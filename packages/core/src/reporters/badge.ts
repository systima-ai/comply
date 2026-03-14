import type { ScanResult } from '../types'

interface BadgeConfig {
  label: string
  message: string
  colour: string
}

function getBadgeConfig(result: ScanResult): BadgeConfig {
  const { summary } = result
  const score = Math.round(summary.overallComplianceScore * 100)

  if (summary.findingsBySeverity.critical > 0) {
    return {
      label: 'EU AI Act',
      message: 'critical',
      colour: '#e53e3e',
    }
  }

  if (summary.findingsBySeverity.fail > 0) {
    return {
      label: 'EU AI Act',
      message: `${score}%`,
      colour: '#dd6b20',
    }
  }

  if (summary.findingsBySeverity.warning > 0) {
    return {
      label: 'EU AI Act',
      message: `${score}%`,
      colour: '#d69e2e',
    }
  }

  return {
    label: 'EU AI Act',
    message: `${score}%`,
    colour: '#38a169',
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function generateBadgeSvg(result: ScanResult): string {
  const config = getBadgeConfig(result)
  const labelWidth = config.label.length * 7.5 + 12
  const messageWidth = config.message.length * 7.5 + 12
  const totalWidth = labelWidth + messageWidth

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${escapeXml(config.label)}: ${escapeXml(config.message)}">
  <title>${escapeXml(config.label)}: ${escapeXml(config.message)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${config.colour}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(config.label)}</text>
    <text x="${labelWidth / 2}" y="14">${escapeXml(config.label)}</text>
    <text aria-hidden="true" x="${labelWidth + messageWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(config.message)}</text>
    <text x="${labelWidth + messageWidth / 2}" y="14">${escapeXml(config.message)}</text>
  </g>
</svg>`
}

export function generateBadgeUrl(result: ScanResult): string {
  const config = getBadgeConfig(result)
  const encodedLabel = encodeURIComponent(config.label)
  const encodedMessage = encodeURIComponent(config.message)
  const colour = config.colour.replace('#', '')

  return `https://img.shields.io/badge/${encodedLabel}-${encodedMessage}-${colour}`
}
