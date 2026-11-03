import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ErrorBox } from './ui'

/* 관리 → 기타 설정. 알림이 실제로 나갔는지 본다.
   (지은님 2026-11-03: "6시 지나면 알림이 안 뜬다" 를 찾는 데 반나절이 걸렸다)

   ⚠️ **알림은 실패해도 조용하다.** 보내는 함수가 오류를 통째로 삼킨다 —
      그래야 알림이 안 가도 메시지는 올라간다. 그 대신 여기에 기록을 남긴다.

   ⚠️ 보낸 결과는 **몇 초 뒤에야** 들어온다(보내 놓고 바로 끝나는 방식이라).
      5분마다 도는 일이 채워 넣고, 급하면 '지금 확인' 을 누른다. */

const KIND = { chat: '메신저', doc: '전자결재' }

/* '11/3 18:25'. ⚠️ toLocaleString 은 '11. 3. 오후 06:25' 처럼 길어서
   큰 글씨 칸(.stats strong)에서 줄이 넘어간다. 직접 짧게 만든다. */
function when(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/* 코드 숫자 대신 무슨 일이 있었는지로 적는다. */
function resultOf(r) {
  if (r.status === null || r.status === undefined) return { text: '확인 중…', cls: 'muted' }
  if (r.status === 0) return { text: r.note || '응답이 오지 않았어요', cls: 'pl-bad' }
  if (r.status >= 200 && r.status < 300) {
    if (r.sent > 0) return { text: `${r.sent}대로 보냄${r.gone ? ` · 끊긴 기기 ${r.gone}대 정리` : ''}`, cls: 'pl-ok' }
    return { text: '보낼 기기가 없었어요', cls: 'muted' }
  }
  return { text: `실패 (${r.status}) ${r.note || ''}`.trim(), cls: 'pl-bad' }
}

export default function PushLogCard() {
  const [sum, setSum] = useState(null)
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [{ data: s, error: e1 }, { data: l, error: e2 }] = await Promise.all([
      supabase.rpc('push_health_sum', { p_days: 3 }),
      supabase.rpc('push_health', { p_days: 3 }),
    ])
    /* ⚠️ 함수가 아직 없으면(SQL 을 안 돌렸으면) 여기서 오류가 난다.
       '기록이 없다' 로 바꿔치지 않는다 — 안 만든 것과 조용한 것은 다르다. */
    if (e1 || e2) { setErr('알림 기록을 읽지 못했어요. SQL(2026-11-03a)을 아직 안 돌렸을 수 있어요.'); return }
    setErr('')
    setSum(s?.[0] || null)
    setRows(l || [])
  }, [])

  useEffect(() => { load() }, [load])

  async function checkNow() {
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('sync_push_log_now')
    setBusy(false)
    if (error) return setErr('확인하지 못했어요.')
    setMsg('방금 것까지 받아왔어요.')
    load()
  }

  const fail = Number(sum?.fail || 0)

  return (
    <section className="card stack-sm">
      <h2>알림 점검</h2>
      <p className="hint">
        메신저·전자결재 알림이 <strong>실제로 나갔는지</strong> 봅니다. 최근 <strong>3일</strong>치예요.
        알림은 안 가도 조용히 넘어가기 때문에, 안 뜬다는 말이 나오면 여기부터 봅니다.
      </p>

      <ErrorBox>{err}</ErrorBox>

      {sum && (
        <>
          {/* ⚠️ .form-row 는 styles.css 에 두 번 있고 **뒤엣것(양식 편집용)이 이긴다**.
             숫자 칸은 .stats 가 맞다 — 근태 화면이 쓰는 것과 같다. */}
          <div className="stats">
            <div><span className="label">등록된 기기</span><strong className="tnum">{sum.devices ?? 0}대</strong></div>
            <div><span className="label">보낸 횟수</span><strong className="tnum">{sum.tries ?? 0}번</strong></div>
            <div><span className="label">실패</span>
              <strong className={`tnum ${fail > 0 ? 'pl-bad' : ''}`}>{fail}번</strong></div>
          </div>
          {/* ⚠️ 칸은 **셋까지**. 좁은 화면에서 .stats 는 min-width 를 버리고 고르게
              나누기 때문에(styles.css 803줄), 넷이 되면 휴대폰에서 76px 로 눌려
              '등록된 / 기기' 처럼 글자가 세로로 쪼개진다. 넷째는 아래 글로 내린다. */}
          <p className="hint">마지막으로 알림이 나간 때는 <strong>{when(sum.last_ok)}</strong> 입니다.</p>
          {/* 기기가 0대면 아무리 보내도 뜰 데가 없다. 제일 먼저 짚어 준다. */}
          {Number(sum.devices || 0) === 0 && (
            <p className="hint warn">
              <strong>알림을 켠 기기가 하나도 없습니다.</strong> 직원들이 ‘내 정보 → 기기 알림’ 에서
              켜야 알림이 갑니다.
            </p>
          )}
          {fail > 0 && (
            <p className="hint warn">
              <strong>실패가 {fail}번 있습니다.</strong> 아래 목록에서 까닭을 확인하세요.
            </p>
          )}
        </>
      )}

      {rows === null ? <p className="hint">불러오는 중…</p> : rows.length === 0 ? (
        <p className="hint">최근 3일 동안 보낸 알림이 없어요.</p>
      ) : (
        <div className="table-wrap">
          <table className="table compact">
            <thead><tr><th>때</th><th>어디</th><th>결과</th></tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const v = resultOf(r)
                return (
                  <tr key={`${r.ts}-${i}`}>
                    <td className="tnum">{when(r.ts)}</td>
                    <td>{KIND[r.kind] || r.kind || '—'}</td>
                    <td className={v.cls}>{v.text}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {msg && <p className="ok">{msg}</p>}

      <div className="actions start">
        <button className="btn" disabled={busy} onClick={checkNow}>지금 확인</button>
      </div>
      <p className="hint">
        보낸 결과는 <strong>몇 초 뒤에야</strong> 들어와서, 방금 것은 ‘확인 중…’ 으로 보일 수 있어요.
        5분마다 저절로 채워집니다. 기록은 <strong>30일</strong> 뒤 지워져요.
      </p>
    </section>
  )
}
