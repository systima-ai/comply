import type { TDocumentDefinitions, Content, TableCell, ContentTable, StyleDictionary } from 'pdfmake/interfaces'
import type { ScanResult, SystemScanResult, ComplianceDiff } from '../types'

const STATUS_LABELS: Record<string, string> = {
  pass: 'PASS',
  fail: 'FAIL',
  warning: 'WARNING',
  skipped: 'SKIPPED',
}

const STATUS_COLOURS: Record<string, string> = {
  pass: '#16a34a',
  fail: '#dc2626',
  warning: '#d97706',
  skipped: '#9ca3af',
}

const SEVERITY_COLOURS: Record<string, string> = {
  critical: '#dc2626',
  fail: '#dc2626',
  warning: '#d97706',
  info: '#2563eb',
}

function scoreColour(score: number): string {
  if (score >= 0.8) return '#16a34a'
  if (score >= 0.5) return '#d97706'
  return '#dc2626'
}

function buildStyles(): StyleDictionary {
  return {
    title: { fontSize: 28, bold: true, color: '#111827', margin: [0, 0, 0, 8] },
    subtitle: { fontSize: 14, color: '#6b7280', margin: [0, 0, 0, 24] },
    h2: { fontSize: 18, bold: true, color: '#111827', margin: [0, 20, 0, 8] },
    h3: { fontSize: 14, bold: true, color: '#374151', margin: [0, 12, 0, 6] },
    body: { fontSize: 10, color: '#374151', lineHeight: 1.4 },
    tableHeader: { fontSize: 9, bold: true, color: '#ffffff', fillColor: '#1f2937' },
    tableCell: { fontSize: 9, color: '#374151' },
    disclaimer: { fontSize: 8, color: '#9ca3af', italics: true, margin: [0, 16, 0, 0] },
  }
}

function buildStatusCell(status: string): TableCell {
  return {
    text: STATUS_LABELS[status] ?? status,
    fontSize: 9,
    bold: true,
    color: '#ffffff',
    fillColor: STATUS_COLOURS[status] ?? '#9ca3af',
    alignment: 'center',
  }
}

