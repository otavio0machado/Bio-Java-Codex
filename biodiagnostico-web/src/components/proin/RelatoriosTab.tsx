import { Download, LineChart } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQcExams } from '../../hooks/useQcRecords'
import { canDownload } from '../../lib/permissions'
import { reportService } from '../../services/reportService'
import { Button, Card, Select, useToast } from '../ui'

const LeveyJenningsModal = lazy(() =>
  import('../charts/LeveyJenningsModal').then((module) => ({ default: module.LeveyJenningsModal })),
)

interface RelatoriosTabProps {
  area: string
}

export function RelatoriosTab({ area }: RelatoriosTabProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: exams = [] } = useQcExams(area)
  const [periodType, setPeriodType] = useState('current-month')
  const [month, setMonth] = useState(String(new Date().getMonth() + 1))
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [isChartOpen, setIsChartOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleDownload = async () => {
    setIsGenerating(true)
    try {
      const blob = await reportService.getQcPdf({
        area,
        periodType,
        month,
        year,
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'qc-report.pdf'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.warning('Não foi possível gerar o PDF solicitado.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Relatórios</h3>
          <p className="text-sm text-neutral-500">Selecione o período e gere os artefatos da rotina de CQ.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Select label="Período" value={periodType} onChange={(event) => setPeriodType(event.target.value)}>
            <option value="current-month">Mês atual</option>
            <option value="specific-month">Mês específico</option>
            <option value="year">Ano</option>
          </Select>
          <InputMonth month={month} setMonth={setMonth} />
          <Select label="Ano" value={year} onChange={(event) => setYear(event.target.value)}>
            {Array.from({ length: 5 }).map((_, index) => {
              const currentYear = new Date().getFullYear() - index
              return (
                <option key={currentYear} value={String(currentYear)}>
                  {currentYear}
                </option>
              )
            })}
          </Select>
        </div>
        <div className="flex flex-wrap gap-3">
          {canDownload(user) ? (
            <Button
              onClick={() => void handleDownload()}
              icon={<Download className="h-4 w-4" />}
              loading={isGenerating}
              disabled={isGenerating}
            >
              Gerar PDF
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => setIsChartOpen(true)} icon={<LineChart className="h-4 w-4" />}>
            Gerar Gráfico Levey-Jennings
          </Button>
        </div>
      </Card>

      {isChartOpen ? (
        <Suspense fallback={null}>
          <LeveyJenningsModal isOpen={isChartOpen} onClose={() => setIsChartOpen(false)} area={area} exams={exams} />
        </Suspense>
      ) : null}
    </div>
  )
}

function InputMonth({ month, setMonth }: { month: string; setMonth: (value: string) => void }) {
  return (
    <Select label="Mês" value={month} onChange={(event) => setMonth(event.target.value)}>
      {Array.from({ length: 12 }).map((_, index) => (
        <option key={index} value={String(index + 1)}>
          {String(index + 1).padStart(2, '0')}
        </option>
      ))}
    </Select>
  )
}
