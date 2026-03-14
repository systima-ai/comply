import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { scan } from '../src/scanner/index.js'

const FIXTURES = resolve(import.meta.dirname, 'fixtures')

describe('integration: limited-chatbot fixture', () => {
  it('detects OpenAI usage and passes transparency check', async () => {
    const result = await scan({
      path: resolve(FIXTURES, 'limited-chatbot'),
      scanMode: 'full',
      outputFormat: 'json',
      failOn: 'none',
      verbose: false,
    })

    expect(result.discoveryMode).toBe(false)
    expect(result.systems).toHaveLength(1)

    const system = result.systems[0]!
    expect(system.systemId).toBe('support-chatbot')
    expect(system.classification.riskLevel).toBe('limited')

    const openaiDetections = system.detections.filter(
      (d) => d.frameworkId === 'openai',
    )
    expect(openaiDetections.length).toBeGreaterThan(0)

    const art50 = system.complianceResults.find(
      (r) => r.articleId === 'art50',
    )
    expect(art50).toBeDefined()
    expect(art50!.status).toBe('pass')
  })
})

describe('integration: no-ai-detected fixture', () => {
  it('produces a clean scan with no AI detections', async () => {
    const result = await scan({
      path: resolve(FIXTURES, 'no-ai-detected'),
      scanMode: 'full',
      outputFormat: 'json',
      failOn: 'none',
      verbose: false,
    })

    expect(result.discoveryMode).toBe(true)
    expect(result.systems).toHaveLength(0)
    expect(result.summary.totalDetections).toBe(0)
  })
})

describe('integration: undeclared-biometric fixture', () => {
  it('detects face_recognition in discovery mode', async () => {
    const result = await scan({
      path: resolve(FIXTURES, 'undeclared-biometric'),
      scanMode: 'full',
      outputFormat: 'json',
      failOn: 'none',
      verbose: false,
    })

    expect(result.discoveryMode).toBe(true)

    const discoveryWarning = result.globalFindings.find(
      (f) => f.id === 'discovery-mode-ai-detected',
    )
    expect(discoveryWarning).toBeDefined()
  })
})

describe('integration: high-risk-lending fixture', () => {
  it('scans a high-risk system with documentation', async () => {
    const result = await scan({
      path: resolve(FIXTURES, 'high-risk-lending'),
      scanMode: 'full',
      outputFormat: 'json',
      failOn: 'none',
      verbose: false,
    })

    expect(result.discoveryMode).toBe(false)
    expect(result.systems).toHaveLength(1)

    const system = result.systems[0]!
    expect(system.systemId).toBe('loan-assessor')
    expect(system.classification.riskLevel).toBe('high')

    const docResults = system.complianceResults.filter(
      (r) => r.status === 'pass',
    )
    expect(docResults.length).toBeGreaterThan(0)
  })
})

describe('integration: classification-mismatch fixture', () => {
  it('detects face_recognition in a limited-risk declared system', async () => {
    const result = await scan({
      path: resolve(FIXTURES, 'classification-mismatch'),
      scanMode: 'full',
      outputFormat: 'json',
      failOn: 'none',
      verbose: false,
    })

    expect(result.discoveryMode).toBe(false)
    expect(result.systems).toHaveLength(1)

    const system = result.systems[0]!
    expect(system.classificationMismatches.length).toBeGreaterThan(0)

    const biometricMismatch = system.classificationMismatches.find(
      (m) => m.frameworkId === 'face-recognition',
    )
    expect(biometricMismatch).toBeDefined()
    expect(biometricMismatch!.suggestedRiskLevel).toBe('high')
  })
})
