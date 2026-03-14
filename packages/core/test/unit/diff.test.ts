import { describe, it, expect } from 'vitest'
import { computeDiff } from '../../src/diff/index.js'
import type { ScanResult } from '../../src/types.js'

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    timestamp: new Date().toISOString(),
    scanPath: '/test',
    scanMode: 'full',
    discoveryMode: false,
    systems: [],
    undeclaredSystems: [],
    globalFindings: [],
    summary: {
      totalSystems: 0,
      totalDetections: 0,
      totalFindings: 0,
      findingsBySeverity: { critical: 0, fail: 0, warning: 0, info: 0 },
      overallComplianceScore: 1,
      highestRiskLevel: 'minimal',
      classificationChanged: false,
    },
    ...overrides,
  }
}

describe('baseline diff', () => {
  it('detects new findings', () => {
    const baseline = makeScanResult()
    const current = makeScanResult({
      globalFindings: [{
        id: 'new-finding',
        severity: 'warning',
        title: 'New finding',
        message: 'Something new detected',
      }],
    })

    const diff = computeDiff(baseline, current)
    expect(diff.newFindings).toHaveLength(1)
    expect(diff.resolvedFindings).toHaveLength(0)
  })

  it('detects resolved findings', () => {
    const baseline = makeScanResult({
      globalFindings: [{
        id: 'old-finding',
        severity: 'warning',
        title: 'Old finding',
        message: 'Something that was fixed',
      }],
    })
    const current = makeScanResult()

    const diff = computeDiff(baseline, current)
    expect(diff.newFindings).toHaveLength(0)
    expect(diff.resolvedFindings).toHaveLength(1)
  })

  it('computes compliance score delta', () => {
    const baseline = makeScanResult({
      summary: {
        totalSystems: 1, totalDetections: 0, totalFindings: 0,
        findingsBySeverity: { critical: 0, fail: 0, warning: 0, info: 0 },
        overallComplianceScore: 0.5,
        highestRiskLevel: 'high',
        classificationChanged: false,
      },
    })
    const current = makeScanResult({
      summary: {
        totalSystems: 1, totalDetections: 0, totalFindings: 0,
        findingsBySeverity: { critical: 0, fail: 0, warning: 0, info: 0 },
        overallComplianceScore: 0.8,
        highestRiskLevel: 'high',
        classificationChanged: false,
      },
    })

    const diff = computeDiff(baseline, current)
    expect(diff.complianceScoreDelta).toBeCloseTo(0.3)
  })
})
