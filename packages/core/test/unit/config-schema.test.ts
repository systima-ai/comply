import { describe, it, expect } from 'vitest'
import { complyConfigSchema } from '../../src/config/schema.js'

describe('config schema validation', () => {
  it('accepts a valid minimal config', () => {
    const result = complyConfigSchema.safeParse({
      version: '1',
      organisation: {
        name: 'Acme Corp',
        eu_presence: true,
        operator_role: 'provider',
      },
      systems: [
        {
          id: 'my-system',
          name: 'My System',
          scope: { paths: ['src/**'] },
          classification: { risk_level: 'limited' },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a config with no systems', () => {
    const result = complyConfigSchema.safeParse({
      version: '1',
      organisation: { name: 'Acme', eu_presence: true, operator_role: 'provider' },
      systems: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid version', () => {
    const result = complyConfigSchema.safeParse({
      version: '2',
      organisation: { name: 'Acme', eu_presence: true, operator_role: 'provider' },
      systems: [{ id: 'x', name: 'X', scope: { paths: ['**'] }, classification: { risk_level: 'minimal' } }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid risk level', () => {
    const result = complyConfigSchema.safeParse({
      version: '1',
      organisation: { name: 'Acme', eu_presence: true, operator_role: 'provider' },
      systems: [{ id: 'x', name: 'X', scope: { paths: ['**'] }, classification: { risk_level: 'extreme' } }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts a full high-risk config with all documentation fields', () => {
    const result = complyConfigSchema.safeParse({
      version: '1',
      organisation: { name: 'FinCo', eu_presence: true, operator_role: 'both' },
      systems: [
        {
          id: 'loan-scorer',
          name: 'Loan Scorer',
          description: 'ML credit scoring',
          scope: { paths: ['src/lending/**'], exclude: ['src/lending/tests/**'] },
          classification: {
            risk_level: 'high',
            annex_iii_category: '5b',
            rationale: 'Automated credit scoring',
          },
          regulations: ['eu_ai_act', 'gdpr'],
          documentation: {
            risk_management: 'docs/risk.md',
            data_governance: 'docs/data.md',
            technical_docs: 'docs/tech.md',
            transparency: 'docs/transparency.md',
            human_oversight: 'docs/oversight.md',
            fria: 'docs/fria.md',
          },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts all valid Annex III categories', () => {
    const categories = [
      '1a', '1b', '1c', '2', '3a', '3b', '3c', '3d',
      '4a', '4b', '5a', '5b', '5c', '5d',
      '6a', '6b', '6c', '6d', '6e', '7a', '7b', '7c', '7d', '8a', '8b',
    ]
    for (const cat of categories) {
      const result = complyConfigSchema.safeParse({
        version: '1',
        organisation: { name: 'X', eu_presence: true, operator_role: 'provider' },
        systems: [{
          id: 'x', name: 'X', scope: { paths: ['**'] },
          classification: { risk_level: 'high', annex_iii_category: cat },
        }],
      })
      expect(result.success, `Category ${cat} should be valid`).toBe(true)
    }
  })
})
