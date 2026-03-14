import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AnnexIIICategory } from '../types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ANNEX_III_PATH = resolve(__dirname, '../../../../knowledge/eu-ai-act/annex-iii.json')

export interface AnnexIIISubcategory {
  ref: AnnexIIICategory
  description: string
  codeIndicators: string[]
}

export interface AnnexIIICategoryGroup {
  number: number
  title: string
  condition: string | null
  subcategories: AnnexIIISubcategory[]
}

let cachedCategories: AnnexIIICategoryGroup[] | null = null

export async function loadAnnexIIICategories(): Promise<AnnexIIICategoryGroup[]> {
  if (cachedCategories) return cachedCategories

  const raw = await readFile(ANNEX_III_PATH, 'utf-8')
  const data = JSON.parse(raw) as { categories: AnnexIIICategoryGroup[] }
  cachedCategories = data.categories

  return cachedCategories
}

export function findCategoryByRef(
  categories: AnnexIIICategoryGroup[],
  ref: AnnexIIICategory,
): AnnexIIISubcategory | undefined {
  for (const group of categories) {
    const sub = group.subcategories.find((s) => s.ref === ref)
    if (sub) return sub
  }
  return undefined
}

export function findCategoriesByCodeIndicator(
  categories: AnnexIIICategoryGroup[],
  text: string,
): AnnexIIISubcategory[] {
  const lowerText = text.toLowerCase()
  const matches: AnnexIIISubcategory[] = []

  for (const group of categories) {
    for (const sub of group.subcategories) {
      const hasMatch = sub.codeIndicators.some(
        (indicator) => lowerText.includes(indicator.toLowerCase()),
      )
      if (hasMatch) {
        matches.push(sub)
      }
    }
  }

  return matches
}
