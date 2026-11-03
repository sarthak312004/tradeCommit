import { requestJson } from '../utils/http'

const BASE = '/api/v1/billing'

// Every call is for the signed-in user only: the server reads the account from the session and the payment
// provider's ids from our own database, so nothing here sends an id, price or plan.
// Each resolves to the plan state: { plan, status, accessUntil, cancelAtPeriodEnd, interval }.
export const billingApi = {
  status: () => requestJson(`${BASE}/status`, { cache: 'no-store' }),
  cancel: () => requestJson(`${BASE}/cancel`, { method: 'POST', body: {} }),
  resume: () => requestJson(`${BASE}/resume`, { method: 'POST', body: {} }),
  sync: () => requestJson(`${BASE}/sync`, { method: 'POST', body: {} }),
  /** Resolves to { url }: the payment provider's customer portal (payment method, invoices, history). */
  portal: () => requestJson(`${BASE}/portal`, { method: 'POST', body: {} }),
}
