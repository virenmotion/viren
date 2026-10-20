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

export default function Layout() {
  const { me, isAdmin } = useSession()
  const todo = useTodoCount()
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-in">
          <NavLink to="/" className="logo">VIREN <span>WORK</span></NavLink>
          <nav className="nav">
            <NavLink to="/" end>홈</NavLink>
            <NavLink to="/approval">
              전자결재{todo > 0 && <span className="badge" aria-label={`결재할 문서 ${todo}건`}>{todo}</span>}
            </NavLink>
            <NavLink to="/attendance">근태</NavLink>
            {isAdmin && <NavLink to="/admin">관리</NavLink>}
          </nav>
          <div className="who">
            <NavLink to="/me" className="who-name">{me.name || me.email}</NavLink>
            <button className="linkbtn" onClick={() => supabase.auth.signOut()}>로그아웃</button>
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
