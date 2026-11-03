import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/user.models.js';
import { dbConnection } from '../src/db/dbConnection.js';
import { getDodoClient } from '../src/utils/dodoClient.js';
import { BillingEventError } from '../src/utils/billingEvents.js';
import { reconcileUser } from '../src/utils/billingReconcile.js';

const productIntervals = () => {
  const map = {};
  if (process.env.DODO_PRODUCT_PRO_MONTHLY) map[process.env.DODO_PRODUCT_PRO_MONTHLY.trim()] = 'monthly';
  if (process.env.DODO_PRODUCT_PRO_YEARLY) map[process.env.DODO_PRODUCT_PRO_YEARLY.trim()] = 'yearly';
  return map;
};

const main = async () => {
  let examined = 0;
  let changed = 0;
  let unchanged = 0;
  let stale = 0;
  let failed = 0;

  if (!process.env.DODO_PAYMENTS_API_KEY?.trim()) throw new Error('DODO_PAYMENTS_API_KEY is required');
  await dbConnection();
  try {
    const client = await getDodoClient();
    if (!client) throw new Error('Dodo client unavailable');

    const intervals = productIntervals();
    const cursor = User.find({ billingSubscriptionId: { $type: 'string', $ne: '' } })
      .select('+billingSubscriptionId +billingLastEventAt planStatus planAccessUntil planInterval cancelAtPeriodEnd')
      .lean()
      .cursor();

    for await (const user of cursor) {
      examined += 1;
      try {
        // Subscription id comes only from the user's persisted, server-managed billing state.
        // Never writes billingLastEventAt, and only applies if the user's billing fields are unchanged since they were read.
        const outcome = await reconcileUser({ User, client, user, productIntervals: intervals });
        if (outcome === 'changed') changed += 1;
        else if (outcome === 'stale') stale += 1;
        else unchanged += 1;
      } catch (error) {
        failed += 1;
        if (error instanceof BillingEventError) {
          console.error('Billing reconciliation skipped an invalid provider state.');
        }
        // Do not log provider payloads, subscription ids, customer details, or raw errors.
      }
    }

    console.log(JSON.stringify({ mode: 'nightly-reconcile', examined, changed, unchanged, stale, failed }));
  } finally {
    await mongoose.disconnect();
  }
};

main().catch(async (error) => {
  console.error('Billing reconciliation failed:', error?.name ?? 'Error');
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
