/* 업무 자료 내보내기 · 되돌리기 SQL 만들기.
   화면(BackupCard.jsx)은 여기에 있는 것을 쓰기만 한다 — 그래야 시험할 수 있다.

   ⚠️⚠️ **이것은 '전체 백업' 이 아니다.** 무료 서버에서 브라우저가 가져올 수 있는 것만
        담는다. 못 담는 것은 `MISSING` 에 적어 두고 화면에도 그대로 띄운다.
        전체를 받으려면 Supabase 대시보드에서 따로 받아야 한다 — `work/BACKUP.md`.

   ⚠️ 되돌리기(복구)는 **여기서 하지 않는다.** 핵심 표에는 insert 정책이 아예 없어서
      (문서·직원·인사 기록은 함수로만 만들어진다) 브라우저로는 넣을 수가 없다.
      대신 **SQL 을 만들어 준다.** 사람이 눈으로 보고 SQL Editor 에서 돌린다 —
      미리보기와 실행이 갈라져 있어야 실수로 덮어쓰는 일이 없다. */

/* 자료 모양이 바뀌면 올린다. 2 = 2026-11-05(건수·해시·빠진 것 적기 시작) */
export const BACKUP_VERSION = 2

/* 담는 표. **차례가 중요하다** — 가리키는 쪽(부모)이 먼저다.
   되돌릴 때 이 차례로 넣어야 '없는 줄을 가리킨다' 고 막히지 않는다.
   key = 기본키(겹칠 때 무엇으로 알아보나), order = 가져올 때 줄 세우는 기준. */
export const TABLES = [
  { name: 'settings', key: ['id'], order: 'id', what: '회사 설정' },
  { name: 'employees', key: ['id'], order: 'id', what: '직원' },
  { name: 'employee_hr', key: ['user_id'], order: 'user_id', what: '인사 기록' },
  { name: 'employee_careers', key: ['id'], order: 'id', what: '경력' },
  { name: 'employee_certs', key: ['id'], order: 'id', what: '자격증' },
  { name: 'doc_forms', key: ['id'], order: 'id', what: '결재 양식' },
  { name: 'approval_docs', key: ['id'], order: 'id', what: '결재 문서' },
  { name: 'approval_steps', key: ['doc_id', 'step'], order: 'doc_id', what: '결재선' },
  { name: 'approval_refs', key: ['doc_id', 'user_id'], order: 'doc_id', what: '참조자' },
  { name: 'approval_files', key: ['id'], order: 'id', what: '결재 첨부(파일 정보)' },
  { name: 'attendance', key: ['user_id', 'work_date'], order: 'work_date', what: '근태' },
  { name: 'event_categories', key: ['id'], order: 'id', what: '일정 분류' },
  { name: 'events', key: ['id'], order: 'id', what: '일정' },
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

/* 줄을 글자로 굳힌다. 해시를 잴 때도, 되돌리는 SQL 을 만들 때도 이것만 쓴다.
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

/* 표 하나의 해시. 줄 차례가 달라도 같은 값이 나오도록 **줄마다 재서 정렬한 뒤** 합친다.
   (가져오는 차례가 흔들려도 같은 자료면 같은 해시여야 한다) */
export async function hashRows(rows, subtle) {
  const each = await Promise.all(rows.map((r) => sha256(stable(r), subtle)))
  return sha256(each.sort().join(''), subtle)
}

/* 내려받을 꾸러미를 만든다.
   fetchTable(name, order) 는 그 표를 **전부** 가져와 배열로 준다(화면 쪽이 넘겨준다).
   listFiles(bucket) 는 파일 경로·크기 목록을 준다. 없으면 건너뛴다. */
export async function buildBackup({ fetchTable, listFiles, subtle, now }) {
  const out = {
    version: BACKUP_VERSION,
    exported_at: (now || new Date()).toISOString(),
    complete: false,          // 아래에서 정한다. **전체가 아니면 절대 true 가 아니다**
    tables: {},
    counts: {},
    hashes: {},
    files: {},
    missing: MISSING,
    problems: [],
  }

  for (const t of TABLES) {
    try {
      const rows = await fetchTable(t.name, t.order)
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
        out.files[b] = await listFiles(b)
      } catch (e) {
        /* 파일 목록은 못 받아도 자료는 쓸모가 있다. 다만 **적어 둔다.** */
        out.problems.push({ bucket: b, error: String(e?.message || e) })
      }
    }
  }

  /* '전체' 는 영원히 false 다 — 메신저·파일 본체·계정이 빠져 있다.
     거짓 안심을 주지 않으려고 자리만 남겨 둔다. */
  out.complete = false
  return out
}

