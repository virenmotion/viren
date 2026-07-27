import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { listProjects } from './lib/projectStore'
import { SEED_PROJECTS } from './workProjects'

const Ctx = createContext(null)

/* WORK 프로젝트 목록을 한 번 불러와 앱 전역에 제공. 실패 시 시드로 폴백. */
export function ProjectsProvider({ children }) {
  const [projects, setProjects] = useState(null) // null = 로딩 중
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const rows = await listProjects()
      setProjects(rows)
      setError(null)
    } catch (e) {
      console.error('프로젝트 로드 실패, 시드로 폴백:', e)
      setProjects(SEED_PROJECTS)
      setError(e)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const value = {
    projects: projects || [],
    loading: projects === null,
    error,
    refresh,
    findProject: (slug) => (projects || []).find((p) => p.slug === slug),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useProjects() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider')
  return ctx
}
