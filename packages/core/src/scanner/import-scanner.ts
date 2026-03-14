import ts from 'typescript'
import { readFile } from 'node:fs/promises'
import { loadFrameworks, findFrameworkByImport } from '../knowledge/frameworks'
import type { AiUsageDetection, ClassifiedFile } from '../types'

function getLineNumber(sourceFile: ts.SourceFile, pos: number): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1
}

function extractModuleSpecifier(node: ts.Node): string | null {
  if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
    return node.moduleSpecifier.text
  }

  if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
    return node.moduleSpecifier.text
  }

  if (
    ts.isCallExpression(node) &&
    node.arguments.length > 0
  ) {
    const firstArg = node.arguments[0]

    if (node.expression.kind === ts.SyntaxKind.ImportKeyword && firstArg && ts.isStringLiteral(firstArg)) {
      return firstArg.text
    }

    if (
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      firstArg &&
      ts.isStringLiteral(firstArg)
    ) {
      return firstArg.text
    }
  }

  return null
}

export async function scanTypeScriptImports(
  file: ClassifiedFile,
): Promise<AiUsageDetection[]> {
  const detections: AiUsageDetection[] = []
  const frameworks = await loadFrameworks()

  let content: string
  try {
    content = await readFile(file.path, 'utf-8')
  } catch {
    return detections
  }

  const scriptKind = file.path.endsWith('.tsx') || file.path.endsWith('.jsx')
    ? ts.ScriptKind.TSX
    : file.path.endsWith('.ts') || file.path.endsWith('.mts') || file.path.endsWith('.cts')
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS

  const sourceFile = ts.createSourceFile(
    file.relativePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  )

  function visit(node: ts.Node): void {
    const moduleSpecifier = extractModuleSpecifier(node)

    if (moduleSpecifier) {
      if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')) {
        ts.forEachChild(node, visit)
        return
      }

      const framework = findFrameworkByImport(frameworks, moduleSpecifier, 'javascript')
      if (framework) {
        const line = getLineNumber(sourceFile, node.getStart(sourceFile))
        const endLine = getLineNumber(sourceFile, node.getEnd())

        detections.push({
          filePath: file.path,
          lineNumber: line,
          endLineNumber: endLine,
          frameworkId: framework.id,
          frameworkName: framework.name,
          frameworkCategory: framework.category,
          detectionType: 'import',
          confidence: 'high',
          riskSignals: framework.riskSignals,
          matchedText: moduleSpecifier,
          isDevelopmentDependency: false,
        })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return detections
}
