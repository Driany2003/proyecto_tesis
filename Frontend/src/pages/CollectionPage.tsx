import { useState, useRef, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPatient } from '@/api/patients'
import { listRecordings, uploadRecording } from '@/api/recordings'
import { apiClient } from '@/api/client'
import { DEFAULT_QUESTIONS } from '@/constants/conversationQuestions'
import { useToast } from '@/contexts/ToastContext'
import { PageHeader, SectionCard, SectionCardSimple, SectionDivider } from '@/layout/PageSection'
import { IconUsers, IconMicrophone } from '@/components/icons/SidebarIcons'

type Step = 'register' | 'recording' | 'done'

interface RecordingResult {
  questionIndex: number
  question: string
  blob: Blob
  durationSeconds: number
}

export function CollectionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [step, setStep] = useState<Step>('register')
  const [patientId, setPatientId] = useState<string | null>(null)
  const [patientName, setPatientName] = useState('')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [results, setResults] = useState<RecordingResult[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<{ id: string; fullName: string; dni: string }[]>([])
  const [ageError, setAgeError] = useState<string | null>(null)
  const [docType, setDocType] = useState('DNI')
  const [dniError, setDniError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'wizard' | 'list'>('wizard')
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null)

  const { data: collectedPatients = [] } = useQuery({
    queryKey: ['patients-with-stored-recordings'],
    queryFn: async () => {
      const { data } = await apiClient.get('/patients/with-stored-recordings')
      return Array.isArray(data) ? data : []
    },
    enabled: viewMode === 'list',
  })

  const createPatientMutation = useMutation({
    mutationFn: (data: { fullName: string; age: number; gender: string; dni: string }) =>
      createPatient(data),
    onSuccess: (patient) => {
      setPatientId(patient.id)
      setPatientName(patient.fullName)
      setStep('recording')
      setCurrentQuestion(0)
      setResults([])
      setShowForm(false)
      setSearch('')
      setSuggestions([])
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : 'Error al registrar paciente')
    }
  })

  const handleSearch = async (value: string) => {
    setSearch(value)
    if (value.trim().length < 2) {
      setSuggestions([])
      return
    }
    try {
      const { data } = await apiClient.get('/patients', { params: { search: value.trim() } })
      const list = Array.isArray(data) ? data : []
      setSuggestions(list.slice(0, 5).map((p: any) => ({ id: p.id, fullName: p.fullName, dni: p.dni })))
    } catch {
      setSuggestions([])
    }
  }

  const selectPatient = (p: { id: string; fullName: string; dni: string }) => {
    setPatientId(p.id)
    setPatientName(p.fullName)
    setStep('recording')
    setCurrentQuestion(0)
    setResults([])
    setSearch('')
    setSuggestions([])
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const docType = (form.get('docType') as string) || 'DNI'
    const dni = form.get('dni') as string
    const fullDni = docType === 'DNI' ? dni : `${docType}-${dni}`

    try {
      const patient = await createPatientMutation.mutateAsync({
        fullName: form.get('fullName') as string,
        age: Number(form.get('age')),
        gender: form.get('gender') as string,
        dni: fullDni,
      })
      setPatientId(patient.id)
      setPatientName(patient.fullName)
      setStep('recording')
      setCurrentQuestion(0)
      setResults([])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      const isDuplicate = msg.includes('DNI') || msg.includes('Ya existe')

      if (isDuplicate) {
        try {
          const { data: existing } = await apiClient.get(`/patients/by-dni/${dni}`)
          if (existing) {
            setPatientId(existing.id)
            setPatientName(existing.fullName)
            setStep('recording')
            setCurrentQuestion(0)
            setResults([])
            toast.info(`Paciente ya registrado: ${existing.fullName}. Continuando con sus datos.`)
            return
          }
        } catch {}
      }
      toast.error(msg || 'Error al registrar paciente')
      setError(msg || 'Error al registrar paciente')
    }
  }

  const handleRecordingComplete = (blob: Blob, durationSeconds: number) => {
    const q = DEFAULT_QUESTIONS[currentQuestion]
    setResults(prev => [...prev, { questionIndex: currentQuestion, question: q.text, blob, durationSeconds }])
  }

  const handleNextQuestion = () => {
    if (currentQuestion < DEFAULT_QUESTIONS.length - 1) {
      setCurrentQuestion(prev => prev + 1)
    } else {
      uploadAllRecordings()
    }
  }

  const uploadAllRecordings = async () => {
    if (!patientId) return
    setIsUploading(true)
    let success = 0
    let failed = 0
    const total = results.length

    for (let i = 0; i < total; i++) {
      const r = results[i]
      setUploadProgress(`Guardando ${i + 1} de ${total}...`)
      let uploaded = false
      for (let attempt = 0; attempt < 3 && !uploaded; attempt++) {
        try {
          await uploadRecording(patientId, r.blob, r.durationSeconds, false)
          success++
          uploaded = true
        } catch (err: unknown) {
          const status = (err as any)?.response?.status
          if (status === 429) {
            await new Promise(resolve => setTimeout(resolve, 5000))
          } else if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 1500))
          } else {
            failed++
          }
        }
      }
      if (i < total - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    setUploadProgress('')
    setIsUploading(false)
    queryClient.invalidateQueries({ queryKey: ['recordings', patientId] })
    setStep('done')
    if (failed === 0) {
      toast.success(`${success} grabaciones guardadas correctamente`)
    } else {
      toast.warning(`${success} guardadas, ${failed} fallaron`)
    }
  }

  const resetAll = () => {
    setStep('register')
    setPatientId(null)
    setPatientName('')
    setCurrentQuestion(0)
    setResults([])
    setError(null)
    setShowForm(false)
    setSearch('')
    setSuggestions([])
    setAgeError(null)
    setUploadProgress('')
  }

  return (
    <div>
      <PageHeader
        title="Recolección de datos de voz"
        subtitle={viewMode === 'list' ? 'Pacientes con grabaciones recolectadas'
          : step === 'register' ? 'Registre al paciente para iniciar la sesión de grabación'
          : step === 'recording' ? `Paciente: ${patientName} — Pregunta ${currentQuestion + 1} de ${DEFAULT_QUESTIONS.length}`
          : 'Sesión completada'}
      />

      <div className="mb-6 flex gap-2">
        <button onClick={() => { setViewMode('wizard'); resetAll() }}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${viewMode === 'wizard' ? 'bg-sky-500 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
          Nueva sesión
        </button>
        <button onClick={() => setViewMode('list')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${viewMode === 'list' ? 'bg-sky-500 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
          Ver grabaciones recolectadas
        </button>
      </div>

      {viewMode === 'list' && (
        <SectionCard title="Grabaciones recolectadas" description="Pacientes registrados con sus sesiones de recolección">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Paciente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">DNI</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Edad</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Grabaciones</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Acción</th>
                </tr>
              </thead>
              <tbody>
                {collectedPatients.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No hay pacientes con grabaciones recolectadas aún.</td></tr>
                ) : (
                  collectedPatients.map((p: any) => {
                    const isExpanded = expandedPatient === p.id
                    return (
                    <Fragment key={p.id}>
                    <tr key={p.id} onClick={() => setExpandedPatient(isExpanded ? null : p.id)}
                      className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{p.fullName}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.dni}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.age}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {p.storedRecordings?.length || 0} recolectadas
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={(e) => {
                          e.stopPropagation()
                          setPatientId(p.id); setPatientName(p.fullName);
                          setStep('recording'); setCurrentQuestion(0); setResults([]);
                          setViewMode('wizard');
                        }}
                          className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600">
                          Nueva grabación
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${p.id}-recordings`} className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50">
                        <td colSpan={5} className="px-6 py-4">
                          <RecordingsList patientId={p.id} storedRecordings={p.storedRecordings || []} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )})
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {viewMode === 'wizard' && step === 'register' && (
        <SectionCard title="Buscar o registrar paciente" description="Busque por nombre o DNI. Si no existe, regístrelo." icon={<IconUsers className="h-5 w-5" />}>
          <div className="max-w-md space-y-4">
            <div className="relative">
              <label className="mb-1 block text-sm font-medium text-slate-600">Buscar paciente</label>
              <input
                type="text"
                placeholder="Escriba nombre o DNI del paciente..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="input-base w-full"
                autoFocus
              />
              {suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
                  {suggestions.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => selectPatient(p)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-sky-50 dark:hover:bg-sky-900/30"
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-100">{p.fullName}</span>
                        <span className="text-xs text-slate-400">DNI {p.dni}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!showForm ? (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400"
              >
                + Crear nuevo paciente
              </button>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-600">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">Nombre completo</label>
                    <input name="fullName" required placeholder="Ej. Juan Pérez"
                      onKeyDown={(e) => { if (/\d/.test(e.key)) e.preventDefault() }}
                      className="input-base w-full" defaultValue={search} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">Número de documento</label>
                    <div className="flex rounded-lg border border-slate-300 overflow-hidden dark:border-slate-600">
                      <select name="docType"
                        value={docType}
                        onChange={(e) => { setDocType(e.target.value); setDniError(null) }}
                        className="w-20 shrink-0 border-r border-slate-300 bg-slate-50 px-1.5 py-2 text-[11px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
                        <option value="DNI">DNI</option>
                        <option value="CÉDULA">CÉDULA</option>
                        <option value="PASAPORTE">PASAPORTE</option>
                      </select>
                      <input name="dni" required placeholder={docType === 'DNI' ? '8 dígitos' : docType === 'CÉDULA' ? '8-10 dígitos' : '6-12 caracteres'}
                        onKeyDown={(e) => {
                          if (docType !== 'PASAPORTE' && !/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Tab' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                            e.preventDefault()
                          }
                        }}
                        maxLength={docType === 'PASAPORTE' ? 12 : 10}
                        onChange={(e) => {
                          const v = e.target.value
                          if (docType === 'DNI' && !/^\d*$/.test(v)) return
                          if (docType === 'DNI' && v.length === 8) setDniError(null)
                          else if (docType === 'DNI' && v.length > 0 && v.length !== 8) setDniError('DNI requiere 8 dígitos')
                          else if (docType === 'CÉDULA' && v.length > 0 && v.length < 8) setDniError('Cédula requiere 8-10 dígitos')
                          else if (docType === 'PASAPORTE' && v.length > 0 && v.length < 6) setDniError('Pasaporte requiere 6-12 caracteres')
                          else setDniError(null)
                        }}
                        className="flex-1 border-0 bg-white px-2 py-2 text-sm focus:outline-none dark:bg-slate-800 dark:text-slate-100" />
                    </div>
                    {dniError && <p className="mt-1 text-xs text-red-500">{dniError}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">Edad</label>
                    <input name="age" type="number" required min={18} max={90}
                      onKeyDown={(e) => { if (['e','E','+','-','.'].includes(e.key)) e.preventDefault() }}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setAgeError(v > 90 ? 'Máximo 90 años' : v < 18 && e.target.value ? 'Mínimo 18 años' : null)
                      }}
                      className="input-base w-full" />
                    {ageError && <p className="mt-1 text-xs text-red-500">{ageError}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">Género</label>
                    <select name="gender" required className="input-base w-full">
                      <option value="">Seleccionar</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                    </select>
                  </div>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex items-center gap-4">
                  <button type="submit" disabled={createPatientMutation.isPending}
                    className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-sky-600 disabled:opacity-50">
                    {createPatientMutation.isPending ? 'Registrando…' : 'Registrar y comenzar a grabar'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="text-sm text-slate-500 hover:text-slate-700">
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </SectionCard>
      )}

      {step === 'recording' && patientId && (
        <div className="space-y-4">
          <SectionCardSimple>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Pregunta: <span className="text-sky-600 dark:text-sky-400">{DEFAULT_QUESTIONS[currentQuestion].text}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">Lea esta pregunta al paciente y grabe su respuesta (10-30 segundos)</p>
          </SectionCardSimple>
          <SectionCard title="Grabar respuesta" description="Mínimo 3s, máximo 30s" icon={<IconMicrophone className="h-5 w-5" />}>
            <MiniRecorder
              key={currentQuestion}
              onComplete={handleRecordingComplete}
              minDuration={3}
              maxDuration={30}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 dark:border-slate-600">
              {results.length > currentQuestion && (
                <span className="text-sm text-emerald-600 dark:text-emerald-400">Grabación lista ✓</span>
              )}
              <button type="button" onClick={handleNextQuestion} disabled={results.length <= currentQuestion || isUploading}
                className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:opacity-50">
                {isUploading ? uploadProgress : currentQuestion < DEFAULT_QUESTIONS.length - 1 ? 'Siguiente pregunta' : 'Finalizar y guardar'}
              </button>
              {isUploading && <span className="text-sm text-sky-600">{uploadProgress}</span>}
            </div>
          </SectionCard>
          <div className="mt-4 flex gap-2">
            {DEFAULT_QUESTIONS.map((_, i) => (
              <span key={i} className={`h-2 w-2 rounded-full ${i === currentQuestion ? 'bg-sky-500' : i < results.length ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
            ))}
          </div>
        </div>
      )}

      {step === 'done' && (
        <SectionCard title="Sesión completada" description={`${results.length} grabaciones guardadas para ${patientName}`}>
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">Resumen de la sesión:</p>
            <ul className="space-y-2">
              {results.map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <span className="text-emerald-500">✓</span>
                  <span className="font-medium">Pregunta {i + 1}:</span>
                  <span className="text-slate-500">{r.durationSeconds}s</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200 dark:border-slate-600">
              <button onClick={resetAll}
                className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-600">
                Nueva sesión
              </button>
              <button onClick={() => navigate('/patients')}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                Ir a pacientes
              </button>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

function MiniRecorder({ onComplete, minDuration, maxDuration }: {
  onComplete: (blob: Blob, seconds: number) => void
  minDuration: number
  maxDuration: number
}) {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [recorded, setRecorded] = useState(false)
  const [tooShort, setTooShort] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const durationRef = useRef(0)

  const cleanup = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    mediaRecorderRef.current = null
  }

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 48000, channelCount: 1 } })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        cleanup()
        if (chunksRef.current.length) {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
          const secs = durationRef.current
          if (secs < minDuration) {
            setTooShort(true)
            setRecorded(true)
          } else {
            setRecorded(true)
            setTooShort(false)
            onComplete(blob, secs)
          }
        }
      }
      mediaRecorderRef.current = recorder
      recorder.start(500)
      setIsRecording(true)
      setDuration(0)
      durationRef.current = 0
      setRecorded(false)
      timerRef.current = setInterval(() => {
        durationRef.current += 1
        setDuration(durationRef.current)
        if (durationRef.current >= maxDuration) {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
          }
        }
      }, 1000)
    } catch {
      cleanup()
    }
  }

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    } else {
      cleanup()
    }
    setIsRecording(false)
  }

  useEffect(() => () => cleanup(), [])

  return (
    <div className="space-y-3">
      {!isRecording && !recorded && (
        <button onClick={start} className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-medium text-white hover:bg-red-600">
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
          Iniciar grabación
        </button>
      )}
      {isRecording && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-red-600">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            Grabando… {duration}s
          </span>
          <button onClick={stop} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            Detener
          </button>
        </div>
      )}
      {recorded && !isRecording && (
        tooShort ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-red-600">
              ✕ Muy corto ({durationRef.current}s). Mínimo {minDuration} segundos.
            </span>
            <button onClick={() => { setRecorded(false); setTooShort(false); }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Intentar de nuevo
            </button>
          </div>
        ) : (
          <span className="text-sm font-medium text-emerald-600">✓ Grabado ({durationRef.current}s)</span>
        )
      )}
    </div>
  )
}

