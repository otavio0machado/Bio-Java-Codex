import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import { dashboardService } from './dashboardService'
import { qcService } from './qcService'
import type { QcRecordPage } from '../types'

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
  },
}))

describe('consultas limitadas de CQ', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
  })

  it('envia filtros canônicos e cursor ao endpoint paginado', async () => {
    const page: QcRecordPage = {
      items: [],
      nextCursor: 'cursor-2',
      hasNext: true,
      size: 50,
    }
    vi.mocked(api.get).mockResolvedValueOnce({ data: page })

    await expect(qcService.getRecordsPage({
      area: 'bioquimica',
      examName: 'glic',
      startDate: '2026-08-19',
      endDate: '2026-08-19',
      status: 'APROVADO',
      cursor: 'cursor-1',
      size: 50,
    })).resolves.toEqual(page)

    expect(api.get).toHaveBeenCalledWith('/qc/records/page', {
      params: {
        area: 'bioquimica',
        examName: 'glic',
        startDate: '2026-08-19',
        endDate: '2026-08-19',
        status: 'APROVADO',
        cursor: 'cursor-1',
        size: 50,
      },
    })
  })

  it('envia área e limite ao endpoint de registros recentes', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] })

    await dashboardService.getRecentRecords('hematologia', 6)

    expect(api.get).toHaveBeenCalledWith('/dashboard/recent-records', {
      params: { area: 'hematologia', limit: 6 },
    })
  })
})
