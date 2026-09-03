import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { uroanaliseService } from '../services/uroanaliseService'
import type {
  UroSedimentRunRequest,
  UroStripControlSetRequest,
  UroStripRunRequest,
} from '../types'

export function useUroStripControlSets(filters?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: ['uroanalise', 'control-sets', filters],
    queryFn: () => uroanaliseService.getControlSets(filters),
  })
}

export function useCreateUroStripControlSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: UroStripControlSetRequest) => uroanaliseService.createControlSet(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['uroanalise', 'control-sets'] })
    },
  })
}

export function useUpdateUroStripControlSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: UroStripControlSetRequest }) =>
      uroanaliseService.updateControlSet(id, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['uroanalise', 'control-sets'] })
    },
  })
}

export function useDeactivateUroStripControlSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => uroanaliseService.deactivateControlSet(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['uroanalise', 'control-sets'] })
    },
  })
}

export function useUroStripRuns(filters?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['uroanalise', 'strip-runs', filters],
    queryFn: () => uroanaliseService.getStripRuns(filters),
  })
}

export function useCreateUroStripRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: UroStripRunRequest) => uroanaliseService.createStripRun(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['uroanalise', 'strip-runs'] })
    },
  })
}

export function useDeleteUroStripRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => uroanaliseService.deleteStripRun(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['uroanalise', 'strip-runs'] })
    },
  })
}

export function useUroSedimentRuns(filters?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['uroanalise', 'sediment-runs', filters],
    queryFn: () => uroanaliseService.getSedimentRuns(filters),
  })
}

export function useCreateUroSedimentRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: UroSedimentRunRequest) => uroanaliseService.createSedimentRun(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['uroanalise', 'sediment-runs'] })
    },
  })
}

export function useDeleteUroSedimentRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => uroanaliseService.deleteSedimentRun(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['uroanalise', 'sediment-runs'] })
    },
  })
}
