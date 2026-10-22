import { parse } from './dates'
import { supabase } from './supabase'

/* 증명서에 쓰는 값들. (양식: 「[제1호] 재직증명서.hwp」, 2026-10-22) */

/* 직인 그림 — 비공개 버킷 'company' 안의 경로.
   ⚠️ public/ 에 두지 않는다. 도장 그림이 공개되면 아무 문서나 찍을 수 있다. */
export const SEAL_PATH = 'seal.png'

/* 회사 정보의 기본값.
   ⚠️ 진짜 값은 settings 표에 있다(2026-10-22f-cert.sql). 여기 있는 건
      SQL 을 아직 안 돌렸을 때만 쓰는 임시값이다. 회사 정보가 바뀌면 DB 를 고친다. */
export const COMPANY = {
  name: '주식회사 바이렌',
  short: '㈜바이렌',
  ceo: '김기선, 백승민',
  ceoTitle: '대표이사',
  bizNo: '566-87-03717',
  phone: '02-3144-1222',
  fax: '-',
  address: '서울특별시 마포구 양화로8길 32-17, 3층',
}

/* 직인 가져오기.
     url   — 화면에서만 쓰는 임시 주소(다 쓰면 URL.revokeObjectURL 로 거둔다)
     state — '' 있음 / '없음' / 'SQL 전'(버킷이 아직 없다) */
export async function loadSeal() {
  const { data, error } = await supabase.storage.from('company').download(SEAL_PATH)
  if (data) return { url: URL.createObjectURL(data), state: '' }
  return { url: '', state: /bucket not found/i.test(error?.message || '') ? 'SQL 전' : '없음' }
}

/* 올리기·지우기는 관리자만 된다(DB 정책). */
export const uploadSeal = (file) =>
  supabase.storage.from('company').upload(SEAL_PATH, file, {
    upsert: true, contentType: file.type || 'image/png',
  })

export const delSeal = () => supabase.storage.from('company').remove([SEAL_PATH])

/* 2026-07-20 → '2026년   07월   20일' (양식의 날짜 줄) */
export function korDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-')
  return `${y}년 ${m}월 ${d}일`
}

/* 재직기간 한 줄. 끝이 비면 '현재 재직중'. */
export function periodText(from, to) {
  if (!from) return '-'
  const one = (s) => {
    const d = parse(s)
    return `${d.getUTCFullYear()}년 ${String(d.getUTCMonth() + 1).padStart(2, '0')}월 `
      + `${String(d.getUTCDate()).padStart(2, '0')}일`
  }
  return `${one(from)} ~ ${to ? one(to) : '현재 재직중'}`
}

/* 양식의 이름표는 글자 사이를 벌려 칸을 꽉 채운다('성  명', '주 민 등 록 번 호').
   한글 자모 사이에 얇은 공백을 넣어 같은 모양을 낸다. */
export const spread = (s) => String(s).split('').join(' ')
