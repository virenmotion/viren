import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { SessionProvider, useSession } from './lib/session'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import Approvals from './pages/Approvals'
import ApprovalNew from './pages/ApprovalNew'
import ApprovalView from './pages/ApprovalView'
import Attendance from './pages/Attendance'
import Calendar from './pages/Calendar'
import Chat from './pages/Chat'
import ChatRoom from './pages/ChatRoom'
import Admin from './pages/Admin'
import Me from './pages/Me'

export default function App() {
  if (!supabase) {
    return (
      <div className="center-screen">
        <div className="card narrow">
          <h1 className="brand-title">VIREN WORK</h1>
          <p>서버 설정이 아직 없습니다. <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code> 환경변수를 넣고 다시 배포해 주세요.</p>
        </div>
      </div>
    )
  }
  return (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  )
}

function Gate() {
  const { session, me, ready, loadError } = useSession()
  if (!ready) return <div className="center-screen muted">불러오는 중…</div>
  if (!session) return <Login />
  if (!me) {
    return (
      <div className="center-screen">
        <div className="card narrow">
          <h1 className="brand-title">VIREN WORK</h1>
          <p>{loadError || '이 계정은 사용이 중지되었거나 직원 정보가 없습니다. 관리자에게 문의해 주세요.'}</p>
          <button className="btn" onClick={() => supabase.auth.signOut()}>로그아웃</button>
        </div>
      </div>
    )
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="approval" element={<Approvals />} />
        <Route path="approval/new" element={<ApprovalNew />} />
        <Route path="approval/:id" element={<ApprovalView />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="chat" element={<Chat />} />
        <Route path="chat/:id" element={<ChatRoom />} />
        <Route path="me" element={<Me />} />
        <Route path="admin" element={<AdminOnly />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function AdminOnly() {
  const { isAdmin } = useSession()
  return isAdmin ? <Admin /> : <Navigate to="/" replace />
}
