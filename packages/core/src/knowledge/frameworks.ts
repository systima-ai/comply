import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FrameworkPattern, FrameworkCategory, RiskTier } from '../types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRAMEWORKS_PATH = resolve(__dirname, '../../../../knowledge/frameworks/ai-frameworks.json')

interface RawFramework {
  id: string
  name: string
  category: FrameworkCategory
  riskSignals: RiskTier[]
  python: { imports: string[]; packages: string[] }
  javascript: { imports: string[]; packages: string[] }
  envPatterns: string[]
  description: string
}

let cachedFrameworks: FrameworkPattern[] | null = null

export async function loadFrameworks(): Promise<FrameworkPattern[]> {
  if (cachedFrameworks) return cachedFrameworks

  const raw = await readFile(FRAMEWORKS_PATH, 'utf-8')
  const data = JSON.parse(raw) as { frameworks: RawFramework[] }

  cachedFrameworks = data.frameworks.map((fw): FrameworkPattern => ({
    id: fw.id,
    name: fw.name,
    category: fw.category,
    riskSignals: fw.riskSignals,
    python: fw.python,
    javascript: fw.javascript,
    envPatterns: fw.envPatterns,
    description: fw.description,
  }))

  return cachedFrameworks
}

export function findFrameworkByPackage(
  frameworks: FrameworkPattern[],
  packageName: string,
  language: 'python' | 'javascript',
): FrameworkPattern | undefined {
  return frameworks.find((fw) => {
    const patterns = language === 'python' ? fw.python.packages : fw.javascript.packages
    return patterns.some((p) => packageName === p || packageName.startsWith(`${p}/`))
  })
}

export function findFrameworkByImport(
  frameworks: FrameworkPattern[],
  importPath: string,
  language: 'python' | 'javascript',
): FrameworkPattern | undefined {
  return frameworks.find((fw) => {
    const patterns = language === 'python' ? fw.python.imports : fw.javascript.imports
    return patterns.some((p) => importPath === p || importPath.startsWith(`${p}/`) || importPath.startsWith(`${p}.`))
  })
}

export function findFrameworkByEnvPattern(
  frameworks: FrameworkPattern[],
  envKey: string,
): FrameworkPattern | undefined {
  return frameworks.find((fw) =>
    fw.envPatterns.some((p) => envKey === p),
  )
}
