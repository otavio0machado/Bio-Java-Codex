import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  History,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
  useCreateMaintenanceRecord,
  useDeleteMaintenanceRecord,
  useMaintenanceRecords,
  useUpdateMaintenanceRecord,
} from '../../hooks/useMaintenance'
import { useSuggestObservation } from '../../hooks/useAiAssist'
import type { MaintenanceRecord, MaintenanceRequest } from '../../types'
import {
  Button,
  Card,
  Combobox,
  EmptyState,
  Input,
  Modal,
  Select,
  StatCard,
  TextArea,
  useToast,
} from '../ui'
import type { ComboboxOption } from '../ui'
import { AiAssistDisclaimer } from './AiAssistShared'
import {
  compareLocalDate,
  diffInDays,
  formatLongBR,
  todayLocal,
} from '../../utils/date'

type DerivedStatus = 'ATRASADA' | 'PROXIMA' | 'AGENDADA' | 'EM_DIA' | 'REALIZADA'

interface RecordStatusInfo {
  status: DerivedStatus
  label: string
  pillClasses: string
  diffDays: number | null
}

const MAINTENANCE_TYPES = ['Preventiva', 'Corretiva', 'Calibração']

const emptyForm: MaintenanceRequest = {
  equipment: '',
  type: 'Preventiva',
  date: todayLocal(),
  nextDate: '',
  technician: '',
  notes: '',
}

/**
 * Deriva o status operacional de uma manutencao.
 *
 * - Se isLatest === false: registro historico concluido -> REALIZADA ("Realizada").
 * - Se isLatest === true:
 *   - sem nextDate -> EM_DIA ("Em dia").
 *   - nextDate < hoje -> ATRASADA ("Atrasada").
 *   - nextDate em ate 7 dias -> PROXIMA ("Próxima (7d)").
 *   - nextDate em ate 30 dias -> AGENDADA ("Agendada (30d)").
 *   - nextDate > 30 dias -> EM_DIA ("Em dia").
 */
function deriveRecordStatus(record: MaintenanceRecord, isLatest: boolean): RecordStatusInfo {
  const today = todayLocal()

  if (!isLatest) {
    return {
      status: 'REALIZADA',
      label: 'Realizada',
      pillClasses: 'bg-neutral-100 text-neutral-700',
      diffDays: null,
    }
  }

  if (!record.nextDate) {
    return {
      status: 'EM_DIA',
      label: 'Em dia',
      pillClasses: 'bg-green-100 text-green-800',
      diffDays: null,
    }
  }

  const diff = diffInDays(today, record.nextDate)
  if (diff === null) {
    return {
      status: 'EM_DIA',
      label: 'Em dia',
      pillClasses: 'bg-green-100 text-green-800',
      diffDays: null,
    }
  }

  if (diff < 0) {
    return {
      status: 'ATRASADA',
      label: 'Atrasada',
      pillClasses: 'bg-red-100 text-red-800',
      diffDays: Math.abs(diff),
    }
  }

  if (diff <= 7) {
    return {
      status: 'PROXIMA',
      label: 'Próxima (7d)',
      pillClasses: 'bg-amber-100 text-amber-800',
      diffDays: diff,
    }
  }

  if (diff <= 30) {
    return {
      status: 'AGENDADA',
      label: 'Agendada (30d)',
      pillClasses: 'bg-amber-50 text-amber-700',
      diffDays: diff,
    }
  }

  return {
    status: 'EM_DIA',
    label: 'Em dia',
    pillClasses: 'bg-green-100 text-green-800',
    diffDays: diff,
  }
}

function statusLabel(status: DerivedStatus) {
  switch (status) {
    case 'ATRASADA':
      return 'Atrasada'
    case 'PROXIMA':
      return 'Próxima (7d)'
    case 'AGENDADA':
      return 'Agendada (30d)'
    case 'REALIZADA':
      return 'Realizadas'
    default:
      return 'Em dia'
  }
}

