#!/usr/bin/env node

import { defineCommand, runMain } from 'citty'
import { resolve } from 'node:path'
import { writeFile, access } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { scan } from './scanner/index.js'
import { loadBaseline, saveBaseline, computeDiff } from './diff/index.js'
import { formatGitHubPRComment } from './reporters/github-pr.js'
import { formatJsonReport } from './reporters/json.js'
import { formatSarifReport } from './reporters/sarif.js'
import { formatMarkdownReport } from './reporters/markdown.js'
import type { FailOn, OutputFormat, ScanResult } from './types.js'

function formatOutput(
  result: ScanResult,
  format: OutputFormat,
  diff?: ReturnType<typeof computeDiff>,
): string {
  switch (format) {
    case 'comment':
      return formatGitHubPRComment(result, diff)
    case 'json':
      return formatJsonReport(result, diff)
    case 'sarif':
      return formatSarifReport(result)
    case 'markdown':
      return formatMarkdownReport(result, diff)
    case 'text':
    default:
      return formatGitHubPRComment(result, diff)
  }
}

function shouldFail(result: ScanResult, failOn: FailOn): boolean {
  if (failOn === 'none') return false

  const severity = result.summary.findingsBySeverity

  switch (failOn) {
    case 'critical':
      return severity.critical > 0
    case 'fail':
      return severity.critical > 0 || severity.fail > 0
    case 'warning':
      return severity.critical > 0 || severity.fail > 0 || severity.warning > 0
    default:
      return false
  }
}

const scanCommand = defineCommand({
  meta: {
    name: 'scan',
    description: 'Scan a codebase for EU AI Act compliance',
  },
  args: {
    path: {
      type: 'string',
      description: 'Path to scan',
      default: '.',
    },
    config: {
      type: 'string',
      description: 'Path to .systima.yml config',
    },
    output: {
      type: 'string',
      description: 'Output format (json, sarif, markdown, text)',
      default: 'text',
    },
    out: {
      type: 'string',
      description: 'Write output to file',
    },
    baseline: {
      type: 'string',
      description: 'Path to baseline file for diff comparison',
      default: '.systima-baseline.json',
    },
    'fail-on': {
      type: 'string',
      description: 'Fail on: none, warning, fail, critical',
      default: 'critical',
    },
    verbose: {
      type: 'boolean',
      description: 'Verbose output',
      default: false,
    },
  },
  async run({ args }) {
    const scanPath = resolve(args.path)
    const outputFormat = (args.output ?? 'text') as OutputFormat
    const failOn = (args['fail-on'] ?? 'critical') as FailOn

    const result = await scan({
      path: scanPath,
      configPath: args.config,
      scanMode: 'full',
      outputFormat,
      failOn,
      verbose: args.verbose,
    })

    const baseline = await loadBaseline(resolve(scanPath, args.baseline))
    const diff = baseline ? computeDiff(baseline, result) : undefined

    const output = formatOutput(result, outputFormat, diff)

    if (args.out) {
      await writeFile(resolve(args.out), output, 'utf-8')
      console.log(`Report written to ${args.out}`)
    } else {
      console.log(output)
    }

    if (shouldFail(result, failOn)) {
      process.exit(1)
    }
  },
})

const baselineCommand = defineCommand({
  meta: {
    name: 'baseline',
    description: 'Save current scan as baseline for future diff comparisons',
  },
  args: {
    path: {
      type: 'string',
      description: 'Path to scan',
      default: '.',
    },
    config: {
      type: 'string',
      description: 'Path to .systima.yml config',
    },
    out: {
      type: 'string',
      description: 'Baseline output path',
      default: '.systima-baseline.json',
    },
  },
  async run({ args }) {
    const scanPath = resolve(args.path)

    const result = await scan({
      path: scanPath,
      configPath: args.config,
      scanMode: 'full',
      outputFormat: 'json',
      failOn: 'none',
      verbose: false,
    })

    const baselinePath = resolve(args.out)
    await saveBaseline(baselinePath, result)
    console.log(`Baseline saved to ${baselinePath}`)
  },
})

