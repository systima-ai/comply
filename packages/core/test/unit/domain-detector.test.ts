import { describe, it, expect } from 'vitest'
import { detectDomainFromText, detectDomainFromFilePaths, suggestAnnexIIICategory } from '../../src/classifier/domain-detector.js'

describe('domain detector', () => {
  it('detects creditworthiness domain from keywords', () => {
    const results = detectDomainFromText('credit scoring loan assessment underwriting model')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((r) => r.annexIiiCategory === '5b')).toBe(true)
  })

  it('detects employment domain from keywords', () => {
    const results = detectDomainFromText('candidate resume screening applicant ranking hiring')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((r) => r.annexIiiCategory === '4a')).toBe(true)
  })

  it('detects biometric domain from keywords', () => {
    const results = detectDomainFromText('face_recognition biometric identification facial matching')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((r) => r.annexIiiCategory === '1a')).toBe(true)
  })

  it('does not detect domain from generic text', () => {
    const results = detectDomainFromText('hello world function returns a string')
    expect(results).toHaveLength(0)
  })

  it('detects domain from file paths', () => {
    const results = detectDomainFromFilePaths([
      'src/lending/credit-model.py',
      'src/lending/loan-scorer.py',
    ])
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((r) => r.annexIiiCategory === '5b')).toBe(true)
  })

  it('suggests Annex III category from detections', () => {
    const category = suggestAnnexIIICategory([
      { matchedText: 'sklearn credit model', filePath: 'src/lending/scorer.py' },
      { matchedText: 'loan assessment', filePath: 'src/lending/assess.py' },
    ])
    expect(category).toBe('5b')
  })

  it('returns undefined for non-regulated detections', () => {
    const category = suggestAnnexIIICategory([
      { matchedText: 'openai', filePath: 'src/utils/helper.ts' },
    ])
    expect(category).toBeUndefined()
  })
})
