import test from "node:test";
import assert from "node:assert/strict";
import { buildPreview, inspectImportMapping, parseCsv, readRows, sanitizeImportTrade, classifyTrade, kindFromText } from "./tradeImport.js";

const TODAY = "2025-02-01";
const preview = (csv) => buildPreview(parseCsv(csv), { today: TODAY });

test("parseCsv handles quotes, embedded commas/newlines, BOM and semicolons", () => {
  const rows = parseCsv('\uFEFFa;b;c\r\n1;"x;y";"he said ""hi"""\r\n"multi\nline";2;3\r\n');
  assert.deepEqual(rows, [["a", "b", "c"], ["1", "x;y", 'he said "hi"'], ["multi\nline", "2", "3"]]);
});

test("one-row-per-trade file: tags come from exit date, product column or stay unclassified", () => {
  const result = preview([
    "Date,Symbol,Direction,Quantity,Entry Price,Exit Price,Stop Loss,Exit Date,Product,Notes",
    "2025-01-06,RELIANCE,Long,50,1215.5,1238,1204,2025-01-06,MIS,breakout",
    "2025-01-08,TCS,Long,20,4120,4310,4040,2025-01-14,CNC,",
    "2025-01-15,NIFTY,Short,75,23150,,23240,,,still open",
    "2025-01-20,INFY,Long,10,1500,1510,,,,",
  ].join("\n"));
  assert.equal(result.format, "trades");
  assert.equal(result.trades.length, 4);
  const byName = Object.fromEntries(result.trades.map((t) => [t.symbol, t]));
  assert.equal(byName.RELIANCE.kind, "intraday");
  assert.equal(byName.RELIANCE.pnl, 1125);
  assert.equal(byName.TCS.kind, "delivery");
  assert.equal(byName.TCS.exitDate, "2025-01-14");
  assert.equal(byName.NIFTY.kind, "delivery"); // open and carried past its entry day
  assert.equal(byName.NIFTY.exitPrice, null);
  assert.equal(byName.INFY.kind, "unknown");
  assert.equal(byName.RELIANCE.notes, "breakout");
});

test("broker tradebook: fills are paired FIFO, scaled entries merged, leftovers stay open", () => {
  const result = preview([
    "symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time",
    "SBIN,X,2025-01-10,NSE,EQ,EQ,buy,false,10,600,1,1,2025-01-10T09:20:00",
    "SBIN,X,2025-01-10,NSE,EQ,EQ,buy,false,10,610,2,2,2025-01-10T09:40:00",
    "SBIN,X,2025-01-10,NSE,EQ,EQ,sell,false,20,620,3,3,2025-01-10T14:00:00",
    "HDFCBANK,X,2025-01-10,NSE,EQ,EQ,buy,false,5,1700,4,4,2025-01-10T10:00:00",
    "HDFCBANK,X,2025-01-13,NSE,EQ,EQ,sell,false,3,1750,5,5,2025-01-13T10:00:00",
  ].join("\n"));
  assert.equal(result.format, "executions");
  const sbin = result.trades.find((t) => t.symbol === "SBIN");
  assert.equal(sbin.quantity, 20);
  assert.equal(sbin.entryPrice, 605);
  assert.equal(sbin.exitPrice, 620);
  assert.equal(sbin.kind, "intraday");
  const hdfc = result.trades.filter((t) => t.symbol === "HDFCBANK");
  assert.equal(hdfc.length, 2);
  const closed = hdfc.find((t) => t.exitPrice !== null);
  const open = hdfc.find((t) => t.exitPrice === null);
  assert.equal(closed.quantity, 3);
  assert.equal(closed.kind, "delivery");
  assert.equal(open.quantity, 2);
  assert.equal(open.kind, "delivery");
});

