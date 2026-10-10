// Helpers for the journal strategy, which is rich text (HTML) but may still be plain text in older journals.

const ALLOWED = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'H2', 'H3', 'H4', 'BLOCKQUOTE'])
const ALIASES = { DIV: 'P', H1: 'H2', H5: 'H4', H6: 'H4' }

const escapeHtml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const looksLikeHtml = (value) => /<\/?(p|div|br|ul|ol|li|b|strong|i|em|u|h[1-6]|blockquote)\b[^>]*>/i.test(value)

const parse = (html) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body

// copies only the formatting the editor can produce; attributes, scripts and unknown tags are dropped
const copyAllowed = (source, target) => {
  for (const node of source.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      target.appendChild(document.createTextNode(node.textContent))
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = ALIASES[node.tagName] ?? node.tagName
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE'].includes(node.tagName)) continue
      if (ALLOWED.has(tag)) {
        const copy = document.createElement(tag)
        copyAllowed(node, copy)
        target.appendChild(copy)
      } else {
        copyAllowed(node, target) // keep the text of an unknown wrapper, drop the wrapper itself
      }
    }
  }
}

/** Safe HTML for the editor: allow-listed tags only. Plain text (older journals) becomes one paragraph per line. */
export const strategyToHtml = (value) => {
  const text = String(value ?? '')
  if (!text.trim()) return ''
  if (!looksLikeHtml(text)) {
    return text
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join('')
  }
  const clean = document.createElement('div')
  copyAllowed(parse(text), clean)
  return clean.innerHTML
}

/** Number of visible characters (what the length limit counts). */
export const richTextLength = (html) => (html ? parse(html).textContent.trim().length : 0)

/** True when the editor holds no visible text (only empty paragraphs, line breaks or empty list items). */
export const isRichTextEmpty = (html) => !html || richTextLength(html) === 0

/** What gets saved: '' for an empty editor, otherwise the trimmed HTML. */
export const cleanStrategy = (html) => (isRichTextEmpty(html) ? '' : String(html).trim())
