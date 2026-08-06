import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import { qcService } from './qcService'

vi.mock('./api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

describe('qcService.getReferences', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    vi.mocked(api.post).mockReset()
  })

  it('envia a área de coagulação no GET de referências', async () => {
    await qcService.getReferences({ area: 'coagulacao', activeOnly: true })

    expect(api.get).toHaveBeenCalledWith('/qc/references', {
      params: { area: 'coagulacao', activeOnly: true },
    })
  })

  it('usa batch-v2 em modo partial e devolve resultado linha a linha', async () => {
    const result = {
      runId: 'run-1',
      mode: 'PARTIAL',
      total: 1,
      successCount: 0,
      failureCount: 1,
      results: [{ rowIndex: 0, success: false, message: 'Lote inválido', record: null }],
    }
    vi.mocked(api.post).mockResolvedValue({ data: result })

    await expect(qcService.createBatch([])).resolves.toEqual(result)
    expect(api.post).toHaveBeenCalledWith('/qc/records/batch-v2', [], {
      params: { mode: 'partial' },
    })
  })
})
