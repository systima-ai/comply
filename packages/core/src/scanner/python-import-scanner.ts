import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadFrameworks, findFrameworkByImport } from '../knowledge/frameworks.js'
import type { AiUsageDetection, ClassifiedFile } from '../types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface TreeSitterParser {
  parse(input: string): TreeSitterTree
}

interface TreeSitterTree {
  rootNode: TreeSitterNode
}

interface TreeSitterNode {
  type: string
  text: string
  startPosition: { row: number; column: number }
  endPosition: { row: number; column: number }
  children: TreeSitterNode[]
  childForFieldName(name: string): TreeSitterNode | null
  namedChildren: TreeSitterNode[]
}

let parserInstance: TreeSitterParser | null = null
let initFailed = false

async function getParser(): Promise<TreeSitterParser | null> {
  if (parserInstance) return parserInstance
  if (initFailed) return null

  try {
    const { Parser, Language } = await import('web-tree-sitter')
    await Parser.init()

    const parser = new Parser()

    const wasmPaths = [
      resolve(__dirname, '../../../../node_modules/tree-sitter-python/tree-sitter-python.wasm'),
      resolve(__dirname, '../../../node_modules/tree-sitter-python/tree-sitter-python.wasm'),
      resolve(__dirname, '../../node_modules/tree-sitter-python/tree-sitter-python.wasm'),
    ]

    let language: InstanceType<typeof Language> | null = null
    for (const wasmPath of wasmPaths) {
      try {
        language = await Language.load(wasmPath)
        break
      } catch {
        continue
      }
    }

    if (!language) {
      initFailed = true
      return null
    }

    parser.setLanguage(language)
    parserInstance = parser as unknown as TreeSitterParser
    return parserInstance
  } catch {
    initFailed = true
    return null
  }
}

function extractImportsFromAST(rootNode: TreeSitterNode): Array<{ module: string; line: number; endLine: number; text: string }> {
  const imports: Array<{ module: string; line: number; endLine: number; text: string }> = []

  function visit(node: TreeSitterNode): void {
    if (node.type === 'import_statement') {
      const nameNode = node.childForFieldName('name')
      if (nameNode) {
        imports.push({
          module: nameNode.text,
          line: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          text: node.text,
        })
      } else {
        for (const child of node.namedChildren) {
          if (child.type === 'dotted_name' || child.type === 'aliased_import') {
            const name = child.type === 'aliased_import'
              ? child.childForFieldName('name')?.text ?? child.text
              : child.text
            imports.push({
              module: name,
              line: node.startPosition.row + 1,
              endLine: node.endPosition.row + 1,
              text: node.text,
            })
          }
        }
      }
    }

    if (node.type === 'import_from_statement') {
      const moduleNode = node.childForFieldName('module_name')
      if (moduleNode) {
        imports.push({
          module: moduleNode.text,
          line: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          text: node.text,
        })
      }
    }

    for (const child of node.children) {
      visit(child)
    }
  }

  visit(rootNode)
  return imports
}

function extractImportsWithRegex(content: string): Array<{ module: string; line: number; endLine: number; text: string }> {
  const imports: Array<{ module: string; line: number; endLine: number; text: string }> = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const trimmed = line.trim()

    const importMatch = trimmed.match(/^import\s+([\w.]+)/)
    if (importMatch?.[1]) {
      imports.push({
        module: importMatch[1],
        line: i + 1,
        endLine: i + 1,
        text: trimmed,
      })
      continue
    }

    const fromImportMatch = trimmed.match(/^from\s+([\w.]+)\s+import/)
    if (fromImportMatch?.[1]) {
      imports.push({
        module: fromImportMatch[1],
        line: i + 1,
        endLine: i + 1,
        text: trimmed,
      })
    }
  }

  return imports
}

export async function scanPythonImports(
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

  const parser = await getParser()

  let rawImports: Array<{ module: string; line: number; endLine: number; text: string }>
  let confidence: 'high' | 'medium'

  if (parser) {
    const tree = parser.parse(content)
    rawImports = extractImportsFromAST(tree.rootNode)
    confidence = 'high'
  } else {
    rawImports = extractImportsWithRegex(content)
    confidence = 'medium'
  }

  for (const imp of rawImports) {
    const topLevelModule = imp.module.split('.')[0] ?? imp.module
    const framework = findFrameworkByImport(frameworks, imp.module, 'python')
      ?? findFrameworkByImport(frameworks, topLevelModule, 'python')

    if (framework) {
      detections.push({
        filePath: file.path,
        lineNumber: imp.line,
        endLineNumber: imp.endLine,
        frameworkId: framework.id,
        frameworkName: framework.name,
        frameworkCategory: framework.category,
        detectionType: 'import',
        confidence,
        riskSignals: framework.riskSignals,
        matchedText: imp.text,
        isDevelopmentDependency: false,
      })
    }
  }

  return detections
}
