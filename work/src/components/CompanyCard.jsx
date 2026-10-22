import { useCallback, useEffect, useState } from 'react'
import { errText, supabase } from '../lib/supabase'
import { delSeal, loadSeal, uploadSeal } from '../lib/cert'
import { ErrorBox } from './ui'

/* 회사 정보 — 증명서(재직·경력)에 그대로 들어가는 값들. (지은님 2026-10-22)
   코드가 아니라 DB(settings) 에 둔 이유: 주소·전화가 바뀔 때마다 배포하지 않으려고.

   ⚠️ settings 는 '재직자 누구나 보는' 표다. 여기 넣는 값은 사업자등록증·홈페이지에
      이미 적혀 있는 것뿐이어야 한다. 고치는 건 관리자만 된다(DB 정책).
   ⚠️ 직인(도장) 그림은 **비공개 저장소**에 들어간다. public/ 에 두면
      로그인 없이 누구나 내려받고, 도장 그림만 있으면 아무 문서나 찍을 수 있다. */

/* [칸 이름, 이름표, 보기글, 설명, 한 줄 다 쓰기] */
const FIELDS = [
  ['company_name', '회사명 (정식)', '주식회사 바이렌', '증명서 맨 아래에 크게 들어갑니다'],
  ['company_short', '회사명 (짧게)', '㈜바이렌', '증명서 표 안의 ‘회사명’ 칸'],
  ['company_ceo', '대표자', '김기선, 백승민', '두 명이면 쉼표로 나눕니다'],
  ['ceo_title', '대표 직함', '대표이사', '맨 아래 서명 줄'],
  ['company_biz_no', '사업자번호', '000-00-00000', ''],
  ['company_phone', '전화번호', '02-0000-0000', ''],
  ['company_fax', '팩스번호', '-', '없으면 - 로 두세요'],
  ['company_address', '소재지', '서울특별시 …', '', true],
  ['ai_office_url', 'AI 사무실 주소', 'https://…', '홈 바로가기의 ‘AI 사무실’. 비우면 그 칸이 안 보입니다', true],
]

export default function CompanyCard() {
  const [s, setS] = useState(null)
  const [seal, setSeal] = useState('')
  const [sealState, setSealState] = useState('')   // '' | '없음' | 'SQL 전'
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle()
    if (error) return setErr(errText(error))
    if (data && !('company_name' in data)) {
      return setErr('아직 데이터베이스 설정 전입니다. work/supabase/migrations 의 2026-10-22f-cert.sql 을 한 번 실행해 주세요.')
    }
    setErr(''); setS(data)

    const r = await loadSeal()
    setSeal((old) => { if (old) URL.revokeObjectURL(old); return r.url })
    setSealState(r.state)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => () => { if (seal) URL.revokeObjectURL(seal) }, [seal])

  const set = (k) => (e) => setS({ ...s, [k]: e.target.value })

  async function save() {
    setBusy(true); setErr(''); setMsg('')
    const patch = Object.fromEntries(FIELDS.map(([k]) => [k, (s[k] || '').trim()]))
    const { error } = await supabase.from('settings')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
    setBusy(false)
    if (error) return setErr(errText(error))
    setMsg('저장했습니다. 다음에 뽑는 증명서부터 이 내용으로 나갑니다.')
  }

  async function putSeal(file) {
    if (!file) return
    setBusy(true); setErr(''); setMsg('')
    const { error } = await uploadSeal(file)
    setBusy(false)
    if (error) return setErr(errText(error))
    setMsg('직인을 올렸습니다.')
    load()
  }

  async function removeSeal() {
    if (!window.confirm('직인 그림을 지울까요? 증명서에 도장이 안 찍히게 됩니다.')) return
    setBusy(true); setErr(''); setMsg('')
    const { error } = await delSeal()
    setBusy(false)
    if (error) return setErr(errText(error))
    load()
  }

  if (!s) return <ErrorBox>{err || '불러오는 중…'}</ErrorBox>

  return (
    <section className="stack-sm">
      <div className="card info">
        <p>여기 적은 내용이 <strong>재직증명서·경력증명서</strong>에 그대로 들어갑니다.
          주소나 전화가 바뀌면 여기서 고치세요 — 따로 배포할 필요가 없습니다.</p>
        <p><strong>AI 사무실 주소</strong>는 홈 바로가기에 쓰입니다. 공유키가 붙은 주소라
          코드에 적지 않고 여기 둡니다 — <strong>로그인한 재직자만</strong> 볼 수 있습니다.</p>
        <p><strong>고치는 건 관리자만</strong> 됩니다. 직원에게는 보이기만 합니다.</p>
      </div>

      <section className="card stack-sm">
        <h2>회사 정보</h2>
        <div className="company-form">
          {FIELDS.map(([k, label, ph, help, wide]) => (
            <label className={wide ? 'field wide' : 'field'} key={k}><span>{label}</span>
              <input value={s[k] ?? ''} onChange={set(k)} placeholder={ph} />
              {help && <em className="field-help">{help}</em>}
            </label>
          ))}
        </div>
        <ErrorBox>{err}</ErrorBox>
        {msg && <p className="ok">{msg}</p>}
        <div className="actions start">
          <button className="btn primary" disabled={busy} onClick={save}>회사 정보 저장</button>
        </div>
      </section>

      <section className="card stack-sm">
        <h2>직인 (법인 도장)</h2>
        <p className="hint">
          증명서 맨 아래 <strong>‘대표이사 : … (인)’</strong> 옆에 찍힙니다.
          배경이 비치는 PNG 를 올리세요.
        </p>
        <p className="hint">
          ⚠️ 이 그림은 <strong>로그인한 재직자만</strong> 볼 수 있는 곳에 들어갑니다.
          인터넷에 공개되지 않습니다 — 도장 그림만 있으면 아무 문서나 바이렌이 찍은 것처럼
          만들 수 있기 때문입니다.
        </p>

        <div className="seal-box">
          {seal
            ? <img className="seal-view" src={seal} alt="직인" />
            : <span className="muted">{sealState === 'SQL 전'
                ? '아직 준비 전입니다 (2026-10-22f-cert.sql 실행 필요)'
                : '올린 직인이 없습니다 — 증명서에 도장 없이 나갑니다'}</span>}
        </div>

        <div className="actions start">
          <label className="btn file-pick">
            {seal ? '직인 바꾸기' : '직인 올리기'}
            <input type="file" accept="image/png,image/webp" hidden disabled={busy}
              onChange={(e) => { putSeal(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {seal && <button className="btn" disabled={busy} onClick={removeSeal}>직인 지우기</button>}
        </div>
      </section>
    </section>
  )
}
