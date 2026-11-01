// The four loop stages. Kept apart from scenes.js so the diagram and sandbox can import them without a circular import.

export const STAGES = [
  { id: 'strategy', name: 'Strategy', short: 'Define rules', summary: 'Define trading rules.' },
  { id: 'planner', name: 'Planner', short: 'Plan first', summary: 'Plan before trading.' },
  { id: 'journal', name: 'Journal', short: 'Record execution', summary: 'Record actual execution.' },
  { id: 'mentor', name: 'AI Mentor', short: 'Find mistakes', summary: 'Analyze execution and identify recurring mistakes.' },
]
