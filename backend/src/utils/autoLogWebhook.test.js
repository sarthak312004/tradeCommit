import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  applyNormalizedAutoLogItems,
  assertAutoLogEntitled,
  canonicalSymbolKey,
  generateWebhookToken,
  normalizeBrokerPayload,
  withJournalLock,
} from "./autoLogWebhook.js";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-06T12:00:00.000Z");

let savedEnforcement;
beforeEach(() => {
  savedEnforcement = process.env.PLAN_ENFORCEMENT;
  process.env.PLAN_ENFORCEMENT = "all";
});
afterEach(() => {
  if (savedEnforcement === undefined) delete process.env.PLAN_ENFORCEMENT;
  else process.env.PLAN_ENFORCEMENT = savedEnforcement;
});

const freeUser = { _id: "u_free", createdAt: new Date(NOW - DAY) };
const proUser = {
  _id: "u_pro",
  planStatus: "active",
  planInterval: "monthly",
  planAccessUntil: new Date(NOW + 10 * DAY),
};

const createFakeTradeModel = (store = []) => ({
  store,
  async create(doc) {
    const record = {
      _id: `t_${store.length + 1}`,
      ...doc,
      async save() {
        return this;
      },
    };
    store.push(record);
    return record;
  },
  findOne(query) {
    return {
      async sort() {
        const regex = query.assetName?.$regex;
        return (
          [...store]
            .reverse()
            .find((t) => t.exitPrice === null && (!regex || regex.test(t.assetName))) ?? null
        );
      },
    };
  },
});

test("assertAutoLogEntitled blocks Free users with 403 PLAN_LIMIT and allows Pro users", () => {
  assert.throws(
    () => assertAutoLogEntitled(freeUser, NOW),
    (err) => err.statusCode === 403 && err.code === "PLAN_LIMIT" && err.feature === "autoLogWebhook"
  );
  assert.doesNotThrow(() => assertAutoLogEntitled(proUser, NOW));
});

test("generateWebhookToken creates a prefixed random token", () => {
  const a = generateWebhookToken();
  const b = generateWebhookToken();
  assert.match(a, /^tcwh_[a-f0-9]{48}$/);
  assert.notEqual(a, b);
});

test("normalizeBrokerPayload parses Indian and Global broker formats and skips intermediate/cancelled statuses", () => {
  // 1. Zerodha Kite postback
  const zerodhaFill = normalizeBrokerPayload(
    {
      order_id: "241106000123",
      tradingsymbol: "NIFTY26NOV24500CE",
      transaction_type: "BUY",
      status: "COMPLETE",
      filled_quantity: 50,
      average_price: 184.5,
      order_timestamp: "2026-11-06 10:15:00",
    },
    "zerodha"
  );
  assert.equal(zerodhaFill.length, 1);
  assert.equal(zerodhaFill[0].source, "zerodha");
  assert.equal(zerodhaFill[0].assetName, "NIFTY26NOV24500CE");
  assert.equal(zerodhaFill[0].side, "BUY");
  assert.equal(zerodhaFill[0].quantity, 50);
  assert.equal(zerodhaFill[0].price, 184.5);
  assert.equal(zerodhaFill[0].externalId, "zerodha:241106000123");

  // Intermediate / non-final statuses are ignored so order postbacks never double-log
  for (const status of ["OPEN", "PENDING", "CANCELLED", "REJECTED", "TRIGGER PENDING", "PARTIALLY_FILLED", "UPDATE"]) {
    assert.equal(
      normalizeBrokerPayload({
        order_id: "241106000124",
        tradingsymbol: "NIFTY26NOV24500CE",
        transaction_type: "BUY",
        status,
        filled_quantity: 25,
        average_price: 184.5,
      }).length,
      0,
      `status ${status} should be ignored`
    );
  }

  // 2. Dhan postback with formatted string numbers
  const dhanFill = normalizeBrokerPayload(
    {
      dhanClientId: "110022",
      orderId: "998877",
      tradingSymbol: "BANKNIFTY",
      transactionType: "SELL",
      orderStatus: "TRADED",
      tradedQuantity: "15",
      tradedPrice: "₹51,320.50",
    },
    "dhan"
  );
  assert.equal(dhanFill.length, 1);
  assert.equal(dhanFill[0].source, "dhan");
  assert.equal(dhanFill[0].side, "SELL");
  assert.equal(dhanFill[0].price, 51320.5);

  // 3. Fyers postback (side -1 = SELL, status 2 = Filled)
  const fyersFill = normalizeBrokerPayload(
    {
      id: "fy_101",
      symbol: "NSE:SBIN-EQ",
      side: -1,
      status: 2,
      filledQty: 100,
      tradedPrice: 825.5,
    },
    "fyers"
  );
  assert.equal(fyersFill.length, 1);
  assert.equal(fyersFill[0].side, "SELL");
  assert.equal(fyersFill[0].quantity, 100);

  // 4. MetaTrader 5 closed round-trip deal
  const mt5Deal = normalizeBrokerPayload(
    {
      ticket: 774411,
      symbol: "XAUUSD",
      dealType: "DEAL_TYPE_BUY",
      lots: 2,
      openPrice: "$2,740.00",
      closePrice: "$2,755.50",
      sl: 2732.0,
    },
    "mt5"
  );
  assert.equal(mt5Deal.length, 1);
  assert.equal(mt5Deal[0].kind, "roundtrip");
  assert.equal(mt5Deal[0].entryPrice, 2740.0);
  assert.equal(mt5Deal[0].exitPrice, 2755.5);
  assert.equal(mt5Deal[0].stopLoss, 2732.0);

  const fractionalFill = normalizeBrokerPayload(
    { symbol: "EURUSD", side: "BUY", quantity: "0.25", price: "1.0800", trade_id: "fx-1" },
    "custom"
  );
  assert.equal(fractionalFill[0].quantity, 0.25);

  const unsafeFill = normalizeBrokerPayload(
    { symbol: "EURUSD", side: "BUY", quantity: "1e20", price: "1.0800", trade_id: "fx-2" },
    "custom"
  );
  assert.equal(unsafeFill.length, 0);
});

