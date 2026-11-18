/** Socratic study loop: prompt → (hint) → compare your hunch with the reveal → rate → next step. Pure, no React. */

export type Phase = 'PROMPTING' | 'HINT_REVEALED' | 'COMPARING' | 'SESSION_COMPLETE'
/** 1 = Missed it, 2 = Close, 3 = Nailed it */
export type Rating = 1 | 2 | 3
export type StepRecord = { step: number; hunch: string; rating: Rating; usedHint: boolean; isRetry: boolean }

export type SocraticState = {
  queue: number[] // step indexes; a missed step is appended once more
  pos: number // index into queue
  phase: Phase
  hunch: string
  hintUsed: boolean // hint opened for the current queue entry
  hints: number // hints opened in total
  hintSteps: number[] // which steps had a hint opened (unique)
  retries: Record<number, number> // step → retries used (max 1)
  completed: StepRecord[] // in queue order, so completed[i] belongs to queue[i]
}

export type SocraticAction =
  | { type: 'TYPE'; text: string }
  | { type: 'HINT' }
  | { type: 'REVEAL' }
  | { type: 'RATE'; rating: Rating }
  | { type: 'RESET'; steps: number }

export const MAX_RETRIES = 1

export const initSocratic = (steps: number): SocraticState => ({
  queue: Array.from({ length: steps }, (_, i) => i),
  pos: 0,
  phase: steps ? 'PROMPTING' : 'SESSION_COMPLETE',
  hunch: '',
  hintUsed: false,
  hints: 0,
  hintSteps: [],
  retries: {},
  completed: [],
})

const asking = (p: Phase) => p === 'PROMPTING' || p === 'HINT_REVEALED'

/** Actions that don't fit the current phase are ignored (returns the same state), so key handlers can dispatch freely. */
export function socratic(s: SocraticState, a: SocraticAction): SocraticState {
  const step = s.queue[s.pos]
  switch (a.type) {
    case 'RESET':
      return initSocratic(a.steps)
    case 'TYPE':
      return asking(s.phase) ? { ...s, hunch: a.text } : s
    case 'HINT':
      if (s.phase !== 'PROMPTING') return s
      return {
        ...s,
        phase: 'HINT_REVEALED',
        hintUsed: true,
        hints: s.hints + 1,
        hintSteps: s.hintSteps.includes(step) ? s.hintSteps : [...s.hintSteps, step],
      }
    case 'REVEAL':
      return asking(s.phase) ? { ...s, phase: 'COMPARING', hunch: s.hunch.trim() } : s
    case 'RATE': {
      if (s.phase !== 'COMPARING') return s
      const isRetry = s.completed.some(r => r.step === step)
      const requeue = a.rating === 1 && (s.retries[step] ?? 0) < MAX_RETRIES
      const queue = requeue ? [...s.queue, step] : s.queue
      const pos = s.pos + 1
      return {
        ...s,
        queue,
        pos,
        phase: pos >= queue.length ? 'SESSION_COMPLETE' : 'PROMPTING',
        hunch: '',
        hintUsed: false,
        retries: requeue ? { ...s.retries, [step]: (s.retries[step] ?? 0) + 1 } : s.retries,
        completed: [...s.completed, { step, hunch: s.hunch, rating: a.rating, usedHint: s.hintUsed, isRetry }],
      }
    }
  }
}

export const tally = (done: StepRecord[]) => ({
  missed: done.filter(r => r.rating === 1).length,
  close: done.filter(r => r.rating === 2).length,
  nailed: done.filter(r => r.rating === 3).length,
})
