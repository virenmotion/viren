import { Fragment, useEffect, useState } from 'react'
import Marquee from './Marquee'
import OutlineText from './OutlineText'
import { getBandWords } from '../lib/projectStore'

/* 관리자에서 저장한 문구가 없거나 미연결이면 이 기본값으로 표시 */
export const DEFAULT_BAND_WORDS = [
  'BRAND FILM',
  'MOTION GRAPHICS',
  'MEDIA ART',
  'CGI',
  'CONTENT DESIGN',
  'VISUAL STORYTELLING',
  'IMMERSIVE CONTENT',
  'DIGITAL EXPERIENCE',
]

export default function Band() {
  const [words, setWords] = useState(DEFAULT_BAND_WORDS)

  useEffect(() => {
    getBandWords()
      .then((list) => { if (Array.isArray(list) && list.length) setWords(list) })
      .catch(() => {})
  }, [])

  return (
    <div className="band">
      <Marquee>
        {words.map((w, i) => (
          <Fragment key={`${i}-${w}`}>
            {i % 2 ? <OutlineText>{w}</OutlineText> : <span>{w}</span>}
            <span className="sep">+</span>
          </Fragment>
        ))}
      </Marquee>
    </div>
  )
}