test("deduplication works both with explicit order_id AND via deterministic fingerprint when order_id is absent", async () => {
  const FakeTradeModel = createFakeTradeModel();
  const journal = { _id: "j_dedup", owner: proUser._id, autoLog: { processedOrderIds: [] } };

  // TradingView alert payload without an explicit order_id, but with a timestamp
  const tvPayload = {
    ticker: "BTCUSDT",
    action: "BUY",
    contracts: 1,
    price: 68500,
    time: "2026-11-06T10:30:00Z",
  };

  const items1 = normalizeBrokerPayload(tvPayload, "tradingview");
  assert.equal(items1.length, 1);
  assert.ok(items1[0].externalId?.startsWith("tradingview:fp_"));

  const firstRun = await applyNormalizedAutoLogItems({
    journal,
    ownerUser: proUser,
    items: items1,
    TradeModel: FakeTradeModel,
    now: NOW,
  });
  journal.autoLog.processedOrderIds = firstRun.processedOrderIds;
  assert.equal(firstRun.loggedCount, 1);
  assert.equal(FakeTradeModel.store.length, 1);

  // Second delivery of the exact same TradingView alert is skipped as a duplicate
  const secondRun = await applyNormalizedAutoLogItems({
    journal,
    ownerUser: proUser,
    items: normalizeBrokerPayload(tvPayload, "tradingview"),
    TradeModel: FakeTradeModel,
    now: NOW,
  });
  assert.equal(secondRun.loggedCount, 0);
  assert.equal(secondRun.skippedDuplicates, 1);
  assert.equal(FakeTradeModel.store.length, 1);
});

test("newest-first broker tradebooks are sorted chronologically so entry @ 09:30 matches before exit @ 14:30", async () => {
  const FakeTradeModel = createFakeTradeModel();
  const journal = { _id: "j_chrono", owner: proUser._id, autoLog: { processedOrderIds: [] } };

  // Broker API returns newest-first: SELL at 14:30 is index 0, BUY at 09:30 is index 1
  const newestFirstFeed = {
    data: [
      {
        trade_id: "tr_exit",
        tradingsymbol: "RELIANCE",
        transaction_type: "SELL",
        status: "COMPLETE",
        filled_quantity: 20,
        average_price: 1310,
        order_timestamp: "2026-11-06T14:30:00Z",
      },
      {
        trade_id: "tr_entry",
        tradingsymbol: "RELIANCE",
        transaction_type: "BUY",
        status: "COMPLETE",
        filled_quantity: 20,
        average_price: 1280,
        order_timestamp: "2026-11-06T09:30:00Z",
      },
    ],
  };

  const items = normalizeBrokerPayload(newestFirstFeed, "zerodha");
  assert.equal(items.length, 2);
  assert.equal(items[0].side, "BUY");
  assert.equal(items[0].price, 1280);
  assert.equal(items[1].side, "SELL");
  assert.equal(items[1].price, 1310);

  await applyNormalizedAutoLogItems({
    journal,
    ownerUser: proUser,
    items,
    TradeModel: FakeTradeModel,
    now: NOW,
  });

  assert.equal(FakeTradeModel.store.length, 1);
  assert.equal(FakeTradeModel.store[0].direction, "long");
  assert.equal(FakeTradeModel.store[0].entryPrice, 1280);
  assert.equal(FakeTradeModel.store[0].exitPrice, 1310);
});

