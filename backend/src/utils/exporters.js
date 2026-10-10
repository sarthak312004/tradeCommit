import { Parser } from "@json2csv/plainjs";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import archiver from "archiver";

/* ------------------------------------------------------------------ shared */

const number = (value, digits = 2) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

/** "INR 1,234.50" / "-INR 80.00". Currency codes (not symbols) so every PDF font can draw them. */
const money = (value, currency, { signed = false } = {}) => {
  if (value === null || value === undefined || value === "") return "-";
  const sign = value < 0 ? "-" : signed && value > 0 ? "+" : "";
  return `${sign}${currency} ${number(Math.abs(value))}`;
};

const percent = (value) => (value === null || value === undefined ? "-" : `${Math.round(value * 100)}%`);

const summaryItems = (data) => {
  const { summary: s, journal } = data;
  return [
    ["Trades", String(s.totalTrades)],
    ["Closed / open", `${s.closedTrades} / ${s.openTrades}`],
    ["Win rate", percent(s.winRate)],
    ["Net P&L", money(s.netPnl, journal.currency, { signed: true })],
    ["Gross profit", money(s.grossProfit, journal.currency)],
    ["Gross loss", money(s.grossLoss ? -s.grossLoss : s.grossLoss, journal.currency)],
    ["Profit factor", s.profitFactor === null ? "-" : String(s.profitFactor)],
    ["Average R", s.averageR === null ? "-" : `${s.averageR}R`],
    ["Best trade", money(s.bestTrade, journal.currency, { signed: true })],
    ["Worst trade", money(s.worstTrade, journal.currency, { signed: true })],
  ];
};

const rangeText = (range) => (range.from || range.to ? `${range.label} (${range.from ?? "start"} to ${range.to ?? "today"})` : range.label);

/* --------------------------------------------------------------------- JSON */

export const buildJson = (data) => {
  const { columns: _columns, rows: _rows, ...rest } = data;
  return Buffer.from(JSON.stringify(rest, null, 2), "utf8");
};

/* ---------------------------------------------------------------------- CSV */

