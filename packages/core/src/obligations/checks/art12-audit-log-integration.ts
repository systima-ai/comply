import { readFile } from 'node:fs/promises'
import type {
  AiUsageDetection,
  ClassifiedFile,
  ComplianceResult,
} from '../../types.js'

const AUDIT_LOG_PACKAGE = '@systima/aiact-audit-log'
const AUDIT_LOG_MIDDLEWARE = '@systima/aiact-audit-log/ai-sdk/middleware'

async function findAuditLogUsage(
  allFiles: ClassifiedFile[],
): Promise<{
  hasPackage: boolean
  hasMiddleware: boolean
  hasContextPropagation: boolean
  hasStorage: boolean
  filePaths: string[]
}> {
  const result = {
    hasPackage: false,
    hasMiddleware: false,
    hasContextPropagation: false,
    hasStorage: false,
    filePaths: [] as string[],
  }

  const sourceFiles = allFiles.filter(
    (f) => f.language === 'typescript' || f.language === 'javascript',
  )

  for (const file of sourceFiles) {
    try {
      const content = await readFile(file.path, 'utf-8')

      if (content.includes(AUDIT_LOG_PACKAGE)) {
        result.hasPackage = true
        result.filePaths.push(file.path)

        if (content.includes(AUDIT_LOG_MIDDLEWARE) || content.includes('aiActMiddleware')) {
          result.hasMiddleware = true
        }

        if (content.includes('withAuditContext') || content.includes('AsyncLocalStorage')) {
          result.hasContextPropagation = true
        }

        if (
          content.includes('S3Storage') ||
          content.includes('FileStorage') ||
          content.includes('storage:')
        ) {
          result.hasStorage = true
        }
      }
    } catch {
      continue
    }
  }

  const packageJsonFiles = allFiles.filter(
    (f) => f.relativePath.split('/').pop() === 'package.json',
  )

  for (const file of packageJsonFiles) {
    try {
      const content = await readFile(file.path, 'utf-8')
      if (content.includes(AUDIT_LOG_PACKAGE)) {
        result.hasPackage = true
      }
    } catch {
      continue
    }
  }

  return result
}

function calculateLoggingCoverage(
  detections: AiUsageDetection[],
  _allFiles: ClassifiedFile[],
): { covered: number; total: number } {
  const aiCallDetections = detections.filter(
    (d) => d.detectionType === 'import' && !d.isDevelopmentDependency,
  )

  return {
    covered: 0,
    total: aiCallDetections.length,
  }
}

export async function checkArt12AuditLogIntegration(
  detections: AiUsageDetection[],
  allFiles: ClassifiedFile[],
): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = []
  const auditLogUsage = await findAuditLogUsage(allFiles)

  if (!auditLogUsage.hasPackage) {
    results.push({
      articleId: 'art12',
      status: 'warning',
      title: '@systima/aiact-audit-log not detected',
      detail: 'The @systima/aiact-audit-log package is not installed. This package provides Article 12 compliant structured, tamper-evident audit logging with AI SDK middleware. Install it with: npm install @systima/aiact-audit-log',
      referenceUrl: 'https://github.com/systima-ai/aiact-audit-log',
      phase: 3,
    })
    return results
  }

  results.push({
    articleId: 'art12',
    status: 'pass',
    title: '@systima/aiact-audit-log installed',
    detail: 'The Article 12 compliant audit logging package is installed.',
    filePaths: auditLogUsage.filePaths,
    referenceUrl: 'https://github.com/systima-ai/aiact-audit-log',
    phase: 3,
  })

  if (!auditLogUsage.hasMiddleware) {
    results.push({
      articleId: 'art12',
      status: 'warning',
      title: 'AI SDK middleware not detected',
      detail: 'The @systima/aiact-audit-log package is installed but AI SDK middleware is not configured. Register the middleware to automatically capture every generateText and streamText call.',
      referenceUrl: 'https://github.com/systima-ai/aiact-audit-log#ai-sdk-middleware',
      phase: 3,
    })
  } else {
    results.push({
      articleId: 'art12',
      status: 'pass',
      title: 'AI SDK middleware configured',
      detail: 'Automatic audit logging middleware is registered for AI SDK calls.',
      referenceUrl: 'https://github.com/systima-ai/aiact-audit-log#ai-sdk-middleware',
      phase: 3,
    })
  }

  if (!auditLogUsage.hasContextPropagation) {
    results.push({
      articleId: 'art12',
      status: 'warning',
      title: 'Context propagation not detected',
      detail: 'withAuditContext or AsyncLocalStorage-based context propagation not found. Context propagation ensures decision IDs flow through async call chains for complete audit trails.',
      referenceUrl: 'https://github.com/systima-ai/aiact-audit-log#context-propagation',
      phase: 3,
    })
  }

  if (!auditLogUsage.hasStorage) {
    results.push({
      articleId: 'art12',
      status: 'warning',
      title: 'Storage configuration not detected',
      detail: 'No S3 or file storage configuration found for audit logs. Production deployments should use S3-compatible storage with Object Lock for tamper-evidence.',
      referenceUrl: 'https://github.com/systima-ai/aiact-audit-log#storage',
      phase: 3,
    })
  }

  const coverage = calculateLoggingCoverage(detections, allFiles)
  if (coverage.total > 0) {
    results.push({
      articleId: 'art12',
      status: coverage.covered === coverage.total ? 'pass' : 'warning',
      title: `Logging coverage: ${coverage.covered}/${coverage.total} AI call sites`,
      detail: coverage.covered === coverage.total
        ? 'All detected AI call sites have associated logging instrumentation.'
        : `${coverage.total - coverage.covered} AI call site(s) may not have logging coverage. Review that all AI API calls are captured by the audit logger.`,
      referenceUrl: 'https://artificialintelligenceact.eu/article/12/',
      phase: 3,
    })
  }

  return results
}
