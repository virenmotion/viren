/* VIREN WORK 알림 받는 일꾼 (service worker). 2026-10-21
 *
 * 하는 일은 알림 하나뿐이다. **화면 파일을 캐시하지 않는다** —
 * 캐시를 넣으면 배포한 새 화면이 안 보이는 사고가 반드시 한 번은 난다.
 * 그런 건 필요해지면 그때 따로 생각한다.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { body: e.data && e.data.text() } }
  e.waitUntil(self.registration.showNotification(d.title || 'VIREN WORK', {
    body: d.body || '',
    // 알림을 펼쳤을 때 나오는 큰 그림 — 원래 색 그대로
    icon: '/icon-192.png',
    /* ⚠️ 안드로이드 알림줄의 **작은 아이콘**이다. 안드로이드는 이 그림을
       색을 버리고 **흰색 실루엣 한 겹으로만** 그린다. 그래서 색이 든 아이콘을
       주면 모양이 다 뭉개져 **하얀 네모**가 된다(2026-10-26 지은님 지적).
       흰색 한 가지 색 + 투명 배경 PNG 여야 한다. */
    badge: '/badge-96.png',
    tag: d.tag || 'viren-work',
    renotify: d.renotify !== false,
    data: { url: d.url || '/' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of wins) {
      if (w.url.startsWith(self.location.origin)) {
        await w.focus()
        return w.navigate(url)
      }
    }
    return self.clients.openWindow(url)
  })())
})
