export type RiskTier = 'unacceptable' | 'high' | 'limited' | 'minimal'

export type OperatorRole = 'provider' | 'deployer' | 'both'

export type Regulation = 'eu_ai_act' | 'gdpr' | 'nis2' | 'cra' | 'dora'

export type FindingSeverity = 'critical' | 'fail' | 'warning' | 'info'

export type ComplianceStatus = 'pass' | 'fail' | 'warning' | 'skipped'

export type DetectionType = 'import' | 'dependency' | 'config'

export type DetectionConfidence = 'high' | 'medium' | 'low'

export type ScanMode = 'full' | 'diff'

export type OutputFormat = 'comment' | 'json' | 'sarif' | 'markdown' | 'text' | 'pdf'

export type FailOn = 'none' | 'warning' | 'fail' | 'critical'

export type FileLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'json'
  | 'yaml'
  | 'toml'
  | 'env'
  | 'dockerfile'
  | 'terraform'
  | 'ini'
  | 'unknown'

export type FrameworkCategory =
  | 'llm_provider'
  | 'ml_framework'
  | 'agent_framework'
  | 'computer_vision'
  | 'nlp_embeddings'
  | 'ai_infrastructure'

export type SystemDomain =
  | 'general_purpose'
  | 'customer_support'
  | 'internal_tooling'
  | 'content_generation'
  | 'creditworthiness'
  | 'employment'
  | 'insurance'
  | 'education'
  | 'legal'
  | 'law_enforcement'
  | 'migration'
  | 'critical_infrastructure'
  | 'biometric'
  | 'emergency_services'
  | 'public_benefits'
  | 'election'

export const REGULATED_DOMAINS: Set<SystemDomain> = new Set([
  'creditworthiness',
  'employment',
  'insurance',
  'education',
  'legal',
  'law_enforcement',
  'migration',
  'critical_infrastructure',
  'biometric',
  'emergency_services',
  'public_benefits',
  'election',
])

export type AnnexIIICategory =
  | '1a' | '1b' | '1c'
  | '2'
  | '3a' | '3b' | '3c' | '3d'
  | '4a' | '4b'
  | '5a' | '5b' | '5c' | '5d'
  | '6a' | '6b' | '6c' | '6d' | '6e'
  | '7a' | '7b' | '7c' | '7d'
  | '8a' | '8b'

export type ArticleId =
  | 'art5'
  | 'art6'
  | 'art9'
  | 'art10'
  | 'art11'
  | 'art12'
  | 'art13'
  | 'art14'
  | 'art15'
  | 'art25'
  | 'art27'
  | 'art50'
  | 'art72'

export interface FrameworkPattern {
  id: string
  name: string
  category: FrameworkCategory
  riskSignals: RiskTier[]
  python: {
    imports: string[]
    packages: string[]
  }
  javascript: {
    imports: string[]
    packages: string[]
  }
  envPatterns: string[]
  description: string
}

export interface AiUsageDetection {
  filePath: string
  lineNumber: number
  endLineNumber?: number
  frameworkId: string
  frameworkName: string
  frameworkCategory: FrameworkCategory
  detectionType: DetectionType
  confidence: DetectionConfidence
  riskSignals: RiskTier[]
  matchedText: string
  isDevelopmentDependency: boolean
}

export interface SystemScope {
  paths: string[]
  exclude?: string[]
}

export interface SystemClassification {
  riskLevel: RiskTier
  domain?: SystemDomain
  annexIiiCategory?: AnnexIIICategory
  rationale?: string
}

export interface SystemDocumentation {
  riskManagement?: string
  dataGovernance?: string
  technicalDocs?: string
  transparency?: string
  humanOversight?: string
  fria?: string
  accuracyRobustness?: string
  postMarketMonitoring?: string
}

export interface SystemDeclaration {
  id: string
  name: string
  description?: string
  scope: SystemScope
  classification: SystemClassification
  regulations?: Regulation[]
  documentation?: SystemDocumentation
  ignore?: string[]
}

export interface OrganisationConfig {
  name: string
  euPresence: boolean
  operatorRole: OperatorRole
}

