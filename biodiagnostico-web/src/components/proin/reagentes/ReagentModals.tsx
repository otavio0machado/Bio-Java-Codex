import { AlertTriangle, ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type {
  ReagentLabelSummary,
  ReagentLot,
  ReagentLotRequest,
  StockMovement,
  StockMovementRequest,
} from '../../../types'
import { cn } from '../../../utils/cn'
import { todayLocal } from '../../../utils/date'
import { Button, Combobox, Input, Modal, Select, type ComboboxOption } from '../../ui'
import {
  CATEGORIES,
  MOVEMENT_REASONS,
  REAGENT_STATUS_OPTIONS,
  TEMPS,
} from './constants'
import { canReceiveEntry } from './utils'

interface ReagentLotModalProps {
  form: ReagentLotRequest
  isOpen: boolean
  isEditing: boolean
  isSaving: boolean
  labels: ReagentLabelSummary[]
  manufacturerOptions?: ComboboxOption[]
  locationOptions?: ComboboxOption[]
  supplierOptions?: ComboboxOption[]
  onClose: () => void
  onSave: () => void
  setForm: Dispatch<SetStateAction<ReagentLotRequest>>
}

/**
 * Modal de cadastro/edicao de lote pos-refator v2.
 *
 * Layout canonico (contrato 6.1):
 * - Secao 1 (Identificacao): Etiqueta (combobox), Lote, Fabricante, Categoria.
 * - Secao 2 (Estoque & Status): Quantidade, Status, Validade.
 * - Secao 3 (Armazenamento): Localizacao, Temperatura.
 * - Secao 4 (Detalhes adicionais — colapsavel): Fornecedor, Recebimento, Abertura.
 *
 * Comportamentos chave:
 * - Etiqueta usa {@code Combobox} com {@code allowCustom=true} e
 *   {@code createLabel="+ Criar nova etiqueta"}. Backend cria via POST /api/reagents.
 * - Banner amarelo quando {@code expiryDate < hoje}: o backend forca status='vencido'.
 * - Trim defensivo no submit (bloqueante audit 4.2.1) — feito via service tambem.
 */
export function ReagentLotModal({
  form,
  isOpen,
  isEditing,
  isSaving,
  labels,
  manufacturerOptions = [],
  locationOptions = [],
  supplierOptions = [],
  onClose,
  onSave,
  setForm,
}: ReagentLotModalProps) {
  const [showAdditional, setShowAdditional] = useState(false)
  const today = todayLocal()
  const expiryWillForceVencido = Boolean(form.expiryDate) && form.expiryDate < today

  const labelOptions = useMemo<ComboboxOption[]>(
    () =>
      labels
        .map((summary) => ({
          value: summary.label,
          label: summary.label,
          description:
            summary.total > 1 ? `${summary.total} lotes cadastrados` : '1 lote cadastrado',
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [labels],
  )

  const handleSave = () => {
    // Bloqueante audit 4.2.1: garante trim no submit, mesmo que o usuario tenha
    // digitado whitespace antes/depois. Service tambem sanitiza antes do POST.
    setForm((current) => ({
      ...current,
      label: current.label?.trim() ?? '',
      lotNumber: current.lotNumber?.trim() ?? '',
      manufacturer: current.manufacturer?.trim() ?? '',
      location: current.location?.trim() ?? '',
      supplier: current.supplier?.trim() || undefined,
    }))
    onSave()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Lote' : 'Novo Lote'}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={isSaving}>
            {isEditing ? 'Atualizar' : 'Cadastrar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <FormSection title="Identificação">
          <div className="grid gap-3 sm:grid-cols-2">
            <Combobox
              id="reagent-label-input"
              label="Etiqueta *"
              placeholder="Buscar ou criar etiqueta..."
              value={form.label ?? ''}
              onChange={(value) =>
                setForm((current) => ({ ...current, label: value }))
              }
              options={labelOptions}
              allowCustom
              createLabel="+ Criar nova etiqueta"
              emptyText="Nenhuma etiqueta cadastrada"
            />
            <Input
              label="Nº do Lote *"
              value={form.lotNumber}
              onChange={(event) =>
                setForm((current) => ({ ...current, lotNumber: event.target.value }))
              }
            />
            <Combobox
              id="reagent-manufacturer-input"
              label="Fabricante *"
              placeholder="Buscar ou criar fabricante..."
              value={form.manufacturer ?? ''}
              onChange={(value) =>
                setForm((current) => ({ ...current, manufacturer: value }))
              }
              options={manufacturerOptions}
              allowCustom
              createLabel="+ Criar novo fabricante"
              emptyText="Nenhum fabricante cadastrado"
            />
            <Select
              label="Categoria *"
              value={form.category ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, category: event.target.value }))
              }
            >
              <option value="">Selecione...</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </div>
        </FormSection>

        <FormSection title="Estoque & Status">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Quantidade atual *"
              type="number"
              min="0"
              value={String(form.currentStock ?? 0)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  currentStock: Number(event.target.value || 0),
                }))
              }
            />
            <Select
              label="Status *"
              value={form.status ?? 'em_estoque'}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value }))
              }
            >
              {REAGENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              label="Validade *"
              type="date"
              value={form.expiryDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, expiryDate: event.target.value }))
              }
            />
          </div>
          {expiryWillForceVencido ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Este lote será salvo como <strong>Vencido</strong> automaticamente porque a validade já
                passou. O servidor sobrescreve o status enviado.
              </span>
            </div>
          ) : null}
        </FormSection>

        <FormSection title="Armazenamento">
          <div className="grid gap-3 sm:grid-cols-2">
            <Combobox
              id="reagent-location-input"
              label="Localização *"
              placeholder="Buscar ou criar localização..."
              value={form.location ?? ''}
              onChange={(value) =>
                setForm((current) => ({ ...current, location: value }))
              }
              options={locationOptions}
              allowCustom
              createLabel="+ Criar nova localização"
              emptyText="Nenhuma localização cadastrada"
            />
            <Select
              label="Temperatura *"
              value={form.storageTemp ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, storageTemp: event.target.value }))
              }
            >
              <option value="">Selecione...</option>
              {TEMPS.map((temp) => (
                <option key={temp} value={temp}>
                  {temp}
                </option>
              ))}
            </Select>
          </div>
        </FormSection>

        <div>
          <button
            type="button"
            onClick={() => setShowAdditional((current) => !current)}
            className={cn(
              'flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:border-green-300',
              showAdditional ? 'border-green-300 bg-green-50/40 text-green-900' : '',
            )}
            aria-expanded={showAdditional}
          >
            <span className="flex items-center gap-2">
              {showAdditional ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Detalhes adicionais (opcional)
            </span>
            <span className="text-xs text-neutral-500">
              Fornecedor, recebimento e abertura
            </span>
          </button>
          {showAdditional ? (
            <div className="mt-3 grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2">
              <Combobox
                id="reagent-supplier-input"
                label="Fornecedor"
                placeholder="Buscar ou criar fornecedor..."
                value={form.supplier ?? ''}
                onChange={(value) =>
                  setForm((current) => ({ ...current, supplier: value || undefined }))
                }
                options={supplierOptions}
                allowCustom
                createLabel="+ Criar novo fornecedor"
                emptyText="Nenhum fornecedor cadastrado"
              />
              <Input
                label="Data de recebimento"
                type="date"
                value={form.receivedDate ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    receivedDate: event.target.value || undefined,
                  }))
                }
              />
              <Input
                label="Data de abertura"
                type="date"
                value={form.openedDate ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    openedDate: event.target.value || undefined,
                  }))
                }
              />
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}

