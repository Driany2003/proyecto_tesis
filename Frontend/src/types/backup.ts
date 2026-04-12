export interface BackupRecord {
  id: string
  date: string
  sizeBytes: number
  durationSeconds: number
  status: 'success' | 'error'
  integrityHash?: string
}
