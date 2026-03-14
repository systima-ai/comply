import type { Log as SarifLog, Result as SarifResult, ReportingDescriptor } from 'sarif'
import type { ScanResult, Finding } from '../types'

const SEVERITY_TO_SARIF_LEVEL: Record<string, SarifResult.level> = {
  critical: 'error',
  fail: 'error',
  warning: 'warning',
  info: 'note',
}

function buildRule(finding: Finding): ReportingDescriptor {
  return {
    id: finding.id,
    shortDescription: { text: finding.title },
    fullDescription: { text: finding.message },
    helpUri: finding.referenceUrl,
  }
}

function buildResult(finding: Finding): SarifResult {
  const level = SEVERITY_TO_SARIF_LEVEL[finding.severity] ?? 'note'

  const result: SarifResult = {
    ruleId: finding.id,
    level,
    message: { text: finding.message },
  }

  if (finding.filePath) {
    result.locations = [
      {
        physicalLocation: {
          artifactLocation: {
            uri: finding.filePath,
            uriBaseId: '%SRCROOT%',
          },
          region: finding.lineNumber
            ? {
              startLine: finding.lineNumber,
              endLine: finding.endLineNumber ?? finding.lineNumber,
            }
            : undefined,
        },
      },
    ]
  }

  return result
}

export function formatSarifReport(scanResult: ScanResult): string {
  const allFindings: Finding[] = [
    ...scanResult.globalFindings,
    ...scanResult.systems.flatMap((s) => s.findings),
  ]

  const rules: ReportingDescriptor[] = []
  const results: SarifResult[] = []
  const ruleIds = new Set<string>()

  for (const finding of allFindings) {
    if (!ruleIds.has(finding.id)) {
      ruleIds.add(finding.id)
      rules.push(buildRule(finding))
    }
    results.push(buildResult(finding))
  }

  const sarifLog: SarifLog = {
    version: '2.1.0',
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'Systima Comply',
            version: '0.1.0',
            semanticVersion: '0.1.0',
            informationUri: 'https://github.com/systima-ai/comply',
            rules,
          },
        },
        results,
      },
    ],
  }

  return JSON.stringify(sarifLog, null, 2)
}
