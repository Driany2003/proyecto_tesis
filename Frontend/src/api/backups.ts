import { apiClient } from './client'
import type { BackupRecord } from '@/types/backup'

export async function getBackups(): Promise<BackupRecord[]> {
  const { data } = await apiClient.get<BackupRecord[]>('/backups')
  return Array.isArray(data) ? data : []
}

export async function restoreBackup(backupId: string): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>('/backups/restore', { backupId })
  return data
}
