import { apiClient } from './client'
import type { AuditLogEntry, AuditLogFilters } from '@/types/audit'

export async function getAuditLogs(filters?: AuditLogFilters): Promise<AuditLogEntry[]> {
  const { data } = await apiClient.get<AuditLogEntry[]>('/audit-logs', { params: filters })
  return Array.isArray(data) ? data : []
}

export async function exportAuditLogs(
  filters?: AuditLogFilters,
  format: 'csv' | 'json' = 'csv'
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/audit-logs/export?format=${format}`, {
    params: filters,
    responseType: 'blob',
  })
  return data
}
