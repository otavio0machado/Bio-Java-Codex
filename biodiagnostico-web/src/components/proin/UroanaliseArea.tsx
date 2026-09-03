import { useState } from 'react'
import {
  TestTube,
  Microscope,
  History,
  SlidersHorizontal,
} from 'lucide-react'
import { UroStripQcTab } from './uroanalise/UroStripQcTab'
import { UroSedimentQcTab } from './uroanalise/UroSedimentQcTab'
import { UroControlSetsTab } from './uroanalise/UroControlSetsTab'
import { UroHistoryTab } from './uroanalise/UroHistoryTab'
import { cn } from '../../utils/cn'

type UroTab = 'strip' | 'sediment' | 'control-sets' | 'history'

const TABS: Array<{ value: UroTab; label: string; icon: React.ReactNode }> = [
  { value: 'strip', label: 'Tiras de Urina (Físico-Químico)', icon: <TestTube className="h-4 w-4" /> },
  { value: 'sediment', label: 'Sedimento Urinário (Inter-Observador)', icon: <Microscope className="h-4 w-4" /> },
  { value: 'control-sets', label: 'Lotes de Controle', icon: <SlidersHorizontal className="h-4 w-4" /> },
  { value: 'history', label: 'Histórico & Corridas', icon: <History className="h-4 w-4" /> },
]

export function UroanaliseArea() {
  const [activeTab, setActiveTab] = useState<UroTab>('strip')

  return (
    <div className="space-y-6">
      {/* Barra de Sub-Navegação Oficial da Área (sem botões avulsos ou dashboards duplicados) */}
      <div className="border-b border-neutral-200">
        <nav className="flex flex-wrap gap-6 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={cn(
                'border-b-2 pb-3 text-base font-medium transition flex items-center gap-2',
                activeTab === tab.value
                  ? 'border-green-800 text-green-800 font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              )}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo da Aba Ativa */}
      <div>
        {activeTab === 'strip' && <UroStripQcTab />}
        {activeTab === 'sediment' && <UroSedimentQcTab />}
        {activeTab === 'control-sets' && <UroControlSetsTab />}
        {activeTab === 'history' && <UroHistoryTab />}
      </div>
    </div>
  )
}
