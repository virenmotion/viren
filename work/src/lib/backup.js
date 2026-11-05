/* 업무 자료 내보내기 · 되돌리기 SQL 만들기.
   화면(BackupCard.jsx)은 여기에 있는 것을 쓰기만 한다 — 그래야 시험할 수 있다.

   ⚠️⚠️ **이것은 '전체 백업' 이 아니다.** 무료 서버에서 브라우저가 가져올 수 있는 것만
        담는다. 못 담는 것은 `MISSING` 에 적어 두고 화면에도 그대로 띄운다.
        전체를 받으려면 Supabase 대시보드에서 따로 받아야 한다 — `work/BACKUP.md`.

   ⚠️ 되돌리기(복구)는 **여기서 하지 않는다.** 핵심 표에는 insert 정책이 아예 없어서
      (문서·직원·인사 기록은 함수로만 만들어진다) 브라우저로는 넣을 수가 없다.
      대신 **SQL 을 만들어 준다.** 사람이 눈으로 보고 SQL Editor 에서 돌린다 —
      미리보기와 실행이 갈라져 있어야 실수로 덮어쓰는 일이 없다.

   ⚠️⚠️ **검사를 통과하지 않은 꾸러미로는 SQL 을 만들지 않는다.** `restoreSql` 은
        `checkBackup` 의 결과를 받아야만 돌아간다. 믿을 수 없는 자료로 SQL 글자를
        짓는 순간 칸 이름 자리에 무엇이든 들어올 수 있다(2026-11-05 검토 지적). */

/* 자료 모양이 바뀌면 올린다. 2 = 2026-11-05(건수·해시·빠진 것 적기 시작) */
export const BACKUP_VERSION = 2

/* 담는 표. **차례가 중요하다** — 가리키는 쪽(부모)이 먼저다.
   되돌릴 때 이 차례로 넣어야 '없는 줄을 가리킨다' 고 막히지 않는다.

   key = 기본키. 겹칠 때 무엇으로 알아보는지이자, **가져올 때 줄 세우는 기준**이다.
   ⚠️ 복합키는 **전부** 써서 줄을 세워야 한다. 한 칸만 쓰면(예: doc_id) 그 값이 같은
      줄들의 차례가 정해지지 않아, 1000건씩 끊어 가져올 때 **겹치거나 빠진다**
      (2026-11-05 검토 지적 — 그전에는 한 칸만 썼다). */
export const TABLES = [
  { name: 'settings', key: ['id'], what: '회사 설정' },
  { name: 'employees', key: ['id'], what: '직원' },
  { name: 'employee_hr', key: ['user_id'], what: '인사 기록' },
  { name: 'employee_careers', key: ['id'], what: '경력' },
  { name: 'employee_certs', key: ['id'], what: '자격증' },
  { name: 'doc_forms', key: ['id'], what: '결재 양식' },
  { name: 'approval_docs', key: ['id'], what: '결재 문서' },
  { name: 'approval_steps', key: ['doc_id', 'step'], what: '결재선' },
  { name: 'approval_refs', key: ['doc_id', 'user_id'], what: '참조자' },
  { name: 'approval_files', key: ['id'], what: '결재 첨부(파일 정보)' },
  { name: 'attendance', key: ['user_id', 'work_date'], what: '근태' },
  { name: 'event_categories', key: ['id'], what: '일정 분류' },
  { name: 'events', key: ['id'], what: '일정' },
]

/* 담긴 파일 정보가 가리키는 저장소. 본체는 여기에 안 들어간다. */
export const BUCKETS = ['approval-files', 'chat-files', 'company']

/* **일부러 뺀 것.** 빠뜨린 게 아니라 뺀 것이고, 까닭이 저마다 다르다.
   화면에 이 글을 그대로 띄운다 — '전체' 라고 믿게 두지 않는다. */
