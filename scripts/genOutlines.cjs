/* 아웃라인/고스트 글자를 Montserrat 글리프 벡터 패스로 변환.
   브라우저는 <text>의 stroke-linejoin을 무시하므로, 패스로 뽑아 stroke해야
   모서리(bevel)가 제대로 적용된다. 단어를 바꾸면 다시 실행:
   node scripts/genOutlines.cjs  */
const fs = require('fs')
const path = require('path')
const opentype = require('opentype.js')

const load = (file) => {
  const b = fs.readFileSync(path.join(__dirname, file))
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}
const medium = load('Montserrat-Medium.ttf')
const bold = load('Montserrat-Bold.ttf')

/* opentype의 toPathData()는 커맨드가 정상인데도 특정 경우 'NaN'을 뱉는 버그가 있어
   (SVG 파서가 NaN에서 멈춰 글자가 잘림), 직접 안전하게 직렬화한다. */
function serialize(commands, prec = 2) {
  const r = (n) => {
    const v = Number(Number(n).toFixed(prec))
    return Number.isFinite(v) ? String(v) : '0'
  }
  let s = ''
  for (const c of commands) {
    switch (c.type) {
      case 'M': s += `M${r(c.x)} ${r(c.y)}`; break
      case 'L': s += `L${r(c.x)} ${r(c.y)}`; break
      case 'C': s += `C${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)} ${r(c.x)} ${r(c.y)}`; break
      case 'Q': s += `Q${r(c.x1)} ${r(c.y1)} ${r(c.x)} ${r(c.y)}`; break
      case 'Z': s += 'Z'; break
      default: break
    }
  }
  return s
}

/* 공통: 글자열 → {d, w}. baseline/fontSize/track/x0 는 렌더 SVG와 맞춘다 */
function build(font, word, { fs: FS, baseline, track, x0 = 0 }) {
  let x = x0
  const cmds = []
  for (const ch of word) {
    const glyph = font.charToGlyph(ch)
    cmds.push(...glyph.getPath(x, baseline, FS).commands)
    x += (glyph.advanceWidth / font.unitsPerEm) * FS + track
  }
  return { d: serialize(cmds), w: Math.ceil(x - track) }
}

/* 마퀴 아웃라인 (Medium 500, viewBox 높이 100 기준, letter-spacing -.03em) */
const MARQUEE = [
  'BRAND FILM', 'MOTION GRAPHICS', 'MEDIA ART', 'CGI',
  'CONTENT DESIGN', 'VISUAL STORYTELLING', 'IMMERSIVE CONTENT', 'DIGITAL EXPERIENCE',
  'VIREN',
]
const marquee = {}
MARQUEE.forEach((w) => { marquee[w] = build(medium, w, { fs: 100, baseline: 80, track: -3 }) })
fs.writeFileSync(path.join(__dirname, '..', 'src', 'outlinePaths.json'), JSON.stringify(marquee, null, 0))

/* 고스트 글자 (Bold 700, 기존 ghost SVG와 동일: viewBox 380x180, fontSize 150, x0 4, y 150, track -6) */
const GHOSTS = ['VI', 'R', 'EN']
const ghost = {}
GHOSTS.forEach((w) => { ghost[w] = build(bold, w, { fs: 150, baseline: 150, track: -6, x0: 4 }) })
fs.writeFileSync(path.join(__dirname, '..', 'src', 'ghostPaths.json'), JSON.stringify(ghost, null, 0))

console.log('marquee words:', Object.keys(marquee).length, '| ghost:', Object.keys(ghost).join(','))
console.log('DIGITAL EXPERIENCE w=', marquee['DIGITAL EXPERIENCE'].w, '| EN dLen=', ghost['EN'].d.length)
