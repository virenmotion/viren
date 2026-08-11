import { supabase, isConfigured, THUMB_BUCKET } from './supabase'
import { SEED_PROJECTS } from '../workProjects'

const TABLE = 'projects'
/* DB 컬럼(snake_case) → 앱(camelCase) alias. description은 예약어 desc 회피용. */
const SELECT_BASE = 'slug, cat, kind, client, year, titleEn:title_en, titleKo:title_ko, youtube, location, deliverables, thumb, desc:description, sort, created_at'
const SELECT = SELECT_BASE + ', blocks'

/* ---------- 조회 ---------- */
export async function listProjects() {
  if (!isConfigured) return SEED_PROJECTS
  const order = (q) => q.order('sort', { ascending: true }).order('created_at', { ascending: false })
  const { data, error } = await order(supabase.from(TABLE).select(SELECT))
  if (!error) return data
  /* blocks 컬럼 미생성 등 → 축소 SELECT로 재시도(목록이 깨지지 않게) */
  const r = await order(supabase.from(TABLE).select(SELECT_BASE))
  if (r.error) throw r.error
  return r.data
}

/* ---------- 쓰기(관리자 전용) ---------- */
/* 앱 형태 → DB 행 */
function toRow(p) {
  return {
    slug: p.slug,
    cat: p.cat,
    /* kind(구분 태그)는 UI에서 제거됨. 여기서 쓰지 않으므로 기존 DB 값은 저장 시에도 보존된다. */
    client: p.client || null,
    year: p.year || null,
    title_en: p.titleEn || null,
    title_ko: p.titleKo || null,
    youtube: p.youtube || null,
    location: p.location || null,
    deliverables: p.deliverables || null,
    thumb: p.thumb || null,
    description: p.desc || null,
    blocks: Array.isArray(p.blocks) ? p.blocks : [],
    sort: Number.isFinite(p.sort) ? p.sort : 0,
  }
}

export async function createProject(p) {
  requireDB()
  const { data, error } = await supabase.from(TABLE).insert(toRow(p)).select(SELECT).single()
  if (error) throw error
  return data
}

export async function updateProject(slug, p) {
  requireDB()
  const { data, error } = await supabase.from(TABLE).update(toRow(p)).eq('slug', slug).select(SELECT).single()
  if (error) throw error
  return data
}

export async function deleteProject(slug) {
  requireDB()
  const { error } = await supabase.from(TABLE).delete().eq('slug', slug)
  if (error) throw error
}

/* 드래그로 바뀐 순서를 sort 값(1,2,3…)으로 일괄 저장 */
export async function reorderProjects(slugs) {
  requireDB()
  const results = await Promise.all(
    slugs.map((slug, i) => supabase.from(TABLE).update({ sort: i + 1 }).eq('slug', slug)),
  )
  const bad = results.find((r) => r.error)
  if (bad) throw bad.error
}

/* 썸네일 이미지 업로드 → 공개 URL 반환 */
export async function uploadThumb(file) {
  requireDB()
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${slugSafeStamp()}.${ext}`
  const { error } = await supabase.storage.from(THUMB_BUCKET).upload(path, file, {
    cacheControl: '3600', upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from(THUMB_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/* 본문 영상 파일 업로드 → 공개 URL 반환.
   유튜브 임베드 대신 직접 재생하고 싶을 때 사용. 저장소·대역폭을 쓰므로 짧은 클립 위주로.
   Supabase 무료 플랜은 저장 1GB·대역폭 월 5GB 수준이라 대용량 영상은 유튜브를 권장. */
export const MAX_VIDEO_MB = 50
export async function uploadVideo(file) {
  requireDB()
  const mb = file.size / (1024 * 1024)
  if (mb > MAX_VIDEO_MB) {
    throw new Error(`영상이 ${mb.toFixed(1)}MB입니다. ${MAX_VIDEO_MB}MB 이하로 줄이거나 유튜브를 이용하세요.`)
  }
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase()
  const path = `video-${slugSafeStamp()}.${ext}`
  const { error } = await supabase.storage.from(THUMB_BUCKET).upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || 'video/mp4',
  })
  if (error) throw error
  const { data } = supabase.storage.from(THUMB_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/* ---------- 사이트 설정: WORK 분야 · WHAT WE DO (site_settings jsonb) ---------- */
const SETTINGS_TABLE = 'site_settings'

async function getSetting(key) {
  if (!isConfigured) return null
  const { data, error } = await supabase.from(SETTINGS_TABLE).select('value').eq('key', key).maybeSingle()
  if (error) throw error
  return Array.isArray(data?.value) ? data.value : null
}
async function saveSetting(key, value) {
  requireDB()
  const { error } = await supabase.from(SETTINGS_TABLE).upsert({ key, value })
  if (error) throw error
}

/* WORK 분야(카테고리) — [{slug, label, hidden}] */
export const getCategories = () => getSetting('work_categories')
export const saveCategories = (list) => saveSetting('work_categories', list)

/* WHAT WE DO 항목 — [{label, desc, link, hidden}] (WORK와 무관, link=페이지 연결) */
export const getWhatWeDo = () => getSetting('what_we_do')
export const saveWhatWeDo = (list) => saveSetting('what_we_do', list)

/* 홈 PHILOSOPHY 아래 마퀴 문구 — 문자열 배열, 순서=표시순서 */
export const getBandWords = () => getSetting('band_words')
export const saveBandWords = (list) => saveSetting('band_words', list)

/* ---------- 인증 ---------- */
export async function signIn(email, password) {
  requireDB()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}
export async function signOut() {
  if (!isConfigured) return
  await supabase.auth.signOut()
}
export async function getUser() {
  if (!isConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data.user
}
export function onAuthChange(cb) {
  if (!isConfigured) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null))
  return () => data.subscription.unsubscribe()
}

/* ---------- 내부 ---------- */
function requireDB() {
  if (!isConfigured) throw new Error('Supabase가 연결되지 않았습니다. .env.local 에 URL/anon key 를 설정하세요.')
}
/* new Date() 사용 가능한 런타임 — 파일명 충돌 방지용 타임스탬프 */
function slugSafeStamp() {
  const t = Date.now().toString(36)
  const r = Math.floor(Math.random() * 1e6).toString(36)
  return `thumb-${t}-${r}`
}
