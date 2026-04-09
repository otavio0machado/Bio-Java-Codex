import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
  useCreateQcExam,
  useCreateQcReference,
  useDeleteQcReference,
  useQcExams,
  useQcReferences,
  useUpdateQcReference,
} from '../../hooks/useQcRecords'
import type { QcExam, QcReferenceRequest, QcReferenceValue } from '../../types'
import { Button, Card, EmptyState, Input, Modal, Select, StatusBadge, TextArea, useToast } from '../ui'
import { VoiceRecorderModal } from './VoiceRecorderModal'

interface ReferenciasTabProps {
  area: string
}

const emptyReferenceForm: QcReferenceRequest = {
  examId: '',
  name: '',
  level: 'Normal',
  lotNumber: '',
  manufacturer: '',
  targetValue: 0,
  targetSd: 0,
  cvMaxThreshold: 10,
  validFrom: '',
  validUntil: '',
  notes: '',
}

export function ReferenciasTab({ area }: ReferenciasTabProps) {
  const { toast } = useToast()
  const { data: exams = [] } = useQcExams(area)
  const { data: references = [] } = useQcReferences(undefined, false)
  const createReference = useCreateQcReference()
  const updateReference = useUpdateQcReference()
  const deleteReference = useDeleteQcReference()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<QcReferenceValue | null>(null)
  const [form, setForm] = useState<QcReferenceRequest>(emptyReferenceForm)

  const filteredReferences = useMemo(
    () => references.filter((reference) => reference.exam?.area === area),
    [area, references],
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyReferenceForm)
    setIsModalOpen(true)
  }

  const openEdit = (reference: QcReferenceValue) => {
    setEditing(reference)
    setForm({
      examId: reference.exam.id,
      name: reference.name,
      level: reference.level,
      lotNumber: reference.lotNumber ?? '',
      manufacturer: reference.manufacturer ?? '',
      targetValue: reference.targetValue,
      targetSd: reference.targetSd,
      cvMaxThreshold: reference.cvMaxThreshold,
      validFrom: reference.validFrom ?? '',
      validUntil: reference.validUntil ?? '',
      notes: reference.notes ?? '',
    })
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.examId || !form.name) {
      toast.warning('Preencha exame e nome da referência.')
      return
    }
    const payload: QcReferenceRequest = {
      ...form,
      validFrom: form.validFrom || undefined,
      validUntil: form.validUntil || undefined,
      lotNumber: form.lotNumber || undefined,
      manufacturer: form.manufacturer || undefined,
      notes: form.notes || undefined,
    }
    try {
      if (editing) {
        await updateReference.mutateAsync({ id: editing.id, request: payload })
        toast.success('Referência atualizada.')
      } else {
        await createReference.mutateAsync(payload)
        toast.success('Referência criada.')
      }
      setIsModalOpen(false)
    } catch {
      toast.error('Não foi possível salvar a referência.')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteReference.mutateAsync(id)
      toast.success('Referência excluída.')
    } catch {
      toast.error('Não foi possível excluir a referência.')
    }
  }

  if (!filteredReferences.length) {
    return (
      <>
        <EmptyState
          icon={<Plus className="h-8 w-8" />}
          title="Nenhuma referência cadastrada"
          description="Cadastre valores alvo, desvio padrão e validade para automatizar o preenchimento do registro."
          action={{ label: 'Nova Referência', onClick: openCreate }}
        />
        <ReferenceModal
          area={area}
          exams={exams}
          form={form}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          setForm={setForm}
          isSaving={createReference.isPending || updateReference.isPending}
        />
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Referências</h3>
          <p className="text-sm text-neutral-500">Faixas alvo ativas para a área de {area}</p>
        </div>
        <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
          Nova Referência
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredReferences.map((reference) => (
          <Card key={reference.id} className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-neutral-900">{reference.name}</h4>
                <div className="text-sm text-neutral-500">
                  {reference.exam.name} · {reference.level}
                </div>
              </div>
              <StatusBadge status={reference.isActive ? 'ativo' : 'inativo'} />
            </div>
            <div className="space-y-2 text-sm text-neutral-600">
              <div>Alvo: {reference.targetValue.toFixed(2)} ± {reference.targetSd.toFixed(2)}</div>
              <div>CV máx: {reference.cvMaxThreshold.toFixed(2)}%</div>
              <div>Validade: {reference.validUntil ? new Date(reference.validUntil).toLocaleDateString('pt-BR') : 'Sem data final'}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => openEdit(reference)} icon={<Pencil className="h-4 w-4" />}>
                Editar
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => void handleDelete(reference.id)} icon={<Trash2 className="h-4 w-4" />}>
                Excluir
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <ReferenceModal
        area={area}
        exams={exams}
        form={form}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        setForm={setForm}
        isSaving={createReference.isPending || updateReference.isPending}
      />
    </div>
  )
}

