import { useSearchParams } from 'react-router-dom'
import { RelatoriosTab } from '../components/proin/RelatoriosTab'

export function RelatoriosPage() {
  const [searchParams] = useSearchParams()
  const area = searchParams.get('area') ?? 'bioquimica'

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-3xl font-bold text-neutral-900">Relatórios</h1>
        <p className="text-base text-neutral-500">Geração e histórico de relatórios de CQ.</p>
      </header>
      <RelatoriosTab area={area} />
    </div>
  )
}
