import { walkFiles } from './file-walker'
import { scanTypeScriptImports } from './import-scanner'
import { scanPythonImports } from './python-import-scanner'
import { scanDependencies, isDependencyManifest } from './dependency-scanner'
import { scanConfigFile } from './config-scanner'
import { checkDocumentation } from './doc-scanner'
import { loadConfig } from '../config/loader'
import { classifySystem, detectUndeclaredSystems } from '../classifier/index'
import { traceCallChains } from '../tracer/index'
import { detectDomainFromFilePaths, suggestAnnexIIICategory } from '../classifier/domain-detector'
import { runObligationChecks } from '../obligations/index'
import type {
  AiUsageDetection,
  ArticleId,
  CallChainTrace,
  ClassifiedFile,
  ComplianceResult,
  Finding,
  RiskTier,
  ScanOptions,
  ScanResult,
  ScanSummary,
  SystemDeclaration,
  SystemScanResult,
  FindingSeverity,
} from '../types'
import { REGULATED_DOMAINS } from '../types'
import picomatch from 'picomatch'

const HIGH_RISK_ONLY_ARTICLES: Set<ArticleId> = new Set([
  'art9', 'art10', 'art11', 'art12', 'art13', 'art14', 'art15', 'art25', 'art27', 'art72',
])

const UNIVERSAL_ARTICLES: Set<ArticleId> = new Set([
  'art5', 'art50',
])

function isObligationApplicable(articleId: ArticleId, riskLevel: RiskTier): boolean {
  if (UNIVERSAL_ARTICLES.has(articleId)) return true
  if (HIGH_RISK_ONLY_ARTICLES.has(articleId) && riskLevel === 'high') return true
  if (HIGH_RISK_ONLY_ARTICLES.has(articleId) && riskLevel === 'unacceptable') return true
  return false
}

function matchesScope(
  relativePath: string,
  scopePaths: string[],
  excludePaths?: string[],
): boolean {
  const included = scopePaths.some((pattern) => picomatch(pattern)(relativePath))
  if (!included) return false

  if (excludePaths && excludePaths.length > 0) {
    const excluded = excludePaths.some((pattern) => picomatch(pattern)(relativePath))
    if (excluded) return false
  }

  return true
}

async function detectAiUsage(files: ClassifiedFile[]): Promise<AiUsageDetection[]> {
  const detections: AiUsageDetection[] = []

  const scanPromises = files.map(async (file) => {
    const fileDetections: AiUsageDetection[] = []

    if (file.language === 'typescript' || file.language === 'javascript') {
      const imports = await scanTypeScriptImports(file)
      fileDetections.push(...imports)
    }

    if (file.language === 'python') {
      const imports = await scanPythonImports(file)
      fileDetections.push(...imports)
    }

    if (isDependencyManifest(file.relativePath)) {
      const deps = await scanDependencies(file)
      fileDetections.push(...deps)
    }

    if (file.language === 'env' || file.language === 'terraform' || file.language === 'yaml') {
      const configs = await scanConfigFile(file)
      fileDetections.push(...configs)
    }

    return fileDetections
  })

  const results = await Promise.all(scanPromises)
  for (const result of results) {
    detections.push(...result)
  }

  return detections
}

