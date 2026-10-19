// Turns a picked picture into a header-sized JPEG blob: wide enough to look sharp, small enough to upload quickly.
const MAX_WIDTH = 1600
const MAX_BYTES = 15 * 1024 * 1024

export async function fileToHeaderImage(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > MAX_BYTES) throw new Error('That image is too large (15 MB max).')

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('That image could not be read.'))
      el.src = url
    })
    const scale = Math.min(1, MAX_WIDTH / img.naturalWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob) throw new Error('That image could not be prepared.')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}
