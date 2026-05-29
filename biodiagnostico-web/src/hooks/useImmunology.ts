import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { immunologyService } from '../services/immunologyService'
import type { ImmunologyControlSetRequest, ImmunologyRunRequest } from '../types'

export function useImmunologyControlSets(analito?: string) {
  return useQuery({
    queryKey: ['immunology', 'control-sets', analito],
    queryFn: () => immunologyService.getControlSets(analito),
  })
}

export function useCreateImmunologyControlSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: ImmunologyControlSetRequest) => immunologyService.createControlSet(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['immunology', 'control-sets'] })
    },
  })
}

export function useUpdateImmunologyControlSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: ImmunologyControlSetRequest }) =>
      immunologyService.updateControlSet(id, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['immunology', 'control-sets'] })
    },
  })
}

export function useDeactivateImmunologyControlSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => immunologyService.deactivateControlSet(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['immunology', 'control-sets'] })
    },
  })
}

export function useImmunologyRuns(filters?: { analito?: string; controlSetId?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['immunology', 'runs', filters],
    queryFn: () => immunologyService.getRuns(filters),
  })
}

export function useCreateImmunologyRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: ImmunologyRunRequest) => immunologyService.createRun(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['immunology', 'runs'] })
    },
  })
}
