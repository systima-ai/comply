import type { ScanResult, ComplianceDiff } from '../types'

export interface JsonReport {
  version: string
  scan: ScanResult
  diff?: ComplianceDiff
}

export function formatJsonReport(
  result: ScanResult,
  diff?: ComplianceDiff,
): string {
  const report: JsonReport = {
    version: '1.0.0',
    scan: result,
    diff,
  }

  return JSON.stringify(report, null, 2)
}
