import { useId } from 'react'
import { H, SCENES, W } from './headerSceneData'

/**
 * One scene as an SVG.
 *  - default ("fill"): stretches to cover its box (picker thumbnails).
 *  - fixedScale: for the page header. The drawing is sized by the header's HEIGHT only and pinned to its right edge, so it
 *    never zooms when the header gets wider or narrower (sidebar collapsing, window resizing). Extra width is filled by
 *    more of the landscape (the scenes continue past both sides) and a narrower header simply crops the left side.
 */
function HeaderScene({ sceneId, dark, fixedScale = false, className = '' }) {
  const gradientId = useId().replace(/:/g, '')
  const scene = SCENES.find((item) => item.id === sceneId)
  if (!scene) return null
  const palette = dark ? scene.dark : scene.light

  return (
    <svg
      viewBox={`0 60 ${W} ${H - 60}`}
      preserveAspectRatio={fixedScale ? 'xMaxYMax meet' : 'xMidYMax slice'}
      overflow={fixedScale ? 'visible' : undefined}
      style={fixedScale ? { aspectRatio: `${W} / ${H - 60}` } : undefined}
      aria-hidden="true"
      focusable="false"
      className={fixedScale ? `absolute bottom-0 right-0 block h-full w-auto max-w-none ${className}` : `block h-full w-full ${className}`}
    >
      {scene.render(palette, `sky-${sceneId}-${gradientId}`)}
    </svg>
  )
}

export default HeaderScene