export const MISSING = [
  {
    what: '메신저(대화방·참여자·글)',
    why: '방에 들어가 있는 사람만 읽을 수 있게 막혀 있다. 관리자도 예외가 아니다.',
    how: '브라우저로는 못 가져온다. 받으려면 Supabase 대시보드에서 받아야 한다(BACKUP.md).',
  },
  {
    what: '비밀 설정(user_mail · push_config)',
    why: '직원 메일 비밀번호(암호문)와 알림 비밀키가 들어 있다. 일부러 아무도 못 읽게 막아 두었다.',
    how: '내려받는 파일에 **넣지 않는다.** 서버를 새로 만들면 다시 넣는다(BACKUP.md 의 재설정 절차).',
  },
  {
    what: '파일 본체(그림·PDF·직인)',
    why: `저장소 세 곳(${BUCKETS.join(' · ')})에 있다. 브라우저로 한 번에 묶기엔 너무 크다.`,
    how: '파일 **경로와 크기**만 담는다. 본체는 Supabase 대시보드 → Storage 에서 따로 받는다.',
  },
  {
    what: '로그인 계정·비밀번호',
    why: 'Supabase 가 따로 들고 있다(auth). 우리 쪽에서 꺼낼 수 없고, 꺼내서도 안 된다.',
    how: '되돌릴 때는 계정을 **먼저** 만들어야 한다. 직원 줄은 그 계정 번호를 가리킨다.',
  },
  {
    what: '표 구조·함수·방아쇠·권한(RLS)',
    why: '자료가 아니라 설계다. 우리 코드(`supabase/schema.sql`)에 들어 있다.',
    how: '새 서버에는 `schema.sql` 을 먼저 돌리고, 그다음에 이 자료를 넣는다.',
  },
  {
    what: '알림 기록(push_log) · 메일 진행 상태(mail_state)',
    why: '되돌리면 **해롭다.** 어디까지 봤는지를 과거로 돌리면 지난 메일이 다시 알림으로 터진다.',
    how: '일부러 뺀다. 새 서버에서는 지금부터 다시 쌓으면 된다.',
  },
]

/* ── 글자로 굳히기 · 해시 ─────────────────────────────────────────── */

/* 줄을 글자로 굳힌다. 해시를 잴 때도 이것만 쓴다.
   ⚠️ 키 차례가 달라지면 해시가 달라진다. 그래서 **키를 정렬해서** 굳힌다. */