function deduplicateDetections(detections: AiUsageDetection[]): AiUsageDetection[] {
  const seen = new Set<string>()
  return detections.filter((d) => {
    const key = `${d.filePath}:${d.lineNumber}:${d.frameworkId}:${d.detectionType}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function computeComplianceScore(results: ComplianceResult[]): number {
  if (results.length === 0) return 1

  const applicable = results.filter((r) => r.status !== 'skipped')
  if (applicable.length === 0) return 1

  const passed = applicable.filter((r) => r.status === 'pass').length
  return passed / applicable.length
}

function computeSummary(
  systems: SystemScanResult[],
  globalFindings: Finding[],
  allDetections: AiUsageDetection[],
): ScanSummary {
  const allFindings = [
    ...globalFindings,
    ...systems.flatMap((s) => s.findings),
  ]

  const findingsBySeverity: Record<FindingSeverity, number> = {
    critical: 0,
    fail: 0,
    warning: 0,
    info: 0,
  }

  for (const finding of allFindings) {
    findingsBySeverity[finding.severity]++
  }

  const riskTierPriority: Record<RiskTier, number> = {
    unacceptable: 4,
    high: 3,
    limited: 2,
    minimal: 1,
  }

  let highestRiskLevel: RiskTier = 'minimal'
  for (const sys of systems) {
    if (riskTierPriority[sys.classification.riskLevel] > riskTierPriority[highestRiskLevel]) {
      highestRiskLevel = sys.classification.riskLevel
    }
  }

  const scores = systems.map((s) => s.complianceScore)
  const overallScore = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 1

  return {
    totalSystems: systems.length,
    totalDetections: allDetections.length,
    totalFindings: allFindings.length,
    findingsBySeverity,
    overallComplianceScore: Math.round(overallScore * 100) / 100,
    highestRiskLevel,
    classificationChanged: false,
  }
}

function isRegulatedDomain(systemDecl: SystemDeclaration): boolean {
  const domain = systemDecl.classification.domain ?? 'general_purpose'
  return REGULATED_DOMAINS.has(domain)
}

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const { config, discoveryMode, configPath } = await loadConfig(
    options.path,
    options.configPath,
  )

  const manifest = await walkFiles(options.path)
  const allDetections = deduplicateDetections(await detectAiUsage(manifest.files))

  const systems: SystemScanResult[] = []
  const globalFindings: Finding[] = []

  if (config && !discoveryMode) {
    for (const systemDecl of config.systems) {
      const systemDetections = allDetections.filter((d) =>
        matchesScope(
          d.filePath.replace(options.path + '/', ''),
          systemDecl.scope.paths,
          systemDecl.scope.exclude,
        ),
      )

      const classificationResult = await classifySystem(systemDecl, systemDetections)

      const tsJsDetections = systemDetections.filter(
        (d) => d.detectionType === 'import' && !d.isDevelopmentDependency,
      )
      const tracesByFile = new Map<string, AiUsageDetection[]>()
      for (const det of tsJsDetections) {
        if (det.filePath.match(/\.[mc]?[jt]sx?$/)) {
          const existing = tracesByFile.get(det.filePath) ?? []
          existing.push(det)
          tracesByFile.set(det.filePath, existing)
        }
      }

      const callChainTraces: CallChainTrace[] = []
      for (const [filePath, dets] of tracesByFile) {
        const traces = await traceCallChains(filePath, dets)
        callChainTraces.push(...traces)
      }

      const detectionFilePaths = systemDetections.map((d) => d.filePath)
      const domainMatches = detectDomainFromFilePaths(detectionFilePaths)

      if (domainMatches.length > 0 && !systemDecl.classification.annexIiiCategory) {
        const suggested = suggestAnnexIIICategory(
          systemDetections.map((d) => ({ matchedText: d.matchedText, filePath: d.filePath })),
        )
        if (suggested) {
          classificationResult.mismatches.push({
            systemId: systemDecl.id,
            declaredRiskLevel: systemDecl.classification.riskLevel,
            suggestedRiskLevel: 'high',
            reason: `Domain analysis suggests this system may fall under Annex III Category ${suggested}. Consider declaring an annex_iii_category in .systima.yml. Detected domain: ${domainMatches[0]?.description ?? 'unknown'}.`,
            frameworkId: 'domain-analysis',
            suggestedAnnexIiiCategory: suggested,
            filePaths: detectionFilePaths.slice(0, 3),
          })
        }
      }

      const seenSinks = new Map<string, { count: number; sink: typeof callChainTraces[number]['sinks'][number]; frameworkId: string }>()
      for (const trace of callChainTraces) {
        for (const sink of trace.sinks) {
          const key = `${sink.filePath}:${sink.lineNumber}:${sink.type}`
          const existing = seenSinks.get(key)
          if (existing) {
            existing.count++
          } else {
            seenSinks.set(key, { count: 1, sink, frameworkId: trace.sourceDetection.frameworkId })
          }
        }
      }

      for (const [, { sink, frameworkId }] of seenSinks) {
        classificationResult.mismatches.push({
          systemId: systemDecl.id,
          declaredRiskLevel: systemDecl.classification.riskLevel,
          suggestedRiskLevel: sink.suggestedRiskLevel ?? 'limited',
          reason: `Call-chain analysis: ${sink.description} at ${sink.filePath}:${sink.lineNumber}`,
          frameworkId,
          suggestedAnnexIiiCategory: sink.suggestedAnnexIiiCategory,
          filePaths: [sink.filePath],
        })
      }

      const docResults = await checkDocumentation(systemDecl.documentation)

      const obligationResults = await runObligationChecks(
        systemDecl,
        systemDetections,
        manifest.files,
        options.path,
      )

      const allResults: ComplianceResult[] = [...docResults, ...obligationResults]
      const riskLevel = systemDecl.classification.riskLevel
      const regulated = isRegulatedDomain(systemDecl)

      const applicableResults = allResults.filter((r) =>
        isObligationApplicable(r.articleId, riskLevel),
      )
      const advisoryResults = allResults.filter((r) =>
        !isObligationApplicable(r.articleId, riskLevel),
      )

      const findings: Finding[] = []
      const advisoryFindings: Finding[] = []

      const callChainIsHighSeverity = riskLevel === 'high' || regulated
      for (const mismatch of classificationResult.mismatches) {
        const isCallChain = mismatch.frameworkId !== 'domain-analysis'
          && mismatch.reason.startsWith('Call-chain analysis:')

        if (isCallChain && !callChainIsHighSeverity) {
          advisoryFindings.push({
            id: `call-chain-advisory-${systemDecl.id}-${mismatch.filePaths[0] ?? ''}:${mismatch.reason.split(':').pop()?.trim() ?? ''}`,
            severity: 'info',
            articleId: 'art6',
            systemId: systemDecl.id,
            title: 'Code pattern detected (advisory)',
            message: mismatch.reason,
            filePath: mismatch.filePaths[0],
            referenceUrl: 'https://artificialintelligenceact.eu/article/6/',
          })
        } else {
          findings.push({
            id: `classification-mismatch-${systemDecl.id}-${mismatch.frameworkId}`,
            severity: callChainIsHighSeverity || !isCallChain ? 'critical' : 'info',
            articleId: 'art6',
            systemId: systemDecl.id,
            title: isCallChain && !callChainIsHighSeverity
              ? 'Code pattern detected (advisory)'
              : 'Classification mismatch detected',
            message: mismatch.reason,
            filePath: mismatch.filePaths[0],
            referenceUrl: 'https://artificialintelligenceact.eu/article/6/',
          })
        }
      }

      for (const result of applicableResults) {
        if (result.status === 'fail') {
          findings.push({
            id: `${result.articleId}-fail-${systemDecl.id}`,
            severity: 'fail',
            articleId: result.articleId,
            systemId: systemDecl.id,
            title: result.title,
            message: result.detail,
            suggestion: result.remediation,
            filePath: result.filePaths?.[0],
            referenceUrl: result.referenceUrl,
          })
        } else if (result.status === 'warning') {
          findings.push({
            id: `${result.articleId}-warn-${systemDecl.id}`,
            severity: 'warning',
            articleId: result.articleId,
            systemId: systemDecl.id,
            title: result.title,
            message: result.detail,
            suggestion: result.remediation,
            filePath: result.filePaths?.[0],
            referenceUrl: result.referenceUrl,
          })
        }
      }

      for (const result of advisoryResults) {
        if (result.status === 'fail' || result.status === 'warning') {
          advisoryFindings.push({
            id: `${result.articleId}-advisory-${systemDecl.id}`,
            severity: 'info',
            articleId: result.articleId,
            systemId: systemDecl.id,
            title: result.title,
            message: result.detail,
            suggestion: result.remediation,
            filePath: result.filePaths?.[0],
            referenceUrl: result.referenceUrl,
          })
        }
      }

      systems.push({
        systemId: systemDecl.id,
        systemName: systemDecl.name,
        classification: systemDecl.classification,
        detections: systemDetections,
        complianceResults: applicableResults,
        advisoryResults,
        classificationMismatches: classificationResult.mismatches,
        findings,
        advisoryFindings,
        complianceScore: computeComplianceScore(applicableResults),
      })
    }
  }

  const undeclaredSystems = config
    ? detectUndeclaredSystems(config, allDetections, options.path)
    : []

  if (discoveryMode && allDetections.length > 0) {
    globalFindings.push({
      id: 'discovery-mode-ai-detected',
      severity: 'warning',
      title: 'AI frameworks detected without configuration',
      message: `${allDetections.length} AI framework usage(s) detected but no .systima.yml configuration found. Run "comply init" to create one.`,
    })
  }

  for (const undeclared of undeclaredSystems) {
    globalFindings.push({
      id: `undeclared-system-${undeclared.detections[0]?.frameworkId ?? 'unknown'}`,
      severity: 'warning',
      title: 'Undeclared AI system detected',
      message: undeclared.reason,
      filePath: undeclared.detections[0]?.filePath,
      lineNumber: undeclared.detections[0]?.lineNumber,
    })
  }

  const summary = computeSummary(systems, globalFindings, allDetections)

  return {
    timestamp: new Date().toISOString(),
    configPath: configPath ?? undefined,
    scanPath: options.path,
    scanMode: options.scanMode,
    discoveryMode,
    systems,
    undeclaredSystems,
    globalFindings,
    summary,
  }
}
