export interface RecordingUploadResponse {
  recordingId: string
  sessionId: string
  status: string
  message: string
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

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
  const filename = `recording.${ext}`
  const formData = new FormData()
  formData.append('file', blob, filename)
  formData.append('durationSeconds', String(durationSeconds))

  const token = localStorage.getItem('token')
  const headers: HeadersInit = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}/patients/${patientId}/recordings`, {
    method: 'POST',
    headers,
    body: formData,
  })

  let data: RecordingUploadResponse & { error?: string } = {} as RecordingUploadResponse & {
    error?: string
  }
  const text = await res.text()
  try {
    data = text ? (JSON.parse(text) as typeof data) : data
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    throw Object.assign(new Error(data.error || text || res.statusText || 'Error al subir'), {
      response: { data, status: res.status },
    })
  }

  return data as RecordingUploadResponse
}
