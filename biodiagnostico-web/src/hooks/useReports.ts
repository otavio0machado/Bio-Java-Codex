import { useQuery } from '@tanstack/react-query'
import { reportService } from '../services/reportService'

/** Historico de relatorios gerados (RelatoriosTab V2). */
export function useReportHistory(limit = 20) {
  return useQuery({
    queryKey: ['report-history', limit],
    queryFn: () => reportService.history(limit),
  })
}
