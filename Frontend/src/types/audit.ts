export interface AuditLogEntry {
  id: string
  timestamp: string
  userId: string
  userName: string
  userEmail?: string
  userRole?: string
  action: string
  resource?: string
  resourceId?: string
  result: string
  ip?: string
  details?: string
}

export interface AuditLogFilters {
  fromDate?: string
  toDate?: string
  userId?: string
  action?: string
  result?: string
  resource?: string
}