export function stable(v) {
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

/* SHA-256. 브라우저와 node 둘 다 같은 crypto.subtle 을 쓴다. */
export async function sha256(text, subtle) {
  const c = subtle || (typeof crypto !== 'undefined' ? crypto.subtle : null)
  if (!c) throw new Error('이 환경에서는 해시를 잴 수 없어요.')
  const buf = await c.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/* 표 하나의 해시. 줄 차례가 달라도 같은 값이 나오도록 **줄마다 재서 정렬한 뒤** 합친다. */
export async function hashRows(rows, subtle) {
  const each = await Promise.all(rows.map((r) => sha256(stable(r), subtle)))
  return sha256(each.sort().join(''), subtle)
}

/* ── 믿어도 되는 모양인지 ─────────────────────────────────────────── */

const IDENT = /^[a-z_][a-z0-9_]{0,61}$/        // 칸 이름은 이 모양만 받는다
const HASH = /^[0-9a-f]{64}$/
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/

export function isIsoTime(v) {
  return typeof v === 'string' && ISO.test(v) && !Number.isNaN(Date.parse(v))
}

/* SQL 에 넣어도 되는 칸 이름인지. **모양이 안 맞으면 만들지 않는다.**
   따옴표를 두 번 써서 '빠져나가게' 두지 않는다 — 아예 거절한다. */
export function safeIdent(name) {
  if (typeof name !== 'string' || !IDENT.test(name)) {
    throw new Error(`칸 이름으로 쓸 수 없는 글자가 있어요: ${JSON.stringify(String(name)).slice(0, 40)}`)
  }
  return `"${name}"`
}

/* 한 표의 줄들이 성한지. SQL 을 만들기 전에 반드시 거친다.
   돌려주는 것: { problems, cols } — cols 는 **모든 줄에서 모은** 칸 이름. */
export function checkRows(t, rows) {
  const problems = []
  const cols = new Set()
  const seen = new Set()
  let shape = null

  rows.forEach((r, i) => {
    const at = `‘${t.what}’ ${i + 1}번째 줄`
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      problems.push(`${at}이 줄 모양이 아닙니다.`)
      return
    }
    const keys = Object.keys(r)
    for (const k of keys) {
      if (!IDENT.test(k)) {
        problems.push(`${at}에 칸 이름으로 쓸 수 없는 글자가 있습니다: ${JSON.stringify(k).slice(0, 40)}`)
        continue
      }
      cols.add(k)
    }
    /* 칸 구성이 줄마다 다르면 되돌릴 때 일부 칸이 안 덮인다 */
    const sig = keys.slice().sort().join(',')
    if (shape === null) shape = sig
    else if (sig !== shape) problems.push(`${at}의 칸 구성이 첫 줄과 다릅니다.`)

    /* 기본키가 비었거나 겹치면 되돌릴 때 엉뚱한 줄을 덮는다 */
    const gone = t.key.filter((k) => r[k] === undefined || r[k] === null)
    if (gone.length) {
      problems.push(`${at}에 ${gone.join('·')} 이(가) 비어 있습니다.`)
      return
    }
    const id = t.key.map((k) => stable(r[k])).join('\u0000')
    if (seen.has(id)) problems.push(`${at}이 앞의 줄과 번호가 같습니다(${t.key.join('·')}).`)
    seen.add(id)
  })

  if (rows.length && !t.key.every((k) => cols.has(k))) {
    problems.push(`‘${t.what}’에 기본키 칸(${t.key.join('·')})이 없습니다.`)
  }
  /* 너무 많이 쏟아내면 아무도 안 읽는다 */
  return { problems: problems.slice(0, 5), cols: [...cols] }
}

/* ── 꾸러미 만들기 ────────────────────────────────────────────────── */

/* fetchTable(name, keyCols) 는 그 표를 **전부** 가져와 배열로 준다(화면 쪽이 넘겨준다).
   listFiles(bucket) 는 { files, truncated, note } 또는 배열을 준다. 없으면 건너뛴다. */
export async function buildBackup({ fetchTable, listFiles, subtle, now }) {
  const out = {
    version: BACKUP_VERSION,
    exported_at: (now || new Date()).toISOString(),
    complete: false,          // **전체가 아니면 절대 true 가 아니다**
    tables: {},
    counts: {},
    hashes: {},
    files: {},
    missing: MISSING,
    problems: [],
  }

  for (const t of TABLES) {
    try {
      const rows = await fetchTable(t.name, t.key)
      if (!Array.isArray(rows)) throw new Error('줄을 배열로 받지 못했어요')
      out.tables[t.name] = rows
      out.counts[t.name] = rows.length
      out.hashes[t.name] = await hashRows(rows, subtle)
    } catch (e) {
      /* ⚠️ 한 표가 실패하면 **거기서 멈춘다.** 반쪽짜리를 '다 받았다' 로 내주지 않는다. */
      out.problems.push({ table: t.name, error: String(e?.message || e) })
      throw Object.assign(new Error(`‘${t.what}’(${t.name})을 가져오지 못했어요: ${e?.message || e}`), { partial: out })
    }
  }

  if (listFiles) {
    for (const b of BUCKETS) {
      try {
        const r = await listFiles(b)
        const files = Array.isArray(r) ? r : (r?.files || [])
        const odd = files.filter((f) => !safePath(f?.path))
        if (odd.length) out.problems.push({ bucket: b, error: `쓸 수 없는 경로 ${odd.length}개를 뺐습니다.` })
        out.files[b] = files.filter((f) => safePath(f?.path))
        /* 끝까지 못 읽었으면 **그 사실을 적는다.** 조용히 적게 담는 게 제일 나쁘다. */
        if (r && !Array.isArray(r) && r.truncated) {
          out.problems.push({ bucket: b, error: r.note || '목록을 끝까지 읽지 못했습니다(범위 제한).' })
        }
      } catch (e) {
        out.problems.push({ bucket: b, error: String(e?.message || e) })
      }
    }
  }

  out.complete = false
  return out
}

/* ── 꾸러미 검사 ──────────────────────────────────────────────────── */

/* 받아 둔 꾸러미가 성한지 본다. **되돌리기 전에 반드시 거친다.**
   ⚠️ '적혀 있을 때만 맞춰 보는' 식이면 건수·해시를 지운 파일이 그냥 통과한다
      (2026-11-05 검토 지적). v2 에서는 **없는 것 자체가 문제**다. */
export async function checkBackup(obj, subtle) {
  const bad = []
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, problems: ['파일을 읽지 못했어요.'], tables: [] }
  }
  if (obj.version !== BACKUP_VERSION) {
    bad.push(obj.version
      ? `자료 모양이 ${obj.version} 판입니다. 지금 프로그램은 ${BACKUP_VERSION} 판이에요.`
      : '자료 모양 번호가 없습니다. 아주 옛날 파일이에요.')
  }
  if (!isIsoTime(obj.exported_at)) bad.push('받은 때가 없거나 모양이 이상합니다.')
  if (!obj.tables || typeof obj.tables !== 'object' || Array.isArray(obj.tables)) {
    return { ok: false, problems: [...bad, '표가 하나도 들어 있지 않습니다.'], tables: [] }
  }
  const plain = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
  if (!plain(obj.counts)) bad.push('표별 건수(counts)가 통째로 없습니다. 이 꾸러미로는 되돌릴 수 없어요.')
  if (!plain(obj.hashes)) bad.push('해시(hashes)가 통째로 없습니다. 이 꾸러미로는 되돌릴 수 없어요.')

  const tables = []
  for (const t of TABLES) {
    const rows = obj.tables[t.name]
    if (!Array.isArray(rows)) { bad.push(`‘${t.what}’(${t.name})이 빠져 있습니다.`); continue }

    const said = plain(obj.counts) ? obj.counts[t.name] : undefined
    if (typeof said !== 'number') bad.push(`‘${t.what}’의 건수가 안 적혀 있습니다.`)
    else if (said !== rows.length) bad.push(`‘${t.what}’ 건수가 안 맞습니다 — 적힌 건 ${said}건, 실제는 ${rows.length}건.`)

    const h = plain(obj.hashes) ? obj.hashes[t.name] : undefined
    let hashOk = false
    if (typeof h !== 'string' || !HASH.test(h)) bad.push(`‘${t.what}’의 해시가 없거나 모양이 이상합니다.`)
    else if ((await hashRows(rows, subtle)) !== h) bad.push(`‘${t.what}’의 내용이 받은 뒤에 바뀌었습니다(해시 불일치).`)
    else hashOk = true

    const { problems } = checkRows(t, rows)
    bad.push(...problems)
    tables.push({ name: t.name, what: t.what, rows: rows.length, hashOk })
  }

  /* 파일 목록의 경로도 본다 — 뒤에 이 경로로 파일을 쓰는 도구가 걸려들지 않게 */
  if (plain(obj.files)) {
    for (const [b, list] of Object.entries(obj.files)) {
      if (!Array.isArray(list)) { bad.push(`저장소 ‘${b}’의 파일 목록이 모양에 안 맞습니다.`); continue }
      const odd = list.filter((f) => !f || !safePath(f.path)).slice(0, 3)
      if (odd.length) {
        bad.push(`저장소 ‘${b}’에 쓸 수 없는 경로가 있습니다: ${odd.map((f) => String(f?.path ?? '(빈 경로)').slice(0, 60)).join(' · ')}`)
      }
    }
  }
  return { ok: bad.length === 0, problems: bad, tables }
}

