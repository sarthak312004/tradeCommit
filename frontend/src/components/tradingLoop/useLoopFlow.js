import { useCallback, useState } from 'react'

/** Scene index + direction of travel. Persistence is the caller's job (onChange), so the flow stays reusable. */
export function useLoopFlow(scenes, initialId, onChange) {
  const [nav, setNav] = useState(() => ({ index: Math.max(0, scenes.findIndex((scene) => scene.id === initialId)), direction: 1 }))

  const goTo = useCallback((target) => {
    const next = Math.min(Math.max(target, 0), scenes.length - 1)
    if (next === nav.index) return
    setNav({ index: next, direction: next > nav.index ? 1 : -1 })
    onChange?.(scenes[next].id)
  }, [nav.index, scenes, onChange])

  return {
    index: nav.index,
    direction: nav.direction,
    scene: scenes[nav.index],
    isFirst: nav.index === 0,
    isLast: nav.index === scenes.length - 1,
    goTo,
    next: () => goTo(nav.index + 1),
    back: () => goTo(nav.index - 1),
  }
}