test("newest-first tradebook still pairs buy before sell on the same day", () => {
  const result = preview([
    "Date,Symbol,Buy/Sell,Qty,Price",
    "2025-01-11,ABC,SELL,5,110",
    "2025-01-10,ABC,SELL,5,108",
    "2025-01-10,ABC,BUY,5,100",
  ].join("\n"));
  // oldest-first: BUY 5 @100 then SELL 5 @108 (same day) -> intraday long; SELL 5 on the 11th opens a short
  const long = result.trades.find((t) => t.direction === "long");
  assert.equal(long.exitPrice, 108);
  assert.equal(long.kind, "intraday");
  assert.equal(result.trades.find((t) => t.direction === "short").exitPrice, null);
});

test("dates: day-first by default, month-first when the data proves it, names and excel serials", () => {
  const dayFirst = preview("Date,Symbol,Qty,Entry Price\n05/03/2025,A,1,10\n25/03/2025,B,1,10");
  assert.equal(dayFirst.trades.find((t) => t.symbol === "A").date, "2025-03-05");
  const monthFirst = preview("Date,Symbol,Qty,Entry Price\n03/05/2025,A,1,10\n03/25/2025,B,1,10");
  assert.equal(monthFirst.trades.find((t) => t.symbol === "A").date, "2025-03-05");
  const names = preview("Date,Symbol,Qty,Entry Price\n15-Mar-2025,A,1,10\n45732,B,1,10");
  assert.equal(names.trades.find((t) => t.symbol === "A").date, "2025-03-15");
  assert.equal(names.trades.find((t) => t.symbol === "B").date, "2025-03-16"); // Excel serial 45732
});

test("bad rows are skipped with reasons, and a file with none usable is rejected", () => {
  const result = preview("Date,Symbol,Direction,Qty,Entry Price\n2025-01-01,A,Long,1,10\nnonsense,B,Long,1,10\n2025-01-01,C,Long,0,10");
  assert.equal(result.trades.length, 1);
  assert.equal(result.skippedCount, 2);
  assert.throws(() => preview("Date,Symbol,Direction,Qty,Entry Price\nnope,B,Long,1,10"), /No trades could be read/);
  assert.throws(() => preview("foo,bar\n1,2"), /header row/);
});

test("indian number formats and currency symbols are read", () => {
  const result = preview('Date,Symbol,Direction,Qty,Entry Price,Exit Price\n2025-01-01,A,Long,"1,000","₹1,23,456.50","1,25,000"');
  assert.equal(result.trades[0].quantity, 1000);
  assert.equal(result.trades[0].entryPrice, 123456.5);
});

test("sanitizeImportTrade validates, stores the tag as a property and escapes notes", () => {
  const trade = sanitizeImportTrade({ symbol: " TCS ", date: "2025-01-08", direction: "long", quantity: 2, entryPrice: 10, exitPrice: 12, exitDate: "2025-01-10", kind: "delivery", notes: "a<b>" }, 0);
  assert.equal(trade.assetName, "TCS");
  assert.deepEqual(trade.customFields.map((f) => [f.label, f.value]), [["Trade type", "Delivery"], ["Exit date", "2025-01-10"]]);
  assert.equal(trade.analysis, "<p>a&lt;b&gt;</p>");
  assert.throws(() => sanitizeImportTrade({ symbol: "", date: "2025-01-08", direction: "long", quantity: 1, entryPrice: 1 }, 0), /asset name/);
  assert.throws(() => sanitizeImportTrade({ symbol: "A", date: "2025-02-30", direction: "long", quantity: 1, entryPrice: 1 }, 0), /date/);
  const reuse = sanitizeImportTrade({ symbol: "A", date: "2025-01-08", direction: "short", quantity: 1, entryPrice: 1, kind: "intraday" }, 0, [{ key: "abc", label: "trade type", type: "text" }]);
  assert.equal(reuse.customFields[0].key, "abc");
});

test("classification helpers", () => {
  assert.equal(kindFromText("MIS"), "intraday");
  assert.equal(kindFromText("cnc"), "delivery");
  assert.equal(kindFromText("NRML"), null);
  assert.equal(classifyTrade({ date: "2025-01-10", exitDate: null, exitPrice: null, hint: null }, "2025-01-10").kind, "unknown");
});

