/**
 * The Trading Loop mission: which of the five activation steps are done, derived ONLY from real account state.
 * Pure functions, no React, no I/O, no imports (unit tested in missionSteps.test.js).
 *
 *   1 journal   a journal exists
 *   2 planner   a planner exists                         (may be skipped)
 *   3 link      a planner is connected to the journal    (may be skipped)
 *   4 trade     at least one trade is logged (any journal; an existing trade is never asked for again)
 *   5 feedback  the AI mentor's feedback exists or was seen (server flag firstFeedbackReceived, a saved review, or opened once unlocked)
 *
 * Nothing here ever decides on the user's behalf: with several journals the target stays unset until the user picks one.
 */

export const STEP_IDS = ['journal', 'planner', 'link', 'trade', 'feedback']
export const SKIPPABLE = ['planner', 'link']

// trades still being saved (syncState set) or failed do not count as logged
export const countSavedTrades = (journal) => (journal?.trades ?? []).filter((trade) => !trade.syncState).length

// `sticky` contains steps already reached; their progress stays complete even if the source data is later removed.
export function deriveMission({ journals = [], planners = [], targetJournalId = null, mentor = null, feedbackSeen = false, skipped = [], sticky = [] } = {}) {
  const hasJournal = journals.length > 0
  const chosen = journals.find((journal) => journal.id === targetJournalId) ?? null
  const targetJournal = chosen ?? (journals.length === 1 ? journals[0] : null)
  const needsTargetChoice = journals.length > 1 && !chosen

  const hasPlanner = planners.length > 0
  const isLinkedToJournal = (planner) => journals.some((journal) => journal.id === planner.linkedJournalId)
  const linkedPlanners = planners.filter((planner) => (targetJournal ? planner.linkedJournalId === targetJournal.id : isLinkedToJournal(planner)))
  const linkablePlanners = planners.filter((planner) => !planner.linkedJournalId) // never offer to move a planner that is already linked elsewhere
  const linkDone = Boolean(targetJournal) && linkedPlanners.length > 0

  const tradeCount = journals.reduce((sum, journal) => sum + countSavedTrades(journal), 0)
  const tradeDone = tradeCount > 0

  const unlocked = Boolean(mentor?.completed)
  // the server records the first mentor review (firstFeedbackReceived); feedbackSeen covers older reviews and "opened it once"
  const feedbackDone = Boolean(feedbackSeen) || Boolean(mentor?.firstFeedbackReceived)

  const live = { journal: hasJournal, planner: hasPlanner, link: linkDone, trade: tradeDone, feedback: feedbackDone }
  const done = Object.fromEntries(STEP_IDS.map((id) => [id, live[id] || sticky.includes(id)]))
  const skippedIds = skipped.filter((id) => SKIPPABLE.includes(id) && !done[id])

  const steps = STEP_IDS.map((id) => {
    const isDone = done[id]
    const isSkipped = skippedIds.includes(id)
    let locked = false
    if (id === 'planner' || id === 'link' || id === 'trade') locked = !hasJournal
    if (id === 'link') locked = locked || !hasPlanner || needsTargetChoice
    if (id === 'trade') locked = locked || needsTargetChoice
    if (id === 'feedback') locked = !hasJournal || !unlocked
    return { id, done: isDone, skipped: isSkipped, locked: !isDone && !isSkipped && locked }
  })

  // the step to work on now: the first one that is neither done, skipped, nor waiting on something else.
  // feedback is "waiting" until unlocked, so it only becomes current once the trades are there.
  const current = steps.find((step) => !step.done && !step.skipped && !step.locked) ?? null
  const doneCount = steps.filter((step) => step.done).length
  const resolved = steps.every((step) => step.done || step.skipped)

  return {
    steps,
    doneCount,
    total: steps.length,
    currentId: current?.id ?? null,
    complete: resolved && doneCount === steps.length,
    resolved,
    targetJournal,
    needsTargetChoice,
    linkablePlanners,
    linkedPlanners,
    tradeCount,
    mentor: { count: mentor?.count ?? 0, target: mentor?.target ?? 5, unlocked },
  }
}
