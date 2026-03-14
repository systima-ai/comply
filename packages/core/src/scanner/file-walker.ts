import fg from 'fast-glob'
import ignore from 'ignore'
import { readFile, stat } from 'node:fs/promises'
import { resolve, relative, extname } from 'node:path'
import type { ClassifiedFile, FileLanguage, FileManifest } from '../types'

const MAX_FILES = 50_000

const EXTENSION_MAP: Record<string, FileLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.pyw': 'python',
  '.json': 'json',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'toml',
  '.env': 'env',
  '.tf': 'terraform',
  '.ini': 'ini',
  '.cfg': 'ini',
}

const FILENAME_MAP: Record<string, FileLanguage> = {
  'Dockerfile': 'dockerfile',
  'Dockerfile.dev': 'dockerfile',
  'Dockerfile.prod': 'dockerfile',
  'docker-compose.yml': 'yaml',
  'docker-compose.yaml': 'yaml',
  'Pipfile': 'toml',
  '.env': 'env',
  '.env.local': 'env',
  '.env.development': 'env',
  '.env.production': 'env',
  '.env.example': 'env',
}

function classifyLanguage(filePath: string): FileLanguage {
  const basename = filePath.split('/').pop() ?? ''

  if (FILENAME_MAP[basename]) return FILENAME_MAP[basename]

  if (basename.startsWith('.env')) return 'env'

  const ext = extname(basename).toLowerCase()
  return EXTENSION_MAP[ext] ?? 'unknown'
}

async function loadIgnoreRules(
  scanPath: string,
): Promise<ReturnType<typeof ignore>> {
  const ig = ignore()

  const gitignorePath = resolve(scanPath, '.gitignore')
  try {
    const content = await readFile(gitignorePath, 'utf-8')
    ig.add(content)
  } catch {
    // .gitignore not found; continue
  }

  const systimaIgnorePath = resolve(scanPath, '.systimaignore')
  try {
    const content = await readFile(systimaIgnorePath, 'utf-8')
    ig.add(content)
  } catch {
    // .systimaignore not found; continue
  }

  ig.add(['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv', '.tox', '.mypy_cache'])

  return ig
}

export async function walkFiles(
  scanPath: string,
  scopePaths?: string[],
  excludePaths?: string[],
): Promise<FileManifest> {
  const absoluteScanPath = resolve(scanPath)
  const ig = await loadIgnoreRules(absoluteScanPath)

  const patterns = scopePaths && scopePaths.length > 0
    ? scopePaths.map((p) => p.replace(/\\/g, '/'))
    : ['**/*']

  const ignorePatterns = excludePaths ?? []

  const entries = await fg(patterns, {
    cwd: absoluteScanPath,
    absolute: false,
    dot: false,
    onlyFiles: true,
    ignore: [
      ...ignorePatterns,
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '__pycache__/**',
      '.venv/**',
      'venv/**',
    ],
  })

  const filteredEntries = entries.filter((entry) => !ig.ignores(entry))

  const truncated = filteredEntries.length > MAX_FILES
  const limitedEntries = truncated
    ? filteredEntries.slice(0, MAX_FILES)
    : filteredEntries

  const languages: Record<FileLanguage, number> = {
    typescript: 0,
    javascript: 0,
    python: 0,
    json: 0,
    yaml: 0,
    toml: 0,
    env: 0,
    dockerfile: 0,
    terraform: 0,
    ini: 0,
    unknown: 0,
  }

  const files: ClassifiedFile[] = []
  for (const entry of limitedEntries) {
    const absolutePath = resolve(absoluteScanPath, entry)
    const language = classifyLanguage(entry)
    languages[language]++

    let fileSize = 0
    try {
      const stats = await stat(absolutePath)
      fileSize = stats.size
    } catch {
      // File may have been deleted since glob; skip size
    }

    files.push({
      path: absolutePath,
      relativePath: relative(absoluteScanPath, absolutePath),
      language,
      size: fileSize,
    })
  }

  return {
    files,
    totalFiles: files.length,
    truncated,
    languages,
  }
}
