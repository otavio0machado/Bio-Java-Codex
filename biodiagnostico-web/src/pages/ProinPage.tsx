import { lazy, Suspense, useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { AiAssistantPanel } from '../components/proin/AiAssistantPanel'
import { Card, Skeleton } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { canWriteQc } from '../lib/permissions'
import { hasFullQcCycle, QC_AREA_OPTIONS } from '../lib/qcAreas'
import { cn } from '../utils/cn'

const DashboardTab = lazy(() => import('../components/proin/DashboardTab').then((module) => ({ default: module.DashboardTab })))
const HematologiaArea = lazy(() =>
  import('../components/proin/HematologiaArea').then((module) => ({ default: module.HematologiaArea })),
)
const ImunologiaArea = lazy(() =>
  import('../components/proin/ImunologiaArea').then((module) => ({ default: module.ImunologiaArea })),
)
const MicrobiologiaArea = lazy(() =>
  import('../components/proin/MicrobiologiaArea').then((module) => ({ default: module.MicrobiologiaArea })),
)
const ParasitologiaArea = lazy(() =>
  import('../components/proin/ParasitologiaArea').then((module) => ({ default: module.ParasitologiaArea })),
)
const ReferenciasTab = lazy(() =>
  import('../components/proin/ReferenciasTab').then((module) => ({ default: module.ReferenciasTab })),
)
const RegistroTab = lazy(() => import('../components/proin/RegistroTab').then((module) => ({ default: module.RegistroTab })))
const UroanaliseArea = lazy(() =>
  import('../components/proin/UroanaliseArea').then((module) => ({ default: module.UroanaliseArea })),
)

const allTabs = [
  { value: 'dashboard', label: 'Dashboard CQ' },
  { value: 'registro', label: 'Registro CQ' },
  { value: 'referencias', label: 'Referências' },
]

const legacyTabRedirects: Record<string, string> = {
  configuracao: '/config',
  reagentes: '/reagentes',
  manutencao: '/manutencao',
  relatorios: '/relatorios',
  importar: '/qc?area=bioquimica&tab=registro',
}

export function ProinPage() {
  const { user } = useAuth()
  const tabs = useMemo(() => {
    return allTabs.filter((tab) => {
      if (tab.value === 'registro') return canWriteQc(user)
      return true
    })
  }, [user])
  const [searchParams, setSearchParams] = useSearchParams()
  const currentArea = searchParams.get('area') ?? 'bioquimica'
  const isFullCycleArea = hasFullQcCycle(currentArea)
  const requestedTab = isFullCycleArea ? (searchParams.get('tab') ?? 'dashboard') : 'registro'
  const currentTab = isFullCycleArea && tabs.some((tab) => tab.value === requestedTab)
    ? requestedTab
    : (tabs[0]?.value ?? 'dashboard')
  const legacyRedirect = currentArea === 'bioquimica' ? legacyTabRedirects[requestedTab] : undefined

  if (legacyRedirect) {
    return <Navigate to={legacyRedirect} replace />
  }

  if (isFullCycleArea && requestedTab !== currentTab) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', currentTab)
    return <Navigate to={`?${next.toString()}`} replace />
  }

  const handleTabChange = (tab: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('tab', tab)
      return next
    })
  }

  const renderSpecializedArea = () => {
    switch (currentArea) {
      case 'hematologia':
        return <HematologiaArea />
      case 'imunologia':
        return <ImunologiaArea />
      case 'parasitologia':
        return <ParasitologiaArea />
      case 'microbiologia':
        return <MicrobiologiaArea />
      case 'uroanalise':
        return <UroanaliseArea />
      default:
        return <RegistroTab key={`registro-${currentArea}`} area={currentArea} />
    }
  }

  const renderFullCycleTab = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardTab area={currentArea} />
      case 'registro':
        return <RegistroTab key={`registro-${currentArea}`} area={currentArea} />
      case 'referencias':
        return <ReferenciasTab area={currentArea} />
      default:
        return <DashboardTab area={currentArea} />
    }
  }

  const currentAreaLabel = QC_AREA_OPTIONS.find((item) => item.value === currentArea)?.label ?? currentArea

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">{currentAreaLabel}</h1>
            <p className="text-base text-neutral-500">Operação de CQ da área selecionada — lançamento, rastreabilidade e análise.</p>
          </div>
          <AiAssistantPanel area={currentArea} areaLabel={currentAreaLabel} />
        </div>

        {isFullCycleArea ? (
          <nav aria-label={`Seções de CQ de ${currentAreaLabel}`} className="flex gap-2 overflow-x-auto border-b border-neutral-200 sm:gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={cn(
                  'whitespace-nowrap border-b-2 pb-3 text-base font-medium transition',
                  currentTab === tab.value
                    ? 'border-green-800 text-green-800'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700',
                )}
                onClick={() => handleTabChange(tab.value)}
                aria-current={currentTab === tab.value ? 'page' : undefined}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        ) : null}
      </header>

      {!isFullCycleArea ? (
        <div>
          <Suspense fallback={<ProinContentFallback />}>{renderSpecializedArea()}</Suspense>
        </div>
      ) : null}

      {isFullCycleArea ? (
        <Suspense fallback={<ProinContentFallback />}>{renderFullCycleTab()}</Suspense>
      ) : null}
    </div>
  )
}

function ProinContentFallback() {
  return (
    <Card>
      <Skeleton height="18rem" />
    </Card>
  )
}
