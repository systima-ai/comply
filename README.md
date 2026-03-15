# Systima Comply

**EU AI Act compliance scanning for CI/CD pipelines.**

Systima Comply analyses your codebase for AI framework usage, validates your risk classification against the EU AI Act, checks obligation compliance, and reports findings directly in pull requests. Think of it as **Snyk for AI regulation**.

> **Systima Comply is an engineering tool, not legal advice. It does not replace professional regulatory assessment.**

## Features

- **AI framework detection**: 40+ frameworks across Python and TypeScript/JavaScript (OpenAI, Anthropic, LangChain, scikit-learn, face_recognition, and more)
- **Risk classification validation**: Validates declared risk levels against detected frameworks; flags mismatches (e.g. biometric processing in a "limited-risk" system)
- **Obligation compliance checking**: Per-article checks for Articles 5, 9, 10, 11, 12, 13, 14, 27, and 50
- **Call-chain analysis**: Traces AI API call return values through your code to detect regulated decision patterns
- **Annex III domain detection**: Identifies when AI output flows into employment, credit, insurance, education, law enforcement, or other regulated domains
- **PR comments**: Well-formatted GitHub PR comments with obligation tables, findings, and remediation links
- **Multiple output formats**: GitHub PR comment, JSON, SARIF (for GitHub Code Scanning), Markdown
- **Baseline diffing**: Track compliance posture over time; see what changed in each PR
- **Zero external dependencies**: No API calls, no telemetry, no data exfiltration. Runs entirely locally.
- **Deterministic**: Same codebase + same config = identical results every time. No LLM calls, no probabilistic analysis.

## Quick Start

### CLI

```bash
# Scan your codebase
npx @systima/comply scan

# Initialise a configuration file
npx @systima/comply init

# Generate a compliance report
npx @systima/comply report --out COMPLIANCE_REPORT.md
```

### GitHub Action

```yaml
# .github/workflows/comply.yml
name: EU AI Act Compliance
on:
  pull_request:
    types: [opened, synchronize, reopened]
permissions:
  contents: read
  pull-requests: write
  security-events: write
jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: systima-ai/comply@v1
        with:
          fail-on: warning
          output-format: all
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: comply-results.sarif
```

## Configuration

Create a `.systima.yml` file in your repository root. Run `npx @systima/comply init` to generate one interactively, or create it manually:

```yaml
version: "1"

organisation:
  name: "Acme Corp"
  eu_presence: true
  operator_role: provider     # provider | deployer | both

systems:
  - id: loan-assessor
    name: "Loan Assessment Engine"
    description: "ML model scoring loan applications for creditworthiness"
    scope:
      paths:
        - src/lending/**
      exclude:
        - src/lending/tests/**
    classification:
      risk_level: high
      annex_iii_category: "5b"   # Creditworthiness assessment
      rationale: "Automated credit scoring affecting natural persons"
    regulations:
      - eu_ai_act
      - gdpr
    documentation:
      risk_management: docs/lending/risk-management.md
      data_governance: docs/lending/data-governance.md
      technical_docs: docs/lending/technical-documentation.md
      transparency: docs/lending/transparency-notice.md
      human_oversight: docs/lending/human-oversight-protocol.md

  - id: support-chatbot
    name: "Customer Support Chatbot"
    scope:
      paths: [src/chatbot/**]
    classification:
      risk_level: limited
      rationale: "AI chatbot interacting with users; transparency obligations"
    documentation:
      transparency: docs/chatbot/ai-disclosure.md
```

### Configuration Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `"1"` | Yes | Config schema version |
| `organisation.name` | string | Yes | Organisation name |
| `organisation.eu_presence` | boolean | Yes | Whether the organisation serves EU users |
| `organisation.operator_role` | `provider` / `deployer` / `both` | Yes | Role under the EU AI Act |
| `systems[].id` | string | Yes | Unique system identifier |
| `systems[].name` | string | Yes | Human-readable system name |
| `systems[].scope.paths` | string[] | Yes | Glob patterns for source code paths |
| `systems[].scope.exclude` | string[] | No | Glob patterns to exclude |
| `systems[].classification.risk_level` | `unacceptable` / `high` / `limited` / `minimal` | Yes | EU AI Act risk tier |
| `systems[].classification.annex_iii_category` | string | No | Annex III subcategory (e.g. `5b`) |
| `systems[].documentation.*` | string | No | Paths to compliance documentation |

## CLI Commands

| Command | Description |
|---------|-------------|
| `comply scan` | Scan codebase for EU AI Act compliance |
| `comply init` | Interactively create a `.systima.yml` configuration |
| `comply baseline` | Save current scan as baseline for future comparisons |
| `comply diff` | Compare current scan against a saved baseline |
| `comply report` | Generate a compliance report for legal/compliance teams |

### `comply scan` Options

| Option | Default | Description |
|--------|---------|-------------|
| `--path` | `.` | Path to scan |
| `--config` | `.systima.yml` | Path to config file |
| `--output` | `text` | Output format: `json`, `sarif`, `markdown`, `text` |
| `--out` | stdout | Write output to file |
| `--fail-on` | `critical` | Exit with code 1 on: `none`, `warning`, `fail`, `critical` |
| `--baseline` | `.systima-baseline.json` | Baseline file for diff comparison |

