import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConversationQuestion } from '@/types/recording'
import type { PresentationMode } from '@/types/recording'

function getPreferredSpanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  const esVoices = voices.filter((v) => v.lang === 'es-ES' || v.lang === 'es-MX' || v.lang.startsWith('es'))
  if (esVoices.length === 0) return null
  const preferred = esVoices.find(
    (v) =>
      /google|microsoft|natural|premium|helena|sabina|paulina|monica|jorge|daniel/i.test(v.name) ||
      (!v.name.toLowerCase().includes('compact') && !v.name.toLowerCase().includes('enhanced'))
  )
  return preferred ?? esVoices[0]
}

interface QuestionPromptProps {
  question: ConversationQuestion
  mode: PresentationMode
  onNext: () => void
  onBack?: () => void
}

export function QuestionPrompt({ question, mode, onNext, onBack }: QuestionPromptProps) {
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const [voicesReady, setVoicesReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const onVoicesChanged = () => setVoicesReady(true)
    if (window.speechSynthesis.getVoices().length > 0) setVoicesReady(true)
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged)
  }, [])

  const speak = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(question.text)
    u.lang = 'es-ES'
    u.rate = 0.92
    u.pitch = 1
    u.volume = 1
    const voice = getPreferredSpanishVoice()
    if (voice) u.voice = voice
    window.speechSynthesis.speak(u)
    synthRef.current = window.speechSynthesis
  }, [question.text])

  useEffect(() => {
    if (mode === 'tts') {
      const t = setTimeout(speak, voicesReady ? 0 : 400)
      return () => {
        clearTimeout(t)
        window.speechSynthesis?.cancel()
      }
    }
    return () => window.speechSynthesis?.cancel()
  }, [mode, speak, voicesReady])

  return (
    <div className="space-y-5">
      <p className="text-lg leading-relaxed text-slate-800 dark:text-slate-100">{question.text}</p>
      {mode === 'tts' && (
        <button
          type="button"
          onClick={speak}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Reproducir de nuevo
        </button>
      )}
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Cuando el paciente esté listo, continúe para grabar su respuesta.
      </p>
      <div className="flex flex-wrap gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Regresar (elegir leer o escuchar)
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          Siguiente: grabar respuesta
        </button>
      </div>
    </div>
  )
}
