import { readFile } from 'node:fs/promises'
import { parse as parseToml } from 'smol-toml'
import { loadFrameworks, findFrameworkByPackage } from '../knowledge/frameworks.js'
import type { AiUsageDetection, ClassifiedFile } from '../types.js'

async function scanPackageJson(file: ClassifiedFile): Promise<AiUsageDetection[]> {
  const detections: AiUsageDetection[] = []
  const frameworks = await loadFrameworks()

  let content: string
  try {
    content = await readFile(file.path, 'utf-8')
  } catch {
    return detections
  }

  let pkg: Record<string, unknown>
  try {
    pkg = JSON.parse(content) as Record<string, unknown>
  } catch {
    return detections
  }

  const depSections: Array<{ deps: Record<string, string>; isDev: boolean }> = []

  if (pkg['dependencies'] && typeof pkg['dependencies'] === 'object') {
    depSections.push({ deps: pkg['dependencies'] as Record<string, string>, isDev: false })
  }
  if (pkg['devDependencies'] && typeof pkg['devDependencies'] === 'object') {
    depSections.push({ deps: pkg['devDependencies'] as Record<string, string>, isDev: true })
  }

  for (const section of depSections) {
    for (const pkgName of Object.keys(section.deps)) {
      const framework = findFrameworkByPackage(frameworks, pkgName, 'javascript')
      if (framework) {
        detections.push({
          filePath: file.path,
          lineNumber: 1,
          frameworkId: framework.id,
          frameworkName: framework.name,
          frameworkCategory: framework.category,
          detectionType: 'dependency',
          confidence: 'high',
          riskSignals: framework.riskSignals,
          matchedText: `${pkgName}: ${section.deps[pkgName] ?? ''}`,
          isDevelopmentDependency: section.isDev,
        })
      }
    }
  }

  return detections
}

async function scanRequirementsTxt(file: ClassifiedFile): Promise<AiUsageDetection[]> {
  const detections: AiUsageDetection[] = []
  const frameworks = await loadFrameworks()

  let content: string
  try {
    content = await readFile(file.path, 'utf-8')
  } catch {
    return detections
  }

  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue

    const pkgMatch = trimmed.match(/^([a-zA-Z0-9_-]+(?:\[[^\]]*\])?)/)
    if (!pkgMatch?.[1]) continue

    const pkgName = pkgMatch[1].replace(/\[.*\]$/, '').toLowerCase()

    const framework = findFrameworkByPackage(frameworks, pkgName, 'python')
    if (framework) {
      detections.push({
        filePath: file.path,
        lineNumber: i + 1,
        frameworkId: framework.id,
        frameworkName: framework.name,
        frameworkCategory: framework.category,
        detectionType: 'dependency',
        confidence: 'high',
        riskSignals: framework.riskSignals,
        matchedText: trimmed,
        isDevelopmentDependency: false,
      })
    }
  }

  return detections
}

async function scanPyprojectToml(file: ClassifiedFile): Promise<AiUsageDetection[]> {
  const detections: AiUsageDetection[] = []
  const frameworks = await loadFrameworks()

  let content: string
  try {
    content = await readFile(file.path, 'utf-8')
  } catch {
    return detections
  }

  let parsed: Record<string, unknown>
  try {
    parsed = parseToml(content) as Record<string, unknown>
  } catch {
    return detections
  }

  const project = parsed['project'] as Record<string, unknown> | undefined
  if (!project) return detections

  const depArrays: Array<{ deps: string[]; isDev: boolean }> = []

  if (Array.isArray(project['dependencies'])) {
    depArrays.push({ deps: project['dependencies'] as string[], isDev: false })
  }

  const optionalDeps = project['optional-dependencies'] as Record<string, string[]> | undefined
  if (optionalDeps) {
    for (const deps of Object.values(optionalDeps)) {
      if (Array.isArray(deps)) {
        depArrays.push({ deps, isDev: true })
      }
    }
  }

  for (const section of depArrays) {
    for (const dep of section.deps) {
      const pkgMatch = dep.match(/^([a-zA-Z0-9_-]+)/)
      if (!pkgMatch?.[1]) continue

      const pkgName = pkgMatch[1].toLowerCase()
      const framework = findFrameworkByPackage(frameworks, pkgName, 'python')
      if (framework) {
        detections.push({
          filePath: file.path,
          lineNumber: 1,
          frameworkId: framework.id,
          frameworkName: framework.name,
          frameworkCategory: framework.category,
          detectionType: 'dependency',
          confidence: 'high',
          riskSignals: framework.riskSignals,
          matchedText: dep,
          isDevelopmentDependency: section.isDev,
        })
      }
    }
  }

  return detections
}

async function scanPipfile(file: ClassifiedFile): Promise<AiUsageDetection[]> {
  const detections: AiUsageDetection[] = []
  const frameworks = await loadFrameworks()

  let content: string
  try {
    content = await readFile(file.path, 'utf-8')
  } catch {
    return detections
  }

  let parsed: Record<string, unknown>
  try {
    parsed = parseToml(content) as Record<string, unknown>
  } catch {
    return detections
  }

  const sections: Array<{ deps: Record<string, unknown>; isDev: boolean }> = []

  if (parsed['packages'] && typeof parsed['packages'] === 'object') {
    sections.push({ deps: parsed['packages'] as Record<string, unknown>, isDev: false })
  }
  if (parsed['dev-packages'] && typeof parsed['dev-packages'] === 'object') {
    sections.push({ deps: parsed['dev-packages'] as Record<string, unknown>, isDev: true })
  }

  for (const section of sections) {
    for (const pkgName of Object.keys(section.deps)) {
      const framework = findFrameworkByPackage(frameworks, pkgName.toLowerCase(), 'python')
      if (framework) {
        detections.push({
          filePath: file.path,
          lineNumber: 1,
          frameworkId: framework.id,
          frameworkName: framework.name,
          frameworkCategory: framework.category,
          detectionType: 'dependency',
          confidence: 'high',
          riskSignals: framework.riskSignals,
          matchedText: `${pkgName} = ${String(section.deps[pkgName])}`,
          isDevelopmentDependency: section.isDev,
        })
      }
    }
  }

  return detections
}

export async function scanDependencies(
  file: ClassifiedFile,
): Promise<AiUsageDetection[]> {
  const basename = file.relativePath.split('/').pop() ?? ''

  if (basename === 'package.json') return scanPackageJson(file)
  if (basename === 'requirements.txt' || basename.match(/requirements.*\.txt$/)) return scanRequirementsTxt(file)
  if (basename === 'pyproject.toml') return scanPyprojectToml(file)
  if (basename === 'Pipfile') return scanPipfile(file)

  return []
}

export function isDependencyManifest(relativePath: string): boolean {
  const basename = relativePath.split('/').pop() ?? ''
  return [
    'package.json',
    'requirements.txt',
    'pyproject.toml',
    'Pipfile',
    'setup.cfg',
  ].includes(basename) || /requirements.*\.txt$/.test(basename)
}
