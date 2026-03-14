import { readFile, writeFile } from 'node:fs/promises'
import type { ComplianceDiff, Finding, ScanResult } from '../types'

export async function loadBaseline(baselinePath: string): Promise<ScanResult | null> {
  try {
    const content = await readFile(baselinePath, 'utf-8')
    return JSON.parse(content) as ScanResult
  } catch {
    return null
  }
}

export async function saveBaseline(
  baselinePath: string,
  result: ScanResult,
): Promise<void> {
  await writeFile(baselinePath, JSON.stringify(result, null, 2), 'utf-8')
}

export function computeDiff(
  baseline: ScanResult,
  current: ScanResult,
): ComplianceDiff {
  const baselineFindings = new Map<string, Finding>()
  const currentFindings = new Map<string, Finding>()

  const allBaselineFindings = [
    ...baseline.globalFindings,
    ...baseline.systems.flatMap((s) => s.findings),
  ]

  const allCurrentFindings = [
    ...current.globalFindings,
    ...current.systems.flatMap((s) => s.findings),
  ]

  for (const finding of allBaselineFindings) {
    baselineFindings.set(finding.id, finding)
  }

  for (const finding of allCurrentFindings) {
    currentFindings.set(finding.id, finding)
  }

  const newFindings: Finding[] = []
  const resolvedFindings: Finding[] = []

  for (const [id, finding] of currentFindings) {
    if (!baselineFindings.has(id)) {
      newFindings.push(finding)
    }
  }

  for (const [id, finding] of baselineFindings) {
    if (!currentFindings.has(id)) {
      resolvedFindings.push(finding)
    }
  }

  const classificationChanges: ComplianceDiff['classificationChanges'] = []
  for (const currentSystem of current.systems) {
    const baselineSystem = baseline.systems.find(
      (s) => s.systemId === currentSystem.systemId,
    )
    if (
      baselineSystem &&
      baselineSystem.classification.riskLevel !== currentSystem.classification.riskLevel
    ) {
      classificationChanges.push({
        systemId: currentSystem.systemId,
        previousRiskLevel: baselineSystem.classification.riskLevel,
        currentRiskLevel: currentSystem.classification.riskLevel,
      })
    }
  }

  const obligationChanges: ComplianceDiff['obligationChanges'] = []
  for (const currentSystem of current.systems) {
    const baselineSystem = baseline.systems.find(
      (s) => s.systemId === currentSystem.systemId,
    )
    if (!baselineSystem) continue

    for (const currentResult of currentSystem.complianceResults) {
      const baselineResult = baselineSystem.complianceResults.find(
        (r) => r.articleId === currentResult.articleId && r.title === currentResult.title,
      )
      if (baselineResult && baselineResult.status !== currentResult.status) {
        obligationChanges.push({
          systemId: currentSystem.systemId,
          articleId: currentResult.articleId,
          previousStatus: baselineResult.status,
          currentStatus: currentResult.status,
        })
      }
    }
  }

  const complianceScoreDelta =
    current.summary.overallComplianceScore - baseline.summary.overallComplianceScore

  return {
    baselineTimestamp: baseline.timestamp,
    currentTimestamp: current.timestamp,
    newFindings,
    resolvedFindings,
    classificationChanges,
    obligationChanges,
    complianceScoreDelta,
  }
}
