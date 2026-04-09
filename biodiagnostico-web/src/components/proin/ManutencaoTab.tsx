import { CalendarClock, Pencil, Trash2, Wrench } from 'lucide-react'
import { useState, type Dispatch, type SetStateAction } from 'react'
import { useCreateMaintenanceRecord, useDeleteMaintenanceRecord, useMaintenanceRecords, useUpdateMaintenanceRecord } from '../../hooks/useMaintenance'
import type { MaintenanceRecord, MaintenanceRequest } from '../../types'
import { Button, Card, EmptyState, Input, Modal, StatusBadge, TextArea, useToast } from '../ui'
import { Select } from '../ui'
import { VoiceRecorderModal } from './VoiceRecorderModal'

const emptyForm: MaintenanceRequest = {
  equipment: '',
  type: 'Preventiva',
  date: new Date().toISOString().slice(0, 10),
  nextDate: '',
  technician: '',
  notes: '',
}

export function ManutencaoTab() {
  const { toast } = useToast()
  const { data: records = [] } = useMaintenanceRecords()
  const createRecord = useCreateMaintenanceRecord()
  const updateRecord = useUpdateMaintenanceRecord()
  const deleteRecord = useDeleteMaintenanceRecord()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null)
  const [form, setForm] = useState<MaintenanceRequest>({ ...emptyForm })

  const handleOpenCreate = () => {
    setEditingRecord(null)
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (record: MaintenanceRecord) => {
    setEditingRecord(record)
    setForm({
      equipment: record.equipment,
      type: record.type,
      date: typeof record.date === 'string' ? record.date : new Date(record.date).toISOString().slice(0, 10),
      nextDate: record.nextDate ? (typeof record.nextDate === 'string' ? record.nextDate : new Date(record.nextDate).toISOString().slice(0, 10)) : '',
      technician: record.technician ?? '',
      notes: record.notes ?? '',
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingRecord(null)
    setForm({ ...emptyForm })
  }

  const handleSave = async () => {
    if (!form.equipment || !form.type) {
      toast.warning('Preencha equipamento e tipo de manutenção.')
      return
    }
    if (form.nextDate && form.date && form.nextDate <= form.date) {
      toast.warning('A próxima data de manutenção deve ser posterior à data da manutenção atual.')
      return
    }
    const payload: MaintenanceRequest = {
      ...form,
      nextDate: form.nextDate || undefined,
    }
    try {
      if (editingRecord) {
        await updateRecord.mutateAsync({ id: editingRecord.id, request: payload })
        toast.success('Manutenção atualizada.')
      } else {
        await createRecord.mutateAsync(payload)
        toast.success('Manutenção registrada.')
      }
      handleCloseModal()
    } catch {
      toast.error(editingRecord ? 'Não foi possível atualizar a manutenção.' : 'Não foi possível registrar a manutenção.')
    }
  }

  const handleDelete = async (record: MaintenanceRecord) => {
    if (!window.confirm(`Excluir manutenção "${record.equipment} — ${record.type}"?`)) return
    try {
      await deleteRecord.mutateAsync(record.id)
      toast.success('Manutenção excluída.')
    } catch {
      toast.error('Não foi possível excluir a manutenção.')
    }
  }

  if (!records.length) {
    return (
      <>
        <EmptyState
          icon={<Wrench className="h-8 w-8" />}
          title="Nenhuma manutenção cadastrada"
          description="Registre revisões preventivas, corretivas e calibrações para manter a operação rastreável."
          action={{ label: 'Nova Manutenção', onClick: handleOpenCreate }}
        />
        <MaintenanceModal
          form={form}
          isOpen={isModalOpen}
          isEditing={Boolean(editingRecord)}
          isSaving={editingRecord ? updateRecord.isPending : createRecord.isPending}
          onClose={handleCloseModal}
          onSave={handleSave}
          setForm={setForm}
        />
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Manutenção</h3>
          <p className="text-sm text-neutral-500">Histórico de manutenção e calibração de equipamentos.</p>
        </div>
        <Button onClick={handleOpenCreate}>Nova Manutenção</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {records.map((record) => {
          const isPending = Boolean(record.nextDate && new Date(record.nextDate) < new Date())
          return (
            <Card key={record.id} className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-neutral-900">{record.equipment}</div>
                  <div className="text-sm text-neutral-500">{record.type}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={isPending ? 'ALERTA' : 'APROVADO'} />
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(record)}
                    className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(record)}
                    className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-neutral-400">Data</div>
                  <div className="mt-1 text-sm font-medium text-neutral-900">{new Date(record.date).toLocaleDateString('pt-BR')}</div>
                </div>
                <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-neutral-400">Próxima</div>
                  <div className="mt-1 text-sm font-medium text-neutral-900">{record.nextDate ? new Date(record.nextDate).toLocaleDateString('pt-BR') : 'Sem previsão'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <CalendarClock className="h-4 w-4" />
                {record.technician || 'Técnico não informado'}
              </div>
            </Card>
          )
        })}
      </div>

      <MaintenanceModal
        form={form}
        isOpen={isModalOpen}
        isEditing={Boolean(editingRecord)}
        isSaving={editingRecord ? updateRecord.isPending : createRecord.isPending}
        onClose={handleCloseModal}
        onSave={handleSave}
        setForm={setForm}
      />
    </div>
  )
}

interface MaintenanceModalProps {
  form: MaintenanceRequest
  isOpen: boolean
  isEditing: boolean
  isSaving: boolean
  onClose: () => void
  onSave: () => void
  setForm: Dispatch<SetStateAction<MaintenanceRequest>>
}

function MaintenanceModal({ form, isOpen, isEditing, isSaving, onClose, onSave, setForm }: MaintenanceModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar manutenção' : 'Nova manutenção'}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSave} loading={isSaving}>{isEditing ? 'Atualizar' : 'Salvar'}</Button>
        </div>
      }
    >
      <div className="mb-4 flex justify-end">
        <VoiceRecorderModal
          formType="manutencao"
          title="Preencher manutenção por voz"
          onApply={(data) =>
            setForm((current) => ({
              ...current,
              equipment: typeof data.equipment === 'string' ? data.equipment : current.equipment,
              type: typeof data.type === 'string' ? data.type : current.type,
              date: typeof data.date === 'string' ? data.date : current.date,
              nextDate: typeof data.next_date === 'string' ? data.next_date : current.nextDate,
              notes: typeof data.notes === 'string' ? data.notes : current.notes,
            }))
          }
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Equipamento" value={form.equipment} onChange={(event) => setForm((current) => ({ ...current, equipment: event.target.value }))} />
        <Select label="Tipo" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
          {['Preventiva', 'Corretiva', 'Calibração'].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Input label="Data" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
        <Input label="Próxima data" type="date" value={form.nextDate} onChange={(event) => setForm((current) => ({ ...current, nextDate: event.target.value }))} />
        <Input label="Técnico" value={form.technician} onChange={(event) => setForm((current) => ({ ...current, technician: event.target.value }))} />
      </div>
      <div className="mt-4">
        <TextArea label="Notas" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
      </div>
    </Modal>
  )
}
