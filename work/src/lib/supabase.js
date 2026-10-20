import { createClient } from '@supabase/supabase-js'

/* 사내 플랫폼 전용 Supabase 프로젝트. 홈페이지 프로젝트와 다른 값이어야 한다. */
const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anon ? createClient(url, anon) : null

export const FILE_BUCKET = 'approval-files'

/* Supabase 오류를 화면에 보여줄 문장으로. DB 함수가 던진 한국어 메시지는 그대로 쓴다. */
export function errText(e) {
  if (!e) return ''
  const m = e.message || String(e)
  if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않습니다.'
  if (/Failed to fetch|NetworkError/i.test(m)) return '서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.'
  if (/JWT expired/i.test(m)) return '로그인이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.'
  return m
}
