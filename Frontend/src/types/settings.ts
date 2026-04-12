export interface RiskThresholds {
  lowMax: number
  moderateMin: number
  moderateMax: number
  highMin: number
  alertThreshold: number
  criticalThreshold?: number
}

export interface ThresholdHistoryEntry {
  id: string
  date: string
  userId: string
  userName: string
  previous: RiskThresholds
  next: RiskThresholds
  reason?: string
}
