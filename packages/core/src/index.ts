export { scan } from './scanner/index.js'
export { loadConfig } from './config/loader.js'
export { loadFrameworks } from './knowledge/frameworks.js'
export { loadAnnexIIICategories } from './knowledge/annex-iii-categories.js'
export { getObligationsForRiskTier, getChecksForArticle, getArticleInfo } from './knowledge/obligations-map.js'
export { walkFiles } from './scanner/file-walker.js'
export { loadBaseline, saveBaseline, computeDiff } from './diff/index.js'
export { formatGitHubPRComment } from './reporters/github-pr.js'
export { formatJsonReport } from './reporters/json.js'
export { formatSarifReport } from './reporters/sarif.js'
export { formatMarkdownReport } from './reporters/markdown.js'
export { complyConfigSchema } from './config/schema.js'
export { traceCallChains } from './tracer/index.js'
export { detectSink } from './tracer/sink-detector.js'
export { detectDomainFromText, detectDomainFromFilePaths, suggestAnnexIIICategory } from './classifier/domain-detector.js'
export { classifySystem, detectUndeclaredSystems } from './classifier/index.js'
export { formatGitLabMRNote, postGitLabMRComment } from './reporters/gitlab-mr.js'
export { checkArt12AuditLogIntegration } from './obligations/checks/art12-audit-log-integration.js'
export { checkArt27Fria } from './obligations/checks/art27-fria.js'
export { generateBadgeSvg, generateBadgeUrl } from './reporters/badge.js'

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
} from './types.js'
