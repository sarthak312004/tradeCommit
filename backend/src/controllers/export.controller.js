import mongoose from "mongoose";
import { Journal } from "../models/journal.models.js";
import { Trade } from "../models/trade.models.js";
import { DEFAULT_CURRENCY } from "../constants/currency.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { rangeToDateFilter, resolveExportRange } from "../utils/exportRange.js";
import { buildExportData } from "../utils/exportData.js";
import { buildCsv, buildJson, buildPdf, buildXlsx, streamZip } from "../utils/exporters.js";

const MAX_EXPORT_TRADES = 20000;

const FORMATS = {
  csv: { extension: "csv", mime: "text/csv; charset=utf-8" },
  json: { extension: "json", mime: "application/json; charset=utf-8" },
  xlsx: { extension: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pdf: { extension: "pdf", mime: "application/pdf" },
  zip: { extension: "zip", mime: "application/zip" },
};
// accepted spellings -> canonical format
const FORMAT_ALIASES = { excel: "xlsx", xls: "xlsx", bundle: "zip" };

const slug = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 50) || "journal";

const baseFileName = (journalName, range) => {
  const span = range.preset === "custom" ? `${range.from ?? "start"}_to_${range.to ?? "today"}` : range.preset;
  return `${slug(journalName)}_${span}_${new Date().toISOString().slice(0, 10)}`;
};

const sendFile = (res, { buffer, fileName, mime }) => {
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Length", buffer.length);
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(200).end(buffer);
};

/**
 * GET /api/v1/journals/:journalId/export
 *   ?format=xlsx|csv|json|pdf|zip      (default xlsx)
 *   &range=7d|1m|3m|6m|1y|2y|all|custom (default all)
 *   &from=YYYY-MM-DD&to=YYYY-MM-DD      (custom range; also overrides a preset's dates)
 */
export const exportJournal = asyncHandler(async (req, res) => {
  const { journalId } = req.params;
  if (!mongoose.isValidObjectId(journalId)) throw new ApiError(400, "A valid journal ID is required");

  const requested = String(req.query.format ?? "xlsx").trim().toLowerCase();
  const format = FORMAT_ALIASES[requested] ?? requested;
  if (!FORMATS[format]) throw new ApiError(400, `Unsupported format "${requested}". Use one of: ${Object.keys(FORMATS).join(", ")}`);

  const range = resolveExportRange({ range: req.query.range, from: req.query.from, to: req.query.to });

  const journal = await Journal.findOne({ _id: journalId, owner: req.user._id }).lean();
  if (!journal) throw new ApiError(404, "Journal not found");

  const filter = { journal: journal._id, owner: req.user._id };
  const dateFilter = rangeToDateFilter(range);
  if (dateFilter) filter.date = dateFilter;

  const trades = await Trade.find(filter).sort({ date: 1, createdAt: 1 }).limit(MAX_EXPORT_TRADES).lean();
  const data = buildExportData({ journal, trades, range, defaultCurrency: DEFAULT_CURRENCY });
  const base = baseFileName(journal.journalName, range);

  if (format === "zip") {
    const files = [
      { name: `${base}.xlsx`, buffer: await buildXlsx(data) },
      { name: `${base}.csv`, buffer: buildCsv(data) },
      { name: `${base}.json`, buffer: buildJson(data) },
      { name: `${base}.pdf`, buffer: await buildPdf(data) },
    ];
    const fileName = `${base}.zip`;
    res.setHeader("Content-Type", FORMATS.zip.mime);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      await streamZip(res, files);
    } catch (error) {
      // headers are already sent, so the JSON error handler cannot answer any more: cut the download instead
      res.destroy(error);
    }
    return;
  }

  const builders = {
    csv: () => buildCsv(data),
    json: () => buildJson(data),
    xlsx: () => buildXlsx(data),
    pdf: () => buildPdf(data),
  };

  sendFile(res, {
    buffer: await builders[format](),
    fileName: `${base}.${FORMATS[format].extension}`,
    mime: FORMATS[format].mime,
  });
});
