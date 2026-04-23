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

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token')
  const h: HeadersInit = {}
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

function parseJson<T>(text: string): T {
  try {
    return text ? (JSON.parse(text) as T) : ({} as T)
  } catch {
    return {} as T
  }
}

export async function listRecordings(patientId: string): Promise<RecordingSummary[]> {
  const res = await fetch(`${API_BASE}/patients/${patientId}/recordings`, {
    method: 'GET',
    headers: authHeaders(),
  })
  const text = await res.text()
  const data = parseJson<RecordingSummary[] | { error?: string }>(text)
  if (!res.ok) {
    const err = data as { error?: string }
    throw Object.assign(new Error(err.error || text || res.statusText || 'Error al listar grabaciones'), {
      response: { data, status: res.status },
    })
  }
  return Array.isArray(data) ? data : []
}

export async function getRecording(patientId: string, recordingId: string): Promise<RecordingListItem> {
  const res = await fetch(`${API_BASE}/patients/${patientId}/recordings/${recordingId}`, {
    method: 'GET',
    headers: authHeaders(),
  })
  const text = await res.text()
  const data = parseJson<RecordingListItem & { error?: string }>(text)
  if (!res.ok) {
    const err = data as { error?: string }
    throw Object.assign(new Error(err.error || text || res.statusText || 'Error al cargar la grabación'), {
      response: { data, status: res.status },
    })
  }
  return data as RecordingListItem
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
  durationSeconds: number
): Promise<RecordingUploadResponse> {
  const ext = extensionFromBlob(blob)
  const formData = new FormData()
  formData.append('file', blob, `recording.${ext}`)
  formData.append('durationSeconds', String(durationSeconds))

  const res = await fetch(`${API_BASE}/patients/${patientId}/recordings`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  })

  const text = await res.text()
  const data = parseJson<RecordingUploadResponse & { error?: string }>(text)
  if (!res.ok) {
    throw Object.assign(new Error(data.error || text || res.statusText || 'Error al subir'), {
      response: { data, status: res.status },
    })
  }
  return data as RecordingUploadResponse
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
  const res = await fetch(
    `${API_BASE}/patients/${patientId}/recordings/${recordingId}/notes`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  const text = await res.text()
  const data = parseJson<RecordingListItem & { error?: string }>(text)
  if (!res.ok) {
    const err = data as { error?: string }
    throw Object.assign(new Error(err.error || text || res.statusText || 'Error al guardar notas'), {
      response: { data, status: res.status },
    })
  }
  return data as RecordingListItem
}
