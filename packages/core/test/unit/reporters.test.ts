import { describe, it, expect } from 'vitest'
import { formatGitHubPRComment } from '../../src/reporters/github-pr.js'
import { formatSarifReport } from '../../src/reporters/sarif.js'
import { generateBadgeSvg } from '../../src/reporters/badge.js'
import type { ScanResult } from '../../src/types.js'

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    timestamp: '2026-03-14T00:00:00.000Z',
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

describe('GitHub PR comment reporter', () => {
  it('includes the Systima Comply header', () => {
    const result = makeScanResult()
    const comment = formatGitHubPRComment(result)
    expect(comment).toContain('Systima Comply')
    expect(comment).toContain('EU AI Act Compliance Scan')
  })

  it('includes the legal disclaimer', () => {
    const result = makeScanResult()
    const comment = formatGitHubPRComment(result)
    expect(comment).toContain('not legal advice')
  })

  it('shows findings when present', () => {
    const result = makeScanResult({
      systems: [{
        systemId: 'test',
        systemName: 'Test System',
        classification: { riskLevel: 'high' },
        detections: [],
        complianceResults: [],
        advisoryResults: [],
        classificationMismatches: [],
        findings: [{
          id: 'test-finding',
          severity: 'critical',
          title: 'Critical issue',
          message: 'Something is very wrong',
          articleId: 'art6',
          systemId: 'test',
        }],
        advisoryFindings: [],
        complianceScore: 0,
      }],
      summary: {
        totalSystems: 1,
        totalDetections: 0,
        totalFindings: 1,
        findingsBySeverity: { critical: 1, fail: 0, warning: 0, info: 0 },
        overallComplianceScore: 0,
        highestRiskLevel: 'high',
        classificationChanged: false,
      },
    })
    const comment = formatGitHubPRComment(result)
    expect(comment).toContain('Critical issue')
    expect(comment).toContain('Something is very wrong')
  })
})

describe('SARIF reporter', () => {
  it('produces valid SARIF JSON', () => {
    const result = makeScanResult({
      globalFindings: [{
        id: 'test-rule',
        severity: 'warning',
        title: 'Test finding',
        message: 'Test message',
      }],
    })
    const sarif = formatSarifReport(result)
    const parsed = JSON.parse(sarif) as Record<string, unknown>
    expect(parsed['version']).toBe('2.1.0')
    expect(parsed['$schema']).toContain('sarif-schema')
    expect(Array.isArray(parsed['runs'])).toBe(true)
  })
})

describe('badge generator', () => {
  it('generates a valid SVG badge', () => {
    const result = makeScanResult()
    const svg = generateBadgeSvg(result)
    expect(svg).toContain('<svg')
    expect(svg).toContain('EU AI Act')
    expect(svg).toContain('100%')
  })

  it('shows critical status for critical findings', () => {
    const result = makeScanResult({
      summary: {
        totalSystems: 1, totalDetections: 0, totalFindings: 1,
        findingsBySeverity: { critical: 1, fail: 0, warning: 0, info: 0 },
        overallComplianceScore: 0,
        highestRiskLevel: 'high',
        classificationChanged: false,
      },
    })
    const svg = generateBadgeSvg(result)
    expect(svg).toContain('critical')
    expect(svg).toContain('#e53e3e')
  })
})
