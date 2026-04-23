import { useState } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getPatient, getPatients } from '@/api/patients'
import { uploadRecording } from '@/api/recordings'
import { DEFAULT_QUESTIONS } from '@/constants/conversationQuestions'
import { ConversationGuide } from '@/components/recording/ConversationGuide'
import { PageHeader, SectionCard, SectionCardSimple, SectionDivider } from '@/layout/PageSection'
import { IconUsers } from '@/components/icons/SidebarIcons'

export function NewRecordingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id: paramId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const patientId = paramId ?? searchParams.get('patientId')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')

  const {
    data: patient,
    isError: isPatientError,
    error: patientError,
    refetch: refetchPatient,
    isFetching: isPatientFetching,
  } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => getPatient(patientId!),
    enabled: !!patientId,
  })

  const { data: patientsData } = useQuery({
    queryKey: ['patients'],
    queryFn: () => getPatients(),
  })
  const patients = Array.isArray(patientsData) ? patientsData : []

  const handleRecordingComplete = async (blob: Blob, durationSeconds: number) => {
    if (!patientId) return
    setUploadError(null)
    setIsUploading(true)
    try {
      await uploadRecording(patientId, blob, durationSeconds)
      await queryClient.invalidateQueries({ queryKey: ['recordings', patientId] })
      await queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
      navigate(`/patients/${patientId}#analisis`, { replace: true })
    } catch (e: unknown) {
      if (e instanceof Error) {
        setUploadError(e.message || 'Error al subir la grabación')
      } else {
        setUploadError('No se pudo subir la grabación. Intente de nuevo.')
      }
    } finally {
      setIsUploading(false)
    }
  }

  const canRecord = !!patientId && !!patient

  return (
    <div>
      <PageHeader
        title="Nueva grabación"
        subtitle={
          patient
            ? `Paciente: ${patient.fullName}`
            : patientId
              ? isPatientError
                ? 'No se pudo cargar el paciente'
                : 'Cargando paciente…'
              : 'Seleccione un paciente para iniciar la grabación'
        }
      />

      {patientId && isPatientError && (
        <SectionCardSimple className="mb-6 border-red-200/80 bg-red-50/80 dark:border-red-800/60 dark:bg-red-950/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-red-800 dark:text-red-100">
              {patientError instanceof Error
                ? patientError.message
                : 'Error al cargar los datos del paciente.'}
            </p>
            <button
              type="button"
              onClick={() => refetchPatient()}
              disabled={isPatientFetching}
              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-red-900/40 dark:text-red-100 dark:hover:bg-red-900/60"
            >
              {isPatientFetching ? 'Reintentando…' : 'Reintentar'}
            </button>
          </div>
        </SectionCardSimple>
      )}

      {!patientId && patients.length > 0 && (
        <SectionCard
          title="Seleccione un paciente"
          description="Elija el paciente con el que realizará la grabación. También puede ir a Pacientes y usar «Grabar voz» en la ficha del paciente."
          icon={<IconUsers className="h-5 w-5" />}
          className="mb-6"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 sm:max-w-xs">
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Paciente
              </label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="input-base"
                aria-label="Seleccionar paciente"
              >
                <option value="">Elegir paciente…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} (DNI {p.dni})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!selectedPatientId}
              onClick={() => selectedPatientId && navigate(`/patients/${selectedPatientId}/record`)}
              className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-600 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              Continuar a grabar
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            O desde{' '}
            <Link to="/patients" className="font-medium text-sky-600 underline underline-offset-2 dark:text-sky-400">
              Pacientes
            </Link>
            , pulse «Grabar voz» en la fila del paciente.
          </p>
        </SectionCard>
      )}

      {!patientId && patients.length === 0 && (
        <SectionCard
          title="No hay pacientes registrados"
          description="Registre al menos un paciente para poder realizar grabaciones."
          icon={<IconUsers className="h-5 w-5" />}
          className="mb-6 border-slate-200 dark:border-slate-600"
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <Link to="/patients" className="font-semibold text-sky-600 underline underline-offset-2 dark:text-sky-400">
              Ir a Pacientes
            </Link>{' '}
            para dar de alta el primer paciente.
          </p>
        </SectionCard>
      )}

      {patient && (
        <>
          <SectionDivider label="Paciente" />
          <SectionCardSimple className="mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700 dark:bg-sky-900/60 dark:text-sky-200">
                {patient.fullName.split(/\s+/).map((s) => s[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">{patient.fullName}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">DNI {patient.dni}</p>
              </div>
            </div>
          </SectionCardSimple>
        </>
      )}

      {canRecord && (
        <>
          <SectionDivider label="Grabación" />
          {isUploading && (
            <SectionCardSimple className="mb-4 border-amber-200/80 bg-amber-50/80 dark:border-amber-800/60 dark:bg-amber-950/30">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Subiendo audio y registrando análisis…
              </p>
            </SectionCardSimple>
          )}
          <ConversationGuide
            questions={DEFAULT_QUESTIONS}
            onComplete={handleRecordingComplete}
            disabled={isUploading}
          />
        </>
      )}

      {uploadError && (
        <SectionCardSimple className="mt-6 border-red-200/80 bg-red-50/80 dark:border-red-800/60 dark:bg-red-950/30">
          <p className="text-sm font-medium text-red-800 dark:text-red-100">{uploadError}</p>
        </SectionCardSimple>
      )}
    </div>
  )
}
