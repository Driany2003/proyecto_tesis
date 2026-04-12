export interface AuditLogEntry {
  id: string
  timestamp: string
  userId: string
  userName: string
  action: string
  resource?: string
  resourceId?: string
  patientId?: string
  ip?: string
  result: 'success' | 'error' | 'denied'
  details?: string
}

export interface AuditLogFilters {
  fromDate?: string
  toDate?: string
  userId?: string
  action?: string
  patientId?: string
  result?: string
}
