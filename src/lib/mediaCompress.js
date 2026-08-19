/* 업로드 전 미디어 정리 — 관리자가 올리는 원본을 그대로 두면 저장소·대역폭이 금방 찬다.

   실제로 겪은 일(2026-08-18): 인쇄용 PNG(최대 7801×2601·36MB)와 거의 무손실 영상
   (960×600을 15.7Mbps)이 쌓여 스토리지 1GB를 넘고 월 대역폭 5GB를 초과했다.
   WORK 상세 한 페이지가 157MB였다. 일괄 정리로 이미지는 97.5%, 영상은 75% 줄었다.
   같은 일이 반복되지 않도록 업로드 시점에 막는다. */

/* 화면에서 이미지가 그려지는 최대 폭은 #work-detail의 1400px.
   레티나(2배)까지 고려해도 2400px이면 충분하다. */
const MAX_PX = 2400
const WEBP_QUALITY = 0.82

/* 애니메이션(gif)·벡터(svg)는 캔버스를 거치면 망가지므로 손대지 않는다. */
const COMPRESSIBLE = /^image\/(jpeg|png|webp)$/

/**
 * 이미지를 WebP로 다시 인코딩하고 긴 변을 MAX_PX로 제한한다.
 * 압축 결과가 원본보다 크면 원본을 그대로 돌려준다(작은 이미지·이미 최적화된 파일).
 * @returns {Promise<{file: File, before: number, after: number, changed: boolean}>}
 */
export async function compressImage(file) {
  const keep = { file, before: file.size, after: file.size, changed: false }
  if (!COMPRESSIBLE.test(file.type)) return keep
  if (typeof createImageBitmap !== 'function') return keep // 아주 오래된 브라우저

  let bitmap
  try {
    /* imageOrientation: 휴대폰 사진의 EXIF 회전 정보를 반영한다(빼면 눕는다) */
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch { return keep }

  try {
    const scale = Math.min(1, MAX_PX / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return keep
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', WEBP_QUALITY))
    /* toBlob이 null이거나(webp 미지원) 되레 커졌으면 원본 유지 */
    if (!blob || blob.size >= file.size) return keep

    const name = file.name.replace(/\.[^.]+$/, '') + '.webp'
    return {
      file: new File([blob], name, { type: 'image/webp' }),
      before: file.size, after: blob.size, changed: true,
    }
  } finally {
    bitmap.close?.()
  }
}

/* ---------- 영상 ---------- */

/* 브라우저에서 영상을 재인코딩하는 건 현실적이지 않다(ffmpeg.wasm은 수십 MB에 매우 느림).
   대신 사양을 읽어 과한 파일을 걸러내고, 압축 방법을 알려준다. */
export const MAX_VIDEO_MB = 20      // 이걸 넘으면 업로드 거부
export const WARN_MBPS = 4          // 이걸 넘으면 경고(업로드는 허용)

/** <video>로 메타데이터만 읽어 길이·해상도·실효 비트레이트를 구한다. */
export function inspectVideo(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    const done = (info) => { URL.revokeObjectURL(url); resolve(info) }
    v.preload = 'metadata'
    v.onloadedmetadata = () => done({
      duration: v.duration,
      width: v.videoWidth,
      height: v.videoHeight,
      mbps: v.duration ? (file.size * 8) / v.duration / 1e6 : 0,
    })
    v.onerror = () => done(null)
    v.src = url
  })
}

/** 사용자에게 보여줄 ffmpeg 압축 명령 */
export function ffmpegHint(fileName) {
  return `ffmpeg -i "${fileName}" -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart "compressed.mp4"`
}

export const mbText = (bytes) => (bytes / 1048576).toFixed(1) + 'MB'
