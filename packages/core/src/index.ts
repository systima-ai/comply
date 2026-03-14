export { scan } from './scanner/index'
export { loadConfig } from './config/loader'
export { loadFrameworks } from './knowledge/frameworks'
export { loadAnnexIIICategories } from './knowledge/annex-iii-categories'
export { getObligationsForRiskTier, getChecksForArticle, getArticleInfo } from './knowledge/obligations-map'
export { walkFiles } from './scanner/file-walker'
export { loadBaseline, saveBaseline, computeDiff } from './diff/index'
export { formatGitHubPRComment } from './reporters/github-pr'
export { formatJsonReport } from './reporters/json'
export { formatSarifReport } from './reporters/sarif'
export { formatMarkdownReport } from './reporters/markdown'
export { complyConfigSchema } from './config/schema'
export { traceCallChains } from './tracer/index'
export { detectSink } from './tracer/sink-detector'
export { detectDomainFromText, detectDomainFromFilePaths, suggestAnnexIIICategory } from './classifier/domain-detector'
export { classifySystem, detectUndeclaredSystems } from './classifier/index'
export { formatGitLabMRNote, postGitLabMRComment } from './reporters/gitlab-mr'
export { checkArt12AuditLogIntegration } from './obligations/checks/art12-audit-log-integration'
export { checkArt27Fria } from './obligations/checks/art27-fria'
export { generateBadgeSvg, generateBadgeUrl } from './reporters/badge'
export { generatePdf, generatePdfDocument } from './reporters/pdf'
export { scaffoldDocumentation } from './scaffold/index'
export { runDoctor } from './doctor/index'
export { checkArt11AiactDocs } from './obligations/checks/art11-aiact-docs'

export type {
  AiUsageDetection,
  AnnexIIICategory,
  ArticleId,
  CallChainTrace,
  ClassificationMismatch,
  ClassifiedFile,
  ComplianceDiff,
  ComplianceResult,
  ComplianceStatus,
  ComplyConfig,
  DetectionConfidence,
  DetectionType,
  DomainIndicator,
  FailOn,
  FileLanguage,
  FileManifest,
  Finding,
  FindingSeverity,
  FrameworkCategory,
  FrameworkPattern,
  ObligationDefinition,
  OperatorRole,
  OutputFormat,
  Regulation,
  RiskTier,
  ScanMode,
  ScanOptions,
  ScanResult,
  ScanSummary,
  SystemDeclaration,
  SystemScanResult,
  TracedSink,
  UndeclaredSystem,
} from './types'
