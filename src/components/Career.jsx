import { useEffect, useState } from 'react'
import Reveal from './Reveal'
import SecStatement from './SecStatement'
import ApplyModal from './ApplyModal'
import { SEED_JOBS, WORK_CONDITIONS } from '../careerJobs'
import { listJobs, getWorkConditions } from '../lib/careerStore'

/* 지원서 양식 파일 (public/assets/에 배치, 파일은 추후 전달) */
const APPLY_FORM_URL = '/assets/viren_application_form.pdf'

/* 근무조건 세부내용 → 줄 배열. 줄바꿈(\n)과 / 를 모두 줄 구분자로 사용 */
const condLines = (body) => {
  const raw = Array.isArray(body) ? body.join('\n') : String(body || '')
  return raw.split(/[\n/]/).map((s) => s.trim()).filter(Boolean)
}

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
  const [applyJob, setApplyJob] = useState(null) // 지원 팝업 대상 공고 (null=닫힘)
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
            /* 공지: 상단 고정 + 상세(담당업무/자격 등) 없음 → 지원하기 숨김 */
            const isNotice = j.pinned && !j.type && !j.responsibilities && !j.qualifications && !j.preferred && !j.headcount
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
                    {!isNotice && (
                      <div className="job-apply-row">
                        <button type="button" className="job-apply" onClick={() => setApplyJob(j)}>
                          지원하기 <span aria-hidden="true">↗</span>
                        </button>
                        <a className="job-form-dl" href={APPLY_FORM_URL} download data-hover>
                          지원서 양식 DOWNLOAD <span aria-hidden="true">↓</span>
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {jobs !== null && shown.length === 0 && <p className="job-empty">등록된 공고가 없습니다.</p>}
        </div>

        {/* JOB POSITION 하단 고정 안내문구 */}
        <p className="job-notice-text">
          <em>지원해주신 모든 정보와 포트폴리오는 소중하게 관리됩니다.</em><br />
          지원 자료는 향후 채용 검토를 위해 등록일로부터 1년간 보관됩니다.<br />
          이후 별도의 채용 진행이 없는 경우에는 개인정보 보호를 위해 안전하게 파기됩니다.
        </p>
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

      <ApplyModal open={!!applyJob} job={applyJob} onClose={() => setApplyJob(null)} />
    </section>
  )
}
