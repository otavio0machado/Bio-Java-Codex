import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  useCreateTemperatureRecord,
  useUpdateTemperatureRecord,
  useTemperatureLocations,
} from '../../hooks/useTemperature'
import type {
  TemperatureRecord,
  TemperatureRecordRequest,
} from '../../types/temperature'
import { Button, Input, Modal, Select, TextArea, useToast } from '../ui'
import { todayLocal } from '../../utils/date'

interface TemperatureRecordModalProps {
  isOpen: boolean
  onClose: () => void
  recordToEdit?: TemperatureRecord | null
  defaultLocationId?: string
}

export function TemperatureRecordModal({
  isOpen,
  onClose,
  recordToEdit,
  defaultLocationId,
}: TemperatureRecordModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: locations } = useTemperatureLocations()

  const createRecord = useCreateTemperatureRecord()
  const updateRecord = useUpdateTemperatureRecord()

  const [locationId, setLocationId] = useState<string>('')
  const [date, setDate] = useState<string>(todayLocal())
  const [time, setTime] = useState<string>('08:00')
  const [period, setPeriod] = useState<string>('UNICO')
  const [tempMax, setTempMax] = useState<string>('')
  const [tempMin, setTempMin] = useState<string>('')
  const [tempCurrent, setTempCurrent] = useState<string>('')
  const [humidity, setHumidity] = useState<string>('')
  const [responsible, setResponsible] = useState<string>('')
  const [actionTaken, setActionTaken] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  useEffect(() => {
    if (recordToEdit) {
      setLocationId(recordToEdit.locationId)
      setDate(recordToEdit.date)
      setTime(recordToEdit.time ? recordToEdit.time.substring(0, 5) : '08:00')
      setPeriod(recordToEdit.period || 'UNICO')
      setTempMax(String(recordToEdit.tempMax))
      setTempMin(String(recordToEdit.tempMin))
      setTempCurrent(
        recordToEdit.tempCurrent !== null && recordToEdit.tempCurrent !== undefined
          ? String(recordToEdit.tempCurrent)
          : ''
      )
      setHumidity(
        recordToEdit.humidity !== null && recordToEdit.humidity !== undefined
          ? String(recordToEdit.humidity)
          : ''
      )
      setResponsible(recordToEdit.responsible)
      setActionTaken(recordToEdit.actionTaken || '')
      setNotes(recordToEdit.notes || '')
    } else {
      setLocationId(defaultLocationId || (locations && locations.length > 0 ? locations[0].id : ''))
      setDate(todayLocal())
      setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      setPeriod('UNICO')
      setTempMax('')
      setTempMin('')
      setTempCurrent('')
      setHumidity('')
      setResponsible(user?.name || '')
      setActionTaken('')
      setNotes('')
    }
  }, [recordToEdit, defaultLocationId, locations, user, isOpen])

  const selectedLoc = locations?.find((l) => l.id === locationId)

  const numMin = parseFloat(tempMin.replace(',', '.'))
  const numMax = parseFloat(tempMax.replace(',', '.'))
  const numHum = humidity ? parseFloat(humidity.replace(',', '.')) : null

  let isNonCompliant = false
  if (selectedLoc && !isNaN(numMin) && !isNaN(numMax)) {
    if (numMin < selectedLoc.minTempTarget || numMax > selectedLoc.maxTempTarget) {
      isNonCompliant = true
    }
    if (numHum !== null && !isNaN(numHum)) {
      if (
        selectedLoc.minHumidityTarget !== null &&
        selectedLoc.minHumidityTarget !== undefined &&
        numHum < selectedLoc.minHumidityTarget
      ) {
        isNonCompliant = true
      }
      if (
        selectedLoc.maxHumidityTarget !== null &&
        selectedLoc.maxHumidityTarget !== undefined &&
        numHum > selectedLoc.maxHumidityTarget
      ) {
        isNonCompliant = true
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!locationId) {
      toast.error('Selecione o ponto de monitoramento.')
      return
    }
    if (isNaN(numMin) || isNaN(numMax)) {
      toast.error('Informe as temperaturas máxima e mínima.')
      return
    }
    if (isNonCompliant && !actionTaken.trim()) {
      toast.error('Preencha a ação corretiva tomada para o desvio de temperatura.')
      return
    }

    const payload: TemperatureRecordRequest = {
      locationId,
      date,
      time,
      period,
      tempMax: numMax,
      tempMin: numMin,
      tempCurrent: isNaN(parseFloat(tempCurrent)) ? null : parseFloat(tempCurrent),
      humidity: numHum,
      responsible: responsible.trim() || 'Operador',
      actionTaken: actionTaken.trim() || null,
      notes: notes.trim() || null,
      ocrApplied: recordToEdit?.ocrApplied ?? false,
      photoUrl: recordToEdit?.photoUrl ?? null,
      photoFilename: recordToEdit?.photoFilename ?? null,
    }

    if (recordToEdit) {
      updateRecord.mutate(
        { id: recordToEdit.id, request: payload },
        {
          onSuccess: () => {
            toast.success('Registro de temperatura atualizado!')
            onClose()
          },
          onError: () => {
            toast.error('Falha ao atualizar registro.')
          },
        }
      )
    } else {
      createRecord.mutate(payload, {
        onSuccess: () => {
          toast.success('Registro de temperatura salvo com sucesso!')
          onClose()
        },
        onError: () => {
          toast.error('Falha ao salvar registro.')
        },
      })
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={recordToEdit ? 'Editar Registro de Temperatura' : 'Novo Registro de Temperatura'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-700">
            Equipamento / Ponto de Monitoramento *
          </label>
          <Select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mt-1"
            required
          >
            {locations?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.code}) [{l.minTempTarget}°C a {l.maxTempTarget}°C]
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-700">Data *</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700">Hora *</label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700">Período</label>
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="mt-1"
            >
              <option value="UNICO">Único / Diário</option>
              <option value="MANHA">Manhã</option>
              <option value="TARDE">Tarde</option>
              <option value="NOITE">Noite</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700">Máx OUT (°C) *</label>
            <Input
              type="text"
              value={tempMax}
              onChange={(e) => setTempMax(e.target.value)}
              placeholder="Ex: 5.5"
              className="mt-1 font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700">Mín OUT (°C) *</label>
            <Input
              type="text"
              value={tempMin}
              onChange={(e) => setTempMin(e.target.value)}
              placeholder="Ex: 2.5"
              className="mt-1 font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700">Atual (°C)</label>
            <Input
              type="text"
              value={tempCurrent}
              onChange={(e) => setTempCurrent(e.target.value)}
              placeholder="Momento"
              className="mt-1"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700">Umidade (%)</label>
            <Input
              type="text"
              value={humidity}
              onChange={(e) => setHumidity(e.target.value)}
              placeholder="% UR"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700">Responsável *</label>
          <Input
            type="text"
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
            placeholder="Nome do operador"
            className="mt-1"
            required
          />
        </div>

        {isNonCompliant && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 space-y-2">
            <label className="block text-xs font-bold text-rose-800 uppercase">
              Ação Corretiva Obrigatória (Desvio de Temperatura) *
            </label>
            <TextArea
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              placeholder="Descreva a providência tomada..."
              rows={2}
              required
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-neutral-700">Observações</label>
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotações gerais..."
            rows={2}
            className="mt-1"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={createRecord.isPending || updateRecord.isPending}
          >
            {recordToEdit ? 'Atualizar' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
