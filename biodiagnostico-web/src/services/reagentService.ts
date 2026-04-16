import { api } from './api'
import type {
  ReagentLot,
  ReagentLotRequest,
  ReagentTagSummary,
  StockMovement,
  StockMovementRequest,
} from '../types'

export const reagentService = {
  async getLots(category?: string, status?: string) {
    const response = await api.get<ReagentLot[]>('/reagents', { params: { category, status } })
    return response.data
  },
  async createLot(request: ReagentLotRequest) {
    const response = await api.post<ReagentLot>('/reagents', request)
    return response.data
  },
  async updateLot(id: string, request: ReagentLotRequest) {
    const response = await api.put<ReagentLot>(`/reagents/${id}`, request)
    return response.data
  },
  async getMovements(id: string) {
    const response = await api.get<StockMovement[]>(`/reagents/${id}/movements`)
    return response.data
  },
  async createMovement(id: string, request: StockMovementRequest) {
    const response = await api.post<StockMovement>(`/reagents/${id}/movements`, request)
    return response.data
  },
  async deleteMovement(id: string) {
    await api.delete(`/reagents/movements/${id}`)
  },
  async getByLotNumber(lotNumber: string) {
    const response = await api.get<ReagentLot[]>('/reagents/by-lot-number', { params: { lotNumber } })
    return response.data
  },
  async getExpiring(days = 30) {
    const response = await api.get<ReagentLot[]>('/reagents/expiring', { params: { days } })
    return response.data
  },
  async getTagSummaries() {
    const response = await api.get<ReagentTagSummary[]>('/reagents/tags')
    return response.data
  },
  async exportCsv(category?: string, status?: string) {
    const { data } = await api.get('/reagents/export/csv', {
      params: { category, status },
      responseType: 'blob',
    })
    return data as Blob
  },
}
