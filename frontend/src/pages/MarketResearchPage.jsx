import { useState } from 'react'
import TopBar from '../components/rightContainer/TopBar'
import ScrollFade from '../components/common/ScrollFade'

const REGIONS = [
  { value: 'ALL', label: 'All regions' },
  { value: 'Global', label: 'Global' },
  { value: 'US', label: 'United States' },
  { value: 'India', label: 'India' },
  { value: 'Europe', label: 'Europe' },
  { value: 'Asia', label: 'Asia-Pacific' },
]

const SOURCES = [
  { region: 'Global', category: 'Financial news', name: 'Reuters Markets', description: 'Global market coverage, company news, currencies, and commodities.', url: 'https://www.reuters.com/markets/' },
  { region: 'Global', category: 'Financial news', name: 'Financial Times Markets', description: 'International markets, asset classes, and economic coverage.', url: 'https://www.ft.com/markets' },
  { region: 'Global', category: 'Current affairs', name: 'Reuters World', description: 'Geopolitics, policy, and global events that can move markets.', url: 'https://www.reuters.com/world/' },
  { region: 'Global', category: 'Current affairs', name: 'Associated Press World', description: 'Independent reporting on major international developments.', url: 'https://apnews.com/world-news' },
  { region: 'Global', category: 'Macro & regimes', name: 'IMF World Economic Outlook', description: 'Global growth forecasts, inflation analysis, and macro scenarios.', url: 'https://www.imf.org/en/Publications/WEO' },
  { region: 'Global', category: 'Macro & regimes', name: 'Cboe VIX', description: 'Volatility index information and market-risk context.', url: 'https://www.cboe.com/tradable_products/vix/' },
  { region: 'Global', category: 'Macro & regimes', name: 'CME FedWatch', description: 'Market-implied probabilities for Federal Reserve rate decisions.', url: 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html' },
  { region: 'US', category: 'Official data & policy', name: 'Federal Reserve', description: 'Monetary policy releases, speeches, and FOMC statements.', url: 'https://www.federalreserve.gov/newsevents.htm' },
  { region: 'US', category: 'Official data & policy', name: 'US Bureau of Labor Statistics', description: 'Employment, inflation, and productivity releases from the source.', url: 'https://www.bls.gov/news.release/' },
  { region: 'US', category: 'Macro & regimes', name: 'FRED Economic Data', description: 'Federal Reserve Bank of St. Louis data for rates, growth, and cycles.', url: 'https://fred.stlouisfed.org/' },
  { region: 'India', category: 'Official data & policy', name: 'Reserve Bank of India', description: 'Monetary policy, liquidity, banking, and regulatory updates.', url: 'https://www.rbi.org.in/' },
  { region: 'India', category: 'Markets', name: 'NSE India', description: 'Official exchange data, indices, market activity, and circulars.', url: 'https://www.nseindia.com/' },
  { region: 'India', category: 'Official data & policy', name: 'SEBI', description: 'Securities-market regulation, circulars, and policy announcements.', url: 'https://www.sebi.gov.in/media/press-releases.html' },
  { region: 'India', category: 'Financial news', name: 'Mint Markets', description: 'Indian markets, business news, and economic developments.', url: 'https://www.livemint.com/market' },
  { region: 'Europe', category: 'Official data & policy', name: 'European Central Bank', description: 'Euro-area monetary policy decisions, speeches, and research.', url: 'https://www.ecb.europa.eu/press/html/index.en.html' },
  { region: 'Europe', category: 'Official data & policy', name: 'Eurostat News', description: 'Official European Union economic and statistical releases.', url: 'https://ec.europa.eu/eurostat/news' },
  { region: 'Europe', category: 'Markets', name: 'Euronext Market Data', description: 'Market information across major European exchanges.', url: 'https://www.euronext.com/en/market-data' },
  { region: 'Asia', category: 'Official data & policy', name: 'Bank of Japan', description: 'Japanese monetary policy, statements, and economic releases.', url: 'https://www.boj.or.jp/en/' },
  { region: 'Asia', category: 'Official data & policy', name: 'China National Bureau of Statistics', description: 'Official China releases for growth, prices, and industrial activity.', url: 'https://www.stats.gov.cn/english/' },
  { region: 'Asia', category: 'Financial news', name: 'Nikkei Asia Markets', description: 'Business and market coverage across Asia-Pacific.', url: 'https://asia.nikkei.com/Markets' },
]

const REGION_DETAILS = {
  ALL: { title: 'All markets', note: 'Browse trusted market, policy, and economic research sources.', tone: 'zinc' },
  Global: { title: 'Global markets', note: 'Cross-market coverage, geopolitical developments, and broad risk indicators.', tone: 'teal' },
  US: { title: 'United States', note: 'US policy, macroeconomic releases, and market-cycle data.', tone: 'blue' },
  India: { title: 'Indian markets', note: 'Indian exchange activity, regulation, and monetary policy.', tone: 'orange' },
  Europe: { title: 'European markets', note: 'Euro-area policy, official economic releases, and exchange data.', tone: 'green' },
  Asia: { title: 'Asia-Pacific markets', note: 'Regional central-bank decisions, economic data, and business coverage.', tone: 'rose' },
}

const TONE_CLASSES = {
  teal: 'border-t-teal-600 group-hover:border-teal-700 dark:border-t-teal-400 dark:group-hover:border-teal-300',
  blue: 'border-t-sky-600 group-hover:border-sky-700 dark:border-t-sky-400 dark:group-hover:border-sky-300',
  orange: 'border-t-orange-600 group-hover:border-orange-700 dark:border-t-orange-400 dark:group-hover:border-orange-300',
  green: 'border-t-emerald-600 group-hover:border-emerald-700 dark:border-t-emerald-400 dark:group-hover:border-emerald-300',
  rose: 'border-t-rose-600 group-hover:border-rose-700 dark:border-t-rose-400 dark:group-hover:border-rose-300',
  zinc: 'border-t-zinc-500 group-hover:border-zinc-700 dark:border-t-zinc-400 dark:group-hover:border-zinc-200',
}

function MarketResearchPage() {
  const [regionFilter, setRegionFilter] = useState('Global')
  const selectedRegion = REGION_DETAILS[regionFilter]
  const visibleSources = SOURCES.filter((source) => regionFilter === 'ALL' || source.region === regionFilter)

  return (
    <>
      <TopBar label="Research desk" title="Market insight" />
      <ScrollFade className="flex min-h-0 flex-1 flex-col" scrollClassName="subtle-scrollbar flex-1 overflow-y-auto p-3 sm:p-6 md:p-8">
        <section aria-labelledby="research-sources-title" className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 border-b border-zinc-300 pb-5 dark:border-white/[0.12] sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase leading-4 tracking-[0.12em] text-zinc-500 dark:text-zinc-400">Market research</p>
              <h2 id="research-sources-title" className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{selectedRegion.title}</h2>
              <p className="mt-1 max-w-xl text-sm leading-5 text-zinc-600 dark:text-zinc-400">{selectedRegion.note}</p>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{visibleSources.length} research sources</p>
          </div>

          <div role="group" aria-label="Select market" className="mt-5 flex max-w-full gap-1 overflow-x-auto border-b border-zinc-300 dark:border-white/[0.12]">
            {REGIONS.map(({ value, label }) => (
              <button key={value} type="button" onClick={() => setRegionFilter(value)} aria-pressed={regionFilter === value} className={`shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${regionFilter === value ? 'border-[#b95b3b] text-zinc-900 dark:border-[#e08a68] dark:text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleSources.map((source) => {
              const tone = REGION_DETAILS[source.region].tone
              return (
                <a key={source.name} href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${source.name} in a new tab`} className={`group relative flex min-h-44 flex-col border border-zinc-300/80 border-t-[3px] bg-white/65 p-5 transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_8px_24px_rgba(24,24,27,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b95b3b] dark:border-white/[0.12] dark:bg-white/[0.025] dark:hover:bg-white/[0.05] dark:hover:shadow-black/20 dark:focus-visible:ring-[#e08a68] ${TONE_CLASSES[tone]}`}>
                  <span className="inline-flex w-fit items-center border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-medium uppercase leading-4 tracking-[0.08em] text-zinc-600 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-zinc-300">{source.category}</span>
                  <span className="mt-4 flex items-start justify-between gap-4 text-base font-semibold leading-6 text-zinc-900 group-hover:text-[#98472f] dark:text-zinc-100 dark:group-hover:text-[#e08a68]">
                    {source.name}
                    <svg viewBox="0 0 20 20" className="mt-1 h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M11 3h6v6M17 3 9 11" /><path d="M15 11v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
                    </svg>
                  </span>
                  <span className="mt-2 text-sm leading-5 text-zinc-600 dark:text-zinc-400">{source.description}</span>
                </a>
              )
            })}
          </div>
        </section>
      </ScrollFade>
    </>
  )
}

export default MarketResearchPage