# AGENTS.md

This document is a guide for AI agents contributing to the Systima Comply project.

## Project overview

- **What**: Open-source EU AI Act compliance scanner for CI/CD pipelines. Analyses codebases for AI framework usage, validates risk classifications, checks obligation compliance, and reports findings in pull requests.
- **Stack**: TypeScript (strict mode), Node.js 20+, pnpm workspaces, Turborepo, tsup (esbuild), vitest.
- **Package manager**: pnpm (never npm or yarn).
- **Monorepo structure**:
  - `packages/core/`: the `@systima/comply` npm package (scanner engine + CLI)
  - `packages/action/`: GitHub Action wrapper (`@systima/comply-action`); source only, `dist/` must be committed
  - `action.yml`: root-level GitHub Action definition (points to `packages/action/dist/index.js`); GitHub Actions requires this at the repo root
  - `knowledge/`: regulatory knowledge base as JSON (EU AI Act articles, Annex III categories, AI framework patterns)
  - `examples/`: reference `.systima.yml` configurations
  - `test/`: test fixtures (sample codebases for integration testing); lives inside `packages/core/test/`

## Setup commands

```bash
pnpm install          # install all dependencies
pnpm build            # build all packages (tsup)
pnpm test             # run all tests (vitest)
pnpm typecheck        # TypeScript strict mode check
```

To work on a specific package:

```bash
pnpm --filter @systima/comply build      # build core only
pnpm --filter @systima/comply test       # test core only
pnpm --filter @systima/comply typecheck  # typecheck core only
pnpm --filter @systima/comply dev        # watch mode build
```

## Code style

- **TypeScript strict mode**. No `any`. No `unknown` as a lazy escape hatch. No aggressive type-casting (`as SomeType`).
- **ESM first**. Import paths use **no file extensions** (e.g. `from './scanner/index'` not `from './scanner/index.js'`). The tsup bundler resolves `.ts` files from extensionless paths via `moduleResolution: "bundler"` in `tsconfig.base.json`. The package ships both ESM and CJS via tsup.
- **No comments in code**. The code should be self-documenting through clear naming. Preserve existing comments.
- **British English** in all communication and content (e.g. "colour" not "color", "analyse" not "analyze"). Variable names in code may use American English where framework APIs expect it.
- **Naming**: descriptive, full words. Functions as verbs, variables as nouns. Files in kebab-case. Types/interfaces in PascalCase.
- **No mocks or stubs** unless the user explicitly requests them.
- **No console.log** in library code. CLI code may use `console.log` for user-facing output.

## Architecture

The scanner executes a five-stage pipeline:

1. **Configuration loading**: parse and validate `.systima.yml` via Zod schema. Missing file enters "discovery mode".
2. **File discovery**: walk the file tree respecting `.gitignore`, `.systimaignore`, and scope patterns.
3. **AI usage detection**: run import scanner (TypeScript Compiler API for TS/JS; web-tree-sitter WASM for Python), dependency scanner (package.json, requirements.txt, pyproject.toml, Pipfile), and config scanner (.env, Docker Compose, Terraform).
4. **Classification and obligation mapping**: validate declared risk levels against detected frameworks. Run call-chain analysis and domain detection. Map risk tiers to applicable EU AI Act articles.
5. **Obligation compliance checking**: for each applicable article, run the corresponding check function. Check documentation existence, content sections, and code-level patterns.

### Key directories

| Directory | Purpose |
|-----------|---------|
| `packages/core/src/scanner/` | File walker, import scanner (TS/JS + Python), dependency scanner, config scanner, document scanner, orchestrator |
| `packages/core/src/classifier/` | Risk classification validation, Annex III domain detection |
| `packages/core/src/tracer/` | Call-chain analysis (follows AI API return values through code), regulated decision sink detection |
| `packages/core/src/obligations/` | Obligation check functions, one per EU AI Act article |
| `packages/core/src/reporters/` | Output formatters: GitHub PR comment, GitLab MR note, JSON, SARIF, Markdown, PDF, SVG badge |
| `packages/core/src/scaffold/` | Documentation template generator (`comply scaffold` command) |
| `packages/core/src/doctor/` | Config validation (`comply doctor` command) |
| `packages/core/src/diff/` | Baseline comparison engine |
| `packages/core/src/config/` | `.systima.yml` Zod schema and loader |
| `packages/core/src/knowledge/` | TypeScript loaders for the JSON knowledge bases |
| `knowledge/frameworks/` | AI framework detection patterns (37+ frameworks) |
| `knowledge/eu-ai-act/` | EU AI Act articles, Annex III categories, obligation mappings, deadlines, changelog |

