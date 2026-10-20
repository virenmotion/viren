import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const Ctx = createContext(null)

/* 로그인 상태 + 내 직원 정보 + 전체 직원 목록(이름 표시·결재자 선택용) */
export function SessionProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = 확인 중
  const [employees, setEmployees] = useState([])
  const [loadError, setLoadError] = useState('')
  const [loadedFor, setLoadedFor] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id
  const reloadEmployees = useCallback(async () => {
    if (!userId) { setEmployees([]); return }
    const { data, error } = await supabase.from('employees').select('*').order('name')
    if (error) setLoadError(error.message)
    else { setLoadError(''); setEmployees(data) }
    setLoadedFor(userId)
  }, [userId])

  useEffect(() => { reloadEmployees() }, [reloadEmployees])

  const value = useMemo(() => {
    const byId = Object.fromEntries(employees.map((e) => [e.id, e]))
    const me = userId ? byId[userId] : null
    return {
      session,
      userId,
      me,
      isAdmin: me?.role === 'admin',
      employees,
      activeEmployees: employees.filter((e) => e.active),
      nameOf: (id) => byId[id]?.name || '알 수 없음',
      empOf: (id) => byId[id],
      reloadEmployees,
      loadError,
      ready: session !== undefined && (!userId || loadedFor === userId),
    }
  }, [session, userId, employees, reloadEmployees, loadError, loadedFor])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useSession = () => useContext(Ctx)
