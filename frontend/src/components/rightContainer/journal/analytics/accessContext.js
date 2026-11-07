import { createContext, useContext } from 'react'

// What the analysis dashboard knows about the user's access, provided once by TradeAnalysis so every MetricGate
// reads the same answer without loading the profile again. Outside a provider it reads as "still loading".
export const AnalyticsAccessContext = createContext({ status: 'loading', entitlements: null, retry: () => {} })

export const useAnalyticsAccess = () => useContext(AnalyticsAccessContext)