## CLI commands

| Command | Description |
|---------|-------------|
| `comply scan` | Scan codebase for EU AI Act compliance |
| `comply init` | Interactively create a `.systima.yml` config (or `--template` for non-interactive) |
| `comply scaffold` | Generate template documentation files for all declared systems |
| `comply doctor` | Validate `.systima.yml` config without running a full scan |
| `comply baseline` | Save current scan as `.systima-baseline.json` for future diffs |
| `comply diff` | Compare current scan against a saved baseline |
| `comply report` | Generate a compliance report (Markdown, JSON, or PDF via `--format pdf`) |

## `.systima.yml` schema

Key fields to know when modifying the Zod schema (`packages/core/src/config/schema.ts`):

- `version`: always `"1"` (literal)
- `organisation.operator_role`: `provider` / `deployer` / `both`
- `systems[].classification.risk_level`: `unacceptable` / `high` / `limited` / `minimal`
- `systems[].classification.domain`: declares the system's purpose. Non-regulated domains (`general_purpose`, `customer_support`, `internal_tooling`, `content_generation`) cause call-chain findings to be advisory. Regulated domains (`creditworthiness`, `employment`, `insurance`, `education`, `legal`, `law_enforcement`, `migration`, `critical_infrastructure`, `biometric`, `emergency_services`, `public_benefits`, `election`) cause call-chain findings to be critical. Defaults to `general_purpose`.
- `systems[].classification.annex_iii_category`: optional Annex III subcategory (e.g. `5b` for creditworthiness)
- `systems[].documentation.*`: paths relative to the config file; resolved to absolute paths by the loader

## Risk-tiered reporting

The scanner splits findings into **applicable** and **advisory** based on the declared risk level and domain:

- **Applicable obligations**: only articles that legally apply to the declared risk tier are counted in the compliance score and shown in the main obligation table. For limited-risk systems, this is Article 5 (prohibited practices) and Article 50 (transparency).
- **Advisory findings**: call-chain analysis results (DB persistence, conditional branching, UI rendering, API calls) and high-risk-only obligation gaps (Articles 9-14) are shown in a collapsible advisory section, not as red alerts. They only become critical findings when the declared risk level is `high` or the declared `domain` is a regulated domain (e.g. `creditworthiness`, `employment`, `legal`).
- **Domain field**: systems declare a `domain` in `.systima.yml` (e.g. `general_purpose`, `customer_support`, `creditworthiness`). Regulated domains (those mapping to Annex III categories) trigger high-severity treatment of call-chain findings. Non-regulated domains treat them as informational.
- **Compliance score**: only counts obligations that are legally required for the declared risk level. A limited-risk system with both Article 5 and Article 50 passing scores 100%, regardless of whether high-risk-only documentation exists.

When modifying the scanner orchestrator (`packages/core/src/scanner/index.ts`), maintain the separation between `complianceResults` (applicable) and `advisoryResults` (non-applicable) on `SystemScanResult`. Both must be populated; reporters decide how to display them.

## Testing

- Test framework: vitest
- Test files: `packages/core/test/` (integration tests) and `packages/core/test/unit/` (unit tests)
- Test fixtures: `packages/core/test/fixtures/` (sample codebases; these are NOT part of the project and intentionally contain unresolved imports)
- Run all tests: `pnpm --filter @systima/comply test`
- Always run `pnpm typecheck` and `pnpm test` before committing.

### Fixture repos

| Fixture | Purpose |
|---------|---------|
| `limited-chatbot/` | TypeScript + OpenAI, limited-risk, transparency doc present |
| `no-ai-detected/` | Standard web app with no AI dependencies |
| `undeclared-biometric/` | Python + face_recognition, no `.systima.yml` |
| `high-risk-lending/` | Python + scikit-learn + OpenAI, high-risk 5(a), all docs present |
| `classification-mismatch/` | face_recognition declared as limited-risk |

