import catalog from './mascotCatalog.json'

/* 바이렌 마스코트 스티커. (2026-10-26)

   ⚠️ **DB 를 바꾸지 않는다.** 스티커는 새로운 종류의 글이 아니라
   `messages.text` 에 들어가는 **정해진 한 줄**이다:

     [바이렌 스티커: 확인했어요] (viren-mascot:v1:sticker_01)

   읽는 쪽은 이 줄이 아래 목록과 **글자 하나까지 똑같을 때만** 그림으로 바꿔 그린다.
   그래서
     · 옛날 앱·휴대폰 알림에서는 그냥 읽을 수 있는 글로 보이고,
     · 누가 비슷하게 흉내 낸 글을 보내도 그림이 되지 않으며,
     · 아무 주소나 HTML 을 끌어다 그리는 일이 없다.

   ⚠️ `/mascot/v1/` 그림은 **지우면 안 된다.** 지난 대화가 그 주소를 본다.
      그림을 바꿀 일이 생기면 v2 폴더를 새로 만든다. */

export const mascotAssets = Object.freeze(catalog.map(Object.freeze))
const byId = new Map(mascotAssets.map((a) => [a.id, a]))

const kindName = (kind) => (kind === 'sticker' ? '스티커' : '반응')

export function mascotText(id) {
  const asset = byId.get(id)
  if (!asset) throw new Error('사용할 수 없는 스티커예요.')
  return `[바이렌 ${kindName(asset.kind)}: ${asset.label}] (viren-mascot:v1:${asset.id})`
}

const byText = new Map(mascotAssets.map((a) => [mascotText(a.id), a]))

/* 이 글이 스티커인가? 아니면 null — 보통 글은 그대로 글로 둔다. */
export function readMascot(text) {
  return byText.get(text) || null
}

/* 대화 목록의 '마지막 글' 미리보기 — 식별자는 숨기고 사람 말로 */
export function mascotSummary(text) {
  const asset = readMascot(text)
  return asset ? `바이렌 ${kindName(asset.kind)} · ${asset.label}` : text
}
