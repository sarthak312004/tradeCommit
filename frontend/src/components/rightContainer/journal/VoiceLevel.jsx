import { useEffect, useRef } from 'react'

const BARS = 5

// five small bars that follow the microphone loudness; reads `levelRef` itself so the form never re-renders
function VoiceLevel({ levelRef, active }) {
  const barsRef = useRef([])

  useEffect(() => {
    if (!active) return undefined
    let frame = 0
    let smooth = 0
    const tick = () => {
      const target = levelRef?.current ?? 0
      smooth += (target - smooth) * (target > smooth ? 0.5 : 0.15) // quick attack, slow release
      barsRef.current.forEach((bar, index) => {
        if (!bar) return
        const threshold = (index + 1) / (BARS + 1)
        const height = 3 + Math.min(1, Math.max(0, (smooth - threshold * 0.55) * 3)) * 9
        bar.style.height = `${height}px`
        bar.style.opacity = smooth > threshold * 0.4 ? '1' : '0.4'
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, levelRef])

  return (
    <span aria-hidden="true" className="flex h-3 items-center gap-0.5">
      {Array.from({ length: BARS }, (_, index) => (
        <span key={index} ref={(node) => { barsRef.current[index] = node }} className="w-0.5 rounded-full bg-rose-500 transition-[opacity] duration-100" style={{ height: 3 }} />
      ))}
    </span>
  )
}

export default VoiceLevel
