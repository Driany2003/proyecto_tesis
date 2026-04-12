import type { ConversationQuestion } from '@/types/recording'

export const DEFAULT_QUESTIONS: ConversationQuestion[] = [
  { id: '1', text: '¿Qué hizo hoy desde que se levantó?', order: 1 },
  { id: '2', text: '¿Cómo se siente en este momento?', order: 2 },
  { id: '3', text: '¿Qué desayunó?', order: 3 },
  { id: '4', text: '¿Tuvo un buen descanso anoche?', order: 4 },
  { id: '5', text: '¿Hay algo que le gustaría contarme?', order: 5 },
]
