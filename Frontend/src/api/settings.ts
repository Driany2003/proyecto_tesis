import { apiClient } from './client'
import type { RiskThresholds, ThresholdHistoryEntry } from '@/types/settings'

const DEFAULT_THRESHOLDS: RiskThresholds = {
  lowMax: 39,
  moderateMin: 40,
  moderateMax: 69,
  highMin: 70,
  alertThreshold: 70,
  criticalThreshold: 85,
}

export async function getRiskThresholds(): Promise<RiskThresholds> {
  const { data } = await apiClient.get<RiskThresholds>('/settings/risk-thresholds')
  return data
}

export async function updateRiskThresholds(
  thresholds: RiskThresholds,
  reason?: string
): Promise<RiskThresholds> {
  const { data } = await apiClient.put<RiskThresholds>('/settings/risk-thresholds', {
    ...thresholds,
    reason,
  })
  return data
}

export async function getThresholdHistory(): Promise<ThresholdHistoryEntry[]> {
  const { data } = await apiClient.get<ThresholdHistoryEntry[]>(
    '/settings/risk-thresholds/history'
  )
  return Array.isArray(data) ? data : []
}

export async function resetRiskThresholds(): Promise<RiskThresholds> {
  return updateRiskThresholds(DEFAULT_THRESHOLDS, 'Restaurar valores por defecto')
}

export { DEFAULT_THRESHOLDS }
