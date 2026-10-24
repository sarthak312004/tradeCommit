import mongoose from "mongoose";
import { Journal } from "../models/journal.models.js";
import { Trade } from "../models/trade.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { applyContextToFields } from "../utils/customFields.js";
import { getMentorProgress, recordNewTrade, tradeFingerprint } from "../utils/mentorProgress.js";
import {
  MAX_IMPORT_TRADES,
  TEMPLATE_HEADER,
  TEMPLATE_ROWS,
  buildPreview,
  inspectImportMapping,
  readRows,
  sanitizeImportTrade,
} from "../utils/tradeImport.js";

const MAX_GROUPS = 20;

/**
 * POST /api/v1/imports/preview  (multipart, field "file")
 * Reads a CSV / XLSX trade log and returns the trades found, tagged intraday / delivery. Nothing is saved.
 */
export const previewImport = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "Choose a .csv or .xlsx file to import");

  const rows = await readRows(req.file.buffer, req.file.originalname);
  const mappingInfo = inspectImportMapping(rows);
  let mapping = null;
  if (typeof req.body?.mapping === "string") {
    try {
      mapping = JSON.parse(req.body.mapping);
    } catch {
      throw new ApiError(400, "Column mapping is invalid. Please map the columns again.");
    }
  }

  if (!mapping) {
    if (mappingInfo.headerIndex < 0 || mappingInfo.detectedHeader === false) {
      return res.status(200).json(new ApiResponse(200, {
        mappingRequired: true,
        fileName: req.file.originalname,
        ...mappingInfo,
      }, "Map the file columns to continue"));
    }
    const guessedHeader = mappingInfo.candidates.find((candidate) => candidate.index === mappingInfo.headerIndex);
    const hasRequiredColumns = ["date", "symbol", "quantity"].every((role) => guessedHeader?.mapping?.[role] !== undefined);
    const hasPriceColumn = ["entry", "price"].some((role) => guessedHeader?.mapping?.[role] !== undefined);

    if (!hasRequiredColumns || !hasPriceColumn) {
      return res.status(200).json(new ApiResponse(200, {
        mappingRequired: true,
        fileName: req.file.originalname,
        ...mappingInfo,
      }, "Map the file columns to continue"));
    }
  }

  let preview;
  try {
    preview = buildPreview(rows, { mapping });
  } catch (error) {
    if (!mapping && error.statusCode === 400 && /header row|needs a "(Date|Symbol|Quantity)" column|needs a price column|No trades could be read|No trades were found/i.test(error.message)) {
      return res.status(200).json(new ApiResponse(200, {
        mappingRequired: true,
        fileName: req.file.originalname,
        ...mappingInfo,
      }, "Map the file columns to continue"));
    }
    throw error;
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { fileName: req.file.originalname, ...preview, mappingInfo }, "File read successfully"));
});

/**
 * POST /api/v1/imports/commit
 * body: { groups: [{ journalId, trades: [reviewed trade, ...] }, ...] }
 * Saves the trades the person selected, each group into its own journal. Every trade is validated again here, trades
 * already in the journal (same asset, day, direction, entry and size) are skipped so a file can be imported twice safely.
 */
