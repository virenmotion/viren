import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { listProjects, getCategories } from './lib/projectStore'
import { SEED_PROJECTS, DEFAULT_CATEGORIES } from './workProjects'

const Ctx = createContext(null)

/* WORK 프로젝트·분야를 한 번 불러와 앱 전역에 제공. 실패 시 시드/기본값 폴백. */
export function ProjectsProvider({ children }) {
  const [projects, setProjects] = useState(null) // null = 로딩 중
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
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
    try {
      const cats = await getCategories()
      if (cats && cats.length) setCategories(cats)
    } catch (e) { console.error('분야 로드 실패, 기본값 사용:', e) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const value = {
    projects: projects || [],
    categories,                                   // WORK 분야 전체(숨김 포함)
    loading: projects === null,
    error,
    refresh,
    findProject: (slug) => (projects || []).find((p) => p.slug === slug),
    catLabel: (slug) => categories.find((c) => c.slug === slug)?.label || slug,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useProjects() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider')
  return ctx
}
