import { apiClient } from './client'
import type { BackupRecord } from '@/types/backup'

export async function getBackups(): Promise<BackupRecord[]> {
  const { data } = await apiClient.get<BackupRecord[]>('/backups')
  return Array.isArray(data) ? data : []
}

export async function createBackup(): Promise<BackupRecord> {
  const { data } = await apiClient.post<BackupRecord>('/backups')
  return data
}

export async function restoreBackup(backupId: string): Promise<BackupRecord> {
  const { data } = await apiClient.post<BackupRecord>('/backups/restore', { backupId })
  return data
}
