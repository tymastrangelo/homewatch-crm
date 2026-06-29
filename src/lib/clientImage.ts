// Client-side image helpers. Inspection photos come straight off phones at
// 3–12 MB each; uploading the originals (and many of them) is the #1 cause of
// the "it froze when I added a lot of photos" problem. We downscale + re-encode
// to a web-friendly JPEG before upload, which typically shrinks each photo by
// 10–30× while staying plenty sharp for a report.

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82

export type PreparedImage = { blob: Blob; ext: string }

/**
 * Downscale + compress an image File to a JPEG Blob. Falls back to the original
 * file if the browser can't decode it (e.g. HEIC on some non-Safari browsers)
 * so the upload still works — just larger.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) {
    return { blob: file, ext: file.name.split('.').pop()?.toLowerCase() || 'bin' }
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' as ImageOrientation })
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas context')
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (blob && blob.size < file.size) {
      return { blob, ext: 'jpg' }
    }
    // Compression didn't help (already small) — keep original.
    return { blob: file, ext: file.name.split('.').pop()?.toLowerCase() || 'jpg' }
  } catch {
    return { blob: file, ext: file.name.split('.').pop()?.toLowerCase() || 'jpg' }
  }
}

/**
 * Run async tasks with a bounded concurrency so we don't fire dozens of uploads
 * at once (which floods the connection) nor crawl through them one at a time.
 */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
  onProgress?: (done: number, total: number) => void
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0
  let done = 0

  async function worker() {
    while (next < tasks.length) {
      const index = next++
      results[index] = await tasks[index]()
      done++
      onProgress?.(done, tasks.length)
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}
