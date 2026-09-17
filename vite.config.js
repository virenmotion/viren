import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'node:os'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 저장소가 Dropbox 동기화 폴더 안에 있다. 기본 캐시 위치(node_modules/.vite)를 쓰면
  // Dropbox·백신이 파일을 잡고 있는 사이 vite가 deps를 교체하다 EBUSY로 죽고,
  // 브라우저에는 504 (Outdated Optimize Dep)가 뜬다. 캐시를 동기화 밖으로 뺀다.
  cacheDir: path.join(os.tmpdir(), 'viren-vite-cache'),
})
