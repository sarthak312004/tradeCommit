import test from "node:test"
import assert from "node:assert/strict"
import { parseMarketNewsFeed } from "./marketNews.js"

test("parses RSS headlines, source metadata, escaped text, and safe links", () => {
  const feed = `<?xml version="1.0"?>
    <rss><channel><item>
      <title><![CDATA[Markets &amp; rates &#8212; today's outlook]]></title>
      <description>Stocks &amp; bonds see <b>mixed</b> trading.</description>
      <source url="https://news.example/source">Example News</source>
      <link>https://news.example/story?id=1&amp;ref=rss</link>
      <pubDate>Tue, 27 Oct 2026 10:00:00 GMT</pubDate>
    </item><item>
      <title>Unsafe protocol</title><link>javascript:alert(1)</link>
    </item></channel></rss>`

  assert.deepEqual(parseMarketNewsFeed(feed), [{
    title: "Markets & rates — today's outlook",
    summary: "Stocks & bonds see mixed trading.",
    source: "Example News",
    url: "https://news.example/story?id=1&ref=rss",
    publishedAt: "Tue, 27 Oct 2026 10:00:00 GMT",
  }])
})

test("parses Atom entries and ignores items without a usable link", () => {
  const feed = `<feed><entry>
    <title>Market update</title><summary>Daily summary</summary>
    <link href="https://news.example/atom-story" rel="alternate" />
    <published>2026-10-27T10:00:00Z</published><author><name>Market Desk</name></author>
  </entry><entry><title>No link</title></entry></feed>`

  assert.deepEqual(parseMarketNewsFeed(feed), [{
    title: "Market update",
    summary: "Daily summary",
    source: "Market Desk",
    url: "https://news.example/atom-story",
    publishedAt: "2026-10-27T10:00:00Z",
  }])
})
