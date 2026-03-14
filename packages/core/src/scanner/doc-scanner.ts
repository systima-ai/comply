import { readFile, access } from 'node:fs/promises'
import type { SystemDocumentation, ComplianceResult, ArticleId } from '../types.js'

interface DocCheckConfig {
  articleId: ArticleId
  docField: keyof SystemDocumentation
  title: string
  requiredSections?: string[]
  referenceUrl: string
}

const DOC_CHECKS: DocCheckConfig[] = [
  {
    articleId: 'art9',
    docField: 'riskManagement',
    title: 'Risk management documentation',
    requiredSections: ['risk identification', 'risk estimation', 'risk evaluation', 'risk mitigation', 'residual risk'],
    referenceUrl: 'https://artificialintelligenceact.eu/article/9/',
  },
  {
    articleId: 'art10',
    docField: 'dataGovernance',
    title: 'Data governance documentation',
    requiredSections: ['data sources', 'data quality', 'bias'],
    referenceUrl: 'https://artificialintelligenceact.eu/article/10/',
  },
  {
    articleId: 'art11',
    docField: 'technicalDocs',
    title: 'Technical documentation (Annex IV)',
    requiredSections: ['general description', 'design', 'development', 'monitoring', 'performance', 'intended purpose'],
    referenceUrl: 'https://artificialintelligenceact.eu/article/11/',
  },
  {
    articleId: 'art13',
    docField: 'transparency',
    title: 'Transparency documentation',
    requiredSections: ['capabilities', 'limitations', 'intended use'],
    referenceUrl: 'https://artificialintelligenceact.eu/article/13/',
  },
  {
    articleId: 'art14',
    docField: 'humanOversight',
    title: 'Human oversight documentation',
    requiredSections: ['oversight', 'intervention', 'override'],
    referenceUrl: 'https://artificialintelligenceact.eu/article/14/',
  },
]

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function fileIsNonEmpty(path: string): Promise<boolean> {
  try {
    const content = await readFile(path, 'utf-8')
    return content.trim().length > 0
  } catch {
    return false
  }
}

async function fileContainsSections(
  path: string,
  sections: string[],
): Promise<{ found: string[]; missing: string[] }> {
  let content: string
  try {
    content = await readFile(path, 'utf-8')
  } catch {
    return { found: [], missing: sections }
  }

  const lowerContent = content.toLowerCase()
  const found: string[] = []
  const missing: string[] = []

  for (const section of sections) {
    if (lowerContent.includes(section.toLowerCase())) {
      found.push(section)
    } else {
      missing.push(section)
    }
  }

  return { found, missing }
}

export async function checkDocumentation(
  documentation: SystemDocumentation | undefined,
): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = []

  for (const check of DOC_CHECKS) {
    const docPath = documentation?.[check.docField]

    if (!docPath) {
      results.push({
        articleId: check.articleId,
        status: 'fail',
        title: check.title,
        detail: `No ${check.docField} document path declared in .systima.yml`,
        referenceUrl: check.referenceUrl,
        phase: 1,
      })
      continue
    }

    const exists = await fileExists(docPath)
    if (!exists) {
      results.push({
        articleId: check.articleId,
        status: 'fail',
        title: check.title,
        detail: `Declared document not found: ${docPath}`,
        filePaths: [docPath],
        referenceUrl: check.referenceUrl,
        phase: 1,
      })
      continue
    }

    const nonEmpty = await fileIsNonEmpty(docPath)
    if (!nonEmpty) {
      results.push({
        articleId: check.articleId,
        status: 'warning',
        title: check.title,
        detail: `Document exists but is empty: ${docPath}`,
        filePaths: [docPath],
        referenceUrl: check.referenceUrl,
        phase: 1,
      })
      continue
    }

    if (check.requiredSections && check.requiredSections.length > 0) {
      const { missing } = await fileContainsSections(docPath, check.requiredSections)
      if (missing.length > 0) {
        results.push({
          articleId: check.articleId,
          status: 'warning',
          title: check.title,
          detail: `Document missing required sections: ${missing.join(', ')}`,
          filePaths: [docPath],
          referenceUrl: check.referenceUrl,
          phase: 1,
        })
        continue
      }
    }

    results.push({
      articleId: check.articleId,
      status: 'pass',
      title: check.title,
      detail: `Documentation present and contains required sections`,
      filePaths: [docPath],
      referenceUrl: check.referenceUrl,
      phase: 1,
    })
  }

  return results
}