function StatusPill({ statusInfo }: { statusInfo: RecordStatusInfo }) {
  return (
    <span className={'inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ' + statusInfo.pillClasses}>
      {statusInfo.label}
    </span>
  )
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

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState('')
  const [technicianFilter, setTechnicianFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todas' | DerivedStatus>('todas')

  // Undo delete
  const [deletedRecord, setDeletedRecord] = useState<{ request: MaintenanceRequest; timeout: number } | null>(null)

  // Historico por equipamento
  const [historyEquipment, setHistoryEquipment] = useState<string | null>(null)

  // Registro mais recente por equipamento (para derivar status ativo vs histórico)
  const latestRecordByEquipment = useMemo(() => {
    const map = new Map<string, MaintenanceRecord>()
    const sorted = [...records].sort((a, b) => compareLocalDate(b.date, a.date))
    for (const r of sorted) {
      const key = r.equipment?.trim().toUpperCase()
      if (key && !map.has(key)) {
        map.set(key, r)
      }
    }
    return map
  }, [records])

  // Opcoes para o Combobox de equipamento / tecnico — derivadas dos records
  const equipmentOptions = useMemo<ComboboxOption[]>(() => {
    const map = new Map<string, number>()
    for (const r of records) {
      const name = r.equipment?.trim()
      if (!name) continue
      map.set(name, (map.get(name) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({
        value: name,
        label: name,
        description: count > 1 ? `${count} registros` : undefined,
      }))
  }, [records])

  const technicianOptions = useMemo<ComboboxOption[]>(() => {
    const set = new Map<string, number>()
    for (const r of records) {
      const t = r.technician?.trim()
      if (!t) continue
      set.set(t, (set.get(t) ?? 0) + 1)
    }
    return Array.from(set.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([t, c]) => ({ value: t, label: t, description: c > 1 ? `${c} registros` : undefined }))
  }, [records])

  // KPIs — derivados do ciclo ativo por equipamento
  const kpis = useMemo(() => {
    const total = records.length
    let overdue = 0
    let next7 = 0
    let scheduled = 0
    for (const [_, latest] of latestRecordByEquipment.entries()) {
      const s = deriveRecordStatus(latest, true)
      if (s.status === 'ATRASADA') overdue++
      else if (s.status === 'PROXIMA') next7++
      else if (s.status === 'AGENDADA') scheduled++
    }
    return { total, overdue, next7, scheduled }
  }, [records, latestRecordByEquipment])

  // Registros filtrados
  const filteredRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return records
      .filter((r) => {
        if (typeFilter && r.type !== typeFilter) return false
        if (equipmentFilter && r.equipment !== equipmentFilter) return false
        if (technicianFilter && r.technician !== technicianFilter) return false

        const isLatest = latestRecordByEquipment.get(r.equipment?.trim().toUpperCase())?.id === r.id
        const statusInfo = deriveRecordStatus(r, isLatest)
        if (statusFilter !== 'todas' && statusInfo.status !== statusFilter) return false

        if (term) {
          const hay = `${r.equipment ?? ''} ${r.type ?? ''} ${r.technician ?? ''} ${r.notes ?? ''}`.toLowerCase()
          if (!hay.includes(term)) return false
        }
        return true
      })
      .sort((a, b) => compareLocalDate(b.date, a.date))
  }, [records, typeFilter, equipmentFilter, technicianFilter, statusFilter, searchTerm, latestRecordByEquipment])

  const handleOpenCreate = () => {
    setEditingRecord(null)
    setForm({ ...emptyForm, date: todayLocal() })
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
    try {
      await deleteRecord.mutateAsync(record.id)
      // Ativa undo: guarda dados + agenda limpeza em 5s
      if (deletedRecord) {
        window.clearTimeout(deletedRecord.timeout)
      }
      // QA P0: normaliza datas antes de snapshotar. record.date pode vir como
      // Date (em cache) dependendo do parser — serializar como LocalDate puro
      // (YYYY-MM-DD local) evita shift UTC no re-create via undo.
      const normalizeDate = (v: unknown): string | undefined => {
        if (v == null || v === '') return undefined
        if (typeof v === 'string') return v
        if (v instanceof Date) {
          const yyyy = v.getFullYear()
          const mm = String(v.getMonth() + 1).padStart(2, '0')
          const dd = String(v.getDate()).padStart(2, '0')
          return `${yyyy}-${mm}-${dd}`
        }
        return String(v)
      }
      const snapshot: MaintenanceRequest = {
        equipment: record.equipment,
        type: record.type,
        date: normalizeDate(record.date) ?? todayLocal(),
        nextDate: normalizeDate(record.nextDate),
        technician: record.technician ?? undefined,
        notes: record.notes ?? undefined,
      }
      const timeout = window.setTimeout(() => setDeletedRecord(null), 5000)
      setDeletedRecord({ request: snapshot, timeout })
      toast.success('Manutenção excluída.')
    } catch {
      toast.error('Não foi possível excluir a manutenção.')
    }
  }

  const handleUndo = async () => {
    if (!deletedRecord) return
    window.clearTimeout(deletedRecord.timeout)
    try {
      await createRecord.mutateAsync(deletedRecord.request)
      toast.success('Manutenção restaurada.')
    } catch {
      toast.error('Não foi possível restaurar a manutenção.')
    } finally {
      setDeletedRecord(null)
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setTypeFilter('')
    setEquipmentFilter('')
    setTechnicianFilter('')
    setStatusFilter('todas')
  }

  const hasActiveFilter =
    Boolean(searchTerm) || Boolean(typeFilter) || Boolean(equipmentFilter) || Boolean(technicianFilter) || statusFilter !== 'todas'

  if (!records.length) {
    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Manutenção</h1>
            <p className="mt-1 text-base text-neutral-500">Registro e histórico de manutenções de equipamentos.</p>
          </div>
          <Button onClick={handleOpenCreate}>Nova Manutenção</Button>
        </header>
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
          equipmentOptions={equipmentOptions}
          technicianOptions={technicianOptions}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Manutenção</h1>
          <p className="mt-1 text-base text-neutral-500">Registro e histórico de manutenções de equipamentos.</p>
        </div>
        <Button onClick={handleOpenCreate}>Nova Manutenção</Button>
      </header>

      {/* KPIs — clicaveis para pre-filtrar status */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={() => setStatusFilter('todas')} className="text-left">
          <StatCard
            label="Total de registros"
            value={kpis.total}
            icon={<Wrench className="h-5 w-5" />}
            iconColor="bg-neutral-500"
          />
        </button>
        <button type="button" onClick={() => setStatusFilter('ATRASADA')} className="text-left">
          <StatCard
            label="Atrasadas"
            value={kpis.overdue}
            icon={<AlertTriangle className="h-5 w-5" />}
            iconColor={kpis.overdue > 0 ? 'bg-red-500' : 'bg-neutral-400'}
          />
        </button>
        <button type="button" onClick={() => setStatusFilter('PROXIMA')} className="text-left">
          <StatCard
            label="Próximas 7 dias"
            value={kpis.next7}
            icon={<Clock className="h-5 w-5" />}
            iconColor={kpis.next7 > 0 ? 'bg-amber-500' : 'bg-neutral-400'}
          />
        </button>
        <button type="button" onClick={() => setStatusFilter('AGENDADA')} className="text-left">
          <StatCard
            label="Agendadas 30 dias"
            value={kpis.scheduled}
            icon={<CalendarClock className="h-5 w-5" />}
            iconColor="bg-green-600"
          />
        </button>
      </div>

      {/* Filtros */}
      <Card className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Busca"
            placeholder="Equipamento, tipo, técnico, nota..."
            icon={<Search className="h-4 w-4" />}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <Select label="Tipo" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">Todos os tipos</option>
            {MAINTENANCE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Combobox
            label="Equipamento"
            placeholder="Todos os equipamentos"
            value={equipmentFilter}
            onChange={setEquipmentFilter}
            options={equipmentOptions}
            allowCustom={false}
            emptyText="Nenhum equipamento cadastrado"
          />
          <Combobox
            label="Técnico"
            placeholder="Todos os técnicos"
            value={technicianFilter}
            onChange={setTechnicianFilter}
            options={technicianOptions}
            allowCustom={false}
            emptyText="Nenhum técnico cadastrado"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-500">Status:</span>
          {(['todas', 'ATRASADA', 'PROXIMA', 'AGENDADA', 'EM_DIA', 'REALIZADA'] as const).map((s) => {
            const active = statusFilter === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={
                  'rounded-full px-3 py-1.5 text-sm font-medium transition ' +
                  (active
                    ? 'bg-green-700 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200')
                }
              >
                {s === 'todas' ? 'Todas' : statusLabel(s)}
              </button>
            )
          })}
          {hasActiveFilter ? (
            <button type="button" onClick={clearFilters} className="ml-auto inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          ) : null}
        </div>
      </Card>

      {/* Lista */}
      {filteredRecords.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wrench className="h-8 w-8" />}
            title="Nenhuma manutenção encontrada"
            description="Ajuste busca, tipo ou status para ver mais registros."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredRecords.map((record) => {
            const isLatest = latestRecordByEquipment.get(record.equipment?.trim().toUpperCase())?.id === record.id
            const statusInfo = deriveRecordStatus(record, isLatest)
            return (
              <Card key={record.id} className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setHistoryEquipment(record.equipment)}
                      className="block truncate text-left text-base font-semibold text-green-900 underline-offset-2 hover:underline focus:outline-none focus:underline"
                      title={`Ver histórico de ${record.equipment}`}
                    >
                      {record.equipment}
                    </button>
                    <div className="text-sm text-neutral-500">{record.type}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill statusInfo={statusInfo} />
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
                    <div className="mt-1 text-sm font-medium text-neutral-900">{formatLongBR(record.date)}</div>
                  </div>
                  <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-neutral-400">Próxima</div>
                    <div className="mt-1 text-sm font-medium text-neutral-900">
                      {record.nextDate ? formatLongBR(record.nextDate) : 'Sem previsão'}
                      {isLatest && record.nextDate && statusInfo.diffDays !== null ? (
                        <span className={'ml-2 text-xs font-semibold ' + (statusInfo.status === 'ATRASADA' ? 'text-red-600' : statusInfo.status === 'PROXIMA' ? 'text-amber-600' : 'text-neutral-500')}>
                          {statusInfo.status === 'ATRASADA' ? `${statusInfo.diffDays}d atraso` : statusInfo.diffDays === 0 ? 'hoje' : `em ${statusInfo.diffDays}d`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <CalendarClock className="h-4 w-4" />
                  {record.technician || 'Técnico não informado'}
                </div>
                {record.notes ? <div className="text-sm text-neutral-600">{record.notes}</div> : null}
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal cadastro/edicao */}
      <MaintenanceModal
        form={form}
        isOpen={isModalOpen}
        isEditing={Boolean(editingRecord)}
        isSaving={editingRecord ? updateRecord.isPending : createRecord.isPending}
        onClose={handleCloseModal}
        onSave={handleSave}
        setForm={setForm}
        equipmentOptions={equipmentOptions}
        technicianOptions={technicianOptions}
      />

      {/* Modal historico do equipamento */}
      <EquipmentHistoryModal
        equipment={historyEquipment}
        records={records}
        onClose={() => setHistoryEquipment(null)}
      />

      {/* Undo delete — desabilita enquanto createRecord esta rodando (QA P1) */}
      {deletedRecord ? (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-lg">
          <span className="text-base text-neutral-700">Manutenção excluída.</span>
          <button
            onClick={handleUndo}
            disabled={createRecord.isPending}
            className="font-semibold text-green-700 hover:text-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createRecord.isPending ? 'Restaurando...' : 'Desfazer'}
          </button>
        </div>
      ) : null}
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
  equipmentOptions: ComboboxOption[]
  technicianOptions: ComboboxOption[]
}

function MaintenanceModal({
  form,
  isOpen,
  isEditing,
  isSaving,
  onClose,
  onSave,
  setForm,
  equipmentOptions,
  technicianOptions,
}: MaintenanceModalProps) {
  const { toast } = useToast()
  const suggestObservation = useSuggestObservation()

  // C8 — Sugere uma nota de manutencao a partir dos dados ja preenchidos.
  // Apenas preenche o campo; o tecnico revisa e decide salvar.
  const handleSuggestNotes = async () => {
    if (suggestObservation.isPending) return
    if (!form.equipment || !form.type) {
      toast.warning('Informe equipamento e tipo antes de sugerir a nota.')
      return
    }
    const contextParts = [
      `Equipamento: ${form.equipment}`,
      `Tipo de manutenção: ${form.type}`,
      `Data: ${form.date}`,
    ]
    if (form.nextDate) contextParts.push(`Próxima manutenção: ${form.nextDate}`)
    if (form.technician) contextParts.push(`Técnico: ${form.technician}`)
    try {
      const suggestion = await suggestObservation.mutateAsync({
        kind: 'maintenance',
        context: contextParts.join(' | '),
      })
      setForm((current) => ({ ...current, notes: suggestion }))
    } catch {
      toast.error('Não foi possível gerar a sugestão agora.')
    }
  }

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
      <div className="grid gap-4 md:grid-cols-2">
        <Combobox
          label="Equipamento"
          placeholder="Busque ou digite um novo equipamento"
          value={form.equipment}
          onChange={(next) => setForm((current) => ({ ...current, equipment: next }))}
          options={equipmentOptions}
          allowCustom
          createLabel="Cadastrar novo"
          emptyText="Nenhum equipamento cadastrado — digite para criar"
        />
        <Select label="Tipo" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
          {MAINTENANCE_TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Input label="Data" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
        <Input label="Próxima data" type="date" value={form.nextDate ?? ''} onChange={(event) => setForm((current) => ({ ...current, nextDate: event.target.value }))} />
        <Combobox
          label="Técnico"
          placeholder="Busque ou digite o técnico"
          value={form.technician ?? ''}
          onChange={(event) => setForm((current) => ({ ...current, technician: event }))}
          options={technicianOptions}
          allowCustom
          createLabel="Cadastrar novo"
          emptyText="Nenhum técnico cadastrado — digite para criar"
        />
      </div>
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-neutral-700">Notas</span>
          <button
            type="button"
            onClick={handleSuggestNotes}
            disabled={suggestObservation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
            title="Sugestão assistiva gerada por IA"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {suggestObservation.isPending ? 'Gerando...' : 'Sugerir nota'}
          </button>
        </div>
        <TextArea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
        {suggestObservation.data ? <AiAssistDisclaimer className="mt-2" /> : null}
      </div>
    </Modal>
  )
}

interface EquipmentHistoryModalProps {
  equipment: string | null
  records: MaintenanceRecord[]
  onClose: () => void
}

/**
 * Historico completo de um equipamento, aberto ao clicar no nome do
 * equipamento na lista. Exibe todas as manutencoes em ordem cronologica
 * e destaca o status ativo (atrasada, proxima ou em dia).
 */
function EquipmentHistoryModal({ equipment, records, onClose }: EquipmentHistoryModalProps) {
  const isOpen = equipment !== null

  const { list, latest, statusInfo } = useMemo(() => {
    if (!equipment) return { list: [], latest: null, statusInfo: null }
    const list = records
      .filter((r) => r.equipment?.trim().toLowerCase() === equipment.trim().toLowerCase())
      .sort((a, b) => compareLocalDate(b.date, a.date))
    const latest = list[0] ?? null
    const statusInfo = latest ? deriveRecordStatus(latest, true) : null
    return { list, latest, statusInfo }
  }, [records, equipment])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={equipment ? `Histórico — ${equipment}` : ''}
      size="lg"
    >
      {!isOpen ? null : (
        <div className="space-y-4">
          {statusInfo?.status === 'ATRASADA' ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-900">
                <AlertTriangle className="h-4 w-4 text-red-600" /> Manutenção atrasada
              </div>
              <div className="mt-1 text-base font-medium text-red-950">
                Prevista para {formatLongBR(latest?.nextDate ?? '')} ({statusInfo.diffDays} dias de atraso) · {latest?.type}
              </div>
            </div>
          ) : latest?.nextDate ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <Clock className="h-4 w-4" /> Próxima manutenção prevista
              </div>
              <div className="mt-1 text-base font-medium text-amber-950">
                {formatLongBR(latest.nextDate)} · {latest.type} {statusInfo?.diffDays !== null ? `(${statusInfo?.diffDays === 0 ? 'hoje' : `em ${statusInfo?.diffDays} dias`})` : ''}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-green-700" /> Manutenções em dia
              </div>
              <div className="mt-1 text-green-900/80">
                {latest
                  ? `Última manutenção realizada em ${formatLongBR(latest.date)} (${latest.type}). Sem nova data agendada.`
                  : 'Nenhuma manutenção registrada para este equipamento.'}
              </div>
            </div>
          )}

          {list.length === 0 ? (
            <EmptyState
              icon={<History className="h-8 w-8" />}
              title="Sem histórico"
              description={`Nenhuma manutenção registrada para ${equipment}.`}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-xs uppercase tracking-wider text-neutral-500">
                    <th className="px-3 py-2.5">Data</th>
                    <th className="px-3 py-2.5">Tipo</th>
                    <th className="px-3 py-2.5">Próxima</th>
                    <th className="px-3 py-2.5">Técnico</th>
                    <th className="px-3 py-2.5">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((record) => (
                    <tr key={record.id} className="border-b border-neutral-50 hover:bg-neutral-50/50">
                      <td className="whitespace-nowrap px-3 py-2 text-neutral-700">{formatLongBR(record.date)}</td>
                      <td className="px-3 py-2 text-neutral-700">{record.type}</td>
                      <td className="px-3 py-2 text-neutral-600">{record.nextDate ? formatLongBR(record.nextDate) : '—'}</td>
                      <td className="px-3 py-2 text-neutral-500">{record.technician || '—'}</td>
                      <td className="px-3 py-2 text-neutral-500">{record.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
