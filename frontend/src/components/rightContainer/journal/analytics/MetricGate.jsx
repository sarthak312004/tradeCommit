import { canViewMetric } from '../../../../config/analyticsAccess'

/**
 * The single place the dashboard asks "may this plan see this metric?".
 * Sections wrap themselves in <MetricGate id="...">; the decision lives in config/analyticsAccess.js.
 * Today everything is free, so this renders its children. A future upgrade prompt would be added here once,
 * not in every section.
 */
function MetricGate({ id, children }) {
  return canViewMetric(id) ? children : null
}

export default MetricGate
