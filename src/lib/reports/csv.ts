import Papa from 'papaparse'
import { withAudit } from '../audit'

export interface CsvOptions {
  filename: string
  resourceLabel: string
  resourceId: string
}

export async function exportCsv<T extends Record<string, unknown>>(
  rows: T[],
  options: CsvOptions,
): Promise<void> {
  const csv = Papa.unparse(rows, {
    delimiter: ';', // Excel BR
    header: true,
  })

  // BOM UTF-8 para Excel BR não bagunçar acentos
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = options.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  await withAudit(
    {
      action: 'download',
      resource: { type: 'session', id: options.resourceId, label: options.resourceLabel },
      metadata: { notes: `Export CSV: ${rows.length} linhas → ${options.filename}` },
    },
    async () => undefined,
  )
}