export const commitImport = asyncHandler(async (req, res) => {
  const groups = req.body?.groups;
  if (!Array.isArray(groups) || groups.length === 0) throw new ApiError(400, "Select at least one trade to import");
  if (groups.length > MAX_GROUPS) throw new ApiError(400, `Trades can be split across up to ${MAX_GROUPS} journals at once`);

  // one entry per journal, even if the client sent the same journal twice
  const byJournal = new Map();
  for (const group of groups) {
    const journalId = String(group?.journalId ?? "");
    if (!mongoose.isValidObjectId(journalId)) throw new ApiError(400, "A valid journal ID is required");
    if (!Array.isArray(group?.trades)) throw new ApiError(400, "Each journal needs a list of trades");
    byJournal.set(journalId, [...(byJournal.get(journalId) ?? []), ...group.trades]);
  }

  const total = [...byJournal.values()].reduce((sum, trades) => sum + trades.length, 0);
  if (total === 0) throw new ApiError(400, "Select at least one trade to import");
  if (total > MAX_IMPORT_TRADES) throw new ApiError(400, `You can import up to ${MAX_IMPORT_TRADES} trades at a time`);

  const journals = await Journal.find({ _id: { $in: [...byJournal.keys()] }, owner: req.user._id });
  if (journals.length !== byJournal.size) throw new ApiError(404, "Journal not found");

  // validate everything before saving anything, so a bad row never leaves a half-imported file
  const prepared = journals.map((journal) => {
    const attributes = (journal.context?.attributes ?? []).map(({ key, label, type, value }) => ({ key, label, type, value }));
    const trades = byJournal.get(String(journal._id)).map((raw, index) => sanitizeImportTrade(raw, index, attributes));
    return { journal, attributes, trades };
  });

  // make sure the unlock progress row exists first: it is seeded from the trades already saved, and must not
  // swallow this file's trades (that would skip the "feedback is ready" moment for someone importing their first file)
  try {
    await getMentorProgress(req.user._id);
  } catch (error) {
    console.error("mentor progress seed failed", error);
  }

  const results = [];
  const created = [];

  for (const { journal, attributes, trades } of prepared) {
    const times = trades.map((trade) => trade.date.getTime());
    const existing = await Trade.find({
      journal: journal._id,
      owner: req.user._id,
      date: { $gte: new Date(Math.min(...times)), $lte: new Date(Math.max(...times)) },
    })
      .select("assetName date direction entryPrice quantity")
      .lean();
    const known = new Set(existing.map(tradeFingerprint));

    const fresh = trades.filter((trade) => !known.has(tradeFingerprint(trade)));
    const docs = fresh.map((trade) => ({
      ...trade,
      // same defaults a trade logged in the form would start with (the journal's default properties)
      customFields: applyContextToFields(trade.customFields, attributes).fields,
      owner: req.user._id,
      journal: journal._id,
    }));

    const inserted = docs.length > 0 ? await Trade.insertMany(docs) : [];
    created.push(...inserted.map((doc, index) => ({ id: doc._id, parsed: fresh[index] })));
    results.push({
      journalId: String(journal._id),
      imported: inserted.length,
      duplicates: trades.length - fresh.length,
    });
  }

  // imported trades count towards unlocking the AI mentor like any other new trade (distinct ones only)
  try {
    for (const { id, parsed } of created) {
      const progress = await recordNewTrade(req.user._id, parsed, id);
      if (progress.completed) break;
    }
  } catch (error) {
    console.error("mentor progress update failed", error);
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        imported: results.reduce((sum, item) => sum + item.imported, 0),
        duplicates: results.reduce((sum, item) => sum + item.duplicates, 0),
        journals: results,
      },
      "Trades imported successfully"
    )
  );
});

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** GET /api/v1/imports/template?format=csv|xlsx: a small sample file in the shape the importer reads best. */
export const downloadImportTemplate = asyncHandler(async (req, res) => {
  if (req.query.format === "xlsx") {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Trades");
    sheet.addRow(TEMPLATE_HEADER).font = { bold: true };
    TEMPLATE_ROWS.forEach((row) => sheet.addRow(row));
    sheet.columns.forEach((column, index) => {
      column.width = index === TEMPLATE_HEADER.length - 1 ? 40 : 14;
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="tradecommit-import-template.xlsx"');
    await workbook.xlsx.write(res);
    return res.end();
  }

  const csv = [TEMPLATE_HEADER, ...TEMPLATE_ROWS].map((row) => row.map(csvCell).join(",")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="tradecommit-import-template.csv"');
  return res.send(`\uFEFF${csv}\r\n`);
});
