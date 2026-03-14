import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname } from 'node:path'
import { loadConfig } from '../config/loader'
import { ALL_TEMPLATES, renderTemplate } from './templates'
import type { SystemDocumentation } from '../types'

export interface ScaffoldResult {
  created: string[]
  skipped: string[]
  errors: string[]
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function scaffoldDocumentation(
  scanPath: string,
  configPath?: string,
  overwrite: boolean = false,
): Promise<ScaffoldResult> {
  const result: ScaffoldResult = { created: [], skipped: [], errors: [] }

  const { config, discoveryMode, errors } = await loadConfig(scanPath, configPath)

  if (errors.length > 0) {
    result.errors.push(...errors.map((e) => `Config error: ${e}`))
    return result
  }

  if (!config || discoveryMode) {
    result.errors.push('No .systima.yml found. Run "comply init" first.')
    return result
  }

  for (const system of config.systems) {
    const documentation = system.documentation
    if (!documentation) continue

    const docFields = Object.entries(documentation) as Array<[keyof SystemDocumentation, string | undefined]>

    for (const [field, docPath] of docFields) {
      if (!docPath) continue

      const template = ALL_TEMPLATES[field]
      if (!template) continue

      const exists = await fileExists(docPath)
      if (exists && !overwrite) {
        result.skipped.push(docPath)
        continue
      }

      try {
        await mkdir(dirname(docPath), { recursive: true })
        const content = renderTemplate(template, system.name)
        await writeFile(docPath, content, 'utf-8')
        result.created.push(docPath)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        result.errors.push(`Failed to create ${docPath}: ${message}`)
      }
    }
  }

  return result
}
