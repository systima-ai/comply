import ts from 'typescript'
import type { TracedSink } from '../types'

function isConditionalBranch(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent
  while (current) {
    if (ts.isIfStatement(current)) return true
    if (ts.isConditionalExpression(current)) return true
    if (ts.isSwitchStatement(current)) return true
    current = current.parent
  }
  return false
}

function isDatabasePersist(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent
  while (current) {
    if (ts.isCallExpression(current)) {
      const callText = current.expression.getText()
      const dbPatterns = [
        '.save', '.insert', '.update', '.create', '.upsert',
        '.set', '.put', '.write', '.store', '.persist',
        'db.', 'prisma.', 'mongoose.', 'sequelize.',
        'collection.', 'dynamodb.', 'firestore.',
      ]
      if (dbPatterns.some((p) => callText.includes(p))) return true
    }
    current = current.parent
  }
  return false
}

function isUIRender(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent
  while (current) {
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) return true
    if (ts.isJsxExpression(current)) return true

    if (ts.isCallExpression(current)) {
      const callText = current.expression.getText()
      const renderPatterns = [
        'res.send', 'res.json', 'res.render', 'res.write',
        'response.json', 'response.send',
        'innerHTML', 'textContent',
        'setState', 'setContent', 'setResponse',
      ]
      if (renderPatterns.some((p) => callText.includes(p))) return true
    }

    current = current.parent
  }
  return false
}

function isApiCall(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent
  while (current) {
    if (ts.isCallExpression(current)) {
      const callText = current.expression.getText()
      const apiPatterns = [
        'fetch(', 'axios.', 'http.', 'request(',
        '.post(', '.put(', '.patch(',
        'api.', 'client.', 'service.',
        'submit', 'send', 'dispatch', 'publish', 'emit',
      ]
      if (apiPatterns.some((p) => callText.includes(p))) return true
    }
    current = current.parent
  }
  return false
}

export function detectSink(
  node: ts.Node,
  _sourceFile: ts.SourceFile,
): Omit<TracedSink, 'filePath' | 'lineNumber'> | null {
  if (isConditionalBranch(node)) {
    return {
      type: 'conditional_branch',
      description: 'AI output used in conditional branching (potential automated decision-making)',
      suggestedRiskLevel: 'high',
    }
  }

  if (isDatabasePersist(node)) {
    return {
      type: 'database_persist',
      description: 'AI output persisted to database (potential scoring/classification of natural persons)',
      suggestedRiskLevel: 'high',
    }
  }

  if (isUIRender(node)) {
    return {
      type: 'ui_render',
      description: 'AI output rendered to user interface (Article 50 transparency obligations apply)',
      suggestedRiskLevel: 'limited',
    }
  }

  if (isApiCall(node)) {
    return {
      type: 'api_call',
      description: 'AI output passed to downstream API (potential integration into regulated decision chain)',
      suggestedRiskLevel: 'high',
    }
  }

  return null
}
