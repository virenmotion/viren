export const FORMS = {
  general: '품의서',
  leave: '휴가신청서',
  expense: '지출결의서',
}

export const DOC_STATUS = {
  pending: '진행 중',
  approved: '승인',
  rejected: '반려',
  withdrawn: '회수',
}

export const STEP_STATUS = {
  waiting: '대기',
  pending: '결재 차례',
  approved: '승인',
  rejected: '반려',
  skipped: '—',
}

/* 휴가 종류 — 2026-10-20 에 연차·월차·반차·공가·대휴 다섯 가지로 정했다(지은님).
   반차만 저장할 때 오전(half_am)·오후(half_pm) 로 갈라진다. */

/* 신청 화면에서 고르는 것. 반차를 고르면 오전·오후를 한 번 더 고른다. */
export const LEAVE_PICK = {
  annual: '연차',
  monthly: '월차',
  half: '반차',
  public: '공가',
  comp: '대휴',
}

/* 저장된 값 → 보여줄 이름. sick·family·other 는 2026-10-20 이전 문서용이라
   목록에서 고를 수는 없지만 옛 문서를 열면 이름이 떠야 한다. */
export const LEAVE_KINDS = {
  annual: '연차',
  monthly: '월차',
  half_am: '오전 반차',
  half_pm: '오후 반차',
  public: '공가',
  comp: '대휴',
  sick: '병가',
  family: '경조사',
  other: '기타',
}

/* 달력의 대괄호 안에 넣는 짧은 이름. 옛 종류는 '휴가' 로 뭉뚱그린다
   (병가·경조사가 전 직원 달력에 드러나지 않게). */
export const LEAVE_SHORT = {
  annual: '연차',
  monthly: '월차',
  half_am: '반차',
  half_pm: '반차',
  public: '공가',
  comp: '대휴',
}

/* 직급과 직책 (지은님 2026-10-21).
   · 직급(DB 칸 이름은 position) — 위에서 아래 순서가 곧 정렬 순서다.
   · 직책(DB 칸 duty)
   값을 늘리거나 바꾸려면 **여기만** 고치면 된다. DB 는 글자만 담고 제한하지 않는다. */
export const RANKS = ['대표', '실장', '팀장', '과장', '대리', '주임', '사원']
export const DUTIES = ['CEO', 'Director', 'leader', 'PM']

/* 정렬용 순번. 목록에 없는 값(옛 데이터 등)은 맨 뒤로. */
export const rankOrder = (p) => {
  const i = RANKS.indexOf(String(p || '').trim())
  return i < 0 ? RANKS.length : i
}

/* 목록·문서에 뜨는 양식 이름. 직접 만든 양식(form_type = 'custom')은 join 해 온
   doc_forms.name 을 쓴다. 양식이 지워졌으면 '문서'. */
export const formName = (d) => d?.doc_forms?.name || FORMS[d?.form_type] || '문서'

export const won = (n) => `${Number(n || 0).toLocaleString('ko-KR')}원`