// A cell that starts with = + - @ is run as a formula by Excel / Sheets; a leading apostrophe keeps it as text.
const defuse = (value) => (typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

export const buildCsv = (data) => {
  const parser = new Parser({
    fields: data.columns.map((column) => ({
      label: column.header,
      value: (row) => defuse(row[column.header]),
    })),
    eol: "\r\n",
  });
  // BOM so Excel opens the file as UTF-8 instead of guessing a legacy code page
  return Buffer.from(`\ufeff${parser.parse(data.rows)}`, "utf8");
};

/* -------------------------------------------------------------------- Excel */

const EXCEL_CELL_LIMIT = 32000;

export const buildXlsx = async (data) => {
  const { journal, range, columns, rows } = data;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TradeCommit";
  workbook.created = new Date();

  /* ---- Trades sheet ---- */
  const sheet = workbook.addWorksheet("Trades", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map((column) => ({ header: column.header, key: column.header, width: column.width }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF18181B" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;

  rows.forEach((row, index) => {
    const excelRow = sheet.addRow(
      columns.map((column) => {
        const value = row[column.header];
        if (value === "" || value === undefined) return null;
        if (column.type === "date") return new Date(`${value}T00:00:00.000Z`);
        if (typeof value === "string") return value.slice(0, EXCEL_CELL_LIMIT);
        return value;
      })
    );
    excelRow.alignment = { vertical: "top" };

    columns.forEach((column, columnIndex) => {
      const cell = excelRow.getCell(columnIndex + 1);
      if (column.type === "date") cell.numFmt = "yyyy-mm-dd";
      if (column.type === "money") {
        cell.numFmt = "#,##0.00;[Red]-#,##0.00";
        if (typeof cell.value === "number") cell.font = { bold: true, color: { argb: cell.value >= 0 ? "FF15803D" : "FFB91C1C" } };
      }
      if (column.type === "r") cell.numFmt = '0.00"R"';
      if (column.type === "long") cell.alignment = { vertical: "top", wrapText: true };
    });
    if (index % 2 === 1) excelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F5" } };
  });

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  /* ---- Summary sheet ---- */
  const info = workbook.addWorksheet("Summary");
  info.columns = [{ width: 24 }, { width: 70 }];
  const put = (label, value, { bold = false } = {}) => {
    const row = info.addRow([label, value]);
    row.getCell(1).font = { bold: true, color: { argb: "FF52525B" } };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    row.getCell(1).alignment = { vertical: "top" };
    if (bold) row.getCell(2).font = { bold: true, size: 14 };
    return row;
  };

  put("Journal", journal.name, { bold: true });
  put("Currency", journal.currency);
  put("Range", rangeText(range));
  put("Exported", new Date(data.generatedAt).toUTCString());
  if (journal.description) put("Description", journal.description);
  info.addRow([]);
  for (const [label, value] of summaryItems(data)) put(label, value);
  if (journal.strategy) {
    info.addRow([]);
    put("Strategy", journal.strategy.slice(0, EXCEL_CELL_LIMIT));
  }
  if (journal.defaultProperties.length) {
    info.addRow([]);
    put("Default properties", journal.defaultProperties.map((property) => property.label).join(", "));
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
};

/* ---------------------------------------------------------------------- PDF */

// pdfkit's built-in fonts only draw Latin-1 (+ a few punctuation marks). Anything else would print as garbage.
const pdfSafe = (text) => String(text ?? "").replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF•–—‘’“”…€]/g, "?");

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);

const PDF = { margin: 40, ink: "#18181B", muted: "#52525B", faint: "#A1A1AA", rule: "#E4E4E7", win: "#15803D", loss: "#B91C1C", link: "#0369A1" };
const MAX_ANALYSIS_CHARS = 3500;
const MAX_STRATEGY_CHARS = 4000;
const MAX_LINKS = 8;

export const buildPdf = (data) =>
  new Promise((resolve, reject) => {
    const { journal, range, trades } = data;
    const doc = new PDFDocument({
      size: "A4",
      margin: PDF.margin,
      bufferPages: true,
      info: { Title: `${journal.name} - trade journal`, Author: "TradeCommit", Subject: rangeText(range) },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = PDF.margin;
    const width = doc.page.width - PDF.margin * 2;
    const bottom = () => doc.page.height - PDF.margin - 12;
    const ensureSpace = (height) => {
      if (doc.y + height > bottom()) doc.addPage();
    };
    const rule = () => {
      doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.5).strokeColor(PDF.rule).stroke();
    };

    /* title */
    doc.font("Helvetica-Bold").fontSize(20).fillColor(PDF.ink).text(pdfSafe(journal.name), left, PDF.margin, { width });
    doc.font("Helvetica").fontSize(9.5).fillColor(PDF.muted).text(pdfSafe(`Trade journal export  |  ${rangeText(range)}  |  ${journal.currency}`), left, doc.y + 2, { width });
    doc.fontSize(9).fillColor(PDF.faint).text(`Generated ${new Date(data.generatedAt).toUTCString()}`, left, doc.y + 1, { width });
    if (journal.description) doc.fontSize(9.5).fillColor(PDF.muted).text(pdfSafe(journal.description), left, doc.y + 6, { width });

    /* summary tiles (5 per row) */
    doc.moveDown(1);
    const tileTop = doc.y;
    const columnsPerRow = 5;
    const tileWidth = width / columnsPerRow;
    const items = summaryItems(data);
    items.forEach(([label, value], index) => {
      const x = left + (index % columnsPerRow) * tileWidth;
      const y = tileTop + Math.floor(index / columnsPerRow) * 38;
      doc.font("Helvetica").fontSize(8).fillColor(PDF.muted).text(label.toUpperCase(), x, y, { width: tileWidth - 6, lineBreak: false });
      const tone = label === "Net P&L" ? (data.summary.netPnl < 0 ? PDF.loss : data.summary.netPnl > 0 ? PDF.win : PDF.ink) : PDF.ink;
      doc.font("Helvetica-Bold").fontSize(11).fillColor(tone).text(pdfSafe(value), x, y + 12, { width: tileWidth - 6, lineBreak: false });
    });
    doc.y = tileTop + Math.ceil(items.length / columnsPerRow) * 38 + 4;
    rule();

    /* strategy */
    if (journal.strategy) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(PDF.ink).text("Strategy", left, doc.y, { width });
      doc.font("Helvetica").fontSize(9.5).fillColor(PDF.muted).text(pdfSafe(truncate(journal.strategy, MAX_STRATEGY_CHARS)), left, doc.y + 3, { width, lineGap: 2 });
      doc.moveDown(0.6);
      rule();
    }

    /* trades */
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(PDF.ink).text(`Trades (${trades.length})`, left, doc.y, { width });
    doc.moveDown(0.5);

    if (!trades.length) {
      doc.font("Helvetica").fontSize(10).fillColor(PDF.muted).text("No trades in this range.", left, doc.y, { width });
    }

    trades.forEach((trade, index) => {
      ensureSpace(70);
      const top = doc.y;
      const pnlColor = trade.pnl === null ? PDF.muted : trade.pnl >= 0 ? PDF.win : PDF.loss;

      doc.font("Helvetica-Bold").fontSize(11).fillColor(PDF.ink)
        .text(pdfSafe(`${trade.date}   ${trade.asset}   ${trade.direction.toUpperCase()}`), left, top, { width: width * 0.62, lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(11).fillColor(pnlColor)
        .text(trade.pnl === null ? "OPEN" : money(trade.pnl, journal.currency, { signed: true }), left, top, { width, align: "right", lineBreak: false });
      doc.y = top + 16;

      const meta = [
        `Qty ${number(trade.quantity, trade.quantity % 1 ? 4 : 0)}`,
        `Entry ${trade.entryPrice ?? "-"}`,
        `Exit ${trade.exitPrice ?? "-"}`,
        `Stop ${trade.stopLoss ?? "-"}`,
        trade.rMultiple === null ? null : `${trade.rMultiple}R`,
      ].filter(Boolean).join("   |   ");
      doc.font("Helvetica").fontSize(9).fillColor(PDF.muted).text(meta, left, doc.y, { width });

      const custom = trade.customFields
        .map((field) => {
          const value = field.type === "checkbox" ? (field.value ? "Yes" : "No") : field.value;
          return value === null || value === undefined || value === "" ? null : `${field.label}: ${value}`;
        })
        .filter(Boolean);
      if (custom.length) doc.fillColor(PDF.muted).text(pdfSafe(custom.join("   |   ")), left, doc.y + 1, { width });

      if (trade.analysis) {
        doc.font("Helvetica").fontSize(9.5).fillColor(PDF.ink)
          .text(pdfSafe(truncate(trade.analysis, MAX_ANALYSIS_CHARS)), left, doc.y + 5, { width, lineGap: 2 });
        if (trade.analysis.length > MAX_ANALYSIS_CHARS) {
          doc.fontSize(8).fillColor(PDF.faint).text("Analysis shortened. The full text is in the Excel, CSV and JSON exports.", left, doc.y + 2, { width });
        }
      }

      if (trade.images.length) {
        doc.font("Helvetica").fontSize(8.5).fillColor(PDF.faint).text(`${trade.images.length} screenshot${trade.images.length === 1 ? "" : "s"}:`, left, doc.y + 4, { width });
        trade.images.slice(0, MAX_LINKS).forEach((url, imageIndex) => {
          doc.fillColor(PDF.link).text(`Screenshot ${imageIndex + 1}`, left, doc.y, { width, link: url, underline: true });
        });
        if (trade.images.length > MAX_LINKS) doc.fillColor(PDF.faint).text(`+ ${trade.images.length - MAX_LINKS} more (see the JSON export)`, left, doc.y, { width });
      }

      doc.moveDown(0.6);
      if (index < trades.length - 1) {
        rule();
        doc.moveDown(0.6);
      }
    });

    /* page numbers: drawn last, with the bottom margin lifted so pdfkit does not open a new page for them */
    const range_ = doc.bufferedPageRange();
    for (let page = 0; page < range_.count; page += 1) {
      doc.switchToPage(range_.start + page);
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font("Helvetica").fontSize(8).fillColor(PDF.faint)
        .text(`${pdfSafe(journal.name)}  |  Page ${page + 1} of ${range_.count}`, left, doc.page.height - 28, { width, align: "center", lineBreak: false });
      doc.page.margins.bottom = savedBottom;
    }

    doc.end();
  });

/* ---------------------------------------------------------------------- ZIP */

/** Streams a ZIP of ready-made files `[{ name, buffer }]` into `res`. */
export const streamZip = (res, files) =>
  new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", reject);
    res.on("close", resolve);
    archive.pipe(res);
    for (const file of files) archive.append(file.buffer, { name: file.name });
    archive.finalize().catch(reject);
  });
