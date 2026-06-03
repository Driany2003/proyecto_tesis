import { apiClient } from './client'

interface RecordingUploadResponse {
  recordingId: string
  sessionId: string
  status: string
  message: string
}

export interface RecordingCharts {
  acoustic_png?: string
  linguistic_png?: string
  risk_png?: string
  [key: string]: string | undefined
}

export interface RecordingSummary {
  id: string
  status: string
  durationSeconds: number
  createdAt: string
  processedAt: string | null
  pParkinson: number | null
  riskBand: string | null
  errorMessage: string | null
  physicianName?: string | null
  audioAvailable?: boolean
}

export interface RecordingListItem extends RecordingSummary {
  charts: RecordingCharts | null
  noteConsiderations?: string | null
  noteAnnotations?: string | null
  noteComplications?: string | null
  audioUrl?: string | null
  audioUrlExpiresInMinutes?: number | null
}

export async function listRecordings(patientId: string): Promise<RecordingSummary[]> {
  const res = await apiClient.get<RecordingSummary[]>(`/patients/${patientId}/recordings`)
  return Array.isArray(res.data) ? res.data : []
}

export async function getRecording(patientId: string, recordingId: string): Promise<RecordingListItem> {
  const res = await apiClient.get<RecordingListItem>(`/patients/${patientId}/recordings/${recordingId}`)
  return res.data
}

function extensionFromBlob(blob: Blob): string {
  const t = blob.type || ''
  if (t.includes('webm')) return 'webm'
  if (t.includes('ogg')) return 'ogg'
  if (t.includes('mp4') || t.includes('mpeg')) return 'm4a'
  if (t.includes('wav')) return 'wav'
  return 'webm'
}

export async function uploadRecording(
  patientId: string,
  blob: Blob,
  durationSeconds: number,
  triggerPipeline = true
): Promise<RecordingUploadResponse> {
  const ext = extensionFromBlob(blob)
  const formData = new FormData()
  formData.append('file', blob, `recording.${ext}`)
  formData.append('durationSeconds', String(durationSeconds))
  formData.append('triggerPipeline', String(triggerPipeline))

  const res = await apiClient.post<RecordingUploadResponse>(
    `/patients/${patientId}/recordings`,
    formData,
    { headers: { 'Content-Type': undefined } }
  )
  return res.data
}

export async function patchRecordingNotes(
  patientId: string,
  recordingId: string,
  body: {
    noteConsiderations: string
    noteAnnotations: string
    noteComplications: string
  }
): Promise<RecordingListItem> {
  const res = await apiClient.patch<RecordingListItem>(
    `/patients/${patientId}/recordings/${recordingId}/notes`,
    body
  )
  return res.data
}
