import { api } from './api'
import type { DashboardAlerts, DashboardKpi, QcRecord } from '../types'

export const dashboardService = {
  async getKpis(area?: string) {
    const response = await api.get<DashboardKpi>('/dashboard/kpis', { params: area ? { area } : undefined })
    return response.data
  },
  async getAlerts() {
    const response = await api.get<DashboardAlerts>('/dashboard/alerts')
    return response.data
  },
  async getRecentRecords(area?: string, limit = 10) {
    const response = await api.get<QcRecord[]>('/dashboard/recent-records', {
      params: { area, limit },
    })
    return response.data
  },
}