test("canonical symbol matching pairs NSE:SBIN-EQ entry with SBIN exit, and handles partial exits & reversals", async () => {
  assert.equal(canonicalSymbolKey("NSE:SBIN-EQ"), "SBIN");
  assert.equal(canonicalSymbolKey("sbin"), "SBIN");

  const FakeTradeModel = createFakeTradeModel();
  const journal = { _id: "j_partial", owner: proUser._id, autoLog: { processedOrderIds: [] } };

  // 1. Open BUY 100 NSE:SBIN-EQ @ 800
  const openRes = await applyNormalizedAutoLogItems({
    journal,
    ownerUser: proUser,
    items: normalizeBrokerPayload({
      order_id: "o1",
      symbol: "NSE:SBIN-EQ",
      side: "BUY",
      quantity: 100,
      price: 800,
    }),
    TradeModel: FakeTradeModel,
    now: NOW,
  });
  journal.autoLog.processedOrderIds = openRes.processedOrderIds;
  assert.equal(FakeTradeModel.store.length, 1);

  // 2. Partial exit SELL 40 SBIN @ 820 -> leaves 60 open @ 800, creates a closed trade for 40 @ 820
  const partialRes = await applyNormalizedAutoLogItems({
    journal,
    ownerUser: proUser,
    items: normalizeBrokerPayload({
      order_id: "o2",
      symbol: "SBIN",
      side: "SELL",
      quantity: 40,
      price: 820,
    }),
    TradeModel: FakeTradeModel,
    now: NOW,
  });
  journal.autoLog.processedOrderIds = partialRes.processedOrderIds;
  assert.equal(FakeTradeModel.store.length, 2);
  const openPos = FakeTradeModel.store.find((t) => t.exitPrice === null);
  const closedPart = FakeTradeModel.store.find((t) => t.exitPrice !== null);
  assert.equal(openPos.quantity, 60);
  assert.equal(closedPart.quantity, 40);
  assert.equal(closedPart.exitPrice, 820);

  // 3. Reversal SELL 80 SBIN @ 830 -> closes the remaining 60 @ 830 and opens a new Short 20 @ 830
  await applyNormalizedAutoLogItems({
    journal,
    ownerUser: proUser,
    items: normalizeBrokerPayload({
      order_id: "o3",
      symbol: "SBIN",
      side: "SELL",
      quantity: 80,
      price: 830,
    }),
    TradeModel: FakeTradeModel,
    now: NOW,
  });
  assert.equal(FakeTradeModel.store.length, 3);
  const reversedShort = FakeTradeModel.store[2];
  assert.equal(reversedShort.direction, "short");
  assert.equal(reversedShort.quantity, 20);
  assert.equal(reversedShort.entryPrice, 830);
  assert.equal(reversedShort.exitPrice, null);
});

test("withJournalLock serializes concurrent webhook deliveries so parallel retries never duplicate trades", async () => {
  const FakeTradeModel = createFakeTradeModel();
  const journal = { _id: "j_race", owner: proUser._id, autoLog: { processedOrderIds: [] } };

  const duplicatePayload = {
    order_id: "race_ord_1",
    tradingsymbol: "NIFTY",
    transaction_type: "BUY",
    status: "COMPLETE",
    filled_quantity: 50,
    average_price: 200,
  };

  const deliverWebhook = () =>
    withJournalLock(journal._id, async () => {
      // Simulate async DB read/write delay inside the lock
      await new Promise((r) => setTimeout(r, 15));
      const res = await applyNormalizedAutoLogItems({
        journal,
        ownerUser: proUser,
        items: normalizeBrokerPayload(duplicatePayload, "zerodha"),
        TradeModel: FakeTradeModel,
        now: NOW,
      });
      journal.autoLog.processedOrderIds = res.processedOrderIds;
      return res;
    });

  // Fire 5 identical webhook deliveries in parallel
  const results = await Promise.all([
    deliverWebhook(),
    deliverWebhook(),
    deliverWebhook(),
    deliverWebhook(),
    deliverWebhook(),
  ]);

  const totalLogged = results.reduce((sum, r) => sum + r.loggedCount, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skippedDuplicates, 0);
  assert.equal(totalLogged, 1);
  assert.equal(totalSkipped, 4);
  assert.equal(FakeTradeModel.store.length, 1);
});