interface ReferenceModalProps {
  area: string
  exams: QcExam[]
  form: QcReferenceRequest
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  setForm: Dispatch<SetStateAction<QcReferenceRequest>>
  isSaving: boolean
}

function ReferenceModal({ area, exams, form, isOpen, onClose, onSave, setForm, isSaving }: ReferenceModalProps) {
  const { toast } = useToast()
  const createExam = useCreateQcExam()
  const [showNewExam, setShowNewExam] = useState(false)
  const [newExamName, setNewExamName] = useState('')

  const handleCreateExam = async () => {
    if (!newExamName.trim()) {
      toast.warning('Informe o nome do exame.')
      return
    }
    try {
      const exam = await createExam.mutateAsync({ name: newExamName.trim(), area })
      setForm((current) => ({ ...current, examId: exam.id }))
      toast.success(`Exame "${exam.name}" criado.`)
      setNewExamName('')
      setShowNewExam(false)
    } catch {
      toast.error('Não foi possível criar o exame.')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Referência de CQ"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSave} loading={isSaving}>
            Salvar
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex justify-end">
        <VoiceRecorderModal
          formType="referencia"
          title="Preencher referência por voz"
          onApply={(data) => {
            const examId = typeof data.exam_name === 'string'
              ? exams.find((exam) => exam.name.toUpperCase() === data.exam_name?.toString().toUpperCase())?.id ?? form.examId
              : form.examId
            setForm((current) => ({
              ...current,
              examId,
              name: typeof data.name === 'string' ? data.name : current.name,
              level: typeof data.level === 'string' ? data.level : current.level,
              validFrom: typeof data.valid_from === 'string' ? data.valid_from : current.validFrom,
              validUntil: typeof data.valid_until === 'string' ? data.valid_until : current.validUntil,
              targetValue: typeof data.target_value === 'number' ? data.target_value : current.targetValue,
              cvMaxThreshold: typeof data.cv_max === 'number' ? data.cv_max : current.cvMaxThreshold,
              lotNumber: typeof data.lot_number === 'string' ? data.lot_number : current.lotNumber,
              manufacturer: typeof data.manufacturer === 'string' ? data.manufacturer : current.manufacturer,
              notes: typeof data.notes === 'string' ? data.notes : current.notes,
            }))
          }}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Select label="Exame" value={form.examId} onChange={(event) => setForm((current) => ({ ...current, examId: event.target.value }))}>
            <option value="">Selecione</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name}
              </option>
            ))}
          </Select>
          {!showNewExam ? (
            <button
              type="button"
              onClick={() => setShowNewExam(true)}
              className="text-sm font-medium text-green-700 hover:text-green-800"
            >
              + Criar novo exame
            </button>
          ) : (
            <div className="flex items-end gap-2 rounded-xl bg-neutral-50 p-3">
              <Input
                label="Nome do exame"
                value={newExamName}
                onChange={(event) => setNewExamName(event.target.value)}
                placeholder="Ex: Glicose, Colesterol..."
              />
              <Button size="sm" onClick={handleCreateExam} loading={createExam.isPending}>
                Criar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowNewExam(false); setNewExamName('') }}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
        <Input label="Nome" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        <Select label="Nível" value={form.level} onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))}>
          {['Normal', 'N1', 'N2', 'N3', 'Patológico', 'Alto', 'Baixo'].map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
        <Input label="Lote" value={form.lotNumber} onChange={(event) => setForm((current) => ({ ...current, lotNumber: event.target.value }))} />
        <Input label="Fabricante" value={form.manufacturer} onChange={(event) => setForm((current) => ({ ...current, manufacturer: event.target.value }))} />
        <Input label="Valor alvo" type="number" step="0.01" value={String(form.targetValue)} onChange={(event) => setForm((current) => ({ ...current, targetValue: Number(event.target.value) }))} />
        <Input label="Desvio padrão" type="number" step="0.01" value={String(form.targetSd)} onChange={(event) => setForm((current) => ({ ...current, targetSd: Number(event.target.value) }))} />
        <Input label="CV máximo" type="number" step="0.01" value={String(form.cvMaxThreshold)} onChange={(event) => setForm((current) => ({ ...current, cvMaxThreshold: Number(event.target.value) }))} />
        <Input label="Válido de" type="date" value={form.validFrom} onChange={(event) => setForm((current) => ({ ...current, validFrom: event.target.value }))} />
        <Input label="Válido até" type="date" value={form.validUntil} onChange={(event) => setForm((current) => ({ ...current, validUntil: event.target.value }))} />
      </div>
      <div className="mt-4">
        <TextArea label="Observações" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
      </div>
    </Modal>
  )
}
