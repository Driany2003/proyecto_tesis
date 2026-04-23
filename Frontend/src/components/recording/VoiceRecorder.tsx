import { useCallback, useEffect, useRef, useState } from 'react'
import { getVoiceMediaStream } from '@/lib/voiceCaptureConstraints'

const MIN_DURATION = 3
const MAX_DURATION = 60

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void
  onError?: (message: string) => void
  disabled?: boolean
}

export function VoiceRecorder({ onRecordingComplete, onError, disabled = false }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await getVoiceMediaStream()
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        releaseStream()
        if (chunksRef.current.length) {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
          setRecordedBlob(blob)
        }
      }
      mediaRecorderRef.current = recorder
      recorder.start(1000)
      setIsRecording(true)
      setDuration(0)
      setRecordedBlob(null)
      timerRef.current = setInterval(() => {
        setDuration((d) => {
          if (d >= MAX_DURATION) {
            stopTimer()
            recorder.stop()
            setIsRecording(false)
            return MAX_DURATION
          }
          return d + 1
        })
      }, 1000)
    } catch {
      releaseStream()
      onError?.('No se pudo acceder al micrófono. Revise los permisos.')
    }
  }, [onError, releaseStream, stopTimer])

  const stopRecording = useCallback(() => {
    stopTimer()
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    } else {
      releaseStream()
    }
    setIsRecording(false)
  }, [releaseStream, stopTimer])

  useEffect(
    () => () => {
      stopTimer()
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          // recorder ya estaba detenido o en estado inválido
        }
      }
      releaseStream()
      mediaRecorderRef.current = null
      chunksRef.current = []
    },
    [releaseStream, stopTimer]
  )

  const handleSave = useCallback(() => {
    if (!recordedBlob) return
    if (duration < MIN_DURATION) {
      onError?.(`La grabación debe tener al menos ${MIN_DURATION} segundos.`)
      return
    }
    onRecordingComplete(recordedBlob, duration)
  }, [recordedBlob, duration, onRecordingComplete, onError])

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Se aplican reducción de ruido, cancelación de eco y control de volumen del navegador para priorizar su voz.
        Para mejores resultados, acérquese al micrófono y evite ventiladores o conversaciones cercanas.
      </p>
      {!isRecording && !recordedBlob && (
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-600 disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-500"
        >
          <span className="flex h-2.5 w-2.5 rounded-full bg-white" aria-hidden />
          Iniciar grabación
        </button>
      )}
      {isRecording && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" aria-hidden />
            Grabando… {duration} s
          </span>
          <button
            type="button"
            onClick={stopRecording}
            disabled={disabled}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
          >
            Detener
          </button>
        </div>
      )}
      {recordedBlob && !isRecording && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Duración: {duration} s {duration < MIN_DURATION && <span className="text-amber-600 dark:text-amber-400">(mín. 3 s)</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={duration < MIN_DURATION || disabled}
              className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-600 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              Guardar y enviar
            </button>
            <button
              type="button"
              onClick={() => setRecordedBlob(null)}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
