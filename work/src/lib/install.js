/* 컴퓨터·휴대폰에 '앱' 으로 설치하기. (지은님 2026-10-21)
 *
 * 설치 파일(.exe)을 따로 만들지 않는다. 브라우저가 이 주소를 **독립 창**으로
 * 띄워 주는 방식이다(PWA). 주소창 없이 뜨고, 작업표시줄에 꽂히고, 알림도 그대로다.
 * 고칠 때마다 설치 파일을 다시 나눠 줄 필요가 없다 — 열면 늘 최신이다.
 *
 * ⚠️ 설치 단추는 **크롬·엣지에서만** 뜬다. 브라우저가 "이제 설치해도 된다" 고
 *    알려 줄 때(beforeinstallprompt)만 누를 수 있기 때문. 사파리는 안 알려 주므로
 *    사람이 메뉴로 설치해야 한다 → 화면에서 안내한다.
 */

let deferred = null
const listeners = new Set()
const tell = () => listeners.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()      // 브라우저가 알아서 띄우는 막대를 막고, 우리 단추로 받는다
    deferred = e
    tell()
  })
  window.addEventListener('appinstalled', () => { deferred = null; tell() })
}

export const canInstall = () => !!deferred
export const onInstallChange = (f) => { listeners.add(f); return () => listeners.delete(f) }

export async function install() {
  if (!deferred) return 'none'
  const e = deferred
  deferred = null
  tell()
  e.prompt()
  const { outcome } = await e.userChoice
  return outcome   // 'accepted' | 'dismissed'
}

/* 이미 앱 창으로 열려 있나 */
export const isInstalled = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)

/* 어떤 기기·브라우저인지 — 손으로 설치해야 할 때 맞는 안내를 보여 주려고 */
export function platform() {
  const u = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(u)) return 'ios'
  if (/android/i.test(u)) return 'android'
  if (/edg\//i.test(u)) return 'edge'
  if (/chrome\//i.test(u) && !/opr\//i.test(u)) return 'chrome'
  if (/safari\//i.test(u)) return 'safari'
  return 'other'
}

/* 작업표시줄·독 아이콘에 안 읽은 수를 띄운다. 앱으로 설치했을 때만 보인다.
   지원하지 않는 브라우저도 많아서 조용히 넘어간다. */
export function setBadge(n) {
  try {
    if (!('setAppBadge' in navigator)) return
    if (n > 0) navigator.setAppBadge(n)
    else navigator.clearAppBadge()
  } catch { /* 안 되면 그만 */ }
}
