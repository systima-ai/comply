import type { ScanResult, SystemScanResult, ComplianceDiff } from '../types.js'

const STATUS_ICONS: Record<string, string> = {
  pass: '✅',
  fail: '❌',
  warning: '⚠️',
  skipped: '⏭️',
}

const SEVERITY_ICONS: Record<string, string> = {
  critical: '🔴',
  fail: '❌',
  warning: '⚠️',
  info: 'ℹ️',
}

function formatObligationTable(system: SystemScanResult): string {
  const results = system.complianceResults
  if (results.length === 0) return ''

  const lines: string[] = [
    `### Obligation Status: ${system.systemName} (${system.classification.riskLevel}-risk)`,
    '',
    '| Article | Obligation | Status | Detail |',
    '|---------|-----------|--------|--------|',
  ]

  for (const result of results) {
    const icon = STATUS_ICONS[result.status] ?? '❓'
    const detail = result.detail.length > 80
      ? result.detail.slice(0, 77) + '...'
      : result.detail
    lines.push(
      `| ${result.articleId.replace('art', 'Art. ')} | ${result.title} | ${icon} ${result.status.charAt(0).toUpperCase() + result.status.slice(1)} | ${detail} |`,
    )
  }

  return lines.join('\n')
}

function formatFindings(result: ScanResult): string {
  const criticalFindings = result.systems.flatMap((s) =>
    s.findings.filter((f) => f.severity === 'critical'),
  )

  if (criticalFindings.length === 0) return ''

  const lines: string[] = []

  for (const finding of criticalFindings) {
    const icon = SEVERITY_ICONS[finding.severity] ?? '❓'
    lines.push(`### ${icon} ${finding.title}`)
    lines.push(`> ${finding.message}`)
    if (finding.filePath) {
      lines.push(`> 📁 \`${finding.filePath}\`${finding.lineNumber ? `:${finding.lineNumber}` : ''}`)
    }
    if (finding.referenceUrl) {
      lines.push(`> 📋 [${finding.articleId?.replace('art', 'Article ') ?? 'Reference'}](${finding.referenceUrl})`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function formatDiffSection(diff: ComplianceDiff | undefined): string {
  if (!diff) return ''

  const lines: string[] = []

  if (diff.newFindings.length > 0) {
    lines.push('### 🆕 New Findings in This PR')
    for (const finding of diff.newFindings) {
      lines.push(`- ${SEVERITY_ICONS[finding.severity] ?? '❓'} ${finding.title}: ${finding.message}`)
    }
    lines.push('')
  }

  if (diff.resolvedFindings.length > 0) {
    lines.push('### ✅ Resolved in This PR')
    for (const finding of diff.resolvedFindings) {
      lines.push(`- ${finding.title}`)
    }
    lines.push('')
  }

  if (diff.classificationChanges.length > 0) {
    lines.push('### 🔄 Classification Changes')
    for (const change of diff.classificationChanges) {
      lines.push(`- **${change.systemId}**: ${change.previousRiskLevel} → ${change.currentRiskLevel}`)
    }
    lines.push('')
  }

  if (diff.complianceScoreDelta !== 0) {
    const direction = diff.complianceScoreDelta > 0 ? '📈' : '📉'
    lines.push(`${direction} Compliance score: ${diff.complianceScoreDelta > 0 ? '+' : ''}${(diff.complianceScoreDelta * 100).toFixed(1)}%`)
    lines.push('')
  }

  return lines.join('\n')
}

export function formatGitHubPRComment(
  result: ScanResult,
  diff?: ComplianceDiff,
): string {
  const { summary } = result

  const passedObligations = result.systems.reduce(
    (acc, s) => acc + s.complianceResults.filter((r) => r.status === 'pass').length,
    0,
  )
  const totalObligations = result.systems.reduce(
    (acc, s) => acc + s.complianceResults.filter((r) => r.status !== 'skipped').length,
    0,
  )

  const summaryStatus = summary.findingsBySeverity.critical > 0
    ? '🔴'
    : summary.findingsBySeverity.fail > 0
      ? '⚠️'
      : '✅'

  const lines: string[] = [
    '## 🛡️ Systima Comply — EU AI Act Compliance Scan',
    '',
    '### Summary',
    `${summaryStatus} ${summary.totalSystems} system(s) scanned | ${summary.totalFindings} finding(s) | ${passedObligations}/${totalObligations} obligations met`,
    '',
  ]

  const findingsSection = formatFindings(result)
  if (findingsSection) {
    lines.push(findingsSection)
  }

  const diffSection = formatDiffSection(diff)
  if (diffSection) {
    lines.push(diffSection)
  }

  for (const system of result.systems) {
    const table = formatObligationTable(system)
    if (table) {
      lines.push(table)
      lines.push('')
    }
  }

  if (result.undeclaredSystems.length > 0) {
    lines.push('### ⚠️ Undeclared AI Systems')
    for (const undeclared of result.undeclaredSystems) {
      lines.push(`- ${undeclared.reason}`)
    }
    lines.push('')
  }

  if (result.globalFindings.length > 0) {
    for (const finding of result.globalFindings) {
      lines.push(`> ${SEVERITY_ICONS[finding.severity] ?? 'ℹ️'} ${finding.message}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push(
    '📖 [EU AI Act Compliance Guide](https://systima.ai/blog/eu-ai-act-engineering-compliance-guide) | ' +
    '🔧 [Configure Comply](.systima.yml) | ' +
    '💬 [Feedback](https://github.com/systima-ai/comply/issues)',
  )
  lines.push('')
  lines.push('> ⚖️ *Systima Comply is an engineering tool, not legal advice. It does not replace professional regulatory assessment.*')

  return lines.join('\n')
}