function RecordingsList({ patientId, storedRecordings }: { patientId: string; storedRecordings: any[] }) {
  if (storedRecordings.length === 0) return <p className="text-sm text-slate-500">Sin grabaciones recolectadas</p>

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{storedRecordings.length} grabaciones recolectadas</p>
      {storedRecordings.map((r: any) => (
        <AudioPlayerRow key={r.id} patientId={patientId} recordingId={r.id} durationSeconds={r.durationSeconds} createdAt={r.createdAt} />
      ))}
    </div>
  )
}

function AudioPlayerRow({ patientId, recordingId, durationSeconds, createdAt }: {
  patientId: string; recordingId: string; durationSeconds: number; createdAt: string
}) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadAudio = async () => {
    if (audioUrl) return
    setLoading(true)
    try {
      const { data } = await apiClient.get(`/patients/${patientId}/recordings/${recordingId}/audio-url`)
      setAudioUrl(data.url)
    } catch { setLoading(false) }
  }

  useEffect(() => {
    if (audioUrl) setLoading(false)
  }, [audioUrl])

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-600 dark:bg-slate-900">
      <span className="text-xs text-slate-500 shrink-0 w-16">{new Date(createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
      <span className="text-xs text-slate-400 shrink-0 w-10">{durationSeconds}s</span>
      {!audioUrl ? (
        <button onClick={loadAudio} disabled={loading}
          className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50">
          {loading ? 'Cargando...' : '▶ Reproducir'}
        </button>
      ) : (
        <audio controls src={audioUrl} className="h-8 flex-1" />
      )}
    </div>
  )
}