export interface ComplyConfig {
  version: string
  organisation: OrganisationConfig
  systems: SystemDeclaration[]
}

export interface ClassifiedFile {
  path: string
  relativePath: string
  language: FileLanguage
  size: number
}

export interface FileManifest {
  files: ClassifiedFile[]
  totalFiles: number
  truncated: boolean
  languages: Record<FileLanguage, number>
}

export interface ObligationDefinition {
  articleId: ArticleId
  articleNumber: number
  title: string
  description: string
  applicableRiskTiers: RiskTier[]
  enforcementDate: string
  penaltyTier: 'highest' | 'high' | 'standard'
  referenceUrl: string
  phase: 1 | 2 | 3
}

export interface ComplianceResult {
  articleId: ArticleId
  status: ComplianceStatus
  title: string
  detail: string
  remediation?: string
  filePaths?: string[]
  lineNumbers?: number[]
  referenceUrl: string
  phase: 1 | 2 | 3
}

export interface ClassificationMismatch {
  systemId: string
  declaredRiskLevel: RiskTier
  suggestedRiskLevel: RiskTier
  reason: string
  frameworkId: string
  suggestedAnnexIiiCategory?: AnnexIIICategory
  filePaths: string[]
}

export interface UndeclaredSystem {
  detections: AiUsageDetection[]
  suggestedRiskLevel: RiskTier
  suggestedAnnexIiiCategory?: AnnexIIICategory
  reason: string
}

export interface Finding {
  id: string
  severity: FindingSeverity
  articleId?: ArticleId
  systemId?: string
  title: string
  message: string
  filePath?: string
  lineNumber?: number
  endLineNumber?: number
  suggestion?: string
  referenceUrl?: string
}

export interface SystemScanResult {
  systemId: string
  systemName: string
  classification: SystemClassification
  detections: AiUsageDetection[]
  complianceResults: ComplianceResult[]
  advisoryResults: ComplianceResult[]
  classificationMismatches: ClassificationMismatch[]
  findings: Finding[]
  advisoryFindings: Finding[]
  complianceScore: number
}

export interface ScanResult {
  timestamp: string
  configPath?: string
  scanPath: string
  scanMode: ScanMode
  discoveryMode: boolean
  systems: SystemScanResult[]
  undeclaredSystems: UndeclaredSystem[]
  globalFindings: Finding[]
  summary: ScanSummary
}

export interface ScanSummary {
  totalSystems: number
  totalDetections: number
  totalFindings: number
  findingsBySeverity: Record<FindingSeverity, number>
  overallComplianceScore: number
  highestRiskLevel: RiskTier
  classificationChanged: boolean
}

export interface ComplianceDiff {
  baselineTimestamp: string
  currentTimestamp: string
  newFindings: Finding[]
  resolvedFindings: Finding[]
  classificationChanges: Array<{
    systemId: string
    previousRiskLevel: RiskTier
    currentRiskLevel: RiskTier
  }>
  obligationChanges: Array<{
    systemId: string
    articleId: ArticleId
    previousStatus: ComplianceStatus
    currentStatus: ComplianceStatus
  }>
  complianceScoreDelta: number
}

export interface ScanOptions {
  path: string
  configPath?: string
  scanMode: ScanMode
  baselinePath?: string
  outputFormat: OutputFormat
  outputFile?: string
  failOn: FailOn
  verbose: boolean
}

export interface TracedSink {
  type: 'conditional_branch' | 'database_persist' | 'ui_render' | 'api_call'
  filePath: string
  lineNumber: number
  description: string
  suggestedAnnexIiiCategory?: AnnexIIICategory
  suggestedRiskLevel?: RiskTier
}

export interface CallChainTrace {
  sourceDetection: AiUsageDetection
  sinks: TracedSink[]
  intermediateSteps: Array<{
    filePath: string
    lineNumber: number
    description: string
  }>
}

export interface DomainIndicator {
  domain: string
  annexIiiCategory: AnnexIIICategory
  keywords: string[]
  description: string
}
