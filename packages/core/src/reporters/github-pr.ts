import type { ScanResult, SystemScanResult, ComplianceDiff, ComplianceResult } from '../types'

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

function formatObligationTable(title: string, results: ComplianceResult[]): string {
  if (results.length === 0) return ''

  const lines: string[] = [
    `### ${title}`,
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

function formatCriticalFindings(result: ScanResult): string {
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
    if (finding.suggestion) {
      lines.push('')
      lines.push(`<details><summary>💡 Remediation</summary>`)
      lines.push('')
      lines.push(finding.suggestion)
      lines.push('')
      lines.push(`</details>`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function formatAdvisorySection(system: SystemScanResult): string {
  const advisoryCount = system.advisoryFindings.length + system.advisoryResults.filter((r) => r.status === 'fail' || r.status === 'warning').length
  if (advisoryCount === 0) return ''

  const lines: string[] = [
    '',
    `<details><summary>ℹ️ ${advisoryCount} advisory note(s) from code analysis (not required for ${system.classification.riskLevel}-risk)</summary>`,
    '',
  ]

  if (system.advisoryFindings.length > 0) {
    const callChainNotes = system.advisoryFindings.filter((f) => f.message.startsWith('Call-chain'))
    const otherNotes = system.advisoryFindings.filter((f) => !f.message.startsWith('Call-chain'))

    if (callChainNotes.length > 0) {
      lines.push('**Code patterns detected** that would be significant if this system operated in a regulated domain:')
      lines.push('')
      for (const note of callChainNotes) {
        lines.push(`- ${note.message}`)
      }
      lines.push('')
      lines.push(`These are informational because the system is declared as \`${system.classification.domain ?? 'general_purpose'}\`.`)
      lines.push('If the system\'s domain changes, run `comply scan` again to reassess.')
      lines.push('')
    }

    if (otherNotes.length > 0) {
      for (const note of otherNotes) {
        lines.push(`- **${note.title}**: ${note.message}`)
      }
      lines.push('')
    }
  }

  const failedAdvisory = system.advisoryResults.filter((r) => r.status === 'fail' || r.status === 'warning')
  if (failedAdvisory.length > 0) {
    lines.push('**If this system is reclassified as high-risk**, the following would additionally apply:')
    lines.push('')
    lines.push('| Article | What You\'d Need | Status |')
    lines.push('|---------|----------------|--------|')
    for (const result of failedAdvisory) {
      const icon = STATUS_ICONS[result.status] ?? '❓'
      lines.push(`| ${result.articleId.replace('art', 'Art. ')} | ${result.title} | ${icon} |`)
    }
    lines.push('')
  }

  lines.push('</details>')

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
    `${summaryStatus} ${summary.totalSystems} system(s) scanned | ${passedObligations}/${totalObligations} obligations met | Score: ${Math.round(summary.overallComplianceScore * 100)}%`,
    '',
  ]

  const criticalSection = formatCriticalFindings(result)
  if (criticalSection) {
    lines.push(criticalSection)
  }

  const diffSection = formatDiffSection(diff)
  if (diffSection) {
    lines.push(diffSection)
  }

  for (const system of result.systems) {
    const tableTitle = `Your Obligations: ${system.systemName} (${system.classification.riskLevel}-risk${system.classification.domain ? `, ${system.classification.domain}` : ''})`
    const table = formatObligationTable(tableTitle, system.complianceResults)
    if (table) {
      lines.push(table)
      lines.push('')
    }

    const advisory = formatAdvisorySection(system)
    if (advisory) {
      lines.push(advisory)
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
