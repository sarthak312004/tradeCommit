import { requestJson } from '../utils/http'

/** { count, target, completed, celebrated, badge, completedAt }: distinct trades logged towards unlocking AI feedback. */
export const getMentorProgress = () => requestJson('/api/v1/progress/mentor', { cache: 'no-store' })

/** Marks the "your feedback is here" moment as seen. */
export const markMentorCelebrated = () => requestJson('/api/v1/progress/mentor/celebrated', { method: 'POST' })
