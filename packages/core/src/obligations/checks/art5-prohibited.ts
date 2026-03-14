import type { AiUsageDetection, ComplianceResult } from '../../types.js'

const BIOMETRIC_FRAMEWORK_IDS = new Set([
  'face-recognition',
  'deepface',
  'insightface',
])

export async function checkArt5Prohibited(
  detections: AiUsageDetection[],
): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = []

  const biometricDetections = detections.filter((d) =>
    BIOMETRIC_FRAMEWORK_IDS.has(d.frameworkId),
  )

  if (biometricDetections.length > 0) {
    results.push({
      articleId: 'art5',
      status: 'warning',
      title: 'Biometric processing framework detected',
      detail: `${biometricDetections.length} biometric processing framework(s) detected. Certain biometric uses are prohibited under Article 5: untargeted facial recognition scraping (5(1)(e)), biometric categorisation for protected attributes (5(1)(g)), and real-time remote biometric identification in public spaces for law enforcement without authorisation (5(1)(h)). Verify that your use case does not fall under a prohibited practice.`,
      filePaths: biometricDetections.map((d) => d.filePath),
      lineNumbers: biometricDetections.map((d) => d.lineNumber),
      referenceUrl: 'https://artificialintelligenceact.eu/article/5/',
      phase: 1,
    })
  }

  if (biometricDetections.length === 0) {
    results.push({
      articleId: 'art5',
      status: 'pass',
      title: 'No prohibited practice indicators detected',
      detail: 'No biometric processing frameworks or prohibited practice patterns detected in scanned code.',
      referenceUrl: 'https://artificialintelligenceact.eu/article/5/',
      phase: 1,
    })
  }

  return results
}
