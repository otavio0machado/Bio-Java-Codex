import { api } from './api'

export const reportService = {
  async getQcPdf(filters?: { area?: string; periodType?: string; month?: string; year?: string }) {
    const response = await api.get<Blob>('/reports/qc-pdf', {
      params: filters,
      responseType: 'blob',
    })
    return response.data
  },
  async getReagentsPdf() {
    const response = await api.get<Blob>('/reports/reagents-pdf', {
      responseType: 'blob',
    })
    return response.data
  },
}
