// Helpers that make screenshot uploads feel instant.
//
// 1. prepareImage()  shrinks big screenshots before they leave the browser. A 3 MB PNG becomes a
//                    ~200 KB WebP, so the upload over Vercel -> Render -> Cloudinary is ~10x smaller.
// 2. preloadImage()  warms the browser cache so swapping a local preview for the hosted URL doesn't flicker.

const MAX_EDGE = 1600 // px, longest side; plenty for reading chart text on a journal card
const SKIP_BELOW_BYTES = 150 * 1024 // small files are already fast, leave them untouched
const SKIP_TYPES = new Set(['image/gif', 'image/svg+xml']) // animated / vector: resizing would break them
const QUALITY = 0.85

/** Returns a smaller File when that helps, otherwise the original file. Never throws. */
export const prepareImage = async (file) => {
  if (!file.type.startsWith('image/') || SKIP_TYPES.has(file.type) || file.size < SKIP_BELOW_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY))
    // some browsers can't encode WebP and silently return a PNG; keep whichever file is smaller
    if (!blob || blob.size >= file.size) return file

    const extension = blob.type.split('/')[1] || 'webp'
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'screenshot'}.${extension}`, { type: blob.type })
  } catch {
    return file
  }
}

/** Resolves once the browser has the image cached (or failed to; never rejects). */
export const preloadImage = (url) =>
  new Promise((resolve) => {
    const probe = new Image()
    probe.onload = probe.onerror = () => resolve()
    probe.src = url
  })

/** blob: URLs are temporary local previews and must never be sent to the API. */
export const isLocalPreview = (url) => typeof url === 'string' && url.startsWith('blob:')