function buildObligationTable(system: SystemScanResult): ContentTable {
  const body: TableCell[][] = [
    [
      { text: 'Article', style: 'tableHeader' },
      { text: 'Obligation', style: 'tableHeader' },
      { text: 'Status', style: 'tableHeader' },
      { text: 'Detail', style: 'tableHeader' },
    ],
  ]

  for (const result of system.complianceResults) {
    body.push([
      { text: result.articleId.replace('art', 'Art. '), style: 'tableCell' },
      { text: result.title, style: 'tableCell' },
      buildStatusCell(result.status),
      {
        text: result.detail.length > 120 ? result.detail.slice(0, 117) + '...' : result.detail,
        style: 'tableCell',
        fontSize: 8,
      },
    ])
  }

  return {
    table: {
      headerRows: 1,
      widths: [45, 130, 55, '*'],
      body,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#e5e7eb',
      vLineColor: () => '#e5e7eb',
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  }
}

function buildFindingsSection(system: SystemScanResult): Content[] {
  const findings = system.findings.filter((f) => f.severity === 'critical' || f.severity === 'fail')
  if (findings.length === 0) return []

  const content: Content[] = [
    { text: 'Findings Requiring Attention', style: 'h3' },
  ]

  for (const finding of findings) {
    const colour = SEVERITY_COLOURS[finding.severity] ?? '#374151'
    content.push({
      margin: [0, 4, 0, 4] as [number, number, number, number],
      columns: [
        { text: finding.severity.toUpperCase(), width: 60, fontSize: 8, bold: true, color: colour },
        {
          stack: [
            { text: finding.title, fontSize: 9, bold: true, color: '#111827' },
            { text: finding.message, fontSize: 8, color: '#6b7280', margin: [0, 2, 0, 0] as [number, number, number, number] },
            ...(finding.suggestion ? [{ text: `Remediation: ${finding.suggestion}`, fontSize: 8, color: '#059669', margin: [0, 2, 0, 0] as [number, number, number, number] }] : []),
          ],
        },
      ],
    })
  }

  return content
}

export function generatePdfDocument(
  result: ScanResult,
  _diff?: ComplianceDiff,
): TDocumentDefinitions {
  const { summary } = result
  const score = Math.round(summary.overallComplianceScore * 100)
  const generatedDate = new Date(result.timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const content: Content[] = [
    { text: 'EU AI Act', style: 'title' },
    { text: 'Compliance Assessment Report', style: 'title', fontSize: 22 },
    { text: `Generated ${generatedDate} by Systima Comply`, style: 'subtitle' },
    {
      margin: [0, 16, 0, 24] as [number, number, number, number],
      columns: [
        {
          width: 120,
          stack: [
            { text: `${score}%`, fontSize: 48, bold: true, color: scoreColour(summary.overallComplianceScore), alignment: 'center' },
            { text: 'Compliance Score', fontSize: 10, color: '#6b7280', alignment: 'center' },
          ],
        },
        {
          width: '*',
          margin: [24, 8, 0, 0] as [number, number, number, number],
          table: {
            widths: ['*', 80],
            body: [
              [{ text: 'Systems scanned', style: 'tableCell' }, { text: String(summary.totalSystems), style: 'tableCell', bold: true }],
              [{ text: 'AI detections', style: 'tableCell' }, { text: String(summary.totalDetections), style: 'tableCell', bold: true }],
              [{ text: 'Total findings', style: 'tableCell' }, { text: String(summary.totalFindings), style: 'tableCell', bold: true }],
              [{ text: 'Critical findings', style: 'tableCell' }, { text: String(summary.findingsBySeverity.critical), style: 'tableCell', bold: true, color: summary.findingsBySeverity.critical > 0 ? '#dc2626' : '#16a34a' }],
              [{ text: 'Highest risk level', style: 'tableCell' }, { text: summary.highestRiskLevel, style: 'tableCell', bold: true }],
            ],
          },
          layout: 'noBorders',
        },
      ],
    },
  ]

  for (const system of result.systems) {
    const sysScore = Math.round(system.complianceScore * 100)
    content.push(
      { text: system.systemName, style: 'h2' },
      {
        text: [
          { text: 'Risk level: ', fontSize: 10 },
          { text: system.classification.riskLevel, fontSize: 10, bold: true },
          ...(system.classification.annexIiiCategory
            ? [{ text: ` | Annex III: ${system.classification.annexIiiCategory}`, fontSize: 10 }]
            : []),
          { text: ` | Score: ${sysScore}%`, fontSize: 10, bold: true, color: scoreColour(system.complianceScore) },
        ],
        margin: [0, 0, 0, 8] as [number, number, number, number],
      } as Content,
    )

    if (system.detections.length > 0) {
      content.push({ text: 'Detected AI Frameworks', style: 'h3' })
      const uniqueFrameworks = new Map<string, string>()
      for (const d of system.detections) {
        if (!uniqueFrameworks.has(d.frameworkId)) {
          uniqueFrameworks.set(d.frameworkId, d.frameworkName)
        }
      }
      const fwList = [...uniqueFrameworks.values()].join(', ')
      content.push({ text: fwList, style: 'body', margin: [0, 0, 0, 8] as [number, number, number, number] })
    }

    if (system.complianceResults.length > 0) {
      content.push({ text: 'Obligation Compliance', style: 'h3' })
      content.push(buildObligationTable(system))
    }

    content.push(...buildFindingsSection(system))
  }

  if (result.undeclaredSystems.length > 0) {
    content.push({ text: 'Undeclared AI Systems', style: 'h2' })
    for (const undeclared of result.undeclaredSystems) {
      content.push({
        text: undeclared.reason,
        style: 'body',
        color: '#d97706',
        margin: [0, 2, 0, 2] as [number, number, number, number],
      })
    }
  }

  content.push({
    text: 'Systima Comply is an engineering tool, not legal advice. It does not replace professional regulatory assessment.',
    style: 'disclaimer',
  })

  return {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    header: {
      text: 'Systima Comply -- EU AI Act Compliance Report',
      fontSize: 8,
      color: '#9ca3af',
      margin: [40, 20, 40, 0],
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: 'systima.ai/comply', fontSize: 8, color: '#9ca3af', margin: [40, 0, 0, 0] },
        { text: `Page ${currentPage} of ${pageCount}`, fontSize: 8, color: '#9ca3af', alignment: 'right', margin: [0, 0, 40, 0] },
      ],
    }),
    content,
    styles: buildStyles(),
    defaultStyle: { font: 'Helvetica' },
  }
}

export async function generatePdf(
  result: ScanResult,
  outputPath: string,
  diff?: ComplianceDiff,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises')
  const pdfmakeModule = await import('pdfmake')
  const pdfmake = pdfmakeModule.default ?? pdfmakeModule

  pdfmake.addFonts({
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  })

  const docDefinition = generatePdfDocument(result, diff)
  const pdf = pdfmake.createPdf(docDefinition)
  const buffer: Buffer = await pdf.getBuffer()

  await writeFile(outputPath, buffer)
}
