import ts from 'typescript'
import { readFile } from 'node:fs/promises'
import type { AiUsageDetection, CallChainTrace, TracedSink } from '../types.js'
import { detectSink } from './sink-detector.js'

interface VariableBinding {
  name: string
  node: ts.Node
  lineNumber: number
}

function getLineNumber(sourceFile: ts.SourceFile, pos: number): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1
}

function isAiApiCallExpression(node: ts.Node, aiImports: Set<string>): boolean {
  if (!ts.isCallExpression(node)) return false

  const expr = node.expression
  const callText = expr.getText()

  for (const importName of aiImports) {
    if (callText.startsWith(importName)) return true
  }

  const aiCallPatterns = [
    'completions.create',
    'chat.completions.create',
    'generateText',
    'streamText',
    'generateObject',
    'messages.create',
    'embeddings.create',
    'predict',
    'predict_proba',
    'generate',
    'invoke',
  ]

  return aiCallPatterns.some((pattern) => callText.includes(pattern))
}

function extractAssignedVariable(
  node: ts.Node,
  sourceFile: ts.SourceFile,
): VariableBinding | null {
  const parent = node.parent

  if (!parent) return null

  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return {
      name: parent.name.text,
      node: parent,
      lineNumber: getLineNumber(sourceFile, parent.getStart(sourceFile)),
    }
  }

  if (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) {
    return extractAssignedVariable(parent, sourceFile)
  }

  if (ts.isAwaitExpression(parent)) {
    return extractAssignedVariable(parent, sourceFile)
  }

  return null
}

function findVariableUsages(
  variableName: string,
  sourceFile: ts.SourceFile,
  startLine: number,
): ts.Node[] {
  const usages: ts.Node[] = []

  function visit(node: ts.Node): void {
    const line = getLineNumber(sourceFile, node.getStart(sourceFile))
    if (line <= startLine) {
      ts.forEachChild(node, visit)
      return
    }

    if (ts.isIdentifier(node) && node.text === variableName) {
      if (node.parent && !ts.isVariableDeclaration(node.parent)) {
        usages.push(node)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return usages
}

function extractAiImportIdentifiers(sourceFile: ts.SourceFile): Set<string> {
  const identifiers = new Set<string>()

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && node.importClause) {
      const moduleText = ts.isStringLiteral(node.moduleSpecifier)
        ? node.moduleSpecifier.text
        : ''

      const aiModules = [
        'openai', 'anthropic', '@anthropic-ai/sdk', 'ai',
        '@google/generative-ai', 'cohere-ai', '@mistralai/mistralai',
        '@langchain/core', '@langchain/openai', 'langchain',
      ]

      if (aiModules.some((m) => moduleText.startsWith(m))) {
        if (node.importClause.name) {
          identifiers.add(node.importClause.name.text)
        }
        if (node.importClause.namedBindings) {
          if (ts.isNamedImports(node.importClause.namedBindings)) {
            for (const specifier of node.importClause.namedBindings.elements) {
              identifiers.add(specifier.name.text)
            }
          }
          if (ts.isNamespaceImport(node.importClause.namedBindings)) {
            identifiers.add(node.importClause.namedBindings.name.text)
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return identifiers
}

export async function traceCallChains(
  filePath: string,
  detections: AiUsageDetection[],
): Promise<CallChainTrace[]> {
  const traces: CallChainTrace[] = []

  let content: string
  try {
    content = await readFile(filePath, 'utf-8')
  } catch {
    return traces
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  )

  const aiImports = extractAiImportIdentifiers(sourceFile)

  function visit(node: ts.Node): void {
    if (isAiApiCallExpression(node, aiImports)) {
      const binding = extractAssignedVariable(node, sourceFile)
      if (!binding) {
        ts.forEachChild(node, visit)
        return
      }

      const usages = findVariableUsages(binding.name, sourceFile, binding.lineNumber)
      const sinks: TracedSink[] = []
      const intermediateSteps: CallChainTrace['intermediateSteps'] = []

      for (const usage of usages) {
        const sink = detectSink(usage, sourceFile)
        if (sink) {
          sinks.push({
            ...sink,
            filePath,
            lineNumber: getLineNumber(sourceFile, usage.getStart(sourceFile)),
          })
        } else {
          intermediateSteps.push({
            filePath,
            lineNumber: getLineNumber(sourceFile, usage.getStart(sourceFile)),
            description: `Variable "${binding.name}" referenced`,
          })
        }
      }

      if (sinks.length > 0) {
        const detection = detections.find((d) => d.filePath === filePath)

        if (detection) {
          traces.push({
            sourceDetection: detection,
            sinks,
            intermediateSteps,
          })
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return traces
}
