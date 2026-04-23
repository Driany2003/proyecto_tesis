import { apiClient } from './client'
import type { Patient, PatientFormData } from '@/types/patient'

export async function getPatients(params?: { search?: string }): Promise<Patient[]> {
  const { data } = await apiClient.get<Patient[]>('/patients', { params })
  return Array.isArray(data) ? data : []
}

export async function getPatient(id: string): Promise<Patient> {
  const { data } = await apiClient.get<Patient>(`/patients/${id}`)
  return data
}

export async function createPatient(form: PatientFormData): Promise<Patient> {
  const { data } = await apiClient.post<Patient>('/patients', form)
  return data
}
