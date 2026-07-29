import { useEffect, useState } from 'react'
import Reveal from './Reveal'
import SecStatement from './SecStatement'
import { SEED_JOBS, WORK_CONDITIONS } from '../careerJobs'
import { listJobs, getWorkConditions } from '../lib/careerStore'

/* 근무조건 세부내용 → 줄 배열. 줄바꿈(\n)과 / 를 모두 줄 구분자로 사용 */
const condLines = (body) => {
  const raw = Array.isArray(body) ? body.join('\n') : String(body || '')
  return raw.split(/[\n/]/).map((s) => s.trim()).filter(Boolean)
}

const APPLY_EMAIL = 'virenmotion@viren.kr'

/* 줄바꿈 텍스트 → 항목 배열 (앞의 -·• 기호는 제거) */
const bullets = (text) =>
  String(text || '').split('\n').map((s) => s.replace(/^[-·•]\s*/, '').trim()).filter(Boolean)

/* 채용 상세 표 — 모집인원 / 담당업무 / 자격요건 / 우대사항 (내용 있는 행만) */
function JobTable({ job }) {
  const rows = [
    { label: '모집인원', text: job.headcount },
    { label: '담당업무', list: bullets(job.responsibilities) },
    { label: '자격요건', list: bullets(job.qualifications) },
    { label: '우대사항', list: bullets(job.preferred) },
  ].filter((r) => r.text || (r.list && r.list.length))

  if (!rows.length) return null

  return (
    <table className="job-table">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th>{r.label}</th>
            <td>
              {r.list
                ? <ul>{r.list.map((x, i) => <li key={i}>{x}</li>)}</ul>
                : r.text}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* CAREER — d'strict식 채용 보드. 좌측 카테고리 필터 + 우측 공고 목록(클릭 시 펼침).
   공고는 Supabase(jobs)에서 로드, 미연결 시 시드 폴백. */
export default function Career() {
  const [openId, setOpenId] = useState(null)
  const [openCond, setOpenCond] = useState(null)
  const [jobs, setJobs] = useState(null) // null = 로딩
  const [conditions, setConditions] = useState(WORK_CONDITIONS) // 근무조건 (DB 저장분 있으면 대체)

  useEffect(() => {
    listJobs().then(setJobs).catch((e) => { console.error('채용 로드 실패, 시드 폴백:', e); setJobs(SEED_JOBS) })
    getWorkConditions().then((c) => { if (c && c.length) setConditions(c) }).catch(() => {})
  }, [])

  // 상단 고정(pinned) 공고를 맨 위로 — 그 외 순서는 유지(안정 정렬)
  const shown = [...(jobs || [])].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))

  return (
    <section id="career">
      <p className="sec-label">CAREER</p>

      <SecStatement>Join the VIREN</SecStatement>

      <Reveal className="career-intro">
        <p>함께 몰입형 콘텐츠를 만들 크리에이터를 찾습니다. 관심 있는 직무에 지원해 주세요.</p>
      </Reveal>

      <h2 className="job-heading">JOB POSITION</h2>

      <div className="career-body">
        {/* 공고 목록 (아코디언) — 상단 고정 공지 우선 */}
        <div className="job-list">
          {shown.map((j) => {
            const open = openId === j.id
            return (
              <div className={`job${open ? ' open' : ''}${j.pinned ? ' pinned' : ''}`} key={j.id}>
                <button className="job-head" onClick={() => setOpenId(open ? null : j.id)}>
                  <span className="job-title">
                    {j.pinned && <span className="job-notice">공지</span>}
                    <span className="en">{j.titleEn}</span>
                    {j.titleKo && <><span className="sep">/</span><span className="ko">{j.titleKo}</span></>}
                  </span>
                  <span className="job-plus" aria-hidden />
                </button>
                {open && (
                  <div className="job-panel">
                    {j.type && <p className="job-type">{j.type}</p>}
                    {j.desc && <p className="job-desc">{j.desc}</p>}
                    <JobTable job={j} />
                    <a className="job-apply" href={`mailto:${APPLY_EMAIL}?subject=[VIREN 지원] ${j.titleEn}`}>
                      지원하기 ↗
                    </a>
                  </div>
                )}
              </div>
            )
          })}

          {jobs !== null && shown.length === 0 && <p className="job-empty">등록된 공고가 없습니다.</p>}
        </div>
      </div>

      {/* 근무조건 — JOB POSITION과 동일한 아코디언·폭 */}
      <h2 className="job-heading cond-heading">WORK CONDITIONS</h2>
      <Reveal className="career-body">
        <div className="job-list">
          {conditions.map((c, ci) => {
            const open = openCond === ci
            return (
              <div className={`job${open ? ' open' : ''}`} key={ci}>
                <button className="job-head" onClick={() => setOpenCond(open ? null : ci)}>
                  <span className="job-title"><span className="en">{c.label}</span></span>
                  <span className="job-plus" aria-hidden />
                </button>
                {open && (
                  <div className="job-panel">
                    <div className="cond-detail">
                      {condLines(c.body).map((line, i) => <p key={i}>{line}</p>)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Reveal>
    </section>
  )
}
