import { supabase, isConfigured, THUMB_BUCKET } from './supabase'

/* 스토리지 점검 — 어디에서도 참조하지 않는 파일(고아)을 찾아 지운다.

   파일을 교체하면 새 파일이 올라가고 DB의 주소만 바뀐다. 예전 파일은 그대로 남는다.
   쌓이면 무료 플랜 저장 한도(1GB)를 잡아먹는다(11절 대청소 참고).

   ⚠️ 참조 검사는 특정 칼럼을 뒤지지 않고 **DB 전체를 문자열로 만들어 파일명이
   들어 있는지** 본다. 나중에 미디어를 담는 칼럼이 늘어도 자동으로 따라간다 —
   칼럼 목록을 손으로 관리하면 언젠가 빠뜨리고 살아 있는 파일을 지우게 된다. */

const TABLES = ['projects', 'jobs', 'site_settings']

function bytes(n) {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)}MB`
  if (n >= 1024) return `${Math.round(n / 1024)}KB`
  return `${n}B`
}

async function listAll() {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(THUMB_BUCKET).list('', {
      limit: 1000, offset, sortBy: { column: 'created_at', order: 'desc' },
    })
    if (error) throw error
    if (!data?.length) break
    out.push(...data)
    if (data.length < 1000) break
  }
  /* 폴더 항목은 metadata가 없다 — 파일만 남긴다 */
  return out.filter((o) => o.metadata?.size != null)
}

/* DB 전체를 한 덩어리 문자열로. 파일명이 여기 있으면 "사용 중"이다. */
async function dbHaystack() {
  const parts = []
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select('*')
    if (error) throw new Error(`${t} 조회 실패: ${error.message}`)
    parts.push(JSON.stringify(data ?? []))
  }
  return parts.join('\n')
}

/* { files, used, orphans, totalBytes, orphanBytes } */
export async function auditStorage() {
  if (!isConfigured) throw new Error('Supabase 설정이 없습니다.')
  const [files, hay] = await Promise.all([listAll(), dbHaystack()])
  /* 업로드 주소는 퍼센트 인코딩될 수 있어 원본·인코딩 두 형태를 모두 확인한다 */
  const isUsed = (name) => hay.includes(name) || hay.includes(encodeURIComponent(name))
  const orphans = files.filter((f) => !isUsed(f.name))
  const sum = (a) => a.reduce((n, f) => n + f.metadata.size, 0)
  return {
    files,
    used: files.length - orphans.length,
    orphans: orphans.map((f) => ({
      name: f.name,
      size: f.metadata.size,
      sizeText: bytes(f.metadata.size),
      created: (f.created_at || '').slice(0, 10),
      isVideo: /\.(mp4|mov|webm)$/i.test(f.name),
    })),
    totalBytes: sum(files),
    orphanBytes: sum(orphans),
  }
}

/* 고아 파일 삭제. 지우기 직전에 한 번 더 대조하고, 지운 뒤 다시 세어 확인한다.

   ⚠️ 권한이 없으면 Supabase는 오류가 아니라 **200 + 빈 배열**을 돌려준다.
   응답만 믿으면 안 지워졌는데 지웠다고 보고하게 된다(2026-09-22에 실제로 겪음).
   그래서 반환값은 "응답이 뭐라 했는가"가 아니라 **다시 센 결과**다. */
export async function deleteOrphans(names) {
  if (!isConfigured) throw new Error('Supabase 설정이 없습니다.')
  const list = Array.isArray(names) ? names : []
  if (!list.length) return { removed: 0, freedBytes: 0, before: 0, after: 0 }

  const fresh = await auditStorage()
  const safe = new Set(fresh.orphans.map((o) => o.name))
  const target = list.filter((n) => safe.has(n))
  if (target.length !== list.length) {
    throw new Error('목록이 바뀌었습니다. 다시 검사한 뒤 삭제하세요.')
  }
  const before = fresh.files.length
  const beforeBytes = fresh.totalBytes

  /* 한 번에 너무 많이 보내면 요청이 거부될 수 있어 나눠 보낸다 */
  for (let i = 0; i < target.length; i += 50) {
    await supabase.storage.from(THUMB_BUCKET).remove(target.slice(i, i + 50))
  }

  const after = await auditStorage()
  return {
    removed: before - after.files.length,
    freedBytes: beforeBytes - after.totalBytes,
    before,
    after: after.files.length,
    audit: after,
  }
}

export { bytes }
