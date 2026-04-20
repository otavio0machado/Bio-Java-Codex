import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reagentService } from '../services/reagentService'
import type { ReagentLotRequest, StockMovementRequest } from '../types'

export function useReagentLots(category?: string, status?: string) {
  return useQuery({
    queryKey: ['reagents', category, status],
    queryFn: () => reagentService.getLots(category, status),
  })
}

export function useCreateReagentLot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: ReagentLotRequest) => reagentService.createLot(request),
    // Conflitos de negocio (ex: lote duplicado) nao melhoram com retry;
    // sem isso o React Query dispara 4 tentativas e polui o log do backend.
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reagents'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateReagentLot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: ReagentLotRequest }) =>
      reagentService.updateLot(id, request),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reagents'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useReagentMovements(lotId?: string) {
  return useQuery({
    queryKey: ['reagent-movements', lotId],
    queryFn: () => reagentService.getMovements(lotId ?? ''),
    enabled: Boolean(lotId),
  })
}

export function useCreateStockMovement(lotId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: StockMovementRequest) => reagentService.createMovement(lotId, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reagents'] })
      void queryClient.invalidateQueries({ queryKey: ['reagent-movements', lotId] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
