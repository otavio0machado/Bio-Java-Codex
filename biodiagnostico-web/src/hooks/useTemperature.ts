import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { temperatureService } from '../services/temperatureService'
import type {
  TemperatureLocationRequest,
  TemperatureOcrRequest,
  TemperatureRecordFilters,
  TemperatureRecordRequest,
} from '../types/temperature'

export function useTemperatureLocations(area?: string, active?: boolean) {
  return useQuery({
    queryKey: ['temperature', 'locations', { area, active }],
    queryFn: () => temperatureService.getLocations(area, active),
    staleTime: 60_000,
    gcTime: 300_000,
  })
}

export function useTemperatureRecords(filters?: TemperatureRecordFilters) {
  return useQuery({
    queryKey: ['temperature', 'records', filters],
    queryFn: () => temperatureService.getRecords(filters),
    staleTime: 30_000,
    gcTime: 300_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useTemperatureSummary() {
  return useQuery({
    queryKey: ['temperature', 'summary'],
    queryFn: () => temperatureService.getSummary(),
    staleTime: 30_000,
    gcTime: 300_000,
    refetchInterval: 60000,
    placeholderData: (previousData) => previousData,
  })
}

export function useCreateTemperatureLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: TemperatureLocationRequest) => temperatureService.createLocation(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['temperature', 'locations'] })
      void queryClient.invalidateQueries({ queryKey: ['temperature', 'summary'] })
    },
  })
}

export function useUpdateTemperatureLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: TemperatureLocationRequest }) =>
      temperatureService.updateLocation(id, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['temperature', 'locations'] })
      void queryClient.invalidateQueries({ queryKey: ['temperature', 'summary'] })
    },
  })
}

export function useDeleteTemperatureLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => temperatureService.deleteLocation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['temperature', 'locations'] })
      void queryClient.invalidateQueries({ queryKey: ['temperature', 'summary'] })
    },
  })
}

export function useCreateTemperatureRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: TemperatureRecordRequest) => temperatureService.createRecord(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['temperature', 'records'] })
      void queryClient.invalidateQueries({ queryKey: ['temperature', 'summary'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateTemperatureRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: TemperatureRecordRequest }) =>
      temperatureService.updateRecord(id, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['temperature', 'records'] })
      void queryClient.invalidateQueries({ queryKey: ['temperature', 'summary'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteTemperatureRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => temperatureService.deleteRecord(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['temperature', 'records'] })
      void queryClient.invalidateQueries({ queryKey: ['temperature', 'summary'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useProcessTemperaturePhoto() {
  return useMutation({
    mutationFn: (request: TemperatureOcrRequest) => temperatureService.processPhoto(request),
  })
}
