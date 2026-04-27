import { api } from './api'
import type {
  ReagentLabelSummary,
  ReagentLot,
  ReagentLotRequest,
  ReagentTagSummary,
  StockMovement,
  StockMovementRequest,
} from '../types'

/**
 * Sanitiza payload antes de submeter ao backend.
 *
 * Bloqueante audit 4.2.1: trim defensivo no {@code label} (e nas demais strings
 * obrigatorias) para impedir variantes acidentais por whitespace. Backend tambem
 * faz trim como defesa em profundidade, mas a primeira linha e aqui.
 */
function sanitizeLotRequest(request: ReagentLotRequest): ReagentLotRequest {
  return {
    ...request,
    label: request.label?.trim() ?? '',
    lotNumber: request.lotNumber?.trim() ?? '',
    manufacturer: request.manufacturer?.trim() ?? '',
    location: request.location?.trim() ?? '',
    supplier: request.supplier?.trim() || undefined,
    receivedDate: request.receivedDate || undefined,
    openedDate: request.openedDate || undefined,
  }
}

export const reagentService = {
  async getLots(category?: string, status?: string) {
    const response = await api.get<ReagentLot[]>('/reagents', { params: { category, status } })
    return response.data
  },
  async createLot(request: ReagentLotRequest) {
    const response = await api.post<ReagentLot>('/reagents', sanitizeLotRequest(request))
    return response.data
  },
  async updateLot(id: string, request: ReagentLotRequest) {
    const response = await api.put<ReagentLot>(`/reagents/${id}`, sanitizeLotRequest(request))
    return response.data
  },
  async deleteLot(id: string) {
    await api.delete(`/reagents/${id}`)
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
  /**
   * Endpoint canonico de etiquetas. Retorna agregados por {@code label} com
   * contagens por status novo (em_estoque, em_uso, fora_de_estoque, vencidos).
   */
  async getLabelSummaries() {
    const response = await api.get<ReagentLabelSummary[]>('/reagents/labels')
    return response.data
  },
  /**
   * @deprecated Alias para {@code /api/reagents/tags}. Mantido apenas para
   * eventual cliente externo durante a janela de transicao. Frontend interno
   * deve consumir {@link getLabelSummaries}.
   */
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