## Knowledge base

The regulatory knowledge base lives in `knowledge/` as JSON files. These are **not** TypeScript; they are loaded at runtime by the loaders in `packages/core/src/knowledge/`. When adding a new AI framework, edit `knowledge/frameworks/ai-frameworks.json`. When updating regulatory data, edit the corresponding file in `knowledge/eu-ai-act/`.

### Adding a new AI framework

Add an entry to `knowledge/frameworks/ai-frameworks.json` with:
- `id`: kebab-case unique identifier
- `name`: display name
- `category`: one of `llm_provider`, `ml_framework`, `agent_framework`, `computer_vision`, `nlp_embeddings`, `ai_infrastructure`
- `riskSignals`: array of risk tiers the framework suggests (e.g. `["high"]` for biometric frameworks)
- `python.imports` / `python.packages`: detection patterns for Python
- `javascript.imports` / `javascript.packages`: detection patterns for JavaScript/TypeScript
- `envPatterns`: environment variable names that indicate this framework
- `description`: human-readable description

### Adding a new obligation check

1. Create a new file in `packages/core/src/obligations/checks/` following the existing pattern (e.g. `art15-accuracy.ts`).
2. Export an async function that takes `SystemDeclaration`, `AiUsageDetection[]`, and `ClassifiedFile[]` and returns `ComplianceResult[]`.
3. Wire it into `packages/core/src/obligations/index.ts`.
4. Add the corresponding article to `knowledge/eu-ai-act/articles.json` and checks to `knowledge/eu-ai-act/obligations.json`.

## Dependencies

- `tree-sitter-python` is an **optional dependency** (native addon). The Python scanner falls back to regex-based detection if the WASM parser fails to initialise. Do not make it a hard dependency.
- `pdfmake` is a runtime dependency for PDF report generation. It is marked as external in tsup (not bundled).
- All other dependencies are pure JavaScript/TypeScript with no native compilation.
- The GitHub Action (`action.yml` at repo root) is a self-contained ESM bundle with a `createRequire` banner for CJS compatibility. It is built via `pnpm --filter @systima/comply-action build` and the `dist/` must be committed to git. The `action.yml` at the repo root points to `packages/action/dist/index.js`.

## Caveats

- **`packages/core/.gitignore`**: contains `/knowledge/` (with leading slash). This ignores only the copied JSON directory at `packages/core/knowledge/` (created by the `prebuild` script). Without the leading slash, it would also ignore `packages/core/src/knowledge/` (the TypeScript source files), which caused a CI build failure in v0.2.0. Always use `/knowledge/` not `knowledge/`.
- **Action `dist/` must be committed**: GitHub Actions loads `packages/action/dist/index.js` at runtime. The root `.gitignore` has `dist/` but `!packages/action/dist/` excludes the action dist from that rule. After rebuilding the action (`pnpm --filter @systima/comply-action build`), always commit the updated `packages/action/dist/` files and force-update the `v1` tag.
- **Knowledge path resolution**: the core package uses `packages/core/src/knowledge/resolve-path.ts` to find the knowledge JSON files. It tries multiple candidate paths relative to `__dirname` so it works both in the monorepo and when installed from npm. If you move knowledge files, update this resolver.

## Constraints

- **Zero external service calls**: the scanner must run entirely locally with no API calls, no telemetry, no data exfiltration. This is a hard requirement for enterprise trust.
- **Deterministic output**: given the same codebase and `.systima.yml`, the scanner must produce identical results every time. No LLM calls, no probabilistic analysis.
- **Package size**: keep the npm package reasonable. The `files` field in package.json is set to `["dist", "knowledge"]`.
- The `knowledge/` directory JSON files are the single source of truth for regulatory data and framework patterns. Do not hardcode regulatory logic in TypeScript; reference the JSON.

## Conventional commits

- `feat(scope): summary` — new user-facing behaviour
- `fix(scope): summary` — bug fix
- `refactor(scope): summary` — code changes without behaviour change
- `chore(scope): summary` — maintenance, tooling, deps
- `docs(scope): summary` — documentation only
- `test(scope): summary` — adding or modifying tests
