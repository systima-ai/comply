import { readFile } from 'node:fs/promises'
import type { ArticleId, RiskTier, ObligationDefinition } from '../types.js'
import { resolveKnowledgePath } from './resolve-path.js'

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

  const articlesPath = await resolveKnowledgePath('eu-ai-act/articles.json')
  const raw = await readFile(articlesPath, 'utf-8')
  const data = JSON.parse(raw) as { articles: RawArticle[] }
  cachedArticles = data.articles

  return cachedArticles
}

async function loadObligations(): Promise<RawObligation[]> {
  if (cachedObligations) return cachedObligations

  const obligationsPath = await resolveKnowledgePath('eu-ai-act/obligations.json')
  const raw = await readFile(obligationsPath, 'utf-8')
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
