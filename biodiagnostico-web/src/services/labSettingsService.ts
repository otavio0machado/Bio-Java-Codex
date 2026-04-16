import { api } from './api'

export interface LabSettings {
  labName: string
  responsibleName: string
  responsibleRegistration: string
  address: string
  phone: string
  email: string
}

export interface LabReportEmail {
  id: string
  email: string
  name: string
  isActive: boolean
}

export const labSettingsService = {
  async getSettings() {
    const { data } = await api.get<LabSettings>('/lab-settings')
    return data
  },
  async updateSettings(payload: LabSettings) {
    const { data } = await api.put<LabSettings>('/lab-settings', payload)
    return data
  },
  async listEmails() {
    const { data } = await api.get<LabReportEmail[]>('/lab-settings/emails')
    return data
  },
  async addEmail(payload: { email: string; name?: string }) {
    const { data } = await api.post<LabReportEmail>('/lab-settings/emails', {
      ...payload,
      isActive: true,
    })
    return data
  },
  async toggleEmail(id: string, active: boolean) {
    const { data } = await api.patch<LabReportEmail>(`/lab-settings/emails/${id}`, null, {
      params: { active },
    })
    return data
  },
  async removeEmail(id: string) {
    await api.delete(`/lab-settings/emails/${id}`)
  },
}