## GitHub Action

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `config-path` | `.systima.yml` | Path to configuration file |
| `scan-mode` | `diff` | `full` (entire repo) or `diff` (changed files only) |
| `fail-on` | `critical` | Fail the check on: `none`, `warning`, `fail`, `critical` |
| `output-format` | `comment` | `comment`, `json`, `sarif`, or `all` |
| `baseline-path` | `.systima-baseline.json` | Path to baseline file |

### Outputs

| Output | Description |
|--------|-------------|
| `compliance-score` | Fraction of obligations met (0.0-1.0) |
| `risk-level` | Highest risk level across all systems |
| `findings-count` | Total number of findings |
| `classification-changed` | Whether any classification changed |

## What It Checks

### Prohibited Practices (Article 5)

Detects biometric processing frameworks (face_recognition, deepface, insightface) that may indicate prohibited uses: untargeted facial recognition scraping, biometric categorisation for protected attributes, or workplace/education emotion recognition.

### Obligation Compliance (Articles 9-15)

For high-risk systems, checks documentation existence and completeness for:

| Article | Obligation | What Comply Checks |
|---------|-----------|-------------------|
| Art. 9 | Risk management | Document exists; contains risk identification, estimation, evaluation, mitigation sections |
| Art. 10 | Data governance | Document exists; references data sources and bias evaluation |
| Art. 11 | Technical documentation | Document exists; covers Annex IV categories |
| Art. 12 | Logging | Structured logging or `@systima/aiact-audit-log` detected |
| Art. 13 | Transparency | Transparency documentation present; model cards; limitation disclosures |
| Art. 14 | Human oversight | Oversight documentation; review/approval mechanisms in code |
| Art. 27 | FRIA | Fundamental Rights Impact Assessment for deployers of high-risk systems |
| Art. 50 | Transparency (all tiers) | AI interaction disclosure in user-facing code |

### Classification Validation

- Flags biometric frameworks in systems declared as limited or minimal risk
- Detects undeclared AI systems outside any configured scope
- Suggests Annex III categories based on domain analysis of code paths

### Call-Chain Analysis

Traces AI API call return values through assignments, destructuring, and property access chains to detect:

- **Conditional branching** on AI output (automated decision-making)
- **Database persistence** of AI classifications (scoring of natural persons)
- **UI rendering** without AI disclosure (Article 50 gap)
- **Downstream API calls** with AI output (integration into regulated decision chain)

## Programmatic API

```typescript
import { scan, formatGitHubPRComment, formatJsonReport } from '@systima/comply'

const result = await scan({
  path: '/path/to/repo',
  scanMode: 'full',
  outputFormat: 'json',
  failOn: 'critical',
  verbose: false,
})

// Access scan results programmatically
console.log(result.summary.overallComplianceScore)
console.log(result.summary.findingsBySeverity)

// Format as GitHub PR comment
const comment = formatGitHubPRComment(result)

// Format as JSON report
const json = formatJsonReport(result)
```

## Detected Frameworks

Comply detects 40+ AI/ML frameworks across Python and TypeScript/JavaScript:

| Category | Frameworks |
|----------|-----------|
| LLM Providers | OpenAI, Anthropic, Google Generative AI, Cohere, Mistral AI, Together AI, Groq, Replicate, MiniMax, AWS Bedrock, Azure OpenAI |
| ML Frameworks | TensorFlow, PyTorch, JAX, scikit-learn, XGBoost, LightGBM, CatBoost |
| Agent Frameworks | LangChain, LlamaIndex, AutoGen, CrewAI, Semantic Kernel, Haystack, DSPy, Mastra |
| Computer Vision | face_recognition, DeepFace, InsightFace, OpenCV DNN, MediaPipe |
| NLP/Embeddings | Hugging Face Transformers, Sentence Transformers, spaCy, NLTK, Flair |
| AI Infrastructure | Vercel AI SDK, MLflow, Weights & Biases, Hugging Face Hub |

## Ecosystem Integration

Comply works alongside Systima's other open-source EU AI Act compliance tools:

- **[@systima/aiact-audit-log](https://github.com/systima-ai/aiact-audit-log)**: Article 12 compliant structured, tamper-evident audit logging. Comply detects whether it is installed and configured.

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

### Development

```bash
git clone https://github.com/systima-ai/comply.git
cd comply
pnpm install
pnpm build
pnpm test
```

### Project Structure

```
packages/
  core/           # @systima/comply npm package + CLI
    src/
      scanner/    # File walker, import/dependency/config scanners
      classifier/ # Risk classification validation, domain detection
      tracer/     # Call-chain analysis, sink detection
      obligations/# Obligation check functions per EU AI Act article
      reporters/  # Output formatters (PR comment, JSON, SARIF, Markdown, badge)
      diff/       # Baseline comparison engine
      config/     # .systima.yml schema and loader
      knowledge/  # Framework patterns, Annex III, obligation mappings
  action/         # GitHub Action wrapper
knowledge/        # Regulatory knowledge base (JSON)
  eu-ai-act/      # Articles, Annex III, obligations, deadlines
  frameworks/     # AI framework detection patterns
examples/         # Reference .systima.yml configurations
```

## Licence

Apache 2.0. See [LICENSE](LICENSE).

---

Built by [Systima](https://systima.ai), an agentic AI consultancy for regulated industries.