interface ReagentMovementModalProps {
  form: StockMovementRequest
  isOpen: boolean
  isSaving: boolean
  lot: ReagentLot | null
  onClose: () => void
  onSave: () => void
  setForm: Dispatch<SetStateAction<StockMovementRequest>>
  movements: StockMovement[]
  /**
   * Quando {@code true}, o usuario abriu o modal explicitamente para uma operacao
   * de ENTRADA — o select de tipo fica fixado e a UI deixa claro o contexto.
   */
  lockType?: boolean
}

export function ReagentMovementModal({
  form,
  isOpen,
  isSaving,
  lot,
  onClose,
  onSave,
  setForm,
  movements,
  lockType = false,
}: ReagentMovementModalProps) {
  const canUseEntrada = lot ? canReceiveEntry(lot) : true

  const titleSuffix = lot ? ` · Lote ${lot.lotNumber}` : ''

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Movimentação${titleSuffix}`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={onSave} loading={isSaving}>
            Registrar
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Tipo"
          value={form.type}
          disabled={lockType}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              type: event.target.value as StockMovementRequest['type'],
            }))
          }
        >
          <option value="ENTRADA" disabled={!canUseEntrada}>
            Entrada
          </option>
          <option value="SAIDA">Saída</option>
          <option value="AJUSTE">Ajuste</option>
        </Select>
        <Input
          label="Quantidade"
          type="number"
          value={String(form.quantity)}
          onChange={(event) =>
            setForm((current) => ({ ...current, quantity: Number(event.target.value) }))
          }
        />
        <Input
          label="Responsável *"
          value={form.responsible}
          onChange={(event) =>
            setForm((current) => ({ ...current, responsible: event.target.value }))
          }
        />
        <Select
          label={form.type === 'AJUSTE' ? 'Motivo *' : 'Motivo (opcional)'}
          value={form.reason ?? ''}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              reason: (event.target.value || null) as StockMovementRequest['reason'],
            }))
          }
        >
          <option value="">{form.type === 'AJUSTE' ? 'Selecione o motivo' : 'Sem motivo específico'}</option>
          {MOVEMENT_REASONS.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </Select>
        <Input
          label="Observações"
          value={form.notes ?? ''}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </div>

      {form.type === 'AJUSTE' ? (
        <p className="mt-2 text-xs text-amber-700">
          Ajustes manuais exigem um motivo para auditoria.
        </p>
      ) : null}

      {!canUseEntrada ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          {lot?.movementWarning ?? 'Lote vencido não aceita nova entrada. Crie um novo lote.'}
        </p>
      ) : null}

      {movements.length > 0 ? (
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <div className="mb-2 flex items-center justify-between text-sm font-medium text-neutral-700">
            <span>Histórico</span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{movements.length}</span>
          </div>
          <div className="max-h-[200px] space-y-1 overflow-y-auto">
            {movements.map((movement) => {
              const previousStock =
                typeof movement.previousStock === 'number' ? movement.previousStock : null
              let nextStock: number | null = null
              if (previousStock != null) {
                if (movement.type === 'ENTRADA') nextStock = previousStock + movement.quantity
                else if (movement.type === 'SAIDA') nextStock = previousStock - movement.quantity
                else if (movement.type === 'AJUSTE') nextStock = movement.quantity
              }

              return (
                <div
                  key={movement.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {movement.type === 'ENTRADA' ? (
                      <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" />
                    ) : movement.type === 'SAIDA' ? (
                      <ArrowUpRight className="h-3.5 w-3.5 text-red-600" />
                    ) : (
                      <Pencil className="h-3.5 w-3.5 text-blue-600" />
                    )}
                    <span
                      className={cn(
                        'font-semibold',
                        movement.type === 'ENTRADA'
                          ? 'text-green-700'
                          : movement.type === 'SAIDA'
                            ? 'text-red-700'
                            : 'text-blue-700',
                      )}
                    >
                      {movement.type === 'ENTRADA' ? '+' : movement.type === 'SAIDA' ? '-' : '='}
                      {movement.quantity}
                    </span>
                    {previousStock != null && nextStock != null ? (
                      <span className="text-xs text-neutral-500 font-mono">
                        {previousStock} → {nextStock}
                      </span>
                    ) : null}
                    {movement.responsible ? (
                      <span className="text-neutral-400">por {movement.responsible}</span>
                    ) : null}
                    {movement.reason ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {MOVEMENT_REASONS.find((reason) => reason.value === movement.reason)?.label ??
                          movement.reason}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-neutral-400">
                    {new Date(movement.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-green-800">{title}</div>
      <div className="border-l-2 border-green-200 pl-4">{children}</div>
    </div>
  )
}
