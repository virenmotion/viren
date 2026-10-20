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

export const LEAVE_KINDS = {
  annual: '연차',
  half_am: '오전 반차',
  half_pm: '오후 반차',
  sick: '병가',
  family: '경조사',
  other: '기타',
}

export const won = (n) => `${Number(n || 0).toLocaleString('ko-KR')}원`
