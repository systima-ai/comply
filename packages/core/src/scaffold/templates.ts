export interface DocTemplate {
  filename: string
  title: string
  articleRef: string
  sections: Array<{ heading: string; guidance: string }>
}

export const RISK_MANAGEMENT_TEMPLATE: DocTemplate = {
  filename: 'risk-management.md',
  title: 'Risk Management System',
  articleRef: 'Article 9',
  sections: [
    { heading: 'Risk Identification', guidance: 'Describe known and reasonably foreseeable risks the AI system may pose to health, safety, or fundamental rights. Include risks arising from intended use and reasonably foreseeable misuse.' },
    { heading: 'Risk Estimation', guidance: 'Estimate the likelihood and severity of each identified risk. Consider both probability of harm and its potential magnitude.' },
    { heading: 'Risk Evaluation', guidance: 'Evaluate whether each risk is acceptable, tolerable, or unacceptable. Define thresholds and criteria used for evaluation.' },
    { heading: 'Risk Mitigation', guidance: 'Describe measures taken to eliminate or reduce each identified risk. Include technical measures (e.g. input validation, output filtering) and organisational measures (e.g. human oversight, deployment gates).' },
    { heading: 'Residual Risk', guidance: 'Document risks that remain after mitigation measures are applied. Explain why these residual risks are considered acceptable.' },
  ],
}

export const DATA_GOVERNANCE_TEMPLATE: DocTemplate = {
  filename: 'data-governance.md',
  title: 'Data and Data Governance',
  articleRef: 'Article 10',
  sections: [
    { heading: 'Data Sources', guidance: 'List all data sources used for training, validation, and testing. Include provenance, collection methods, and legal basis for processing.' },
    { heading: 'Data Quality', guidance: 'Describe data quality measures: completeness, accuracy, timeliness, consistency. Document any data cleaning or preprocessing steps.' },
    { heading: 'Bias', guidance: 'Document bias evaluation methodology. Describe how datasets were examined for possible biases, particularly regarding protected characteristics. Include mitigation measures for identified biases.' },
  ],
}

export const TECHNICAL_DOCS_TEMPLATE: DocTemplate = {
  filename: 'technical-documentation.md',
  title: 'Technical Documentation (Annex IV)',
  articleRef: 'Article 11',
  sections: [
    { heading: 'General Description', guidance: 'Describe the AI system: what it does, how it works at a high level, who it is intended for.' },
    { heading: 'Design', guidance: 'Document the system architecture, key components, and design decisions. Include system diagrams where helpful.' },
    { heading: 'Development', guidance: 'Describe the development process: training methodology, frameworks used, development environment, CI/CD pipeline.' },
    { heading: 'Monitoring', guidance: 'Describe how the system is monitored in production: metrics tracked, alerting thresholds, logging infrastructure.' },
    { heading: 'Performance', guidance: 'Document key performance metrics: accuracy, precision, recall, latency, error rates. Include evaluation methodology and benchmark results.' },
    { heading: 'Intended Purpose', guidance: 'Describe the intended purpose of the AI system, the context in which it operates, and any conditions or limitations on its use.' },
  ],
}

export const TRANSPARENCY_TEMPLATE: DocTemplate = {
  filename: 'transparency.md',
  title: 'Transparency and Provision of Information',
  articleRef: 'Article 13',
  sections: [
    { heading: 'Capabilities', guidance: 'Describe what the AI system can do, including its strengths and the tasks it is designed to perform.' },
    { heading: 'Limitations', guidance: 'Document known limitations: scenarios where performance degrades, input types that are not well supported, known failure modes.' },
    { heading: 'Intended Use', guidance: 'Describe the intended use cases and deployment context. Specify who the intended users are and what decisions the system supports.' },
  ],
}

export const HUMAN_OVERSIGHT_TEMPLATE: DocTemplate = {
  filename: 'human-oversight.md',
  title: 'Human Oversight',
  articleRef: 'Article 14',
  sections: [
    { heading: 'Oversight', guidance: 'Describe the human oversight model: human-in-the-loop (review before action), human-on-the-loop (monitoring with intervention), or human-over-the-loop (governance). Identify who has oversight responsibility.' },
    { heading: 'Intervention', guidance: 'Describe how oversight persons can intervene in the system operation. Include mechanisms for flagging, escalating, or pausing automated decisions.' },
    { heading: 'Override', guidance: 'Describe how oversight persons can override or reverse the system output. Document the kill-switch or halt mechanism. Include audit trail for all overrides.' },
  ],
}

export const ALL_TEMPLATES: Record<string, DocTemplate> = {
  riskManagement: RISK_MANAGEMENT_TEMPLATE,
  dataGovernance: DATA_GOVERNANCE_TEMPLATE,
  technicalDocs: TECHNICAL_DOCS_TEMPLATE,
  transparency: TRANSPARENCY_TEMPLATE,
  humanOversight: HUMAN_OVERSIGHT_TEMPLATE,
}

export function renderTemplate(template: DocTemplate, systemName: string): string {
  const lines: string[] = [
    `# ${template.title}`,
    '',
    `**System**: ${systemName}`,
    `**EU AI Act Reference**: ${template.articleRef}`,
    `**Generated by**: Systima Comply scaffold`,
    `**Date**: ${new Date().toISOString().split('T')[0]}`,
    '',
    '---',
    '',
  ]

  for (const section of template.sections) {
    lines.push(`## ${section.heading}`)
    lines.push('')
    lines.push(`<!-- ${section.guidance} -->`)
    lines.push('')
    lines.push('*TODO: Complete this section.*')
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('*This template was generated by [Systima Comply](https://github.com/systima-ai/comply). For richer auto-generated Annex IV documentation, run `npx @systima/aiact-docs generate`.*')

  return lines.join('\n')
}
