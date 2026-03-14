import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { complyConfigSchema, type RawComplyConfig } from './schema'
import type {
  ComplyConfig,
  SystemDeclaration,
  OrganisationConfig,
  SystemDocumentation,
} from '../types'

export interface ConfigLoadResult {
  config: ComplyConfig | null
  discoveryMode: boolean
  configPath: string | null
  errors: string[]
}

function transformDocumentation(
  raw: RawComplyConfig['systems'][number]['documentation'],
  configDir: string,
): SystemDocumentation | undefined {
  if (!raw) return undefined

  const resolvePath = (p: string | undefined): string | undefined =>
    p ? resolve(configDir, p) : undefined

  return {
    riskManagement: resolvePath(raw.risk_management),
    dataGovernance: resolvePath(raw.data_governance),
    technicalDocs: resolvePath(raw.technical_docs),
    transparency: resolvePath(raw.transparency),
    humanOversight: resolvePath(raw.human_oversight),
    fria: resolvePath(raw.fria),
    accuracyRobustness: resolvePath(raw.accuracy_robustness),
    postMarketMonitoring: resolvePath(raw.post_market_monitoring),
  }
}

function transformConfig(raw: RawComplyConfig, configDir: string): ComplyConfig {
  const organisation: OrganisationConfig = {
    name: raw.organisation.name,
    euPresence: raw.organisation.eu_presence,
    operatorRole: raw.organisation.operator_role,
  }

  const systems: SystemDeclaration[] = raw.systems.map((sys) => ({
    id: sys.id,
    name: sys.name,
    description: sys.description,
    scope: {
      paths: sys.scope.paths,
      exclude: sys.scope.exclude,
    },
    classification: {
      riskLevel: sys.classification.risk_level,
      domain: sys.classification.domain,
      annexIiiCategory: sys.classification.annex_iii_category,
      rationale: sys.classification.rationale,
    },
    regulations: sys.regulations,
    documentation: transformDocumentation(sys.documentation, configDir),
    ignore: sys.ignore,
  }))

  return {
    version: raw.version,
    organisation,
    systems,
  }
}

export async function loadConfig(
  scanPath: string,
  configPath?: string,
): Promise<ConfigLoadResult> {
  const resolvedConfigPath = configPath
    ? resolve(configPath)
    : resolve(scanPath, '.systima.yml')

  let rawContent: string
  try {
    rawContent = await readFile(resolvedConfigPath, 'utf-8')
  } catch {
    return {
      config: null,
      discoveryMode: true,
      configPath: null,
      errors: [],
    }
  }

  let parsed: unknown
  try {
    parsed = parseYaml(rawContent)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      config: null,
      discoveryMode: false,
      configPath: resolvedConfigPath,
      errors: [`Failed to parse YAML in ${resolvedConfigPath}: ${message}`],
    }
  }

  const result = complyConfigSchema.safeParse(parsed)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.join('.')
      return `${path}: ${issue.message}`
    })
    return {
      config: null,
      discoveryMode: false,
      configPath: resolvedConfigPath,
      errors,
    }
  }

  const configDir = dirname(resolvedConfigPath)
  const config = transformConfig(result.data, configDir)

  return {
    config,
    discoveryMode: false,
    configPath: resolvedConfigPath,
    errors: [],
  }
}
