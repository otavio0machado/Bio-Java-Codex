import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VerifyReportResponse } from '../types/reportsV2'
import { VerifyReportPage } from './VerifyReportPage'

const mockVerify = vi.fn()

vi.mock('../services/reportsV2Service', async () => {
  const actual = await vi.importActual<typeof import('../services/reportsV2Service')>(
    '../services/reportsV2Service',
  )
  return {
    ...actual,
    reportsV2Service: {
      ...actual.reportsV2Service,
      verify: (param: string) => mockVerify(param),
    },
  }
})

function renderAt(param: string, overrides?: { retry?: boolean | number }) {
  const queryClient = new QueryClient({
    // Forca retry=false no teste. O hook chama {@code retry: 1} em runtime
    // pensando em falhas transientes reais; em teste nao queremos esperar
    // o backoff do react-query para ver o estado de erro.
    defaultOptions: { queries: { retry: overrides?.retry ?? false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/r/verify/${param}`]}>
        <Routes>
          <Route path="/r/verify/:token" element={<VerifyReportPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockVerify.mockReset()
})

const SHA_ORIGINAL = '8'.repeat(64)
const SHA_SIGNED = '9'.repeat(64)

const baseValidUnsigned: VerifyReportResponse = {
  status: 'VALID_UNSIGNED',
  reportNumber: 'BIO-202604-000001',
  reportCode: 'CQ_OPERATIONAL_V2',
  periodLabel: 'Abril/2026',
  generatedAt: '2026-04-20T10:00:00Z',
  generatedByName: 'ana',
  sha256: SHA_ORIGINAL,
  signatureHash: null,
  signedAt: null,
  signedByName: null,
  signed: false,
  valid: true,
}

const baseValidSigned: VerifyReportResponse = {
  status: 'VALID_SIGNED',
  reportNumber: 'BIO-202604-000001',
  reportCode: 'CQ_OPERATIONAL_V2',
  periodLabel: 'Abril/2026',
  generatedAt: '2026-04-20T10:00:00Z',
  generatedByName: 'ana',
  sha256: SHA_ORIGINAL,
  signatureHash: SHA_SIGNED,
  signedAt: '2026-04-20T11:00:00Z',
  signedByName: 'Dra. Responsavel',
  signed: true,
  valid: true,
}

const baseSuperseded: VerifyReportResponse = {
  status: 'SUPERSEDED',
  reportNumber: 'BIO-202604-000001',
  reportCode: 'CQ_OPERATIONAL_V2',
  periodLabel: 'Abril/2026',
  generatedAt: '2026-04-20T10:00:00Z',
  generatedByName: 'ana',
  // O hash consultado (preliminar) e o sha256 original; a versao oficial e a assinada.
  sha256: SHA_ORIGINAL,
  signatureHash: SHA_SIGNED,
  signedAt: '2026-04-20T11:00:00Z',
  signedByName: 'Dra. Responsavel',
  signed: true,
  valid: true,
}

const baseNotFound: VerifyReportResponse = {
  status: 'NOT_FOUND',
  reportNumber: null,
  reportCode: null,
  periodLabel: null,
  generatedAt: null,
  generatedByName: null,
  sha256: null,
  signatureHash: null,
  signedAt: null,
  signedByName: null,
  signed: false,
  valid: false,
}

/** Sobe ate o ancestral com a classe de cor do banner para checar o estado visual. */
function bannerOf(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null
  while (el) {
    if (el.getAttribute('role') === 'status' || el.getAttribute('role') === 'alert') {
      return el
    }
    el = el.parentElement
  }
  return null
}

describe('VerifyReportPage', () => {
  it('VALID_SIGNED: banner verde + hash assinado autoritativo + original secundario', async () => {
    mockVerify.mockResolvedValue(baseValidSigned satisfies VerifyReportResponse)

    renderAt('token-estavel')

    const title = await screen.findByText(/Documento válido e assinado/)
    expect(title).toBeInTheDocument()
    expect(bannerOf(title)?.className).toContain('emerald')

    // Hash autoritativo = signatureHash, rotulado como versao entregue.
    expect(
      screen.getByText(/SHA-256 do arquivo assinado \(versão entregue\)/),
    ).toBeInTheDocument()
    expect(screen.getByText(SHA_SIGNED)).toBeInTheDocument()
    // Original aparece como informacao secundaria.
    expect(screen.getByText(/SHA-256 original/)).toBeInTheDocument()
    expect(screen.getByText(SHA_ORIGINAL)).toBeInTheDocument()

    expect(screen.getByText('BIO-202604-000001')).toBeInTheDocument()
    expect(screen.getByText(/Dra. Responsavel/)).toBeInTheDocument()
  })

  it('VALID_UNSIGNED: banner azul + sha256 como hash autoritativo entregue', async () => {
    mockVerify.mockResolvedValue(baseValidUnsigned satisfies VerifyReportResponse)

    renderAt('token-estavel')

    const title = await screen.findByText(/Documento válido \(não assinado\)/)
    expect(title).toBeInTheDocument()
    expect(bannerOf(title)?.className).toContain('blue')

    expect(screen.getByText(/SHA-256 do arquivo \(versão entregue\)/)).toBeInTheDocument()
    expect(screen.getByText(SHA_ORIGINAL)).toBeInTheDocument()
    // Sem assinatura: nao expoe rotulo de hash assinado.
    expect(screen.queryByText(/assinado \(versão entregue\)/)).not.toBeInTheDocument()
  })

  it('SUPERSEDED: banner ambar "Versão substituída" + hash da versão assinada', async () => {
    mockVerify.mockResolvedValue(baseSuperseded satisfies VerifyReportResponse)

    renderAt(SHA_ORIGINAL)

    const title = await screen.findByText(/Versão substituída/)
    expect(title).toBeInTheDocument()
    expect(bannerOf(title)?.className).toContain('amber')

    expect(
      screen.getByText(/versão preliminar \(não assinada\) deste laudo/),
    ).toBeInTheDocument()
    // Direciona o verificador ao hash da versao assinada (oficial).
    expect(screen.getByText(/SHA-256 da versão assinada \(oficial\)/)).toBeInTheDocument()
    expect(screen.getByText(SHA_SIGNED)).toBeInTheDocument()

    // Dados do laudo presentes.
    expect(screen.getByText('BIO-202604-000001')).toBeInTheDocument()
    expect(screen.getByText(/Dra. Responsavel/)).toBeInTheDocument()
  })

  it('NOT_FOUND: banner vermelho "Hash desconhecido" com eco do parametro', async () => {
    mockVerify.mockResolvedValue(baseNotFound satisfies VerifyReportResponse)

    renderAt('deadbeef')

    const title = await screen.findByText(/Hash desconhecido/)
    expect(title).toBeInTheDocument()
    expect(bannerOf(title)?.className).toContain('red')
    expect(screen.getByText('deadbeef')).toBeInTheDocument()
  })

  it('mostra estado de loading antes de resolver', async () => {
    let resolveFn: (value: VerifyReportResponse) => void = () => {}
    mockVerify.mockImplementation(
      () =>
        new Promise<VerifyReportResponse>((resolve) => {
          resolveFn = resolve
        }),
    )

    renderAt('abc')

    // Banner ainda nao renderizou
    expect(screen.queryByText(/Documento válido/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Hash desconhecido/)).not.toBeInTheDocument()

    resolveFn(baseValidUnsigned)
    await waitFor(() => {
      expect(screen.getByText(/Documento válido/)).toBeInTheDocument()
    })
  })

  it('mostra banner neutro em caso de erro de rede', async () => {
    mockVerify.mockRejectedValue(new Error('Network down'))

    // useVerifyReport tem retry:1 interno - aguarda o backoff do react-query
    // antes de exibir o estado de erro. waitFor default de 1s pode falhar,
    // subimos o timeout explicitamente.
    renderAt('abc')

    await waitFor(
      () => {
        expect(
          screen.getByText(/Não foi possível consultar o serviço de verificação/),
        ).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
  })
})
