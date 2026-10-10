// Helpers for the journal strategy, which is written in a small rich text editor (bold, italic, headings,
// bullets, numbered lists, quotes). The browser sends HTML, so it is cleaned here before it is stored.

const ALLOWED_TAGS = new Set(["p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "h2", "h3", "h4", "blockquote"]);
// browsers wrap lines in <div> inside contenteditable; store them as paragraphs
const TAG_ALIASES = { div: "p", h1: "h2", h5: "h4", h6: "h4" };
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|svg|math|template)\b[\s\S]*?<\/\1\s*>/gi;

/** Keeps only the formatting tags the editor can produce; every attribute (style, onclick, href...) is removed. */
export const sanitizeRichText = (html) => {
  if (typeof html !== "string") return "";

  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(DROP_WITH_CONTENT, "")
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (tag, rawName) => {
      const name = TAG_ALIASES[rawName.toLowerCase()] ?? rawName.toLowerCase();
      if (!ALLOWED_TAGS.has(name)) return "";
      if (name === "br") return "<br>";
      return tag.startsWith("</") ? `</${name}>` : `<${name}>`;
    })
    // an unmatched "<" that is not a tag (e.g. "a < b" typed as raw text) must not survive as markup
    .replace(/<(?![a-z/])/gi, "&lt;")
    .trim();

  // nothing but empty paragraphs / list items is stored as an empty strategy
  const visibleText = cleaned.replace(/<[^>]*>/g, "").replace(/&nbsp;|\s/g, "");
  return visibleText ? cleaned : "";
};

const decodeEntities = (value) =>
  value
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/**
 * Plain text version that keeps the structure the AI needs to read rules properly:
 * bullets become "- ", numbered lists become "1. 2. 3.", headings and paragraphs stay on their own lines.
 * Older strategies saved as plain text pass through unchanged.
 */
export const htmlToPlainText = (html = "") => {
  const source = String(html ?? "");
  if (!/<[a-z/][^>]*>/i.test(source)) return decodeEntities(source).trim();

  const counters = []; // one entry per open list: null for bullets, a running number for ordered lists
  const output = source.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (tag, rawName) => {
    const name = rawName.toLowerCase();
    const closing = tag.startsWith("</");

    if (name === "ul" || name === "ol") {
      if (closing) counters.pop();
      else counters.push(name === "ol" ? 0 : null);
      return "\n";
    }
    if (name === "li") {
      if (closing) return "";
      const top = counters.length - 1;
      let marker = "- ";
      if (top >= 0 && counters[top] !== null) {
        counters[top] += 1;
        marker = `${counters[top]}. `;
      }
      return `\n${"  ".repeat(Math.max(0, top))}${marker}`;
    }
    if (name === "br") return "\n";
    if (name === "img") return " ";
    if (/^(p|div|blockquote|h[1-6])$/.test(name)) return "\n";
    return "";
  });

  return decodeEntities(output)
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
