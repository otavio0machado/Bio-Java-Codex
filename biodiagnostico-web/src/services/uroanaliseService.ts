import { api } from './api'
import type {
  UroSedimentRun,
  UroSedimentRunRequest,
  UroStripControlSet,
  UroStripControlSetRequest,
  UroStripRun,
  UroStripRunRequest,
} from '../types'

export const uroanaliseService = {
  // Controles da fita
  async getControlSets(filters?: { includeInactive?: boolean }) {
    const response = await api.get<UroStripControlSet[]>('/qc/uroanalise/control-sets', { params: filters })
    return response.data
  },

  async createControlSet(request: UroStripControlSetRequest) {
    const response = await api.post<UroStripControlSet>('/qc/uroanalise/control-sets', request)
    return response.data
  },

  async updateControlSet(id: string, request: UroStripControlSetRequest) {
    const response = await api.put<UroStripControlSet>(`/qc/uroanalise/control-sets/${id}`, request)
    return response.data
  },

  async deactivateControlSet(id: string) {
    await api.delete(`/qc/uroanalise/control-sets/${id}`)
  },

  // Corridas de fita reativa
  async getStripRuns(filters?: { startDate?: string; endDate?: string }) {
    const response = await api.get<UroStripRun[]>('/qc/uroanalise/strip/runs', { params: filters })
    return response.data
  },

  async createStripRun(request: UroStripRunRequest) {
    const response = await api.post<UroStripRun>('/qc/uroanalise/strip/runs', request)
    return response.data
  },

  async deleteStripRun(id: string) {
    await api.delete(`/qc/uroanalise/strip/runs/${id}`)
  },

  // Corridas de sedimento urinário
  async getSedimentRuns(filters?: { startDate?: string; endDate?: string }) {
    const response = await api.get<UroSedimentRun[]>('/qc/uroanalise/sediment/runs', { params: filters })
    return response.data
  },

  async createSedimentRun(request: UroSedimentRunRequest) {
    const response = await api.post<UroSedimentRun>('/qc/uroanalise/sediment/runs', request)
    return response.data
  },

  async deleteSedimentRun(id: string) {
    await api.delete(`/qc/uroanalise/sediment/runs/${id}`)
  },
}
