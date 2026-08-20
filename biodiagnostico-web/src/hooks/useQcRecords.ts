import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qcService } from '../services/qcService'
import type {
  PostCalibrationRequest,
  QcExamRequest,
  QcRecordPageFilters,
  QcRecordRequest,
  QcReferenceRequest,
} from '../types'

const QC_RECORDS_PAGE_SIZE = 50

export function useQcRecords(filters?: {
  area?: string
  examName?: string
  startDate?: string
  endDate?: string
}) {
  return useQuery({
    queryKey: ['qc-records', filters],
    queryFn: () => qcService.getRecords(filters),
  })
}

export function useInfiniteQcRecords(filters: Omit<QcRecordPageFilters, 'cursor' | 'size'>) {
  return useInfiniteQuery({
    queryKey: ['qc-records', 'page', filters, QC_RECORDS_PAGE_SIZE],
    queryFn: ({ pageParam }) => qcService.getRecordsPage({
      ...filters,
      cursor: pageParam ?? undefined,
      size: QC_RECORDS_PAGE_SIZE,
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.hasNext && lastPage.nextCursor
      ? lastPage.nextCursor
      : undefined,
  })
}

export function useCreateQcRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: QcRecordRequest) => qcService.createRecord(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['qc-records'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateQcRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: QcRecordRequest }) =>
      qcService.updateRecord(id, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['qc-records'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useCreateQcBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requests: QcRecordRequest[]) => qcService.createBatch(requests),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['qc-records'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useQcExams(area?: string) {
  return useQuery({
    queryKey: ['qc-exams', area],
    queryFn: () => qcService.getExams(area),
  })
}

export function useCreateQcExam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: QcExamRequest) => qcService.createExam(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['qc-exams'] })
    },
  })
}

export function useQcReferences(
  examIdOrFilters?: string | { examId?: string; area?: string; activeOnly?: boolean },
  activeOnly = false,
) {
  return useQuery({
    queryKey: ['qc-references', examIdOrFilters, activeOnly],
    queryFn: () => qcService.getReferences(examIdOrFilters, activeOnly),
  })
}

export function useCreateQcReference() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: QcReferenceRequest) => qcService.createReference(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['qc-references'] })
    },
  })
}

export function useUpdateQcReference() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: QcReferenceRequest }) =>
      qcService.updateReference(id, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['qc-references'] })
    },
  })
}

export function useDeleteQcReference() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => qcService.deleteReference(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['qc-references'] })
    },
  })
}

export function useLeveyJennings(examName: string, level: string, area: string, days?: number) {
  return useQuery({
    queryKey: ['levey-jennings', examName, level, area, days],
    queryFn: () => qcService.getLeveyJenningsData(examName, level, area, days),
    enabled: Boolean(examName && level && area),
  })
}

export function useCreatePostCalibration(recordId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: PostCalibrationRequest) => qcService.createPostCalibration(recordId, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['qc-records'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
