import type {
  AiUsageDetection,
  ClassifiedFile,
  ComplianceResult,
  SystemDeclaration,
} from '../types'
import { checkArt5Prohibited } from './checks/art5-prohibited'
import { checkArt12Logging } from './checks/art12-logging'
import { checkArt50Transparency } from './checks/art50-transparency'
import { checkArt11AiactDocs } from './checks/art11-aiact-docs'

export async function runObligationChecks(
  system: SystemDeclaration,
  detections: AiUsageDetection[],
  allFiles: ClassifiedFile[],
  scanPath: string,
): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = []

  const prohibitedResults = await checkArt5Prohibited(detections)
  results.push(...prohibitedResults)

  if (system.classification.riskLevel === 'high') {
    const loggingResults = await checkArt12Logging(system, detections, allFiles)
    results.push(...loggingResults)

    const aiactDocsResults = await checkArt11AiactDocs(allFiles, scanPath)
    results.push(...aiactDocsResults)
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