test("manual column mapping reads unfamiliar trade headers and lets the user choose the header row", () => {
  const rows = parseCsv([
    "My broker export",
    "Deal day,Contract,Position,Units,Average open,Average close,Close day",
    "2025-01-10,NIFTY,long,2,22000,22100,2025-01-10",
  ].join("\n"));
  const inspected = inspectImportMapping(rows);
  assert.equal(inspected.headerIndex, 1);

  const result = buildPreview(rows, {
    today: TODAY,
    mapping: {
      headerIndex: 1,
      columns: { date: 0, symbol: 1, side: 2, quantity: 3, entry: 4, exit: 5, exitDate: 6 },
    },
  });
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].symbol, "NIFTY");
  assert.equal(result.trades[0].entryPrice, 22000);
  assert.equal(result.trades[0].exitPrice, 22100);
});

test("manual column mapping pairs broker fills with unfamiliar headings", () => {
  const rows = parseCsv([
    "Trade date,Instrument,Action,Lot size,Executed at",
    "2025-01-10,ABC,BUY,2,100",
    "2025-01-10,ABC,SELL,2,110",
  ].join("\n"));
  const result = buildPreview(rows, {
    today: TODAY,
    mapping: {
      headerIndex: 0,
      columns: { date: 0, symbol: 1, side: 2, quantity: 3, price: 4 },
    },
  });
  assert.equal(result.format, "executions");
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].pnl, 20);
});

test("broker buy/sell column is recognized from values when its heading is unfamiliar", () => {
  const result = preview([
    "Trade date,Instrument,Unknown action,Qty,Trade price",
    "2025-01-10,ABC,BUY,2,100",
    "2025-01-10,ABC,SELL,2,110",
  ].join("\n"));
  assert.equal(result.format, "executions");
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].pnl, 20);
});

test("XLSX preview keeps every valid row beyond the old 1000-trade cutoff", async () => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Trades");
  sheet.addRow(["Date", "Symbol", "Direction", "Qty", "Entry Price"]);
  for (let index = 0; index < 1001; index += 1) {
    sheet.addRow(["2025-01-10", `STOCK${index}`, "Long", 1, 100]);
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const result = buildPreview(await readRows(buffer, "trades.xlsx"), { today: TODAY });
  assert.equal(result.trades.length, 1001);
  assert.equal(result.trades[1000].symbol, "STOCK1000");
  assert.equal(result.truncated, false);
});

test("headerless files can be imported by mapping column positions without dropping the first trade", () => {
  const rows = parseCsv([
    "2025-01-10,RELIANCE,long,2,100,110",
    "2025-01-11,TCS,short,3,200,190",
  ].join("\n"));
  const inspected = inspectImportMapping(rows);
  assert.ok(inspected.candidates.some((candidate) => candidate.index === -1));
  const result = buildPreview(rows, {
    today: TODAY,
    mapping: { headerIndex: -1, columns: { date: 0, symbol: 1, side: 2, quantity: 3, entry: 4, exit: 5 } },
  });
  assert.equal(result.trades.length, 2);
  assert.equal(result.trades[0].symbol, "RELIANCE");
  assert.equal(result.trades[1].symbol, "TCS");
});

test("a one-row headerless file can be manually mapped as one trade", () => {
  const rows = parseCsv("2025-01-10,RELIANCE,long,2,100,110");
  const result = buildPreview(rows, {
    today: TODAY,
    mapping: { headerIndex: -1, columns: { date: 0, symbol: 1, side: 2, quantity: 3, entry: 4, exit: 5 } },
  });
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].symbol, "RELIANCE");
});

test("unrecognized header rows remain selectable beyond the top ten guesses", () => {
  const rows = parseCsv([
    ...Array.from({ length: 14 }, (_, index) => `metadata ${index},value ${index}`),
    "session day,contract label,position side,units,open rate",
    "2025-01-10,ABC,long,2,100",
  ].join("\n"));
  const inspected = inspectImportMapping(rows);
  assert.ok(inspected.candidates.some((candidate) => candidate.index === 14));
  assert.equal(inspected.detectedHeader, false);
});