/* ── 되돌리기 미리보기 ───────────────────────────────────────────── */

/* **무엇이 몇 건 들어가는지만** 센다. 아무것도 쓰지 않는다.
   nowCounts[표] 는 지금 DB 의 건수. **못 세었으면 null 을 넣는다** — 0 과 다르다.
   0 으로 뭉뚱그리면 '새로 넣음' 으로 보여서, 실은 덮어쓰는데 안심하게 된다
   (2026-11-05 검토 지적). */
export function previewRestore(obj, nowCounts = {}) {
  return TABLES.map((t) => {
    const rows = obj?.tables?.[t.name]
    const have = Object.prototype.hasOwnProperty.call(nowCounts, t.name) ? nowCounts[t.name] : undefined
    const unknown = have === null || have === undefined
    return {
      name: t.name,
      what: t.what,
      rows: Array.isArray(rows) ? rows.length : 0,
      have: unknown ? null : have,
      /* ⚠️ 짧게. 휴대폰에서 이 칸이 세 줄로 쪼개진다. 자세한 말은 표 아래 경고에 있다. */
      mode: unknown ? '확인 불가' : (have ? '덮어씀' : '새로 넣음'),
      unknown,
      missing: !Array.isArray(rows),
    }
  })
}

/* ── 되돌리는 SQL ─────────────────────────────────────────────────── */

