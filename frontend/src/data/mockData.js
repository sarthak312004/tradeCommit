export const journals = [
  { id: 1, name: 'Daily Review', updated: '2h ago', accent: 'bg-sky-500' },
  { id: 2, name: 'Weekly Summary', updated: 'Yesterday', accent: 'bg-violet-500' },
  { id: 3, name: 'Trade Notes', updated: '3 days ago', accent: 'bg-emerald-500' },
]

export const trades = [
  { id: 1, symbol: 'AAPL', side: 'Long', qty: '120', pnl: '+$420', status: 'Closed', date: 'Sep 14' },
  { id: 2, symbol: 'NVDA', side: 'Short', qty: '80', pnl: '-$180', status: 'Closed', date: 'Sep 12' },
  { id: 3, symbol: 'TSLA', side: 'Long', qty: '60', pnl: '+$680', status: 'Open', date: 'Sep 10' },
  { id: 4, symbol: 'META', side: 'Swing', qty: '50', pnl: '+$240', status: 'Closed', date: 'Sep 08' },
  { id: 5, symbol: 'AMD', side: 'Breakout', qty: '90', pnl: '+$310', status: 'Closed', date: 'Sep 04' },
]

export const summary = [
  { label: 'Net P&L', value: '+$1,420', tone: 'text-emerald-600 dark:text-emerald-400' },
  { label: 'Win rate', value: '62%', tone: 'text-sky-600 dark:text-sky-400' },
  { label: 'Avg R', value: '1.8R', tone: 'text-violet-600 dark:text-violet-400' },
]
