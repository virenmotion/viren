import { supabase, isConfigured, THUMB_BUCKET } from './supabase'
import { SEED_PROJECTS } from '../workProjects'

const TABLE = 'projects'
/* DB 컬럼(snake_case) → 앱(camelCase) alias. description은 예약어 desc 회피용. */
const SELECT = 'slug, cat, kind, client, year, titleEn:title_en, titleKo:title_ko, youtube, thumb, desc:description, sort, created_at'

/* ---------- 조회 ---------- */
export async function listProjects() {
  if (!isConfigured) return SEED_PROJECTS
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/* ---------- 쓰기(관리자 전용) ---------- */
/* 앱 형태 → DB 행 */
function toRow(p) {
  return {
    slug: p.slug,
    cat: p.cat,
    kind: p.kind || null,
    client: p.client || null,
    year: p.year || null,
    title_en: p.titleEn || null,
    title_ko: p.titleKo || null,
    youtube: p.youtube || null,
    thumb: p.thumb || null,
    description: p.desc || null,
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
