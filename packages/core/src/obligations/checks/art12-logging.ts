import { readFile } from 'node:fs/promises'
import type {
  AiUsageDetection,
  ClassifiedFile,
  ComplianceResult,
  SystemDeclaration,
} from '../../types.js'

const LOGGING_PACKAGES_JS = [
  '@systima/aiact-audit-log',
  'winston',
  'pino',
  'bunyan',
]

const LOGGING_PACKAGES_PY = [
  'structlog',
  'python-json-logger',
  'loguru',
]

function hasLoggingDependency(detections: AiUsageDetection[]): boolean {
  return detections.some((d) => {
    if (d.detectionType !== 'dependency') return false
    return [...LOGGING_PACKAGES_JS, ...LOGGING_PACKAGES_PY].some(
      (pkg) => d.matchedText.includes(pkg),
    )
  })
}

async function hasAuditLogInPackageJson(
  allFiles: ClassifiedFile[],
): Promise<boolean> {
  const packageJsonFiles = allFiles.filter(
    (f) => f.relativePath.split('/').pop() === 'package.json',
  )

  for (const file of packageJsonFiles) {
    try {
      const content = await readFile(file.path, 'utf-8')
      if (content.includes('@systima/aiact-audit-log')) return true
    } catch {
      continue
    }
  }

  return false
}

export async function checkArt12Logging(
  _system: SystemDeclaration,
  detections: AiUsageDetection[],
  allFiles: ClassifiedFile[],
): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = []

  const hasAuditLog = await hasAuditLogInPackageJson(allFiles)

  if (hasAuditLog) {
    results.push({
      articleId: 'art12',
      status: 'pass',
      title: 'Article 12 logging infrastructure detected',
      detail: '@systima/aiact-audit-log package detected. This provides structured, tamper-evident audit logging compliant with Article 12 requirements.',
      referenceUrl: 'https://artificialintelligenceact.eu/article/12/',
      phase: 1,
    })
    return results
  }

  if (hasLoggingDependency(detections)) {
    results.push({
      articleId: 'art12',
      status: 'warning',
      title: 'Structured logging detected but not Article 12 compliant',
      detail: 'A structured logging library was detected, but it is not specifically designed for Article 12 compliance. Article 12 requires: unique decision IDs, model version tracking, parameter capture, input/output recording, tool call logging, human intervention tracking, and tamper-evident storage. Consider adopting @systima/aiact-audit-log for compliant logging.',
      referenceUrl: 'https://artificialintelligenceact.eu/article/12/',
      phase: 1,
    })
    return results
  }

  results.push({
    articleId: 'art12',
    status: 'fail',
    title: 'No logging infrastructure detected',
    detail: 'No structured logging or audit logging package detected for this high-risk system. Article 12 requires automatic logging capabilities that record events relevant to identifying risk situations. This is the highest-retrofit-cost obligation.',
    referenceUrl: 'https://artificialintelligenceact.eu/article/12/',
    phase: 1,
  })

  return results
}
