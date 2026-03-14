import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import fg from 'fast-glob'
import { loadConfig } from '../config/loader'

export interface DoctorCheck {
  name: string
  status: 'pass' | 'fail' | 'warning'
  detail: string
}

export interface DoctorResult {
  checks: DoctorCheck[]
  healthy: boolean
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function runDoctor(
  scanPath: string,
  configPath?: string,
): Promise<DoctorResult> {
  const checks: DoctorCheck[] = []

  const configResult = await loadConfig(scanPath, configPath)

  if (configResult.errors.length > 0) {
    checks.push({
      name: 'Config syntax',
      status: 'fail',
      detail: configResult.errors.join('; '),
    })
    return { checks, healthy: false }
  }

  if (!configResult.config) {
    checks.push({
      name: 'Config exists',
      status: 'fail',
      detail: 'No .systima.yml found. Run "comply init" to create one.',
    })
    return { checks, healthy: false }
  }

  checks.push({
    name: 'Config syntax',
    status: 'pass',
    detail: 'YAML syntax valid and schema validates.',
  })

  const config = configResult.config

  checks.push({
    name: 'Organisation declared',
    status: 'pass',
    detail: `Organisation: ${config.organisation.name} (${config.organisation.operatorRole})`,
  })

  for (const system of config.systems) {
    const scopeMatches = await fg(system.scope.paths, {
      cwd: scanPath,
      onlyFiles: true,
      ignore: system.scope.exclude ?? [],
    })

    if (scopeMatches.length === 0) {
      checks.push({
        name: `Scope: ${system.id}`,
        status: 'warning',
        detail: `Scope patterns [${system.scope.paths.join(', ')}] match 0 files. Check that the paths are correct.`,
      })
    } else {
      checks.push({
        name: `Scope: ${system.id}`,
        status: 'pass',
        detail: `Scope patterns match ${scopeMatches.length} file(s).`,
      })
    }

    if (system.classification.riskLevel !== 'high' && system.classification.annexIiiCategory) {
      checks.push({
        name: `Classification: ${system.id}`,
        status: 'warning',
        detail: `annex_iii_category "${system.classification.annexIiiCategory}" is set but risk_level is "${system.classification.riskLevel}". Annex III categories only apply to high-risk systems.`,
      })
    } else {
      checks.push({
        name: `Classification: ${system.id}`,
        status: 'pass',
        detail: `Risk level: ${system.classification.riskLevel}${system.classification.annexIiiCategory ? `, Annex III: ${system.classification.annexIiiCategory}` : ''}.`,
      })
    }

    if (system.documentation) {
      const docEntries = Object.entries(system.documentation) as Array<[string, string | undefined]>
      for (const [field, docPath] of docEntries) {
        if (!docPath) continue
        const exists = await fileExists(docPath)
        if (!exists) {
          checks.push({
            name: `Doc: ${system.id}/${field}`,
            status: 'fail',
            detail: `Document not found: ${docPath}. Run "comply scaffold" to generate templates.`,
          })
        } else {
          checks.push({
            name: `Doc: ${system.id}/${field}`,
            status: 'pass',
            detail: `Document exists: ${docPath}`,
          })
        }
      }
    } else if (system.classification.riskLevel === 'high') {
      checks.push({
        name: `Documentation: ${system.id}`,
        status: 'fail',
        detail: 'High-risk system has no documentation section declared. Articles 9-14 require extensive documentation.',
      })
    }
  }

  for (let i = 0; i < config.systems.length; i++) {
    for (let j = i + 1; j < config.systems.length; j++) {
      const sysA = config.systems[i]!
      const sysB = config.systems[j]!
      const overlap = sysA.scope.paths.some((p) => sysB.scope.paths.includes(p))
      if (overlap) {
        checks.push({
          name: 'Scope overlap',
          status: 'warning',
          detail: `Systems "${sysA.id}" and "${sysB.id}" have overlapping scope paths. This may cause duplicate detections.`,
        })
      }
    }
  }

  const aiactDocsPath = resolve(scanPath, 'node_modules', '@systima', 'aiact-docs')
  const hasAiactDocs = await fileExists(aiactDocsPath)
  if (hasAiactDocs) {
    checks.push({
      name: '@systima/aiact-docs',
      status: 'pass',
      detail: '@systima/aiact-docs is installed. Run "npx @systima/aiact-docs gap-analysis" for deeper documentation coverage analysis.',
    })
  }

  const healthy = checks.every((c) => c.status !== 'fail')

  return { checks, healthy }
}
