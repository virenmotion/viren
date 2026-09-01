import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { listProjects, getCategories } from './lib/projectStore'
import { isConfigured } from './lib/supabase'
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
    /* 지금 보고 있는 목록이 DB에서 온 진짜 데이터인가.
       false면 시드 폴백이라 "이 slug가 없다 = 삭제된 프로젝트"라고 단정할 수 없다.
       ⚠️ WorkDetail의 noindex 판정이 이 값에 의존한다 — 아래 사고 참고.

       사고(2026-09-01): DB 조회가 실패하면 SEED_PROJECTS(6건, 지금 DB와 슬러그가
       하나도 겹치지 않음)로 폴백하는데, 그 상태에서는 모든 프로젝트 페이지가
       "없는 페이지"로 판정돼 noindex가 붙었다. 구글 서치 콘솔에
       "'NOINDEX' 태그에 의해 제외되었습니다 — 2페이지"로 잡혔다. */
    trusted: isConfigured && !error && projects !== null,
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
