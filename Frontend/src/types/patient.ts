export interface Patient {
  id: string
  fullName: string
  age: number
  gender: string
  dni: string
  medicalHistory?: string
  medication?: string
  comorbidities?: string
  symptomsOnsetMonths?: number
  createdAt: string
  updatedAt: string
}

export interface PatientFormData {
  fullName: string
  age: number
  gender: string
  dni: string
  medicalHistory?: string
  medication?: string
  comorbidities?: string
  symptomsOnsetMonths?: number
}

export interface SessionSummary {
  id: string
  date: string
  riskProbability?: number
  status: 'normal' | 'alerta'
}
