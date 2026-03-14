import * as core from '@actions/core'
import * as github from '@actions/github'
import { scan, formatGitHubPRComment, formatJsonReport, formatSarifReport, loadBaseline, computeDiff } from '@systima/comply'
import type { FailOn, OutputFormat, ScanResult } from '@systima/comply'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'

function shouldFail(result: ScanResult, failOn: FailOn): boolean {
  if (failOn === 'none') return false
  const severity = result.summary.findingsBySeverity
  switch (failOn) {
    case 'critical': return severity.critical > 0
    case 'fail': return severity.critical > 0 || severity.fail > 0
    case 'warning': return severity.critical > 0 || severity.fail > 0 || severity.warning > 0
    default: return false
  }
}

async function run(): Promise<void> {
  try {
    const configPath = core.getInput('config-path') || '.systima.yml'
    const scanMode = core.getInput('scan-mode') || 'diff'
    const failOn = (core.getInput('fail-on') || 'critical') as FailOn
    const outputFormat = (core.getInput('output-format') || 'comment') as OutputFormat | 'all'
    const baselinePath = core.getInput('baseline-path') || '.systima-baseline.json'

    const workspace = process.env['GITHUB_WORKSPACE'] ?? process.cwd()

    core.info('Starting Systima Comply EU AI Act compliance scan...')

    const result = await scan({
      path: workspace,
      configPath: resolve(workspace, configPath),
      scanMode: scanMode === 'diff' ? 'diff' : 'full',
      outputFormat: outputFormat === 'all' ? 'json' : outputFormat,
      failOn,
      verbose: false,
    })

    const baseline = await loadBaseline(resolve(workspace, baselinePath))
    const diff = baseline ? computeDiff(baseline, result) : undefined

    core.setOutput('compliance-score', result.summary.overallComplianceScore.toString())
    core.setOutput('risk-level', result.summary.highestRiskLevel)
    core.setOutput('findings-count', result.summary.totalFindings.toString())
    core.setOutput('classification-changed', result.summary.classificationChanged.toString())

    if (outputFormat === 'comment' || outputFormat === 'all') {
      const comment = formatGitHubPRComment(result, diff)

      const token = process.env['GITHUB_TOKEN']
      if (token && github.context.payload.pull_request) {
        const octokit = github.getOctokit(token)
        const prNumber = github.context.payload.pull_request.number

        const { data: existingComments } = await octokit.rest.issues.listComments({
          ...github.context.repo,
          issue_number: prNumber,
        })

        const botComment = existingComments.find(
          (c) => c.body?.includes('Systima Comply'),
        )

        if (botComment) {
          await octokit.rest.issues.updateComment({
            ...github.context.repo,
            comment_id: botComment.id,
            body: comment,
          })
        } else {
          await octokit.rest.issues.createComment({
            ...github.context.repo,
            issue_number: prNumber,
            body: comment,
          })
        }

        core.info('PR comment posted successfully')
      }
    }

    if (outputFormat === 'json' || outputFormat === 'all') {
      const json = formatJsonReport(result, diff)
      await writeFile(resolve(workspace, 'comply-results.json'), json, 'utf-8')
      core.info('JSON report written to comply-results.json')
    }

    if (outputFormat === 'sarif' || outputFormat === 'all') {
      const sarif = formatSarifReport(result)
      await writeFile(resolve(workspace, 'comply-results.sarif'), sarif, 'utf-8')
      core.info('SARIF report written to comply-results.sarif')
    }

    if (shouldFail(result, failOn)) {
      core.setFailed(
        `Compliance check failed: ${result.summary.findingsBySeverity.critical} critical, ${result.summary.findingsBySeverity.fail} failures, ${result.summary.findingsBySeverity.warning} warnings`,
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    core.setFailed(`Systima Comply failed: ${message}`)
  }
}

run()
