import { api } from './api'
import type {
  TemperatureLocation,
  TemperatureLocationRequest,
  TemperatureOcrRequest,
  TemperatureOcrResponse,
  TemperatureRecord,
  TemperatureRecordFilters,
  TemperatureRecordRequest,
  TemperatureSummary,
} from '../types/temperature'

export const temperatureService = {
  async getLocations(area?: string, active?: boolean): Promise<TemperatureLocation[]> {
    const params = new URLSearchParams()
    if (area) params.append('area', area)
    if (active !== undefined) params.append('active', String(active))

    const response = await api.get<TemperatureLocation[]>(`/temperature/locations?${params.toString()}`)
    return response.data
  },

  async getLocationById(id: string): Promise<TemperatureLocation> {
    const response = await api.get<TemperatureLocation>(`/temperature/locations/${id}`)
    return response.data
  },

  async createLocation(request: TemperatureLocationRequest): Promise<TemperatureLocation> {
    const response = await api.post<TemperatureLocation>('/temperature/locations', request)
    return response.data
  },

  async updateLocation(id: string, request: TemperatureLocationRequest): Promise<TemperatureLocation> {
    const response = await api.put<TemperatureLocation>(`/temperature/locations/${id}`, request)
    return response.data
  },

  async deleteLocation(id: string): Promise<void> {
    await api.delete(`/temperature/locations/${id}`)
  },

  async getRecords(filters?: TemperatureRecordFilters): Promise<TemperatureRecord[]> {
    const params = new URLSearchParams()
    if (filters?.locationId) params.append('locationId', filters.locationId)
    if (filters?.month !== undefined) params.append('month', String(filters.month))
    if (filters?.year !== undefined) params.append('year', String(filters.year))
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)
    if (filters?.status) params.append('status', filters.status)

    const response = await api.get<TemperatureRecord[]>(`/temperature/records?${params.toString()}`)
    return response.data
  },

  async getRecordById(id: string): Promise<TemperatureRecord> {
    const response = await api.get<TemperatureRecord>(`/temperature/records/${id}`)
    return response.data
  },

  async createRecord(request: TemperatureRecordRequest): Promise<TemperatureRecord> {
    const response = await api.post<TemperatureRecord>('/temperature/records', request)
    return response.data
  },

  async updateRecord(id: string, request: TemperatureRecordRequest): Promise<TemperatureRecord> {
    const response = await api.put<TemperatureRecord>(`/temperature/records/${id}`, request)
    return response.data
  },

  async deleteRecord(id: string): Promise<void> {
    await api.delete(`/temperature/records/${id}`)
  },

  async processPhoto(request: TemperatureOcrRequest): Promise<TemperatureOcrResponse> {
    const response = await api.post<TemperatureOcrResponse>('/temperature/ocr', request)
    return response.data
  },

  async getSummary(): Promise<TemperatureSummary> {
    const response = await api.get<TemperatureSummary>('/temperature/summary')
    return response.data
  },

  async exportExcel(locationId?: string, month?: number, year?: number): Promise<Blob> {
    const params = new URLSearchParams()
    if (locationId) params.append('locationId', locationId)
    if (month !== undefined) params.append('month', String(month))
    if (year !== undefined) params.append('year', String(year))

    const response = await api.get(`/temperature/export/excel?${params.toString()}`, {
      responseType: 'blob',
    })
    return response.data
  },

  async exportPdf(locationId?: string, month?: number, year?: number): Promise<Blob> {
    const params = new URLSearchParams()
    if (locationId) params.append('locationId', locationId)
    if (month !== undefined) params.append('month', String(month))
    if (year !== undefined) params.append('year', String(year))

    const response = await api.get(`/temperature/export/pdf?${params.toString()}`, {
      responseType: 'blob',
    })
    return response.data
  },
}
