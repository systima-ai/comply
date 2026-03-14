import type {
  AiUsageDetection,
  ClassifiedFile,
  ComplianceResult,
  SystemDeclaration,
} from '../types.js'
import { checkArt5Prohibited } from './checks/art5-prohibited.js'
import { checkArt12Logging } from './checks/art12-logging.js'
import { checkArt50Transparency } from './checks/art50-transparency.js'

export async function runObligationChecks(
  system: SystemDeclaration,
  detections: AiUsageDetection[],
  allFiles: ClassifiedFile[],
  _scanPath: string,
): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = []

  const prohibitedResults = await checkArt5Prohibited(detections)
  results.push(...prohibitedResults)

  if (system.classification.riskLevel === 'high') {
    const loggingResults = await checkArt12Logging(system, detections, allFiles)
    results.push(...loggingResults)
  }

  if (
    system.classification.riskLevel === 'high' ||
    system.classification.riskLevel === 'limited'
  ) {
    const transparencyResults = await checkArt50Transparency(system, detections, allFiles)
    results.push(...transparencyResults)
  }

  return results
}
