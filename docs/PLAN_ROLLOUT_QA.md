# Free / Pro rollout: manual QA and go-live

## Manual QA matrix

Run each row with a dedicated test account and verify the profile's `plan`, `planState`, and `entitlements` before exercising the UI. Import limits apply per commit; the Free export window is the last 30 days. AI weekly quota remains shared with the existing quota guard and still requires at least five eligible trades.

| Account state | Journals / planners | Import | Export | Weekly AI | Date-range AI | Carry-forward | Analytics | Billing page |
|---|---|---|---|---|---|---|---|---|
| Free | First journal/planner writable; extras blocked at creation | 50 accepted, 51 rejected | Only last 30 days | One per rolling 7 days; 5-trade minimum | Blocked | Available | Basic metrics/equity curve only | Upgrade/pricing shown |
| Active | All writable | Existing import limits | Unlimited range | 1/day and 3/rolling 7 days shared | Available | Available | Full | Active subscription + portal |
| Cancelling, before period end | All writable | Existing limits | Unlimited | Shared Pro caps | Available | Available | Full | Shows cancellation and access end date |
| Cancelling, after period end but inside grace | All writable while grace remains | Existing limits | Unlimited | Shared Pro caps | Available | Available | Full | Shows cancellation / grace state |
| Cancelling, after grace | Free limits; over-limit resources read-only | 50 cap | 30 days | Free weekly cap | Blocked | Available | Basic | Expired/free state + upgrade |
| Past due, inside 3-day grace | All writable | Existing limits | Unlimited | Shared Pro caps | Available | Available | Full | Past-due notice / portal |
| Past due, outside grace | Free limits; extras read-only | 50 cap | 30 days | Free weekly cap | Blocked | Available | Basic | Past-due / expired access state |
| Expired | Free limits; extras read-only | 50 cap | 30 days | Free weekly cap | Blocked | Available | Basic | Upgrade/pricing shown |
| Refund confirmed | Access revoked by verified refund event; Free behavior | 50 cap | 30 days | Free weekly cap | Blocked | Available | Basic | Free/expired state |
| Legacy grandfathered, before expiry | All Pro capabilities while `legacyProUntil` is future | Existing limits | Unlimited | Shared Pro caps | Available | Available | Full | Pro free-until banner/date |
| Legacy grandfathered, after expiry | Free limits; extras read-only | 50 cap | 30 days | Free weekly cap | Blocked | Available | Basic | Upgrade/pricing shown |
| Existing over-limit Free user | Oldest journal and planner writable; later ones readable/exportable but edit/delete/create-trade/create-plan blocked with `readonly_journal` / `readonly_planner` | 50 cap | 30 days | Free weekly cap | Blocked | Available | Basic | Upgrade/pricing shown |

For the over-limit case, also verify that journal trades and planner entries remain visible, export remains available, and direct API calls cannot mutate locked resources. Verify the exact response is HTTP 403 with `{ code: "PLAN_LIMIT", feature: "readonly_journal" }` or `{ code: "PLAN_LIMIT", feature: "readonly_planner" }`.

## Verification status

Nothing below is marked passed. "Code-read" = traced in source; "Unit" = automated test exists; "Manual" = still must be run on a real account (all rows in the matrix above are Manual and unchecked).

| Area | Code-read | Unit | Manual |
|---|---|---|---|
| Plan resolution (Free/Active/Cancelling/Past due/Expired/Refund/Legacy, 3-day grace) | Yes | `entitlements.test.js`, `billingEvents.test.js` | Pending |
| Read-only guard helpers (oldest writable, exact `PLAN_LIMIT` + feature) | Yes | `readOnlyResources.test.js` | Pending |
| Journal, trade, trade-image, planner, plan-entry, plan-image and **import commit** endpoints call the guard | Yes | No controller tests (needs MongoDB) | Pending: run the API test below |
| Reconciliation never writes `billingLastEventAt`; webhook/cancel/resume landing mid-run wins; provider failure writes nothing | Yes | `billingReconcile.test.js` | Pending (test-mode Dodo only) |
| Grandfathering dry-run default, 60 days, no re-grant, concurrent-safe filter | Yes | No (script needs MongoDB) | Pending: dry-run on a DB copy |
| Frontend: banner, disabled add/edit/delete/context/import (journal); new plan, save, delete, journal link (planner) | Yes | No frontend tests | Pending |

### Direct API mutation test (locked journal / planner)

