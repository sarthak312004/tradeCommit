import { useCallback, useEffect, useRef, useState } from 'react'
import './cloudFade.css'

/**
 * A scrolling area with a soft cloud along its bottom edge. The cloud appears while there is more to scroll
 * and fades away at the end of the list. `className` styles the outer frame, `scrollClassName` the scroller itself.
 */
function ScrollFade({ children, className = '', scrollClassName = '' }) {
  const scrollerRef = useRef(null)
  const [hasMore, setHasMore] = useState(false)

  const update = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    setHasMore(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > 24)
  }, [])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return undefined

    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    // the page inside can grow (new trade, filter, another tab) without the scroller itself resizing
    const resizeObserver = new ResizeObserver(schedule)
    let observed = null
    const observeContent = () => {
      const content = scroller.firstElementChild
      if (content === observed) return
      if (observed) resizeObserver.unobserve(observed)
      observed = content
      if (content) resizeObserver.observe(content)
    }

    const mutationObserver = new MutationObserver(() => {
      observeContent()
      schedule()
    })

    resizeObserver.observe(scroller)
    observeContent()
    mutationObserver.observe(scroller, { childList: true })
    scroller.addEventListener('scroll', schedule, { passive: true })
    schedule()

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      scroller.removeEventListener('scroll', schedule)
    }
  }, [update])

  return (
    <div className={`relative ${className}`}>
      <div ref={scrollerRef} className={scrollClassName}>
        {children}
      </div>
      <div aria-hidden="true" data-on={hasMore} className="tc-cloud" />
    </div>
  )
}

export default ScrollFade
