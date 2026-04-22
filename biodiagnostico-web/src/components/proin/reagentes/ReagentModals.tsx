import { ArrowDownLeft, ArrowUpRight, Pencil } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { ReagentLot, ReagentLotRequest, StockMovement, StockMovementRequest } from '../../../types'
import { cn } from '../../../utils/cn'
import { Button, Input, Modal, Select } from '../../ui'
import { CATEGORIES, MOVEMENT_REASONS, TEMPS, UNITS } from './constants'

export function ReagentLotModal({
  form,
  isOpen,
  isEditing,
  isSaving,
  onClose,
  onSave,
  setForm,
}: {
  form: ReagentLotRequest
  isOpen: boolean
  isEditing: boolean
  isSaving: boolean
  onClose: () => void
  onSave: () => void
  setForm: Dispatch<SetStateAction<ReagentLotRequest>>
}) {
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
          <Button onClick={onSave} loading={isSaving}>
            {isEditing ? 'Atualizar' : 'Cadastrar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <FormSection title="Identificação">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Nome / Etiqueta"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ex: Glicose, HIV, TSH..."
            />
            <Input
              label="Nº do Lote"
              value={form.lotNumber}
              onChange={(event) => setForm((current) => ({ ...current, lotNumber: event.target.value }))}
            />
            <div>
              <Input
                label="Fabricante *"
                value={form.manufacturer}
                onChange={(event) => setForm((current) => ({ ...current, manufacturer: event.target.value }))}
                placeholder="Ex: Wama, Abon..."
              />
              {!form.manufacturer?.trim() ? (
                <p className="mt-1 text-xs text-amber-600">
                  Obrigatório: fabricante é exigido para rastreabilidade.
                </p>
              ) : null}
            </div>
            <Select
              label="Categoria"
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
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

        <FormSection title="Estoque">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Estoque Atual"
              type="number"
              value={String(form.currentStock ?? 0)}
              onChange={(event) =>
                setForm((current) => ({ ...current, currentStock: Number(event.target.value) }))
              }
            />
            <Select
              label="Unidade"
              value={form.stockUnit}
              onChange={(event) => setForm((current) => ({ ...current, stockUnit: event.target.value }))}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
            <Input
              label="Consumo/Dia"
              type="number"
              value={String(form.estimatedConsumption ?? 0)}
              onChange={(event) =>
                setForm((current) => ({ ...current, estimatedConsumption: Number(event.target.value) }))
              }
            />
            <Input
              label="Qtde Inicial"
              type="number"
              value={String(form.quantityValue ?? 0)}
              onChange={(event) =>
                setForm((current) => ({ ...current, quantityValue: Number(event.target.value) }))
              }
            />
          </div>
        </FormSection>

        <FormSection title="Validade e Datas">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Input
                label="Validade *"
                type="date"
                value={form.expiryDate}
                onChange={(event) => setForm((current) => ({ ...current, expiryDate: event.target.value }))}
              />
              {!form.expiryDate ? (
                <p className="mt-1 text-xs text-amber-600">
                  Obrigatório: validade é exigida para alertas e rastreabilidade.
                </p>
              ) : null}
            </div>
            <Input
              label="Alerta (dias antes)"
              type="number"
              value={String(form.alertThresholdDays ?? 7)}
              onChange={(event) =>
                setForm((current) => ({ ...current, alertThresholdDays: Number(event.target.value) }))
              }
            />
            <Input
              label="Início de Uso"
              type="date"
              value={form.startDate ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, startDate: event.target.value || undefined }))
              }
            />
            <Input
              label="Data Fim de Uso"
              type="date"
              value={form.endDate ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, endDate: event.target.value || undefined }))
              }
            />
            <Select
              label="Temperatura"
              value={form.storageTemp}
              onChange={(event) => setForm((current) => ({ ...current, storageTemp: event.target.value }))}
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

        <FormSection title="Rastreabilidade">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Localização física"
              value={form.location ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              placeholder="Ex: Geladeira 2, Prateleira B"
            />
            <Input
              label="Fornecedor"
              value={form.supplier ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, supplier: event.target.value }))}
              placeholder="Distribuidor / revendedor"
            />
            <Input
              label="Data de recebimento"
              type="date"
              value={form.receivedDate ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, receivedDate: event.target.value || undefined }))
              }
            />
            <Input
              label="Data de abertura"
              type="date"
              value={form.openedDate ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, openedDate: event.target.value || undefined }))
              }
            />
          </div>
        </FormSection>
      </div>
    </Modal>
  )
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
}: {
  form: StockMovementRequest
  isOpen: boolean
  isSaving: boolean
  lot: ReagentLot | null
  onClose: () => void
  onSave: () => void
  setForm: Dispatch<SetStateAction<StockMovementRequest>>
  movements: StockMovement[]
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Movimentação${lot ? ` · ${lot.name}` : ''}`}
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
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              type: event.target.value as StockMovementRequest['type'],
            }))
          }
        >
          <option value="ENTRADA">Entrada</option>
          <option value="SAIDA">Saída</option>
          <option value="AJUSTE">Ajuste</option>
        </Select>
        <Input
          label="Quantidade"
          type="number"
          value={String(form.quantity)}
          onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) }))}
        />
        <Input
          label="Responsável *"
          value={form.responsible}
          onChange={(event) => setForm((current) => ({ ...current, responsible: event.target.value }))}
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
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
        />
      </div>

      {form.type === 'AJUSTE' ? (
        <p className="mt-2 text-xs text-amber-700">
          Ajustes manuais exigem um motivo para auditoria.
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