Use an account with 2+ journals and 2+ planners on Free (`PLAN_ENFORCEMENT=all`, or a post-cutoff account under `new`). Take the cookie from a logged-in browser session; `L*` = a locked (not the oldest) resource id from `GET /api/v1/journals` / `GET /api/v1/planners` where `readOnly` is `true`.

```
H='-H Content-Type:application/json -b "accessToken=<cookie>"'
B=https://<host>/api/v1
PATCH  $B/journals/$LJ            {"name":"x"}
DELETE $B/journals/$LJ
POST   $B/journals/$LJ/trades     {"assetName":"X","quantity":1,"entry":1,"direction":"long","date":"2026-01-01"}
PATCH  $B/journals/$LJ/trades/$T  (same body)      DELETE $B/journals/$LJ/trades/$T
POST   $B/journals/$LJ/trades/images   (multipart image)
POST   $B/imports/commit          {"groups":[{"journalId":"$LJ","trades":[<one reviewed trade>]}]}
PATCH  $B/planners/$LP            {"name":"x"}       DELETE $B/planners/$LP
POST   $B/planners/$LP/entries    {"title":"t","date":"2026-01-05","content":"c"}
PATCH  $B/planners/$LP/entries/$E (same body)        DELETE $B/planners/$LP/entries/$E
POST   $B/planners/$LP/entries/images  (multipart image)
```

Expected for every call: HTTP 403, `code: "PLAN_LIMIT"`, `feature: "readonly_journal"` (journal/trade/import) or `"readonly_planner"` (planner/entries); the database is unchanged. Also confirm: the same calls on the oldest journal/planner succeed; `GET` of locked trades/entries and the exports still return 200; another user's resource id returns 404 (never trust ids from the body); a client-supplied `owner`/`userId` is ignored.

## Go-live checklist

- [ ] Deploy first with `PLAN_ENFORCEMENT=off`; verify profile, journal/planner CRUD, AI, import/export, and billing pages behave as before.
- [ ] Configure Dodo **live-mode** API key and webhook signing secret in the backend environment only.
- [ ] Confirm the two live Pro products are configured and their ids are set in `DODO_PRODUCT_PRO_MONTHLY` and `DODO_PRODUCT_PRO_YEARLY`.
- [ ] Create a separate live webhook endpoint (do not reuse the test endpoint); set its signing secret as `DODO_PAYMENTS_WEBHOOK_KEY` and subscribe to the subscription/payment/refund events handled by the integration.
- [ ] Confirm `DODO_ENV=live_mode` and `APP_URL` points to the production app.
- [ ] Confirm Atlas automated backups / point-in-time recovery are enabled and a restore procedure is known.
- [ ] Verify rich-text sanitization on journal context, trade analysis, and planner content before public launch.
- [ ] Link current Terms, Privacy, and Refund Policy pages from the app and ensure the Dodo checkout/legal review requirements are met.
- [ ] Configure a monitored support email and verify billing/support messages reach it.
- [ ] Run `npm run grandfather-users` from `backend/` and inspect the dry-run counts. Confirm `PLAN_ENFORCEMENT_FROM` is correct.
- [ ] Run `npm run grandfather-users:apply` once; reruns are idempotent and must not extend existing grants.
- [ ] Schedule `npm run billing:reconcile` as a nightly Render Cron Job using the same backend environment and database. Review only aggregate counts; never log provider payloads or ids.
- [ ] After verification, set `PLAN_ENFORCEMENT=new` and monitor limits, support, billing webhooks, and reconciliation.
- [ ] After the agreed grace period and QA sign-off, set `PLAN_ENFORCEMENT=all`.
- [ ] Rollback: set `PLAN_ENFORCEMENT=off` and redeploy/restart. This restores Pro entitlements without changing or deleting stored data.

## Script safety

- `backend/scripts/grandfather-users.js` is dry-run unless `--apply` is passed. It requires `PLAN_ENFORCEMENT_FROM`, only considers users created before that cutoff, skips users with current billing/access, and never replaces an existing legacy grant.
- `backend/scripts/reconcile-billing.js` only reads subscription ids from persisted User records and retrieves each subscription from Dodo. It updates the same billing state fields as the sync/webhook path, but never writes `billingLastEventAt` (that field is provider event time, not run time) and only writes if the user's billing fields are unchanged since they were read, so a webhook or in-app cancel/resume that lands meanwhile wins. Provider errors skip that user and write nothing. Run it only as a scheduled backend job with live/test environment variables matching the Dodo key.
