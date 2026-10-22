import { useCallback, useEffect, useState } from 'react'
import { errText, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { today } from '../lib/dates'
import { COMPANY, SEAL_PATH, korDate, periodText, spread } from '../lib/cert'
import { DateInput, ErrorBox } from './ui'

/* 재직증명서 · 경력증명서. (지은님 2026-10-22, 양식: 「[제1호] 재직증명서.hwp」)
   관리 → 직원 줄의 [증명서] 로 연다. 화면 그대로 인쇄하면 PDF 로 저장된다.

   ⚠️ **주민등록번호는 저장하지 않는다.** 바이렌워크에는 생년월일만 있다(지은님 결정).
      받는 곳이 주민번호를 꼭 요구하면 **발급할 때 손으로 넣고**, 그 값은 화면을 닫는
      순간 사라진다. DB 에도 브라우저에도 남기지 않는다.

   ⚠️ **경력증명서로 전 직장 경력을 증명하지 않는다.** 바이렌이 증명할 수 있는 것은
      바이렌에서 일한 기간뿐이다. 인사기록의 전 직장 경력은 기술자등급을 셈하려고
      적어 둔 것(건강보험 자격득실확인서)이지, 우리가 증명할 수 있는 게 아니다. */

const KINDS = ['재직증명서', '경력증명서']

/* 표 네 개의 칸 너비를 똑같이 — 안 맞으면 세로줄이 어긋난다 */
const Cols = () => (
  <colgroup>
    <col style={{ width: '10%' }} /><col style={{ width: '21%' }} />
    <col style={{ width: '23.5%' }} /><col style={{ width: '22.5%' }} />
    <col style={{ width: '23%' }} />
  </colgroup>
)

export default function Certificate({ emp, onClose }) {
  const { me } = useSession()
  const [hr, setHr] = useState(null)
  const [cfg, setCfg] = useState(COMPANY)
  const [seal, setSeal] = useState('')          // 직인 그림 (화면에서만 쓰는 임시 주소)
  const [sealMsg, setSealMsg] = useState('')
  const [err, setErr] = useState('')

  const [kind, setKind] = useState('재직증명서')
  const [purpose, setPurpose] = useState('공공기관 제출용')
  const [issued, setIssued] = useState(today())
  /* 주민등록번호 — 입력만 하고 어디에도 안 남긴다 */
  const [useRrn, setUseRrn] = useState(false)
  const [rrn, setRrn] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')              // 비우면 '현재 재직중'
  const [duty, setDuty] = useState('')
  const [issuer, setIssuer] = useState({ name: '', position: '' })

  const load = useCallback(async () => {
    const [{ data: h }, { data: s }] = await Promise.all([
      supabase.from('employee_hr').select('*').eq('user_id', emp.id).maybeSingle(),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
    ])
    setHr(h || {})
    /* 아직 2026-10-22f SQL 을 안 돌렸으면 칸이 없다. 그때는 코드의 기본값을 쓴다. */
    if (s?.company_name) {
      setCfg({
        name: s.company_name, short: s.company_short, ceo: s.company_ceo,
        ceoTitle: s.ceo_title, bizNo: s.company_biz_no,
        phone: s.company_phone, fax: s.company_fax, address: s.company_address,
      })
    }
    setFrom(h?.viren_start || emp.hire_date || '')

    /* 직인은 비공개 버킷에서 내려받는다 — 로그인한 재직자만 받을 수 있다. */
    const { data: blob, error } = await supabase.storage.from('company').download(SEAL_PATH)
    if (blob) { setSeal(URL.createObjectURL(blob)); setSealMsg(''); return }
    setSealMsg(/bucket not found/i.test(error?.message || '')
      ? 'SQL 전'      // 2026-10-22f-cert.sql 을 아직 안 돌렸다
      : '없음')
  }, [emp.id, emp.hire_date])

  useEffect(() => { load() }, [load])

  /* 화면을 닫을 때 임시 주소를 거둔다 */
  useEffect(() => () => { if (seal) URL.revokeObjectURL(seal) }, [seal])

  useEffect(() => {
    if (me) setIssuer({ name: me.name || '', position: me.position || '' })
  }, [me])

  async function putSeal(file) {
    if (!file) return
    setErr(''); setSealMsg('')
    const { error } = await supabase.storage.from('company')
      .upload(SEAL_PATH, file, { upsert: true, contentType: file.type || 'image/png' })
    if (error) return setErr(errText(error))
    load()
  }

  if (!hr) return <section className="card"><p className="hint">불러오는 중…</p></section>

  const 경력 = kind === '경력증명서'
  const birth6 = (hr.birth_date || '').replaceAll('-', '').slice(2)   // 2026-01-02 → 260102
  const idLabel = useRrn ? '주민등록번호' : '생년월일'
  const idValue = useRrn ? (rrn || '—') : (birth6 || '—')
  const period = periodText(from, to)
  const 다른날짜 = hr.viren_start && emp.hire_date && hr.viren_start !== emp.hire_date

  return (
    <section className="card stack-sm cert-card">
      <div className="row-between no-print">
        <h2>{emp.name} {kind}</h2>
        <div className="actions">
          <button className="btn small-btn primary" onClick={() => window.print()}>인쇄 · PDF 저장</button>
          <button className="btn small-btn" onClick={onClose}>닫기</button>
        </div>
      </div>

      <p className="hint no-print">
        인쇄 창에서 <strong>대상(프린터)을 ‘PDF로 저장’</strong> 으로 고르면 파일로 받습니다.
        용지는 <strong>A4</strong>, 배율은 <strong>기본</strong>, <strong>배경 그래픽</strong>을 켜 주세요
        (칸 배경색이 같이 나옵니다).
      </p>

      {/* ── 발급할 때 정하는 것 ─────────────────────────────── */}
      <div className="form-row three no-print">
        <label className="field"><span>종류</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select></label>
        <label className="field"><span>용도</span>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="공공기관 제출용" /></label>
        <label className="field"><span>발급일</span>
          <DateInput value={issued} onChange={(e) => setIssued(e.target.value)} /></label>
      </div>

      <div className="form-row three no-print">
        <label className="field"><span>재직기간 시작</span>
          <DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field"><span>재직기간 끝</span>
          <DateInput value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {경력 && (
          <label className="field"><span>담당업무</span>
            <input value={duty} onChange={(e) => setDuty(e.target.value)}
              placeholder="예: 전시·미디어아트 콘텐츠 디자인" /></label>
        )}
      </div>
      <p className="hint no-print">
        끝을 비우면 <strong>‘현재 재직중’</strong> 으로 나갑니다. 퇴사자는 마지막 날을 넣으세요.
        {다른날짜 && <> 이분은 <strong>입사일과 4대보험 자격취득일이 다릅니다</strong> —
          지금은 자격취득일을 넣어 뒀습니다. 재직증명서에 입사일을 써야 하면 바꾸세요.</>}
      </p>

      <div className="form-row three no-print">
        <label className="field"><span>발급 담당자</span>
          <input value={issuer.name} onChange={(e) => setIssuer({ ...issuer, name: e.target.value })} /></label>
        <label className="field"><span>담당자 직급</span>
          <input value={issuer.position} onChange={(e) => setIssuer({ ...issuer, position: e.target.value })} /></label>
        <label className="field"><span>본인 확인란</span>
          <select value={useRrn ? 'rrn' : 'birth'} onChange={(e) => setUseRrn(e.target.value === 'rrn')}>
            <option value="birth">생년월일 (권장)</option>
            <option value="rrn">주민등록번호</option>
          </select></label>
      </div>
      {useRrn && (
        <div className="no-print">
          <label className="field half"><span>주민등록번호</span>
            <input value={rrn} onChange={(e) => setRrn(e.target.value)}
              placeholder="860310 - 1406212" autoComplete="off" /></label>
          <p className="hint">
            <span className="warn-text">여기 적은 번호는 저장하지 않습니다</span> —
            이 화면을 닫으면 사라집니다. 바이렌워크는 주민등록번호를 보관하지 않습니다.
            받는 곳이 꼭 요구할 때만 쓰세요.
          </p>
        </div>
      )}

      {sealMsg === 'SQL 전' && (
        <p className="hint no-print">
          <span className="warn-text">아직 준비 전입니다</span> —
          <code>work/supabase/migrations/2026-10-22f-cert.sql</code> 을 한 번 실행해 주세요.
          그 전까지는 회사 정보도 코드에 적힌 기본값으로 나오고 직인도 못 올립니다.
        </p>
      )}
      {sealMsg === '없음' && (
        <p className="hint no-print">
          <span className="warn-text">직인 그림이 없습니다</span> — 도장 없이 나갑니다.
          종이에 직접 날인하시거나, 여기서 도장 그림(배경이 비치는 PNG)을 올려 주세요.
          {' '}올린 그림은 <strong>로그인한 재직자만</strong> 볼 수 있는 곳에 들어갑니다 —
          인터넷에 공개되지 않습니다.
          <label className="linkbtn file-pick"> 직인 올리기
            <input type="file" accept="image/png,image/webp" hidden
              onChange={(e) => putSeal(e.target.files?.[0])} />
          </label>
        </p>
      )}
      <ErrorBox>{err}</ErrorBox>

      {/* ── 증명서 ─────────────────────────────────────────── */}
      <div className="cert">
        <div className="cert-head">
          <h1>{kind}</h1>
          <img className="cert-logo" src="/viren-logo.png" alt="VIREN" />
        </div>

        {/* 인적사항 + 재직사항 — 원본은 틈 없이 한 덩어리다 */}
        <table className="cert-tb">
          <Cols />
          <tbody>
            <tr>
              <th className="g k" rowSpan={3}>{'인적\n사항'}</th>
              <th className="g" rowSpan={2}>{spread('성명')}</th>
              <td rowSpan={2}>{emp.name}</td>
              <th className="g">{spread(idLabel)}</th>
              <td>{idValue}</td>
            </tr>
            <tr>
              <th className="g">{spread('전화번호')}</th>
              <td>{hr.phone || '-'}</td>
            </tr>
            <tr>
              <th className="g">{spread('주소')}</th>
              <td colSpan={3}>{hr.address || '-'}</td>
            </tr>

            <tr>
              <th className="g k" rowSpan={경력 ? 3 : 2}>{경력 ? '경력\n사항' : '재직\n사항'}</th>
              <th className="g">{spread('소속부서')}</th>
              <td>{emp.dept || '-'}</td>
              <th className="g">{spread('직급')}</th>
              <td>{emp.position || '-'}</td>
            </tr>
            <tr>
              <th className="g">{spread('재직기간')}</th>
              <td colSpan={3}>{period}</td>
            </tr>
            {경력 && (
              <tr>
                <th className="g">{spread('담당업무')}</th>
                <td colSpan={3}>{duty || '-'}</td>
              </tr>
            )}
          </tbody>
        </table>

        <table className="cert-tb">
          <Cols />
          <tbody>
            <tr>
              <th className="g k" rowSpan={4}>{'회사\n정보'}</th>
              <th className="g">{spread('회사명')}</th>
              <td>{cfg.short}</td>
              <th className="g">{spread('대표자')}</th>
              <td>{cfg.ceo}</td>
            </tr>
            <tr>
              <th className="g" rowSpan={2}>{spread('사업자번호')}</th>
              <td rowSpan={2}>{cfg.bizNo}</td>
              <th className="g">{spread('전화번호')}</th>
              <td>{cfg.phone}</td>
            </tr>
            <tr>
              <th className="g">{spread('팩스번호')}</th>
              <td>{cfg.fax}</td>
            </tr>
            <tr>
              <th className="g">{spread('소재지')}</th>
              <td colSpan={3}>{cfg.address}</td>
            </tr>
          </tbody>
        </table>

        <table className="cert-tb">
          <Cols />
          <tbody>
            <tr>
              <th className="g k" rowSpan={2}>{'발급\n정보'}</th>
              <th className="g">{spread('담당자')}</th>
              <td>{issuer.name || '-'}</td>
              <th className="g">{spread('직급')}</th>
              <td>{issuer.position || '-'}</td>
            </tr>
            <tr>
              <th className="g">{spread('용도')}</th>
              <td colSpan={3}>{purpose || '-'}</td>
            </tr>
          </tbody>
        </table>

        <p className="cert-say">
          {경력
            ? '상기인은 위와 같이 본사에서 근무하였음을 증명합니다.'
            : '상기인은 현재 위와 같이 재직하고 있음을 증명합니다.'}
        </p>

        <p className="cert-date">{korDate(issued)}</p>

        <p className="cert-sign">
          {cfg.ceoTitle} :&nbsp; {cfg.ceo} &nbsp;(인)
          {seal && <img className="cert-seal" src={seal} alt="" />}
        </p>

        <p className="cert-corp">{cfg.name}</p>
      </div>
    </section>
  )
}