const diffCommand = defineCommand({
  meta: {
    name: 'diff',
    description: 'Compare current scan against a baseline',
  },
  args: {
    path: {
      type: 'string',
      description: 'Path to scan',
      default: '.',
    },
    config: {
      type: 'string',
      description: 'Path to .systima.yml config',
    },
    baseline: {
      type: 'string',
      description: 'Path to baseline file',
      default: '.systima-baseline.json',
    },
    output: {
      type: 'string',
      description: 'Output format (json, markdown, text)',
      default: 'text',
    },
  },
  async run({ args }) {
    const scanPath = resolve(args.path)
    const outputFormat = (args.output ?? 'text') as OutputFormat

    const baseline = await loadBaseline(resolve(scanPath, args.baseline))
    if (!baseline) {
      console.error(`No baseline found at ${args.baseline}. Run "comply baseline" first.`)
      process.exit(1)
    }

    const current = await scan({
      path: scanPath,
      configPath: args.config,
      scanMode: 'full',
      outputFormat,
      failOn: 'none',
      verbose: false,
    })

    const diff = computeDiff(baseline, current)
    const output = formatOutput(current, outputFormat, diff)
    console.log(output)
  },
})

const reportCommand = defineCommand({
  meta: {
    name: 'report',
    description: 'Generate a compliance report for legal/compliance teams',
  },
  args: {
    path: {
      type: 'string',
      description: 'Path to scan',
      default: '.',
    },
    config: {
      type: 'string',
      description: 'Path to .systima.yml config',
    },
    format: {
      type: 'string',
      description: 'Report format (markdown, json)',
      default: 'markdown',
    },
    out: {
      type: 'string',
      description: 'Output file path',
      default: 'COMPLIANCE_REPORT.md',
    },
  },
  async run({ args }) {
    const scanPath = resolve(args.path)
    const format = (args.format ?? 'markdown') as OutputFormat

    const result = await scan({
      path: scanPath,
      configPath: args.config,
      scanMode: 'full',
      outputFormat: format,
      failOn: 'none',
      verbose: false,
    })

    const output = formatOutput(result, format)
    const outPath = resolve(args.out)
    await writeFile(outPath, output, 'utf-8')
    console.log(`Compliance report written to ${outPath}`)
  },
})

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout })
  const suffix = defaultValue ? ` (${defaultValue})` : ''
  const answer = await rl.question(`${question}${suffix}: `)
  rl.close()
  return answer.trim() || defaultValue || ''
}

