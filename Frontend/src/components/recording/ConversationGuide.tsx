import { useState } from 'react'
import type { PresentationMode } from '@/types/recording'
import type { ConversationQuestion } from '@/types/recording'
import { QuestionPrompt } from './QuestionPrompt'
import { VoiceRecorder } from './VoiceRecorder'
import { SectionCard, SectionCardSimple } from '@/layout/PageSection'

interface ConversationGuideProps {
  questions: ConversationQuestion[]
  onComplete: (audioBlob: Blob, durationSeconds: number) => void | Promise<void>
  disabled?: boolean
}

type Step = 'mode' | 'question' | 'record'

export function ConversationGuide({ questions, onComplete, disabled = false }: ConversationGuideProps) {
  const [presentationMode, setPresentationMode] = useState<PresentationMode | null>(null)
  const [step, setStep] = useState<Step>('mode')
  const [questionIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const currentQuestion = questions[questionIndex]

  const handleModeSelect = (mode: PresentationMode) => {
    setPresentationMode(mode)
    setStep('question')
  }

  const handleNextFromQuestion = () => {
    setStep('record')
  }

  const goBackToMode = () => {
    setStep('mode')
    setPresentationMode(null)
  }

  const goBackToQuestion = () => {
    setStep('question')
  }

  const handleRecordingComplete = (blob: Blob, durationSeconds: number) => {
    setError(null)
    onComplete(blob, durationSeconds)
  }

  if (step === 'mode') {
    return (
      <SectionCard
        title="Modo de presentación"
        description="Elija cómo se mostrarán las preguntas al paciente."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <button
            type="button"
            onClick={() => handleModeSelect('text')}
            className="rounded-xl border-2 border-sky-500 bg-sky-50 px-5 py-3.5 text-left text-sm font-medium text-sky-800 transition-colors hover:border-sky-600 hover:bg-sky-100 dark:border-sky-500 dark:bg-sky-900/40 dark:text-sky-100 dark:hover:bg-sky-900/60"
          >
            Solo texto (el paciente lee)
          </button>
          <button
            type="button"
            onClick={() => handleModeSelect('tts')}
            className="rounded-xl border-2 border-slate-200 bg-white px-5 py-3.5 text-left text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            La máquina lee la pregunta (voz)
          </button>
        </div>
      </SectionCard>
    )
  }

  if (step === 'question' && currentQuestion && presentationMode) {
    return (
      <SectionCardSimple>
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Pregunta {questionIndex + 1} de {questions.length}
        </p>
        <QuestionPrompt
          question={currentQuestion}
          mode={presentationMode}
          onNext={handleNextFromQuestion}
          onBack={goBackToMode}
        />
      </SectionCardSimple>
    )
  }

  if (step === 'record' && presentationMode !== null) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/25 dark:text-red-300">
            {error}
          </div>
        )}
        <SectionCard
          title="Grabar respuesta"
          description="Mínimo 3 s, máximo 60 s. El paciente debe responder en voz alta."
        >
          <div className="space-y-4">
            <VoiceRecorder
              onRecordingComplete={handleRecordingComplete}
              onError={setError}
              disabled={disabled}
            />
            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-600">
              <button
                type="button"
                onClick={goBackToQuestion}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Regresar a la pregunta
              </button>
              <button
                type="button"
                onClick={goBackToMode}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cambiar modo (leer o escuchar)
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    )
  }

  return null
}
