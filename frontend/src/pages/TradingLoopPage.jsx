import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import TradingLoopDialog from '../components/tradingLoop/TradingLoopDialog'
import { SCENES } from '../components/tradingLoop/scenes'
import { useGuidance } from '../hooks/useGuidance'
import { GUIDES } from '../utils/guidance'

/**
 * /trading-loop : a standalone preview of The Trading Loop, for QA and for sharing a deep link.
 * Lives under Home, so it needs a signed-in session like every other page. It never reads or writes onboarding state,
 * and it does not depend on the rollout switch. Optional ?scene=<id> (welcome, strategy, planner, journal, mentor, loop).
 * It asks the guidance controller for the screen like every other guide, so it can never overlap one.
 */
export default function TradingLoopPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { activeId, request, release } = useGuidance()
  const requested = params.get('scene')
  const initialSceneId = SCENES.some((scene) => scene.id === requested) ? requested : SCENES[0].id
  const leave = () => {
    release(GUIDES.LOOP_PREVIEW)
    navigate('/', { replace: true })
  }

  useEffect(() => {
    request(GUIDES.LOOP_PREVIEW, { trigger: 'user' })
    return () => release(GUIDES.LOOP_PREVIEW)
  }, [request, release])

  if (activeId !== GUIDES.LOOP_PREVIEW) return null
  return <TradingLoopDialog mode="preview" initialSceneId={initialSceneId} onComplete={leave} onSkip={leave} onClose={leave} />
}
