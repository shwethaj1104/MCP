# ResolveDesk — Banking Dispute Workbench

ResolveDesk is an AI-assisted banking dispute management application. Customers submit transaction disputes, AI gathers evidence through banking tools exposed by an MCP server, and bank reviewers validate the findings before requesting customer consent. Persistent LangGraph checkpoints and case history track each dispute through resolution.

## Key capabilities

- MCP server and banking tools for transaction lookup, duplicate detection, reversal checks, policy retrieval and case evidence.
- LangGraph workflows with persistent human-review and customer-consent checkpoints.
- AI investigation through OpenRouter, with structured report validation and recoverable processing failures.
- Role-specific React dashboards, searchable case queues and paginated transaction views.
- FastAPI backend with SQLite persistence and case audit history.

## Screenshots

### Dashboard

Case metrics, workflow stages and a searchable dispute queue in the monochrome workspace.

![ResolveDesk dashboard with case metrics, workflow stages and dispute queue](Output/1.%20Dashboard.png)

### Banking tool activity

Human-readable banking evidence lets reviewers inspect the tool responses behind an investigation.

![ResolveDesk banking tool activity and investigation evidence](Output/6.%20Tools.png)

## Tech stack

**Frontend:** React, TypeScript, Vite, TanStack Query and CSS animations.  
**Backend:** Python, FastAPI, LangGraph, MCP, OpenRouter, SQLAlchemy and SQLite.  
**Validation:** Pytest, Vitest, ESLint and TypeScript.

## Run locally

Requires Python 3.12+ and Node 22+; execute from this repository root.

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.lock
npm install --prefix apps/web
cp .env.example .env
.venv/bin/alembic upgrade head
.venv/bin/python -m scripts.seed
./scripts/dev.sh
```

Open **http://127.0.0.1:5173**. API documentation: **http://127.0.0.1:8000/docs**.

Create a key at [OpenRouter](https://openrouter.ai/settings/keys), add `OPENROUTER_API_KEY` to `.env`, and keep `OPENROUTER_MODEL=openrouter/free`. Then restart the backend. The old OpenAI configuration and implementation are retained as commented reference and are not used. Without credentials, new disputes remain submitted awaiting configuration. There is no fake AI fallback. Paid model IDs and nonzero-price routes are blocked. Free endpoints are availability- and rate-limited; one investigation can use several model requests.

Optional visual fixtures: `.venv/bin/python -m scripts.seed --fixtures`. These are explicitly labelled, read-only UI previews, not completed AI analyses.

## Checks

```sh
.venv/bin/python -m pytest -q
npm test --prefix apps/web
npm run build --prefix apps/web
npm run lint --prefix apps/web
```

## Important boundaries

- Demo identity switching deliberately allows impersonation; this is **not production authentication**. Bind to loopback only.
- All banking data, policies and credits are fictional. No real funds move.
- Customer consent and bank approval are separate, versioned actions.
- SQLite stores application data and LangGraph checkpoints; no other database is required.
- Text evidence only in this version; notifications are portal activity records.

See [the project guide](docs/PROJECT_GUIDE.md) for architecture, workflow, tools, design, limitations, and **test data walkthroughs in the final section**.
