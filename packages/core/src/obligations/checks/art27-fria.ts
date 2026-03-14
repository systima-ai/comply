import { readFile, access } from 'node:fs/promises'
import type {
  ComplianceResult,
  SystemDeclaration,
  OperatorRole,
} from '../../types.js'

const FRIA_REQUIRED_SECTIONS = [
  'processes',
  'natural persons',
  'fundamental rights',
  'impact',
  'risk',
  'mitigation',
  'monitoring',
]

const DPIA_KEYWORDS = [
  'data protection impact assessment',
  'dpia',
  'gdpr article 35',
  'systematic monitoring',
  'large scale processing',
]

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function checkArt27Fria(
  system: SystemDeclaration,
  operatorRole: OperatorRole,
): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = []

  if (operatorRole !== 'deployer' && operatorRole !== 'both') {
    results.push({
      articleId: 'art27',
      status: 'skipped',
      title: 'FRIA not required for providers',
      detail: 'Article 27 FRIA obligations apply to deployers and public bodies. This organisation is declared as a provider.',
      referenceUrl: 'https://artificialintelligenceact.eu/article/27/',
      phase: 3,
    })
    return results
  }

  if (system.classification.riskLevel !== 'high') {
    results.push({
      articleId: 'art27',
      status: 'skipped',
      title: 'FRIA not required for non-high-risk systems',
      detail: 'Fundamental Rights Impact Assessments are only required for high-risk AI systems.',
      referenceUrl: 'https://artificialintelligenceact.eu/article/27/',
      phase: 3,
    })
    return results
  }

  const friaPath = system.documentation?.fria
  if (!friaPath) {
    results.push({
      articleId: 'art27',
      status: 'fail',
      title: 'No FRIA document declared',
      detail: 'No fria path declared in .systima.yml documentation section. Deployers of high-risk AI systems must perform a Fundamental Rights Impact Assessment before deployment.',
      referenceUrl: 'https://artificialintelligenceact.eu/article/27/',
      phase: 3,
    })
    return results
  }

  const exists = await fileExists(friaPath)
  if (!exists) {
    results.push({
      articleId: 'art27',
      status: 'fail',
      title: 'FRIA document not found',
      detail: `Declared FRIA document not found at: ${friaPath}`,
      filePaths: [friaPath],
      referenceUrl: 'https://artificialintelligenceact.eu/article/27/',
      phase: 3,
    })
    return results
  }

  let content: string
  try {
    content = await readFile(friaPath, 'utf-8')
  } catch {
    results.push({
      articleId: 'art27',
      status: 'fail',
      title: 'FRIA document unreadable',
      detail: `Could not read FRIA document at: ${friaPath}`,
      filePaths: [friaPath],
      referenceUrl: 'https://artificialintelligenceact.eu/article/27/',
      phase: 3,
    })
    return results
  }

  const lowerContent = content.toLowerCase()
  const missingSections = FRIA_REQUIRED_SECTIONS.filter(
    (section) => !lowerContent.includes(section),
  )

  if (missingSections.length > 0) {
    results.push({
      articleId: 'art27',
      status: 'warning',
      title: 'FRIA missing required topics',
      detail: `FRIA document does not mention: ${missingSections.join(', ')}. Article 27(1) requires assessment of impact on fundamental rights of affected persons.`,
      filePaths: [friaPath],
      referenceUrl: 'https://artificialintelligenceact.eu/article/27/',
      phase: 3,
    })
  } else {
    results.push({
      articleId: 'art27',
      status: 'pass',
      title: 'FRIA document present and covers required topics',
      detail: 'Fundamental Rights Impact Assessment covers all required sections.',
      filePaths: [friaPath],
      referenceUrl: 'https://artificialintelligenceact.eu/article/27/',
      phase: 3,
    })
  }

  const hasDpiaReference = DPIA_KEYWORDS.some((kw) => lowerContent.includes(kw))
  if (system.regulations?.includes('gdpr') && !hasDpiaReference) {
    results.push({
      articleId: 'art27',
      status: 'warning',
      title: 'No DPIA cross-reference in FRIA',
      detail: 'This system declares GDPR as a regulation, but the FRIA document does not reference a Data Protection Impact Assessment. Consider cross-referencing the DPIA to show alignment between fundamental rights and data protection assessments.',
      filePaths: [friaPath],
      referenceUrl: 'https://artificialintelligenceact.eu/article/27/',
      phase: 3,
    })
  }

  return results
}
