import { useCallback, useEffect, useRef, useState } from 'react'
import { isLocalPreview, preloadImage, prepareImage } from '../../../utils/imageUpload'

const isImageFile = (file) => file.type.startsWith('image/')

// inert document: nothing in it loads or runs
const parseHtml = (html) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body

const sourcesOf = (root) => [...root.querySelectorAll('img')].map((image) => image.getAttribute('src') ?? '').filter(Boolean)

/**
 * Screenshot handling for TiptapEditor.
 *
 * A screenshot appears in the editor at once from a local blob: preview; compressing and uploading happen in the
 * background and the preview is swapped for the hosted URL when that finishes. The hook also remembers which hosted
 * screenshots were deleted from the text (so the API can remove them), and builds the "draft" a form saves.
 *
 * @param {Function} getEditor      () => the Tiptap editor (or null)
 * @param {Function} onUploadImage  (file) => Promise<url>
 */
export function useImageUploads({ getEditor, onUploadImage }) {
  const [error, setError] = useState('')
  const uploadRef = useRef(onUploadImage)
  const removedRef = useRef(new Set()) // hosted URLs that were in the text and have been deleted
  const knownRef = useRef(new Set()) // image URLs in the text after the last change
  const inFlightRef = useRef(new Set()) // promises of uploads that are still running
  const uploadedRef = useRef(new Map()) // local preview (or data:) URL -> hosted URL
  const sourceFilesRef = useRef(new Map()) // local preview URL -> original file, so a failed upload can be retried after the form closed
  const submittedRef = useRef(false) // the form handed its content over: previews may still be on screen elsewhere

  useEffect(() => {
    uploadRef.current = onUploadImage
  }, [onUploadImage])

  const currentSources = useCallback(() => {
    const editor = getEditor()
    const sources = []
    editor?.state.doc.descendants((node) => {
      if (node.type.name === 'image' && node.attrs.src) sources.push(node.attrs.src)
    })
    return sources
  }, [getEditor])

  /** Call after the text was replaced from outside: forget what was removed before and start from what is in the text now. */
  const resetImages = useCallback(() => {
    removedRef.current.clear()
    knownRef.current = new Set(currentSources())
  }, [currentSources])

  /** Call after every change of the text: hosted screenshots that disappeared are queued for deletion. */
  const syncImages = useCallback(() => {
    const next = new Set(currentSources())
    for (const url of knownRef.current) {
      if (!next.has(url) && !isLocalPreview(url)) removedRef.current.add(url)
    }
    knownRef.current = next
  }, [currentSources])

  const replacePreview = useCallback((previewUrl, finalUrl) => {
    const editor = getEditor()
    if (!editor || editor.isDestroyed) return // the form already closed; the saved content picks the hosted URL up from uploadedRef
    const { state, view } = editor
    const transaction = state.tr
    let found = false
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'image' && node.attrs.src === previewUrl) {
        transaction.setNodeMarkup(pos, undefined, { ...node.attrs, src: finalUrl })
        found = true
      }
    })
    if (!found) {
      // the screenshot was removed while it uploaded: queue the hosted copy for deletion
      removedRef.current.add(finalUrl)
      return
    }
    transaction.setMeta('addToHistory', false) // undo must never bring back the temporary preview
    view.dispatch(transaction)
  }, [getEditor])

  const removePreview = useCallback((previewUrl) => {
    const editor = getEditor()
    if (!editor || editor.isDestroyed) return
    const { state, view } = editor
    const transaction = state.tr
    const found = []
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'image' && node.attrs.src === previewUrl) found.push({ pos, size: node.nodeSize })
    })
    for (const { pos, size } of found.reverse()) transaction.delete(pos, pos + size)
    if (found.length) view.dispatch(transaction)
  }, [getEditor])

  const trackUpload = useCallback((file, previewUrl) => {
    sourceFilesRef.current.set(previewUrl, file)
    const task = prepareImage(file)
      .then((smallFile) => uploadRef.current(smallFile))
      .then(async (finalUrl) => {
        uploadedRef.current.set(previewUrl, finalUrl)
        await preloadImage(finalUrl) // swap only once the browser has it, so there is no flicker
        replacePreview(previewUrl, finalUrl)
      })
      .catch((uploadError) => {
        removePreview(previewUrl)
        setError(uploadError.message || 'Image upload failed. Please try again.')
      })
      .finally(() => {
        // after saving, a trade card may still show this preview until the hosted copy replaces it
        if (!submittedRef.current) URL.revokeObjectURL(previewUrl)
        inFlightRef.current.delete(task)
      })
    inFlightRef.current.add(task)
  }, [removePreview, replacePreview])

  /** Inserts screenshots at the caret (or at document position `pos`, e.g. where a file was dropped) and uploads them. */
  const addImageFiles = useCallback((files, pos) => {
    const editor = getEditor()
    const images = files.filter(isImageFile)
    if (!editor || editor.isDestroyed || !images.length) return

    setError('')
    const entries = images.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))
    // the empty paragraph after the screenshots is where the caret lands, so writing can simply continue
    const content = [...entries.map(({ previewUrl }) => ({ type: 'image', attrs: { src: previewUrl } })), { type: 'paragraph' }]
    const chain = editor.chain().focus()
    if (typeof pos === 'number') chain.insertContentAt(pos, content)
    else chain.insertContent(content)
    chain.run()
    for (const { file, previewUrl } of entries) trackUpload(file, previewUrl)
  }, [getEditor, trackUpload])

  /**
   * Snapshot of the text for saving. `prepare()` is async: it waits for screenshots that are still uploading and
   * swaps every local preview (and pasted data: image) for its hosted URL. Safe to run again on "Retry":
   * finished uploads are reused, failed ones are uploaded again from the original file.
   */
  const createDraft = useCallback((html) => {
    const images = sourcesOf(parseHtml(html))
    const inFlight = [...inFlightRef.current]
    const removedImages = [...removedRef.current].filter((url) => !images.includes(url) && !isLocalPreview(url))

    const prepare = async () => {
      await Promise.all(inFlight) // these never reject: failures are handled inside trackUpload

      const root = parseHtml(html)
      for (const image of root.querySelectorAll('img')) {
        const source = image.getAttribute('src') ?? ''
        const isPreview = isLocalPreview(source)
        if (!isPreview && !source.startsWith('data:image/')) continue

        let hostedUrl = uploadedRef.current.get(source)
        if (!hostedUrl) {
          // data: images were dropped in without going through the button / paste path
          const file = isPreview
            ? sourceFilesRef.current.get(source)
            : await fetch(source)
                .then((response) => response.blob())
                .then((blob) => new File([blob], `image-${Date.now()}.${blob.type.split('/')[1]?.split('+')[0] || 'png'}`, { type: blob.type }))
          if (!file) {
            image.remove()
            continue
          }
          hostedUrl = await uploadRef.current(await prepareImage(file))
          uploadedRef.current.set(source, hostedUrl)
        }
        image.setAttribute('src', hostedUrl)
      }

      const finalImages = sourcesOf(root)
      return { html: root.innerHTML, images: finalImages, removedImages: removedImages.filter((url) => !finalImages.includes(url)) }
    }

    return { html, images, removedImages, prepare }
  }, [])

  const markSubmitted = useCallback(() => {
    submittedRef.current = true
  }, [])

  return { error, addImageFiles, syncImages, resetImages, createDraft, markSubmitted }
}
