import { supabase, isConfigured } from './supabase'
import { SEED_JOBS } from '../careerJobs'

const TABLE = 'jobs'
/* DB(snake_case) → 앱(camelCase). description은 예약어 desc 회피용. */
const SELECT = 'id, cat, titleEn:title_en, titleKo:title_ko, type, desc:description, headcount, responsibilities, qualifications, preferred, sort, created_at'

export async function listJobs() {
  if (!isConfigured) return SEED_JOBS
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
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
