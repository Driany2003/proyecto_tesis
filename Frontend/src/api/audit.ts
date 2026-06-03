import { apiClient } from './client'
import type { AuditLogEntry, AuditLogFilters } from '@/types/audit'

export async function getAuditLogs(filters?: AuditLogFilters): Promise<AuditLogEntry[]> {
  const params: Record<string, string | undefined> = {}
  if (filters?.fromDate) params.fromDate = filters.fromDate
  if (filters?.toDate) params.toDate = filters.toDate
  if (filters?.action) params.action = filters.action
  if (filters?.result) params.result = filters.result
  if (filters?.userId) params.userId = filters.userId
  if (filters?.resource) params.resource = filters.resource
  const { data } = await apiClient.get<AuditLogEntry[]>('/audit-logs', { params })
  return Array.isArray(data) ? data : []
}

export async function exportAuditLogs(
  filters?: AuditLogFilters,
  _format: 'csv' | 'json' = 'csv'
): Promise<Blob> {
  const params: Record<string, string | undefined> = {}
  if (filters?.fromDate) params.fromDate = filters.fromDate
  if (filters?.toDate) params.toDate = filters.toDate
  if (filters?.action) params.action = filters.action
  if (filters?.result) params.result = filters.result
  const { data } = await apiClient.get<Blob>(`/audit-logs/export`, {
    params,
    responseType: 'blob',
  })
  return data
}
