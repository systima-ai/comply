import type { AnnexIIICategory, DomainIndicator } from '../types'

const DOMAIN_INDICATORS: DomainIndicator[] = [
  {
    domain: 'employment',
    annexIiiCategory: '4a',
    keywords: [
      'resume', 'cv', 'candidate', 'applicant', 'recruit', 'hiring',
      'interview', 'job', 'employment', 'vacancy', 'hr', 'human_resources',
      'talent', 'workforce', 'employee', 'personnel',
    ],
    description: 'Employment and recruitment: placing targeted job ads, analysing or filtering applications, evaluating candidates.',
  },
  {
    domain: 'worker_management',
    annexIiiCategory: '4b',
    keywords: [
      'performance', 'productivity', 'task_allocation', 'promotion',
      'termination', 'worker', 'monitoring', 'surveillance', 'keylogger',
      'screenshot', 'timetrack',
    ],
    description: 'Worker management: decisions affecting terms of work, promotion, termination, task allocation, monitoring and evaluating performance.',
  },
  {
    domain: 'creditworthiness',
    annexIiiCategory: '5b',
    keywords: [
      'credit', 'loan', 'lending', 'mortgage', 'creditworth', 'underwriting',
      'fico', 'credit_score', 'credit_bureau', 'debt', 'default_risk',
      'repayment', 'borrower',
    ],
    description: 'Creditworthiness: evaluating creditworthiness or establishing credit scores of natural persons.',
  },
  {
    domain: 'insurance',
    annexIiiCategory: '5c',
    keywords: [
      'insurance', 'actuarial', 'premium', 'claim', 'underwrite',
      'mortality', 'morbidity', 'health_risk', 'life_insurance',
      'risk_pricing', 'policyholder',
    ],
    description: 'Insurance: risk assessment and pricing for natural persons in life and health insurance.',
  },
  {
    domain: 'emergency_services',
    annexIiiCategory: '5d',
    keywords: [
      'emergency', 'triage', 'dispatch', '999', '911', '112',
      'ambulance', 'first_responder', 'severity', 'priority_queue',
      'patient_triage',
    ],
    description: 'Emergency services: evaluating and classifying emergency calls, dispatching emergency services, patient triage.',
  },
  {
    domain: 'education_admissions',
    annexIiiCategory: '3a',
    keywords: [
      'admission', 'enrollment', 'placement', 'student', 'university',
      'school', 'academic', 'application_score', 'acceptance',
    ],
    description: 'Education admissions: determining access or admission to educational institutions.',
  },
  {
    domain: 'education_assessment',
    annexIiiCategory: '3b',
    keywords: [
      'grading', 'scoring', 'exam', 'assessment', 'essay_grade',
      'learning_outcome', 'adaptive_learning', 'test_score',
    ],
    description: 'Education assessment: evaluating learning outcomes or steering the learning process.',
  },
  {
    domain: 'law_enforcement',
    annexIiiCategory: '6d',
    keywords: [
      'recidivism', 'reoffend', 'criminal', 'suspect', 'profiling',
      'law_enforcement', 'police', 'prosecution', 'pretrial',
      'risk_assessment_criminal',
    ],
    description: 'Law enforcement: assessing risk of offending or re-offending, profiling of natural persons.',
  },
  {
    domain: 'migration',
    annexIiiCategory: '7b',
    keywords: [
      'asylum', 'visa', 'migration', 'immigration', 'border',
      'refugee', 'residence_permit', 'deportation', 'eurodac',
    ],
    description: 'Migration and asylum: assessing applications, security risk, or health risk in migration context.',
  },
  {
    domain: 'legal_judicial',
    annexIiiCategory: '8a',
    keywords: [
      'judicial', 'court', 'sentencing', 'legal_research', 'case_law',
      'verdict', 'arbitration', 'dispute_resolution', 'legal_outcome',
    ],
    description: 'Administration of justice: assisting judicial authorities in researching and interpreting facts and law.',
  },
  {
    domain: 'biometric_identification',
    annexIiiCategory: '1a',
    keywords: [
      'face_recognition', 'facial_recognition', 'biometric', 'fingerprint',
      'iris_scan', 'voice_print', 'gait_recognition', 'face_matching',
    ],
    description: 'Biometrics: remote biometric identification systems.',
  },
  {
    domain: 'critical_infrastructure',
    annexIiiCategory: '2',
    keywords: [
      'scada', 'ics', 'power_grid', 'water_treatment', 'gas_supply',
      'traffic_control', 'smart_grid', 'energy_dispatch',
      'critical_infrastructure',
    ],
    description: 'Critical infrastructure: AI used as safety components in management of critical digital infrastructure, road traffic, or utilities.',
  },
  {
    domain: 'public_benefits',
    annexIiiCategory: '5a',
    keywords: [
      'benefit', 'welfare', 'social_service', 'eligibility',
      'public_assistance', 'entitlement', 'social_security',
    ],
    description: 'Public benefits: evaluating eligibility for essential public assistance benefits and services.',
  },
]

export function detectDomainFromText(text: string): DomainIndicator[] {
  const lowerText = text.toLowerCase().replace(/[-]/g, '_')
  const matches: DomainIndicator[] = []

  for (const indicator of DOMAIN_INDICATORS) {
    const matchCount = indicator.keywords.filter((kw) =>
      lowerText.includes(kw),
    ).length

    if (matchCount >= 2) {
      matches.push(indicator)
    }
  }

  return matches
}

export function detectDomainFromFilePaths(filePaths: string[]): DomainIndicator[] {
  const combinedPaths = filePaths.join(' ').toLowerCase().replace(/[/\\.-]/g, '_')
  return detectDomainFromText(combinedPaths)
}

export function suggestAnnexIIICategory(
  detections: Array<{ matchedText: string; filePath: string }>,
): AnnexIIICategory | undefined {
  const allText = detections
    .map((d) => `${d.matchedText} ${d.filePath}`)
    .join(' ')

  const domains = detectDomainFromText(allText)
  if (domains.length > 0 && domains[0]) {
    return domains[0].annexIiiCategory
  }

  return undefined
}

export { DOMAIN_INDICATORS }
