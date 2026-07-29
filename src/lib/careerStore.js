import { supabase, isConfigured } from './supabase'
import { SEED_JOBS } from '../careerJobs'

const TABLE = 'jobs'
/* DB(snake_case) → 앱(camelCase). description은 예약어 desc 회피용. */
const SELECT_BASE = 'id, cat, titleEn:title_en, titleKo:title_ko, type, desc:description, headcount, responsibilities, qualifications, preferred, sort, created_at'
const SELECT = SELECT_BASE + ', pinned'

export async function listJobs() {
  if (!isConfigured) return SEED_JOBS
  const order = (q) => q.order('sort', { ascending: true }).order('created_at', { ascending: false })
  const { data, error } = await order(supabase.from(TABLE).select(SELECT))
  if (!error) return data
  const r = await order(supabase.from(TABLE).select(SELECT_BASE)) // pinned 컬럼 없으면 폴백
  if (r.error) throw r.error
  return r.data
}

function toRow(j) {
  return {
    id: j.id,
    cat: j.cat,
    title_en: j.titleEn,
    title_ko: j.titleKo || null,
    type: j.type || null,
    description: j.desc || null,
    headcount: j.headcount || null,
    responsibilities: j.responsibilities || null,
    qualifications: j.qualifications || null,
    preferred: j.preferred || null,
    pinned: !!j.pinned,
    sort: Number.isFinite(j.sort) ? j.sort : 0,
  }
}

export async function createJob(j) {
  requireDB()
  const { data, error } = await supabase.from(TABLE).insert(toRow(j)).select(SELECT).single()
  if (error) throw error
  return data
}

export async function updateJob(id, j) {
  requireDB()
  const { data, error } = await supabase.from(TABLE).update(toRow(j)).eq('id', id).select(SELECT).single()
  if (error) throw error
  return data
}

export async function deleteJob(id) {
  requireDB()
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}

function requireDB() {
  if (!isConfigured) throw new Error('Supabase가 연결되지 않았습니다. .env.local 에 URL/anon key 를 설정하세요.')
}
