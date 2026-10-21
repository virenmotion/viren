import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { rankOrder } from './labels'

const Ctx = createContext(null)

/* 로그인 상태 + 내 직원 정보 + 전체 직원 목록(이름 표시·결재자 선택용) */
export function SessionProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = 확인 중
  const [employees, setEmployees] = useState([])
  const [loadError, setLoadError] = useState('')
  const [loadedFor, setLoadedFor] = useState(null)
  /* 부서 순서. 관리 → 직원에서 지은님이 정한다. 비어 있으면 가나다순. */
  const [deptOrder, setDeptOrder] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id
  const reloadEmployees = useCallback(async () => {
    if (!userId) { setEmployees([]); return }
    const [{ data, error }, cfg] = await Promise.all([
      supabase.from('employees').select('*').order('name'),
      supabase.from('settings').select('dept_order').eq('id', 1).maybeSingle(),
    ])
    /* dept_order 칸이 아직 없는 DB 에서도 목록은 떠야 한다 */
    const order = Array.isArray(cfg?.data?.dept_order) ? cfg.data.dept_order : []
    setDeptOrder(order)
    if (error) setLoadError(error.message)
    else {
      setLoadError('')
      /* 1차 부서, 2차 직급(대표→사원), 3차 이름 (지은님 2026-10-21).
         · 부서는 **지은님이 정한 순서**를 먼저 따르고, 목록에 없는 부서는 뒤에 가나다순.
         · 직급도 글자 순이 아니라 RANKS 에 적은 순서(대표→사원). */
      const deptRank = (d) => {
        const i = order.indexOf((d || '').trim())
        return i < 0 ? order.length : i
      }
      setEmployees([...data].sort((a, b) =>
        deptRank(a.dept) - deptRank(b.dept)
        || (a.dept || '').localeCompare(b.dept || '', 'ko')
        || rankOrder(a.position) - rankOrder(b.position)
        || (a.name || '').localeCompare(b.name || '', 'ko')))
    }
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
      deptOrder,
      loadError,
      ready: session !== undefined && (!userId || loadedFor === userId),
    }
  }, [session, userId, employees, reloadEmployees, deptOrder, loadError, loadedFor])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useSession = () => useContext(Ctx)
