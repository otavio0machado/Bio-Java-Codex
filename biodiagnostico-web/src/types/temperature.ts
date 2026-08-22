export type LocationCategory =
  | 'GELADEIRA'
  | 'FREEZER'
  | 'ESTUFA'
  | 'BANHO_MARIA'
  | 'AMBIENTE'
  | 'OUTRO'

export type TemperatureStatus = 'CONFORME' | 'NAO_CONFORME' | 'ALERTA'

export interface TemperatureLocation {
  id: string
  name: string
  code: string
  category: LocationCategory | string
  area: string
  minTempTarget: number
  maxTempTarget: number
  minHumidityTarget?: number | null
  maxHumidityTarget?: number | null
  thermometerCode?: string | null
  calibrationCertNumber?: string | null
  calibrationDueDate?: string | null
  frequency: string
  active: boolean
  notes?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface TemperatureLocationRequest {
  name: string
  code: string
  category: LocationCategory | string
  area?: string
  minTempTarget: number
  maxTempTarget: number
  minHumidityTarget?: number | null
  maxHumidityTarget?: number | null
  thermometerCode?: string | null
  calibrationCertNumber?: string | null
  calibrationDueDate?: string | null
  frequency?: string
  active?: boolean
  notes?: string | null
}

export interface TemperatureRecord {
  id: string
  locationId: string
  locationName: string
  locationCode: string
  category: string
  area: string
  minTempTarget?: number | null
  maxTempTarget?: number | null
  date: string
  time: string
  period: string
  tempCurrent?: number | null
  tempMax: number
  tempMin: number
  tempMaxIn?: number | null
  tempMinIn?: number | null
  humidity?: number | null
  status: TemperatureStatus | string
  responsible: string
  actionTaken?: string | null
  notes?: string | null
  photoUrl?: string | null
  photoFilename?: string | null
  photoMinUrl?: string | null
  photoMinFilename?: string | null
  ocrApplied: boolean
  createdAt?: string
  updatedAt?: string
}

export interface TemperatureRecordRequest {
  locationId: string
  date: string
  time: string
  period?: string
  tempCurrent?: number | null
  tempMax: number
  tempMin: number
  tempMaxIn?: number | null
  tempMinIn?: number | null
  humidity?: number | null
  responsible: string
  actionTaken?: string | null
  notes?: string | null
  photoUrl?: string | null
  photoFilename?: string | null
  photoMinUrl?: string | null
  photoMinFilename?: string | null
  ocrRawResult?: string | null
  ocrApplied?: boolean
}

export interface TemperatureOcrRequest {
  imageBase64?: string
  mimeType?: string
  imageMinBase64?: string
  mimeTypeMin?: string
  locationId?: string
}

export interface TemperatureOcrResponse {
  time?: string | null
  tempMax?: number | null
  tempMin?: number | null
  tempMaxIn?: number | null
  tempMinIn?: number | null
  tempCurrent?: number | null
  humidity?: number | null
  extractedDate?: string | null
  confidence?: number
  statusMessage?: string
  rawText?: string
}

export interface TemperatureSummary {
  totalLocations: number
  activeLocations: number
  recordedToday: number
  pendingToday: number
  nonCompliantToday: number
  nonCompliantMonth: number
  expiringCalibrationsCount: number
}

export interface TemperatureRecordFilters {
  locationId?: string
  month?: number
  year?: number
  startDate?: string
  endDate?: string
  status?: string
}
