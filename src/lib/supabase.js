import { createClient } from '@supabase/supabase-js'

/* 환경변수(.env.local)에서 프로젝트 URL / anon key 를 읽는다.
   둘 다 없으면 supabase = null → 앱은 정적 시드 데이터로 폴백(사이트는 계속 동작). */
const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anon ? createClient(url, anon) : null
export const isConfigured = !!supabase

/* 썸네일 업로드 버킷 이름 */
export const THUMB_BUCKET = 'work-thumbs'