/* SQL 안에 넣을 달러 인용 표시. 자료 안에 같은 글자가 있으면 비켜 간다. */
function tagFor(text) {
  for (const t of ['$viren$', '$viren1$', '$viren2$', '$viren3$']) {
    if (!text.includes(t)) return t
  }
  throw new Error('자료 안에 인용 표시와 같은 글자가 있어 SQL 을 만들 수 없어요.')
}

/* 되돌리는 SQL 을 만든다. **돌리지는 않는다** — 사람이 보고 SQL Editor 에서 돌린다.

   ⚠️⚠️ `check` 는 `checkBackup` 이 돌려준 것이어야 하고, **ok 가 true 여야 한다.**
        검사 안 한 자료로 SQL 글자를 지으면 칸 이름 자리에 무엇이든 들어올 수 있다.
        화면에서도 단추를 막지만, 여기서 한 번 더 막는다(2026-11-05 검토 지적). */
export function restoreSql(obj, check, { only } = {}) {
  if (!check || check.ok !== true) {
    throw new Error('먼저 꾸러미 검사를 통과해야 되돌리기 SQL 을 만들 수 있어요.')
  }
  if (!isIsoTime(obj?.exported_at)) {
    throw new Error('받은 때가 모양에 안 맞아요. SQL 을 만들지 않습니다.')
  }
  const want = only ? TABLES.filter((t) => only.includes(t.name)) : TABLES
  const head = [
    '-- =====================================================================',
    '-- VIREN WORK — 되돌리기 SQL (자동으로 만든 것)',
    /* exported_at 은 위에서 모양을 확인했다. 줄바꿈이 섞여 주석을 빠져나갈 수 없다. */
    `-- 꾸러미 받은 때: ${obj.exported_at}`,
    `-- 만든 때: ${new Date().toISOString()}`,
    '--',
    '-- ⚠️ 돌리기 전에 꼭 읽으세요',
    '--   · **한 덩어리로 돌아갑니다**(begin…commit). 중간에 하나라도 걸리면',
    '--     아무것도 안 들어간 채로 되돌아갑니다. 반쪽으로 남지 않습니다.',
    '--   · 같은 번호의 줄은 **덮어씁니다.** 지금 DB 에 있는 값이 사라집니다.',
    '--   · 직원 줄은 로그인 계정(auth.users)을 가리킵니다.',
    '--     **계정을 먼저 만들어야** 직원이 들어갑니다. 안 그러면 여기서 멈춥니다.',
    '--   · 메신저·파일 본체·비밀 설정은 이 SQL 에 **없습니다.** BACKUP.md 를 보세요.',
    '-- =====================================================================',
    '',
    'begin;',
    '',
  ]
  const body = []
  for (const t of want) {
    const rows = obj?.tables?.[t.name]
    if (!Array.isArray(rows)) { body.push(`-- ${t.what}(${t.name}) — 꾸러미에 없어서 건너뜁니다.`, ''); continue }
    if (rows.length === 0) { body.push(`-- ${t.what}(${t.name}) — 0건이라 건너뜁니다.`, ''); continue }

    /* 칸 이름은 **모든 줄에서 모아** 쓴다. 첫 줄만 보면 뒤 줄의 칸이 안 덮인다.
       safeIdent 가 모양을 다시 본다 — 여기서 걸리면 SQL 을 아예 안 만든다. */
    /* ⚠️ 줄 모양이 하나라도 성하지 않으면 **만들지 않는다.** 이상한 칸 이름을 그냥
       빼고 넘어가면 그 칸이 조용히 안 들어간다 — 되돌린 줄 알았는데 일부가 빈다.
       (2026-11-05 검토 지적을 고치다 한 번 더 찾은 것) */
    const { problems, cols } = checkRows(t, rows)
    if (problems.length) {
      throw new Error(`‘${t.what}’의 줄 모양이 성하지 않아 SQL 을 만들 수 없어요: ${problems[0]}`)
    }
    const keyCols = t.key.map(safeIdent)
    const sets = cols.filter((c) => !t.key.includes(c)).map((c) => `${safeIdent(c)} = excluded.${safeIdent(c)}`)
    const json = JSON.stringify(rows)
    const tag = tagFor(json)
    body.push(
      `-- ${t.what} — ${rows.length}건`,
      `insert into public.${t.name}`,
      `select * from jsonb_populate_recordset(null::public.${t.name}, ${tag}${json}${tag}::jsonb)`,
      sets.length
        ? `on conflict (${keyCols.join(', ')}) do update set\n  ${sets.join(',\n  ')};`
        : `on conflict (${keyCols.join(', ')}) do nothing;`,
      ''
    )
  }
  return [...head, ...body, 'commit;', '', '-- 끝. 돌린 뒤 건수를 세어 꾸러미와 맞는지 확인하세요.', ''].join('\n')
}

