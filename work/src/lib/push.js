import { supabase } from './supabase'
import { isInstalled, isMac } from './install'

/* 기기 알림 켜기·끄기. (지은님 2026-10-21)
 *
 * 흐름: 일꾼 등록(service worker) → 알림 허락 → 구독 → 기기를 DB 에 저장.
 *
 * ⚠️ 아이폰은 사파리에서 그냥 열어 두면 **알림을 못 받는다.** 공유 → '홈 화면에
 *    추가' 로 깔아서, 그 아이콘으로 열었을 때만 된다(iOS 16.4 이상). 안드로이드는
 *    크롬에서 바로 된다. 화면에서 이걸 안내해야 한다 — 모르면 '안 되는 앱' 이 된다.
 */

export const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC || ''

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator &&
  'PushManager' in window && 'Notification' in window

/* 아이폰·아이패드인데 아직 홈 화면 앱으로 열지 않은 상태 */
export const iosNeedsInstall = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches

const toBytes = (b64) => {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(s)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

const b64 = (buf) => {
  const b = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function ready() {
  const reg = await navigator.serviceWorker.getRegistration('/')
  return reg || navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

export async function currentSub() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration('/')
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

/* 켜기. 성공하면 구독을, 막히면 왜 막혔는지를 글로 돌려준다. */
export async function enablePush(userId) {
  if (!pushSupported()) throw new Error('이 브라우저는 알림을 지원하지 않아요.')
  if (!PUBLIC_KEY) throw new Error('알림 설정(VITE_VAPID_PUBLIC)이 아직 없습니다.')
  if (iosNeedsInstall()) {
    throw new Error("아이폰은 먼저 공유 → '홈 화면에 추가' 로 깔고, 그 아이콘으로 열어야 알림을 받을 수 있어요.")
  }

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error(denyHelp())

  const reg = await ready()
  await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(PUBLIC_KEY) })

  const j = sub.toJSON()
  const { error } = await supabase.from('push_subs').upsert({
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: j.keys?.p256dh || b64(sub.getKey('p256dh')),
    auth: j.keys?.auth || b64(sub.getKey('auth')),
    label: deviceLabel(),
  }, { onConflict: 'endpoint' })
  if (error) throw new Error('기기를 저장하지 못했어요. 잠시 뒤 다시 해 주세요.')
  return sub
}

/* 알림이 거부됐을 때, **어디를 눌러야 하는지** 기기에 맞게 알려 준다.
   ⚠️ 맥 사파리 웹앱(Dock에 추가)에는 **주소창도 자물쇠도 없다.** 그런데 그동안
      "주소창 자물쇠를 눌러라" 만 적혀 있어서 길이 막혔다(지은님 2026-11-03).
   ⚠️ 사파리에서 한 번 거부해 두면 **웹앱으로 만들어도 그 거부가 따라온다.**
      그래서 사파리 쪽 설정을 먼저 풀어야 하고, 안 되면 웹앱을 다시 만들어야 한다. */
export function denyHelp() {
  if (isMac()) {
    const again = isInstalled()
      ? " 그래도 안 되면 Dock 의 바이렌워크를 지우고, 사파리에서 파일 → 「Dock에 추가」 로 다시 만들어 주세요."
      : ''
    return '알림이 거부돼 있어요. Safari 메뉴 → 설정 → 웹사이트 → 알림 에서'
      + ' work.viren.kr 을 「허용」 으로 바꿔 주세요.' + again
      + ' (시스템 설정 → 알림 에서도 바이렌워크가 켜져 있어야 해요)'
  }
  return '알림이 거부돼 있어요. 주소창 왼쪽의 자물쇠를 눌러 이 사이트의 알림을 「허용」 으로 바꿔 주세요.'
}

export async function disablePush() {
  const sub = await currentSub()
  if (!sub) return
  await supabase.from('push_subs').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

/* 시험 알림 — 서버가 내 기기로만 보낸다 */
export async function testPush() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('다시 로그인해 주세요.')
  const res = await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ test: true }),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(out.error || '보내지 못했어요.')
  if (!out.sent) throw new Error('등록된 기기가 없어요. 알림을 먼저 켜 주세요.')
  return out
}

function deviceLabel() {
  const u = navigator.userAgent
  if (/iphone/i.test(u)) return '아이폰'
  if (/ipad/i.test(u)) return '아이패드'
  if (/android/i.test(u)) return '안드로이드폰'
  if (/mac/i.test(u)) return 'Mac'
  if (/windows/i.test(u)) return 'Windows PC'
  return '기기'
}