async function promptChoice(question: string, choices: string[], defaultIndex: number = 0): Promise<string> {
  console.log(`\n${question}`)
  for (let i = 0; i < choices.length; i++) {
    const marker = i === defaultIndex ? '>' : ' '
    console.log(`  ${marker} ${i + 1}. ${choices[i]}`)
  }
  const answer = await prompt('Choose', String(defaultIndex + 1))
  const idx = parseInt(answer, 10) - 1
  return choices[idx] ?? choices[defaultIndex] ?? choices[0] ?? ''
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Initialise a .systima.yml configuration from detected AI usage',
  },
  args: {
    path: {
      type: 'string',
      description: 'Path to scan for AI frameworks',
      default: '.',
    },
    template: {
      type: 'boolean',
      description: 'Skip interactive prompts and generate a commented template',
      default: false,
    },
  },
  async run({ args }) {
    const scanPath = resolve(args.path)
    const configPath = resolve(scanPath, '.systima.yml')

    let configExists = false
    try {
      await access(configPath)
      configExists = true
    } catch {
      // File does not exist; proceed
    }

    if (configExists) {
      const overwrite = await prompt('.systima.yml already exists. Overwrite? (y/N)', 'N')
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Aborted.')
        return
      }
    }

    console.log('\nScanning for AI frameworks...')
    const result = await scan({
      path: scanPath,
      scanMode: 'full',
      outputFormat: 'json',
      failOn: 'none',
      verbose: false,
    })

    const allDetections = [
      ...result.systems.flatMap((s) => s.detections),
      ...result.undeclaredSystems.flatMap((u) => u.detections),
    ]
    const uniqueFrameworks = new Map<string, { name: string; category: string; paths: Set<string> }>()
    for (const det of allDetections) {
      const existing = uniqueFrameworks.get(det.frameworkId)
      if (existing) {
        existing.paths.add(det.filePath)
      } else {
        uniqueFrameworks.set(det.frameworkId, {
          name: det.frameworkName,
          category: det.frameworkCategory,
          paths: new Set([det.filePath]),
        })
      }
    }

    if (uniqueFrameworks.size > 0) {
      console.log(`\nDetected ${uniqueFrameworks.size} AI framework(s):`)
      for (const [, fw] of uniqueFrameworks) {
        console.log(`  - ${fw.name} (${fw.category}) in ${fw.paths.size} file(s)`)
      }
    } else {
      console.log('\nNo AI frameworks detected.')
    }

    if (args.template) {
      const fwList = uniqueFrameworks.size > 0
        ? [...uniqueFrameworks.values()].map((fw) => fw.name).join(', ')
        : 'none'
      const templateConfig = generateTemplateConfig(fwList)
      await writeFile(configPath, templateConfig, 'utf-8')
      console.log(`\nTemplate written to ${configPath}`)
      console.log('Edit the file to declare your AI systems, then run "comply scan".')
      return
    }

    console.log('')
    const orgName = await prompt('Organisation name', 'My Organisation')
    const euPresenceStr = await prompt('Does your organisation serve EU users? (Y/n)', 'Y')
    const euPresence = euPresenceStr.toLowerCase() !== 'n'
    const roleChoice = await promptChoice(
      'What is your role under the EU AI Act?',
      ['provider (you develop or commission the AI system)',
       'deployer (you use an AI system developed by others)',
       'both (you modify and deploy AI systems)'],
      0,
    )
    const operatorRole = roleChoice.startsWith('provider') ? 'provider'
      : roleChoice.startsWith('deployer') ? 'deployer'
      : 'both'

    const systemName = await prompt('AI system name', 'My AI System')
    const systemId = slugify(systemName)
    const systemDescription = await prompt('Brief description', '')

    const riskChoice = await promptChoice(
      'What is the risk classification?',
      ['minimal', 'limited', 'high'],
      1,
    )
    const riskLevel = riskChoice as 'minimal' | 'limited' | 'high'

    let annexCategory = ''
    if (riskLevel === 'high') {
      annexCategory = await prompt('Annex III category (e.g. 5b for creditworthiness; leave blank to skip)', '')
    }

    const scopePath = await prompt('Source code path pattern', 'src/**')

    const lines: string[] = [
      '# .systima.yml -- Systima Comply Configuration',
      `# Generated by comply init on ${new Date().toISOString().split('T')[0]}`,
      '# Documentation: https://github.com/systima-ai/comply',
      '',
      'version: "1"',
      '',
      'organisation:',
      `  name: "${orgName}"`,
      `  eu_presence: ${euPresence}`,
      `  operator_role: ${operatorRole}`,
      '',
      'systems:',
      `  - id: ${systemId}`,
      `    name: "${systemName}"`,
    ]

    if (systemDescription) {
      lines.push(`    description: "${systemDescription}"`)
    }

    lines.push(
      '    scope:',
      '      paths:',
      `        - "${scopePath}"`,
      '    classification:',
      `      risk_level: ${riskLevel}`,
    )

    if (annexCategory) {
      lines.push(`      annex_iii_category: "${annexCategory}"`)
    }

    lines.push(
      '    regulations:',
      '      - eu_ai_act',
    )

    if (riskLevel === 'high') {
      lines.push(
        '    documentation:',
        '      risk_management: docs/risk-management.md',
        '      data_governance: docs/data-governance.md',
        '      technical_docs: docs/technical-documentation.md',
        '      transparency: docs/transparency.md',
        '      human_oversight: docs/human-oversight.md',
      )
    } else if (riskLevel === 'limited') {
      lines.push(
        '    documentation:',
        '      transparency: docs/transparency.md',
      )
    }

    lines.push('')

    await writeFile(configPath, lines.join('\n'), 'utf-8')
    console.log(`\nConfiguration written to ${configPath}`)
    console.log('Run "comply scan" to check your compliance posture.')
  },
})

function generateTemplateConfig(detectedFrameworks: string): string {
  return `# .systima.yml -- Systima Comply Configuration
# Detected frameworks: ${detectedFrameworks}
# Edit this file to declare your AI systems and compliance configuration.
# Documentation: https://github.com/systima-ai/comply

version: "1"

organisation:
  name: "Your Organisation"
  eu_presence: true
  operator_role: provider     # provider | deployer | both

systems:
  - id: my-ai-system
    name: "My AI System"
    description: "Description of your AI system"
    scope:
      paths:
        - "src/**"
      exclude:
        - "src/tests/**"
    classification:
      risk_level: limited       # unacceptable | high | limited | minimal
      # annex_iii_category: "5b" # Uncomment if high-risk; see https://artificialintelligenceact.eu/annex/iii/
      rationale: "Describe why this risk level is appropriate"
    regulations:
      - eu_ai_act
    documentation:
      # risk_management: docs/risk-management.md
      # data_governance: docs/data-governance.md
      # technical_docs: docs/technical-documentation.md
      transparency: docs/transparency.md
      # human_oversight: docs/human-oversight.md
`
}

const main = defineCommand({
  meta: {
    name: 'comply',
    version: '0.1.0',
    description: 'EU AI Act compliance scanning for CI/CD pipelines',
  },
  subCommands: {
    scan: scanCommand,
    init: initCommand,
    baseline: baselineCommand,
    diff: diffCommand,
    report: reportCommand,
  },
})

runMain(main)
