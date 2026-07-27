import { Fragment } from 'react'
import Marquee from './Marquee'
import OutlineText from './OutlineText'

const WORDS = [
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
  return (
    <div className="band">
      <Marquee>
        {WORDS.map((w, i) => (
          <Fragment key={w}>
            {i % 2 ? <OutlineText>{w}</OutlineText> : <span>{w}</span>}
            <span className="sep">+</span>
          </Fragment>
        ))}
      </Marquee>
    </div>
  )
}
