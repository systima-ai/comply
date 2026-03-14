import { readFile } from 'node:fs/promises'
import { loadFrameworks, findFrameworkByEnvPattern } from '../knowledge/frameworks.js'
import type { AiUsageDetection, ClassifiedFile } from '../types.js'

async function scanEnvFile(file: ClassifiedFile): Promise<AiUsageDetection[]> {
  const detections: AiUsageDetection[] = []
  const frameworks = await loadFrameworks()

  let content: string
  try {
    content = await readFile(file.path, 'utf-8')
  } catch {
    return detections
  }

  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) continue

    const keyMatch = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/)
    if (!keyMatch?.[1]) continue

    const envKey = keyMatch[1]
    const framework = findFrameworkByEnvPattern(frameworks, envKey)
    if (framework) {
      detections.push({
        filePath: file.path,
        lineNumber: i + 1,
        frameworkId: framework.id,
        frameworkName: framework.name,
        frameworkCategory: framework.category,
        detectionType: 'config',
        confidence: 'medium',
        riskSignals: framework.riskSignals,
        matchedText: envKey,
        isDevelopmentDependency: false,
      })
    }
  }

  return detections
}

async function scanDockerCompose(file: ClassifiedFile): Promise<AiUsageDetection[]> {
  const detections: AiUsageDetection[] = []
  const frameworks = await loadFrameworks()

  let content: string
  try {
    content = await readFile(file.path, 'utf-8')
  } catch {
    return detections
  }

  const allEnvPatterns = frameworks.flatMap((fw) =>
    fw.envPatterns.map((pattern) => ({ pattern, framework: fw })),
  )

  const aiServicePatterns = [
    'tensorflow/serving',
    'pytorch/pytorch',
    'huggingface',
    'ollama',
    'localai',
    'vllm',
    'tritonserver',
    'sagemaker',
  ]

  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    for (const { pattern, framework } of allEnvPatterns) {
      if (line.includes(pattern)) {
        detections.push({
          filePath: file.path,
          lineNumber: i + 1,
          frameworkId: framework.id,
          frameworkName: framework.name,
          frameworkCategory: framework.category,
          detectionType: 'config',
          confidence: 'medium',
          riskSignals: framework.riskSignals,
          matchedText: pattern,
          isDevelopmentDependency: false,
        })
        break
      }
    }

    for (const imagePattern of aiServicePatterns) {
      if (line.includes(imagePattern)) {
        detections.push({
          filePath: file.path,
          lineNumber: i + 1,
          frameworkId: imagePattern.replace(/[/]/g, '-'),
          frameworkName: imagePattern,
          frameworkCategory: 'ai_infrastructure',
          detectionType: 'config',
          confidence: 'medium',
          riskSignals: ['minimal'],
          matchedText: imagePattern,
          isDevelopmentDependency: false,
        })
        break
      }
    }
  }

  return detections
}

async function scanTerraform(file: ClassifiedFile): Promise<AiUsageDetection[]> {
  const detections: AiUsageDetection[] = []

  let content: string
  try {
    content = await readFile(file.path, 'utf-8')
  } catch {
    return detections
  }

  const aiServicePatterns: Array<{ pattern: string; name: string; id: string }> = [
    { pattern: 'aws_sagemaker', name: 'AWS SageMaker', id: 'aws-sagemaker' },
    { pattern: 'aws_bedrock', name: 'AWS Bedrock', id: 'aws-bedrock' },
    { pattern: 'google_vertex_ai', name: 'Google Vertex AI', id: 'google-vertex-ai' },
    { pattern: 'google_ml_engine', name: 'Google ML Engine', id: 'google-ml-engine' },
    { pattern: 'azurerm_cognitive_account', name: 'Azure Cognitive Services', id: 'azure-cognitive' },
    { pattern: 'azurerm_machine_learning', name: 'Azure Machine Learning', id: 'azure-ml' },
    { pattern: 'azurerm_openai', name: 'Azure OpenAI', id: 'azure-openai' },
  ]

  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    for (const svc of aiServicePatterns) {
      if (line.includes(svc.pattern)) {
        detections.push({
          filePath: file.path,
          lineNumber: i + 1,
          frameworkId: svc.id,
          frameworkName: svc.name,
          frameworkCategory: 'ai_infrastructure',
          detectionType: 'config',
          confidence: 'high',
          riskSignals: ['minimal'],
          matchedText: svc.pattern,
          isDevelopmentDependency: false,
        })
        break
      }
    }
  }

  return detections
}

export async function scanConfigFile(
  file: ClassifiedFile,
): Promise<AiUsageDetection[]> {
  if (file.language === 'env') return scanEnvFile(file)

  const basename = file.relativePath.split('/').pop() ?? ''
  if (basename.startsWith('docker-compose') && file.language === 'yaml') return scanDockerCompose(file)
  if (file.language === 'terraform') return scanTerraform(file)

  return []
}