/* ── 파일 목록(manifest) 다루기 ──────────────────────────────────── */

/* 저장소 경로로 **써도 되는** 모양인지.
   ⚠️ 꾸러미는 바깥에서 들어온 파일이다. 경로를 그대로 믿고 파일을 쓰는 도구가
      있으면 `../../어딘가` 로 폴더를 빠져나간다(경로 탈출). 받아들일 때 막는다. */
const BS = String.fromCharCode(92), NUL = String.fromCharCode(0)
export function safePath(p) {
  if (typeof p !== 'string' || p.length === 0 || p.length > 1024) return false
  if (p.includes(NUL) || p.includes(BS)) return false        // 윈도 구분자·널 글자
  if (p.startsWith('/') || /^[a-zA-Z]:/.test(p)) return false   // 뿌리부터 적은 경로
  return !p.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')
}

/* 꾸러미에 적힌 파일 목록(want)과 **실제로 내려받은 것**(got)을 맞춰 본다.
   둘 다 [{ path, size }]. 크기를 모르면 size 를 null 로 둔다(그 파일은 크기를 안 본다).
   돌려주는 것: { ok, unsafe, missing, extra, wrongSize } */
export function checkManifest(want = [], got = []) {
  const unsafe = []
  const w = new Map()
  for (const f of want) {
    if (!f || !safePath(f.path)) { unsafe.push(String(f?.path ?? '(빈 경로)').slice(0, 120)); continue }
    w.set(f.path, f.size)
  }
  const g = new Map()
  for (const f of got) {
    if (!f || !safePath(f.path)) { unsafe.push(String(f?.path ?? '(빈 경로)').slice(0, 120)); continue }
    g.set(f.path, f.size)
  }
  const missing = [...w.keys()].filter((p) => !g.has(p))
  const extra = [...g.keys()].filter((p) => !w.has(p))
  const wrongSize = [...w.entries()]
    .filter(([p, s]) => g.has(p) && s != null && g.get(p) != null && Number(s) !== Number(g.get(p)))
    .map(([p, s]) => ({ path: p, want: Number(s), got: Number(g.get(p)) }))
  return {
    ok: unsafe.length === 0 && missing.length === 0 && wrongSize.length === 0,
    unsafe, missing, extra, wrongSize,
  }
}
