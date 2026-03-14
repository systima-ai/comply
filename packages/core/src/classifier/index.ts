import type {
  AiUsageDetection,
  ClassificationMismatch,
  ComplyConfig,
  RiskTier,
  SystemDeclaration,
  UndeclaredSystem,
} from '../types.js'
import picomatch from 'picomatch'

const BIOMETRIC_FRAMEWORKS = new Set([
  'face-recognition',
  'deepface',
  'insightface',
])

const EMOTION_FRAMEWORKS = new Set([
  'mediapipe',
])

const RISK_TIER_PRIORITY: Record<RiskTier, number> = {
  unacceptable: 4,
  high: 3,
  limited: 2,
  minimal: 1,
}

interface ClassificationValidation {
  mismatches: ClassificationMismatch[]
  suggestedRiskLevel: RiskTier
}

function checkForUnacceptableRisk(
  detections: AiUsageDetection[],
  systemId: string,
): ClassificationMismatch[] {
  const mismatches: ClassificationMismatch[] = []

  for (const detection of detections) {
    if (BIOMETRIC_FRAMEWORKS.has(detection.frameworkId)) {
      mismatches.push({
        systemId,
        declaredRiskLevel: 'minimal',
        suggestedRiskLevel: 'high',
        reason: `${detection.frameworkName} is a biometric processing framework. If used for remote biometric identification, this may be prohibited under Article 5(1)(h) or classified as high-risk under Annex III Category 1.`,
        frameworkId: detection.frameworkId,
        suggestedAnnexIiiCategory: '1a',
        filePaths: [detection.filePath],
      })
    }
  }

  return mismatches
}

function checkForHighRiskMismatch(
  systemDecl: SystemDeclaration,
  detections: AiUsageDetection[],
): ClassificationMismatch[] {
  const mismatches: ClassificationMismatch[] = []
  const declaredLevel = systemDecl.classification.riskLevel

  if (declaredLevel === 'high' || declaredLevel === 'unacceptable') return mismatches

  for (const detection of detections) {
    if (BIOMETRIC_FRAMEWORKS.has(detection.frameworkId)) {
      mismatches.push({
        systemId: systemDecl.id,
        declaredRiskLevel: declaredLevel,
        suggestedRiskLevel: 'high',
        reason: `${detection.frameworkName} detected in system declared as "${declaredLevel}". Biometric processing frameworks typically trigger Annex III Category 1 (biometric identification) classification. Review whether this system performs remote biometric identification.`,
        frameworkId: detection.frameworkId,
        suggestedAnnexIiiCategory: '1a',
        filePaths: [detection.filePath],
      })
    }

    if (EMOTION_FRAMEWORKS.has(detection.frameworkId) && detection.matchedText.includes('face_mesh')) {
      mismatches.push({
        systemId: systemDecl.id,
        declaredRiskLevel: declaredLevel,
        suggestedRiskLevel: 'limited',
        reason: `${detection.frameworkName} face mesh detected. If used for emotion recognition, this may be prohibited in workplace/education contexts (Article 5(1)(f)) or require limited-risk transparency obligations.`,
        frameworkId: detection.frameworkId,
        suggestedAnnexIiiCategory: '1c',
        filePaths: [detection.filePath],
      })
    }
  }

  return mismatches
}

function getHighestRiskFromDetections(detections: AiUsageDetection[]): RiskTier {
  let highest: RiskTier = 'minimal'

  for (const detection of detections) {
    for (const signal of detection.riskSignals) {
      if (RISK_TIER_PRIORITY[signal] > RISK_TIER_PRIORITY[highest]) {
        highest = signal
      }
    }
  }

  return highest
}

export async function classifySystem(
  systemDecl: SystemDeclaration,
  detections: AiUsageDetection[],
): Promise<ClassificationValidation> {
  const mismatches: ClassificationMismatch[] = []

  const unacceptableMismatches = checkForUnacceptableRisk(detections, systemDecl.id)
  mismatches.push(
    ...unacceptableMismatches.map((m) => ({
      ...m,
      declaredRiskLevel: systemDecl.classification.riskLevel,
    })),
  )

  const highRiskMismatches = checkForHighRiskMismatch(systemDecl, detections)
  mismatches.push(...highRiskMismatches)

  const detectedRiskLevel = getHighestRiskFromDetections(detections)
  if (RISK_TIER_PRIORITY[detectedRiskLevel] > RISK_TIER_PRIORITY[systemDecl.classification.riskLevel]) {
    const alreadyFlagged = mismatches.some(
      (m) => RISK_TIER_PRIORITY[m.suggestedRiskLevel] >= RISK_TIER_PRIORITY[detectedRiskLevel],
    )
    if (!alreadyFlagged) {
      const triggeringDetection = detections.find((d) =>
        d.riskSignals.includes(detectedRiskLevel),
      )
      if (triggeringDetection) {
        mismatches.push({
          systemId: systemDecl.id,
          declaredRiskLevel: systemDecl.classification.riskLevel,
          suggestedRiskLevel: detectedRiskLevel,
          reason: `Detected ${triggeringDetection.frameworkName} with "${detectedRiskLevel}" risk signal, but system is declared as "${systemDecl.classification.riskLevel}". Consider reviewing the classification.`,
          frameworkId: triggeringDetection.frameworkId,
          filePaths: [triggeringDetection.filePath],
        })
      }
    }
  }

  return {
    mismatches,
    suggestedRiskLevel: detectedRiskLevel,
  }
}

export function detectUndeclaredSystems(
  config: ComplyConfig,
  allDetections: AiUsageDetection[],
  scanPath: string,
): UndeclaredSystem[] {
  const undeclared: UndeclaredSystem[] = []

  const coveredDetections = new Set<string>()
  for (const system of config.systems) {
    for (const detection of allDetections) {
      const relativePath = detection.filePath.replace(scanPath + '/', '')
      const isInScope = system.scope.paths.some((pattern) =>
        picomatch(pattern)(relativePath),
      )
      if (isInScope) {
        coveredDetections.add(`${detection.filePath}:${detection.lineNumber}:${detection.frameworkId}`)
      }
    }
  }

  const uncoveredDetections = allDetections.filter((d) => {
    const key = `${d.filePath}:${d.lineNumber}:${d.frameworkId}`
    return !coveredDetections.has(key)
  })

  if (uncoveredDetections.length === 0) return undeclared

  const groupedByFramework = new Map<string, AiUsageDetection[]>()
  for (const detection of uncoveredDetections) {
    const existing = groupedByFramework.get(detection.frameworkId) ?? []
    existing.push(detection)
    groupedByFramework.set(detection.frameworkId, existing)
  }

  for (const [_frameworkId, detections] of groupedByFramework) {
    const riskLevel = getHighestRiskFromDetections(detections)
    const firstDetection = detections[0]
    if (!firstDetection) continue

    undeclared.push({
      detections,
      suggestedRiskLevel: riskLevel,
      reason: `${firstDetection.frameworkName} detected in ${detections.length} location(s) outside any declared system scope. Add a system declaration in .systima.yml to cover these paths.`,
    })
  }

  return undeclared
}
