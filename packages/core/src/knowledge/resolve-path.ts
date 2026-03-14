import { access } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SEARCH_ROOTS = [
  resolve(__dirname, '..', 'knowledge'),
  resolve(__dirname, '..', '..', 'knowledge'),
  resolve(__dirname, '..', '..', '..', 'knowledge'),
  resolve(__dirname, '..', '..', '..', '..', 'knowledge'),
]

export async function resolveKnowledgePath(relativePath: string): Promise<string> {
  for (const root of SEARCH_ROOTS) {
    const candidate = resolve(root, relativePath)
    try {
      await access(candidate)
      return candidate
    } catch {
      continue
    }
  }

  return resolve(SEARCH_ROOTS[0]!, relativePath)
}
