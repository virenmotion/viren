import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

/* 내 결재 차례인 문서 수. 화면을 옮길 때마다 다시 센다. */
function useTodoCount() {
  const { userId } = useSession()
  const { pathname } = useLocation()
  const [n, setN] = useState(0)
  useEffect(() => {
    let alive = true
    supabase.from('approval_steps').select('doc_id', { count: 'exact', head: true })
      .eq('approver_id', userId).eq('status', 'pending')
      .then(({ count }) => alive && setN(count || 0))
    return () => { alive = false }
  }, [userId, pathname])
  return n
}

/* 안 읽은 대화 수. 새 글이 오면 바로 바뀌도록 Realtime 도 같이 듣는다. */
function useChatCount() {
  const { pathname } = useLocation()
  const [n, setN] = useState(0)
  const count = () => supabase.rpc('unread_counts')
    .then(({ data }) => setN((data || []).reduce((a, r) => a + Number(r.n), 0)))
    .catch(() => {})
  useEffect(() => { count() }, [pathname])
  useEffect(() => {
    const ch = supabase.channel('chat-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, count)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])
  return n
}

/* 메뉴 아이콘 — 선 굵기 1.8 의 단순한 모양만 쓴다 */
const ICONS = {
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  approval: <><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" /><path d="M14 3.5V8h4M9.5 13.5l2 2 3.5-4" /></>,
  attendance: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3.3V6.7M16 3.3V6.7" /></>,
  chat: <path d="M4 5.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4.5 3.5V16.5H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />,
  admin: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" /></>,
  me: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20.5c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3" /></>,
}
const Icon = ({ name }) => (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name]}
  </svg>
)

export default function Layout() {
  const { me, isAdmin } = useSession()
  const todo = useTodoCount()
  const chat = useChatCount()
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  const items = [
    { to: '/', end: true, label: '홈', icon: 'home' },
    { to: '/approval', label: '전자결재', icon: 'approval', badge: todo },
    { to: '/attendance', label: '근태', icon: 'attendance' },
    { to: '/calendar', label: '캘린더', icon: 'calendar' },
    { to: '/chat', label: '메신저', icon: 'chat', badge: chat },
    ...(isAdmin ? [{ to: '/admin', label: '관리', icon: 'admin' }] : []),
  ]

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-in">
          <NavLink to="/" className="logo" aria-label="VIREN WORK 홈">VIREN<span>WORK</span></NavLink>
          <nav className="nav" aria-label="주 메뉴">
            {items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.end}>
                {it.label}
                {it.badge > 0 && <span className="badge" aria-label={`결재할 문서 ${it.badge}건`}>{it.badge}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="who">
            <NavLink to="/me" className="who-name">
              <span className="avatar" aria-hidden="true">{(me.name || me.email).slice(0, 1)}</span>
              <span className="who-text">{me.name || me.email}</span>
            </NavLink>
            <button className="linkbtn logout" onClick={() => supabase.auth.signOut()}>로그아웃</button>
          </div>
        </div>
      </header>

      {/* 표가 넓은 화면(관리·근태)은 양옆 여백까지 쓴다 — 칸이 눌려 글자가 잘렸다 */}
      <main className={`page${pathname.startsWith('/admin') || pathname.startsWith('/attendance') ? ' wide' : ''}`}>
        <Outlet />
      </main>

      {/* 휴대폰: 아래쪽 탭 메뉴 */}
      <nav className="tabbar" aria-label="주 메뉴">
        {[...items, { to: '/me', label: '내 정보', icon: 'me' }].map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}>
            <span className="tab-ico">
              <Icon name={it.icon} />
              {it.badge > 0 && <span className="badge">{it.badge}</span>}
            </span>
            <span>{it.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
