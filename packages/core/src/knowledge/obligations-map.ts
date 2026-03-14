import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ArticleId, RiskTier, ObligationDefinition } from '../types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ARTICLES_PATH = resolve(__dirname, '../../../../knowledge/eu-ai-act/articles.json')
const OBLIGATIONS_PATH = resolve(__dirname, '../../../../knowledge/eu-ai-act/obligations.json')

interface RawArticle {
  id: ArticleId
  number: number
  title: string
  description: string
  applicableRiskTiers: RiskTier[]
  enforcementDate: string
  penaltyTier: 'highest' | 'high' | 'standard'
  referenceUrl: string
}

export interface ObligationCheck {
  id: string
  title: string
  description: string
  phase: 1 | 2 | 3
}

interface RawObligation {
  articleId: ArticleId
  checks: ObligationCheck[]
}

let cachedArticles: RawArticle[] | null = null
let cachedObligations: RawObligation[] | null = null

async function loadArticles(): Promise<RawArticle[]> {
  if (cachedArticles) return cachedArticles

  const raw = await readFile(ARTICLES_PATH, 'utf-8')
  const data = JSON.parse(raw) as { articles: RawArticle[] }
  cachedArticles = data.articles

  return cachedArticles
}

async function loadObligations(): Promise<RawObligation[]> {
  if (cachedObligations) return cachedObligations

  const raw = await readFile(OBLIGATIONS_PATH, 'utf-8')
  const data = JSON.parse(raw) as { obligations: RawObligation[] }
  cachedObligations = data.obligations

  return cachedObligations
}

export async function getObligationsForRiskTier(
  riskTier: RiskTier,
): Promise<ObligationDefinition[]> {
  const articles = await loadArticles()

  return articles
    .filter((art) => art.applicableRiskTiers.includes(riskTier))
    .map((art): ObligationDefinition => ({
      articleId: art.id,
      articleNumber: art.number,
      title: art.title,
      description: art.description,
      applicableRiskTiers: art.applicableRiskTiers,
      enforcementDate: art.enforcementDate,
      penaltyTier: art.penaltyTier,
      referenceUrl: art.referenceUrl,
      phase: 1,
    }))
}

export async function getChecksForArticle(
  articleId: ArticleId,
  maxPhase: 1 | 2 | 3 = 3,
): Promise<ObligationCheck[]> {
  const obligations = await loadObligations()
  const obligation = obligations.find((o) => o.articleId === articleId)

  if (!obligation) return []

  return obligation.checks.filter((c) => c.phase <= maxPhase)
}

export async function getArticleInfo(
  articleId: ArticleId,
): Promise<RawArticle | undefined> {
  const articles = await loadArticles()
  return articles.find((a) => a.id === articleId)
}

export async function getAllArticles(): Promise<RawArticle[]> {
  return loadArticles()
}
