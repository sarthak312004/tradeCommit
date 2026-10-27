const FEED_SEARCHES = {
  GLOBAL: "global stock markets finance",
  IN: "India stock market finance",
  US: "US stock market finance",
}
const NEWS_CACHE_TTL_MS = 2 * 60 * 1000
const newsCache = new Map()

const decodeXml = (value) => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, code) => decodeCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => decodeCodePoint(Number.parseInt(code, 16)))
  .replace(/\s+/g, " ")
  .trim()

function decodeCodePoint(code) {
  return code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : ""
}

const elementText = (item, tag) => {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"))
  return match ? decodeXml(match[1]) : ""
}

const itemLink = (item) => {
  const link = item.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i)?.[1]
  const href = item.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i)?.[1]
  const value = decodeXml(link ?? href ?? "")
  try {
    const url = new URL(value)
    return ["https:", "http:"].includes(url.protocol) ? url.href : ""
  } catch {
    return ""
  }
}

export const parseMarketNewsFeed = (xml) => {
  const entries = [...xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)]
  return entries
    .map(([_, item]) => ({
      title: elementText(item, "title"),
      summary: elementText(item, "description") || elementText(item, "summary"),
      source: elementText(item, "source") || elementText(item, "author"),
      url: itemLink(item),
      publishedAt: elementText(item, "pubDate") || elementText(item, "published") || elementText(item, "updated"),
    }))
    .filter((entry) => entry.title && entry.url)
    .slice(0, 15)
}

export const fetchMarketNews = async (region) => {
  const cached = newsCache.get(region)
  if (cached && Date.now() - cached.savedAt < NEWS_CACHE_TTL_MS) return cached.items

  const query = encodeURIComponent(FEED_SEARCHES[region])
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-${region === "IN" ? "IN" : "US"}&gl=${region === "IN" ? "IN" : "US"}&ceid=${region === "IN" ? "IN:en" : "US:en"}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TradeCommit/1.0 (market research headlines)" },
    })
    if (!response.ok) throw new Error(`News provider returned ${response.status}`)
    const xml = await response.text()
    const items = parseMarketNewsFeed(xml)
    if (!items.length) throw new Error("News provider returned no headlines")
    newsCache.set(region, { items, savedAt: Date.now() })
    return items
  } finally {
    clearTimeout(timeout)
  }
}
