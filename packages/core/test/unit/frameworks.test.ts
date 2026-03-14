import { describe, it, expect } from 'vitest'
import { loadFrameworks, findFrameworkByPackage, findFrameworkByImport, findFrameworkByEnvPattern } from '../../src/knowledge/frameworks.js'

describe('framework knowledge base', () => {
  it('loads 30+ frameworks', async () => {
    const frameworks = await loadFrameworks()
    expect(frameworks.length).toBeGreaterThanOrEqual(30)
  })

  it('finds OpenAI by JS package name', async () => {
    const frameworks = await loadFrameworks()
    const fw = findFrameworkByPackage(frameworks, 'openai', 'javascript')
    expect(fw).toBeDefined()
    expect(fw!.id).toBe('openai')
  })

  it('finds scikit-learn by Python package name', async () => {
    const frameworks = await loadFrameworks()
    const fw = findFrameworkByPackage(frameworks, 'scikit-learn', 'python')
    expect(fw).toBeDefined()
    expect(fw!.id).toBe('scikit-learn')
  })

  it('finds face_recognition by Python import', async () => {
    const frameworks = await loadFrameworks()
    const fw = findFrameworkByImport(frameworks, 'face_recognition', 'python')
    expect(fw).toBeDefined()
    expect(fw!.id).toBe('face-recognition')
    expect(fw!.riskSignals).toContain('high')
  })

  it('finds Anthropic by env pattern', async () => {
    const frameworks = await loadFrameworks()
    const fw = findFrameworkByEnvPattern(frameworks, 'ANTHROPIC_API_KEY')
    expect(fw).toBeDefined()
    expect(fw!.id).toBe('anthropic')
  })

  it('finds LangChain by scoped JS package', async () => {
    const frameworks = await loadFrameworks()
    const fw = findFrameworkByPackage(frameworks, '@langchain/core', 'javascript')
    expect(fw).toBeDefined()
    expect(fw!.id).toBe('langchain')
  })

  it('returns undefined for unknown packages', async () => {
    const frameworks = await loadFrameworks()
    const fw = findFrameworkByPackage(frameworks, 'express', 'javascript')
    expect(fw).toBeUndefined()
  })

  it('classifies biometric frameworks as high-risk', async () => {
    const frameworks = await loadFrameworks()
    const biometric = frameworks.filter((fw) => fw.category === 'computer_vision' && fw.riskSignals.includes('high'))
    expect(biometric.length).toBeGreaterThanOrEqual(3)
  })
})
