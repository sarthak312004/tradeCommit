import { useId } from 'react'
import { H, SCENES, W } from './headerSceneData'

/** One scene as an SVG that fills its parent's width (use inside a positioned, overflow-hidden box). */
function HeaderScene({ sceneId, dark, className = '' }) {
  const gradientId = useId().replace(/:/g, '')
  const scene = SCENES.find((item) => item.id === sceneId)
  if (!scene) return null
  const palette = dark ? scene.dark : scene.light
  return (
    <svg
      viewBox={`0 60 ${W} ${H - 60}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
      className={`block h-full w-full ${className}`}
    >
      {scene.render(palette, `sky-${sceneId}-${gradientId}`)}
    </svg>
  )
}

export default HeaderScene
