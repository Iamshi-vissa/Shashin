import imageCompression from 'browser-image-compression'

export interface PixelArea {
  x: number
  y: number
  width: number
  height: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = src
  })
}

/** Crop `src` to `area` (in source pixels), scaling so the long side is <= maxSide. */
export async function cropImage(src: string, area: PixelArea, maxSide = 1600): Promise<Blob> {
  const img = await loadImage(src)
  const scale = Math.min(1, maxSide / Math.max(area.width, area.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(area.width * scale)
  canvas.height = Math.round(area.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Crop failed'))), 'image/jpeg', 0.92),
  )
}

/** Compress to a JPEG of about `maxKB`, long side <= maxSide. */
export async function compressImage(blob: Blob, maxKB = 400, maxSide = 1600): Promise<Blob> {
  const file = new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' })
  return imageCompression(file, {
    maxSizeMB: maxKB / 1024,
    maxWidthOrHeight: maxSide,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
    useWebWorker: true,
  })
}

/** Square avatar: center crop + compress. */
export async function squareAvatar(file: File): Promise<Blob> {
  const src = URL.createObjectURL(file)
  try {
    const img = await loadImage(src)
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const area = {
      x: (img.naturalWidth - side) / 2,
      y: (img.naturalHeight - side) / 2,
      width: side,
      height: side,
    }
    return compressImage(await cropImage(src, area, 512), 120, 512)
  } finally {
    URL.revokeObjectURL(src)
  }
}
