import { z } from 'zod'

const riskTierSchema = z.enum(['unacceptable', 'high', 'limited', 'minimal'])

const operatorRoleSchema = z.enum(['provider', 'deployer', 'both'])

const regulationSchema = z.enum(['eu_ai_act', 'gdpr', 'nis2', 'cra', 'dora'])

const annexIiiCategorySchema = z.enum([
  '1a', '1b', '1c',
  '2',
  '3a', '3b', '3c', '3d',
  '4a', '4b',
  '5a', '5b', '5c', '5d',
  '6a', '6b', '6c', '6d', '6e',
  '7a', '7b', '7c', '7d',
  '8a', '8b',
])

const systemScopeSchema = z.object({
  paths: z.array(z.string()).min(1, 'At least one scope path is required'),
  exclude: z.array(z.string()).optional(),
})

const systemDomainSchema = z.enum([
  'general_purpose',
  'customer_support',
  'internal_tooling',
  'content_generation',
  'creditworthiness',
  'employment',
  'insurance',
  'education',
  'legal',
  'law_enforcement',
  'migration',
  'critical_infrastructure',
  'biometric',
  'emergency_services',
  'public_benefits',
  'election',
])

const systemClassificationSchema = z.object({
  risk_level: riskTierSchema,
  domain: systemDomainSchema.optional().default('general_purpose'),
  annex_iii_category: annexIiiCategorySchema.optional(),
  rationale: z.string().optional(),
})

const systemDocumentationSchema = z.object({
  risk_management: z.string().optional(),
  data_governance: z.string().optional(),
  technical_docs: z.string().optional(),
  transparency: z.string().optional(),
  human_oversight: z.string().optional(),
  fria: z.string().optional(),
  accuracy_robustness: z.string().optional(),
  post_market_monitoring: z.string().optional(),
})

const systemDeclarationSchema = z.object({
  id: z.string().min(1, 'System ID is required'),
  name: z.string().min(1, 'System name is required'),
  description: z.string().optional(),
  scope: systemScopeSchema,
  classification: systemClassificationSchema,
  regulations: z.array(regulationSchema).optional().default(['eu_ai_act']),
  documentation: systemDocumentationSchema.optional(),
  ignore: z.array(z.string()).optional(),
})

const organisationSchema = z.object({
  name: z.string().min(1, 'Organisation name is required'),
  eu_presence: z.boolean().default(true),
  operator_role: operatorRoleSchema.default('provider'),
})

export const complyConfigSchema = z.object({
  version: z.literal('1'),
  organisation: organisationSchema,
  systems: z.array(systemDeclarationSchema).min(1, 'At least one system must be declared'),
})

export type RawComplyConfig = z.infer<typeof complyConfigSchema>
