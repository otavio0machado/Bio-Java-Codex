import { useState } from 'react'
import {
  Plus,
  Pencil,
  Power,
  SlidersHorizontal,
  Calendar,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { Card, Button, EmptyState, useToast } from '../../ui'
import {
  useUroStripControlSets,
  useDeactivateUroStripControlSet,
} from '../../../hooks/useUroanalise'
import { useAuth } from '../../../hooks/useAuth'
import { canWriteQc } from '../../../lib/permissions'
import { formatLongBR } from '../../../utils/date'
import { UroControlSetModal } from './UroControlSetModal'
import type { UroStripControlSet } from '../../../types'

export function UroControlSetsTab() {
  const { toast } = useToast()
  const { user } = useAuth()
  const canManage = canWriteQc(user)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingControlSet, setEditingControlSet] = useState<UroStripControlSet | null>(null)

  const { data: controlSets = [] } = useUroStripControlSets({ includeInactive: true })
  const deactivateControl = useDeactivateUroStripControlSet()

  const handleOpenNew = () => {
    setEditingControlSet(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (controlSet: UroStripControlSet) => {
    setEditingControlSet(controlSet)
    setIsModalOpen(true)
  }

  const handleToggleActive = async (controlSet: UroStripControlSet) => {
    if (!canManage) return
    const action = controlSet.isActive ? 'inativar' : 'reativar'
    if (!window.confirm(`Deseja realmente ${action} o lote de controle ${controlSet.controlLotNumber}?`)) {
      return
    }

    try {
      await deactivateControl.mutateAsync(controlSet.id)
      toast.success(`Lote de controle ${controlSet.isActive ? 'inativado' : 'reativado'} com sucesso.`)
    } catch {
      toast.error(`Erro ao ${action} lote de controle.`)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-6">
        {/* Cabeçalho do Módulo de Lotes de Controle */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-100 pb-5">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Gerenciamento de Lotes de Controle</h2>
            <p className="text-sm text-neutral-500 mt-0.5">
              Cadastro e controle de vigência dos controles comerciais de urina (bula), faixas esperadas e parâmetros físico-químicos.
            </p>
          </div>

          {canManage && (
            <Button
              onClick={handleOpenNew}
              className="h-10 rounded-xl bg-green-800 hover:bg-green-900 text-white font-medium shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Novo Lote de Controle
            </Button>
          )}
        </div>

        {/* Lista de Lotes de Controle */}
        {controlSets.length === 0 ? (
          <EmptyState
            icon={<SlidersHorizontal className="h-8 w-8 text-neutral-400" />}
            title="Nenhum lote de controle cadastrado"
            description="Cadastre os dados da bula do controle interno de urina para calibrar os limites aceitáveis da rotina."
            action={
              canManage
                ? {
                    label: 'Cadastrar Primeiro Lote',
                    onClick: handleOpenNew,
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-xs">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                <tr>
                  <th className="py-3.5 px-4 text-left">Lote / Fabricante</th>
                  <th className="py-3.5 px-4 text-center">Validade</th>
                  <th className="py-3.5 px-4 text-center">Faixa de pH</th>
                  <th className="py-3.5 px-4 text-center">Faixa de Densidade</th>
                  <th className="py-3.5 px-4 text-left">Padrões Qualitativos (Bula)</th>
                  <th className="py-3.5 px-4 text-center">Situação</th>
                  {canManage && <th className="py-3.5 px-4 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {controlSets.map((set) => (
                  <tr key={set.id} className="hover:bg-neutral-50/60 transition">
                    {/* Lote e Marca */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-neutral-900">{set.controlLotNumber}</div>
                      <div className="text-xs text-neutral-500">{set.manufacturer}</div>
                    </td>

                    {/* Validade */}
                    <td className="py-3.5 px-4 text-center font-medium text-neutral-700">
                      <div className="inline-flex items-center gap-1 text-xs">
                        <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                        {formatLongBR(set.validUntil)}
                      </div>
                    </td>

                    {/* Faixa pH */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-mono font-semibold text-neutral-800">
                        {set.expectedPhMin != null && set.expectedPhMax != null
                          ? `${set.expectedPhMin.toFixed(1)} – ${set.expectedPhMax.toFixed(1)}`
                          : '5.0 – 6.0'}
                      </span>
                    </td>

                    {/* Faixa Densidade */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-mono font-semibold text-neutral-800">
                        {set.expectedDensityMin != null && set.expectedDensityMax != null
                          ? `${set.expectedDensityMin.toFixed(3)} – ${set.expectedDensityMax.toFixed(3)}`
                          : '1.005 – 1.025'}
                      </span>
                    </td>

                    {/* Qualitativos */}
                    <td className="py-3.5 px-4 text-xs text-neutral-600">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 max-w-xs">
                        <div>Prot: <strong>{set.expectedProteins || 'NEG'}</strong></div>
                        <div>Glic: <strong>{set.expectedGlucose || 'NEG'}</strong></div>
                        <div>Cetonas: <strong>{set.expectedKetones || 'NEG'}</strong></div>
                        <div>Sangue: <strong>{set.expectedBlood || 'NEG'}</strong></div>
                        <div>Urobil: <strong>{set.expectedUrobilinogen || 'NORM'}</strong></div>
                        <div>Nitrito: <strong>{set.expectedNitrite || 'NEG'}</strong></div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      {set.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 border border-green-200">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600 border border-neutral-200">
                          <XCircle className="h-3.5 w-3.5" /> Inativo
                        </span>
                      )}
                    </td>

                    {/* Ações */}
                    {canManage && (
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(set)}
                            className="p-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-green-800 transition"
                            title="Editar lote de controle"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(set)}
                            className={`p-1.5 rounded-lg transition ${
                              set.isActive
                                ? 'text-neutral-400 hover:text-red-600 hover:bg-red-50'
                                : 'text-neutral-400 hover:text-green-700 hover:bg-green-50'
                            }`}
                            title={set.isActive ? 'Inativar lote' : 'Reativar lote'}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <UroControlSetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingControlSet={editingControlSet}
      />
    </div>
  )
}
