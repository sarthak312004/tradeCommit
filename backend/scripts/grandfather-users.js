import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/user.models.js';
import { dbConnection } from '../src/db/dbConnection.js';

const apply = process.argv.includes('--apply');
const cutoffRaw = process.env.PLAN_ENFORCEMENT_FROM;
const cutoff = cutoffRaw ? new Date(cutoffRaw) : null;

if (!cutoff || Number.isNaN(cutoff.getTime())) {
  console.error('Set PLAN_ENFORCEMENT_FROM to a valid ISO date before running this script.');
  process.exit(1);
}

const main = async () => {
  let examined = 0;
  let eligible = 0;
  let skippedPaying = 0;
  let skippedAlreadyGrandfathered = 0;
  let applied = 0;
  const now = new Date();

  try {
    await dbConnection();
    const cursor = User.find({ createdAt: { $lte: cutoff } })
      .select('_id createdAt planStatus planAccessUntil legacyProUntil +billingSubscriptionId')
      .lean()
      .cursor();

    for await (const user of cursor) {
      examined += 1;
      if (user.legacyProUntil) {
        skippedAlreadyGrandfathered += 1;
        continue;
      }
      const accessUntil = user.planAccessUntil ? new Date(user.planAccessUntil).getTime() : NaN;
      const hasCurrentBilling = Boolean(user.billingSubscriptionId)
        || ['active', 'cancelling', 'past_due'].includes(user.planStatus)
        || (Number.isFinite(accessUntil) && accessUntil > now.getTime());
      if (hasCurrentBilling) {
        skippedPaying += 1;
        continue;
      }

      eligible += 1;
      if (!apply) continue;
      // Conditional update makes reruns safe and avoids overwriting a concurrent webhook/billing update.
      const result = await User.updateOne(
        {
          _id: user._id,
          legacyProUntil: null,
          billingSubscriptionId: { $in: [null, ''] },
          planStatus: { $nin: ['active', 'cancelling', 'past_due'] },
          $or: [{ planAccessUntil: null }, { planAccessUntil: { $lte: now } }, { planAccessUntil: { $exists: false } }],
        },
        { $set: { legacyProUntil: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) } }
      );
      if ((result.matchedCount ?? result.n ?? 0) > 0) applied += 1;
    }

    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', cutoff: cutoff.toISOString(), examined, eligible, applied, skippedPaying, skippedAlreadyGrandfathered }));
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error('Grandfathering script failed:', error?.name ?? 'Error');
  process.exitCode = 1;
});
