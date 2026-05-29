import { api } from './api'
import type {
  ImmunologyControlSet,
  ImmunologyControlSetRequest,
  ImmunologyRun,
  ImmunologyRunRequest,
} from '../types'

export const immunologyService = {
  async getControlSets(analito?: string) {
    const response = await api.get<ImmunologyControlSet[]>('/qc/imunologia/control-sets', { params: { analito } })
    return response.data
  },
  async createControlSet(request: ImmunologyControlSetRequest) {
    const response = await api.post<ImmunologyControlSet>('/qc/imunologia/control-sets', request)
    return response.data
  },
  async updateControlSet(id: string, request: ImmunologyControlSetRequest) {
    const response = await api.put<ImmunologyControlSet>(`/qc/imunologia/control-sets/${id}`, request)
    return response.data
  },
  async deactivateControlSet(id: string) {
    await api.delete(`/qc/imunologia/control-sets/${id}`)
  },
  async getRuns(filters?: { analito?: string; controlSetId?: string; startDate?: string; endDate?: string }) {
    const response = await api.get<ImmunologyRun[]>('/qc/imunologia/runs', { params: filters })
    return response.data
  },
  async createRun(request: ImmunologyRunRequest) {
    const response = await api.post<ImmunologyRun>('/qc/imunologia/runs', request)
    return response.data
  },
}