/* 받아 둔 꾸러미가 성한지 본다. 되돌리기 전에 반드시 거친다. */
export async function checkBackup(obj, subtle) {
  const bad = []
  if (!obj || typeof obj !== 'object') return { ok: false, problems: ['파일을 읽지 못했어요.'], tables: [] }
  if (obj.version !== BACKUP_VERSION) {
    bad.push(obj.version
      ? `자료 모양이 ${obj.version} 판입니다. 지금 프로그램은 ${BACKUP_VERSION} 판이에요.`
      : '자료 모양 번호가 없습니다. 아주 옛날 파일이에요.')
  }
  if (!obj.exported_at) bad.push('언제 받은 것인지 적혀 있지 않습니다.')
  if (!obj.tables || typeof obj.tables !== 'object') {
    return { ok: false, problems: [...bad, '표가 하나도 들어 있지 않습니다.'], tables: [] }
  }

  const tables = []
  for (const t of TABLES) {
    const rows = obj.tables[t.name]
    if (!Array.isArray(rows)) { bad.push(`‘${t.what}’(${t.name})이 빠져 있습니다.`); continue }
    const said = obj.counts?.[t.name]
    if (said !== undefined && said !== rows.length) {
      bad.push(`‘${t.what}’ 건수가 안 맞습니다 — 적힌 건 ${said}건, 실제는 ${rows.length}건.`)
    }
    let hashOk = null
    if (obj.hashes?.[t.name]) {
      hashOk = (await hashRows(rows, subtle)) === obj.hashes[t.name]
      if (!hashOk) bad.push(`‘${t.what}’의 내용이 받은 뒤에 바뀌었습니다(해시 불일치).`)
    }
    tables.push({ name: t.name, what: t.what, rows: rows.length, hashOk })
  }
  return { ok: bad.length === 0, problems: bad, tables }
}

/* 되돌리기 미리보기 — **무엇이 몇 건 들어가는지만** 센다. 아무것도 쓰지 않는다.
   nowCounts 는 지금 DB 의 표별 건수(화면이 세어서 넘긴다). 모르면 비워 둔다. */
export function previewRestore(obj, nowCounts = {}) {
  return TABLES.map((t) => {
    const rows = obj?.tables?.[t.name]
    const have = nowCounts[t.name]
    return {
      name: t.name,
      what: t.what,
      rows: Array.isArray(rows) ? rows.length : 0,
      have: have === undefined ? null : have,
      /* ⚠️ 짧게. 휴대폰에서 이 칸이 세 줄로 쪼개진다. 자세한 말은 표 아래 경고에 있다. */
      mode: have ? '덮어씀' : '새로 넣음',
      missing: !Array.isArray(rows),
    }
  })
}

/* SQL 안에 넣을 달러 인용 표시. 자료 안에 같은 글자가 있으면 안 되므로 비켜 간다. */
function tagFor(text) {
  for (const t of ['$viren$', '$viren1$', '$viren2$', '$viren3$']) {
    if (!text.includes(t)) return t
  }
  throw new Error('자료 안에 인용 표시와 같은 글자가 있어 SQL 을 만들 수 없어요.')
}

/* 되돌리는 SQL 을 만든다. **돌리지는 않는다** — 사람이 보고 SQL Editor 에서 돌린다.
   jsonb_populate_recordset 을 쓰면 칸 이름을 하나하나 적지 않아도 되고,
   따옴표 때문에 깨질 일도 없다(자료는 JSON 한 덩어리로만 들어간다). */
export function restoreSql(obj, { only } = {}) {
  const want = only ? TABLES.filter((t) => only.includes(t.name)) : TABLES
  const head = [
    '-- =====================================================================',
    '-- VIREN WORK — 되돌리기 SQL (자동으로 만든 것)',
    `-- 꾸러미 받은 때: ${obj?.exported_at || '모름'}`,
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
    const json = JSON.stringify(rows)
    const tag = tagFor(json)
    const cols = Object.keys(rows[0])
    const sets = cols.filter((c) => !t.key.includes(c)).map((c) => `"${c}" = excluded."${c}"`)
    body.push(
      `-- ${t.what} — ${rows.length}건`,
      `insert into public.${t.name}`,
      `select * from jsonb_populate_recordset(null::public.${t.name}, ${tag}${json}${tag}::jsonb)`,
      sets.length
        ? `on conflict (${t.key.map((k) => `"${k}"`).join(', ')}) do update set\n  ${sets.join(',\n  ')};`
        : `on conflict (${t.key.map((k) => `"${k}"`).join(', ')}) do nothing;`,
      ''
    )
  }
  return [...head, ...body, 'commit;', '', '-- 끝. 돌린 뒤 건수를 세어 꾸러미와 맞는지 확인하세요.', ''].join('\n')
}
