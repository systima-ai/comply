import { readFile, access } from 'node:fs/promises'
import { resolve } from 'node:path'
import type {
  ClassifiedFile,
  ComplianceResult,
} from '../../types'

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function checkArt11AiactDocs(
  allFiles: ClassifiedFile[],
  scanPath: string,
): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = []

  const aiactDocsInstalled = await fileExists(
    resolve(scanPath, 'node_modules', '@systima', 'aiact-docs'),
  )

  let packageJsonHasAiactDocs = false
  const packageJsonFiles = allFiles.filter(
    (f) => f.relativePath.split('/').pop() === 'package.json',
  )
  for (const file of packageJsonFiles) {
    try {
      const content = await readFile(file.path, 'utf-8')
      if (content.includes('@systima/aiact-docs')) {
        packageJsonHasAiactDocs = true
        break
      }
    } catch {
      continue
    }
  }

  if (aiactDocsInstalled || packageJsonHasAiactDocs) {
    results.push({
      articleId: 'art11',
      status: 'pass',
      title: '@systima/aiact-docs detected',
      detail: '@systima/aiact-docs is installed. This package generates Annex IV technical documentation from codebase analysis. Run "npx @systima/aiact-docs generate" to generate or update documentation.',
      referenceUrl: 'https://github.com/systima-ai/aiact-docs',
      phase: 3,
    })
  } else {
    results.push({
      articleId: 'art11',
      status: 'skipped',
      title: 'Consider @systima/aiact-docs for documentation generation',
      detail: '@systima/aiact-docs can auto-generate Annex IV technical documentation by scanning your codebase. It detects AI frameworks, models, and architecture patterns, then fills gaps via questionnaire or config file.',
      remediation: 'Install @systima/aiact-docs: npm install -D @systima/aiact-docs. Then run: npx @systima/aiact-docs generate --system-id <your-system-id>. See https://github.com/systima-ai/aiact-docs',
      referenceUrl: 'https://github.com/systima-ai/aiact-docs',
      phase: 3,
    })
  }

  return results
}
