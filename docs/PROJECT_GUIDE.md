# ResolveDesk project guide

## 1. Product and implementation plan

ResolveDesk demonstrates banking transaction dispute handling beyond a chatbot. Customers submit a simple form; an AI investigator retrieves evidence through our custom MCP server; a bank employee approves a report or requests reanalysis. The customer explicitly accepts or disputes the bank-approved resolution.

Implementation milestones: establish the visual workbench and domain schema; connect customer/reviewer APIs; implement MCP tools; connect OpenRouter and LangGraph persistence; implement consent and simulated settlement; validate access boundaries, persistence, build and documentation.

This is a local demonstration with production-oriented organization and interface design. Production deployment still requires authenticated identities, hardened authorization, deployment operations, and integration with a bank's actual dispute policies. Do not expose the demo identity API to a network.

## 2. Architecture and responsibilities

```text
React interface (5173)
    ↓ HTTP /api with selected demo identity
FastAPI host (8000)
    ├── SQLite application records and durable job queue
    └── LangGraph + SQLite checkpoints
          ├── OpenRouter Chat Completions API
          ├── MCP client → stdio child → our banking MCP tools → SQLite
          ├── bank-review interrupt
          └── customer-response interrupt
```

- `apps/web`: React/TypeScript UI, reusable design tokens, queries and interactions.
- `apps/host`: HTTP boundaries, durable job worker, graph and model orchestration.
- `apps/banking_mcp`: six read-only evidence tools exposed via the official MCP SDK.
- `packages`: shared SQLAlchemy records and seed initialization.
- `migrations`: Alembic schema baseline.
- `scripts`: seed/reset and local startup commands.
- `tests`: behavior-level tests, including graph checkpoint restoration.
- `data`: runtime SQLite files, ignored by Git.

Application SQLite and workflow SQLite are separate files of the same database technology. Application data uses WAL mode, foreign-key enforcement and lock timeouts. Use one Uvicorn process; the durable worker is deliberately single-consumer. Do not start multiple host workers against this demo queue.

Every authored function has a one-line purpose comment or docstring. Components use semantic names; UI behavior and backend state checks are kept separate. Tool evidence never determines authorization.

## 3. Local setup and configuration

Follow the README commands from the repository root. `scripts/dev.sh` initializes synthetic records and starts both local services. The Vite server proxies `/api` to FastAPI.

Configuration:

| Variable | Meaning |
| --- | --- |
| OPENROUTER_API_KEY | Server-side OpenRouter key; create it at https://openrouter.ai/settings/keys |
| OPENROUTER_MODEL | Default openrouter/free; only this router or model IDs ending in :free are allowed |
| DATABASE_URL | SQLite SQLAlchemy URL; default sqlite:///data/banking.db |
| CHECKPOINT_DB_PATH | LangGraph SQLite file; default data/checkpoints.db |

The OpenRouter credential is optional for viewing the application but required to execute analysis. Previous OpenAI settings in .env are commented and ignored; the original OpenAI Responses function is retained as comments in apps/host/openai_reference.py. The active client is pinned to https://openrouter.ai/api/v1 and never falls back to an OpenAI credential. Restart the backend after changing `.env`. An unconfigured deployment keeps new jobs queued and marks this visibly. No model request is sent by UI fixtures.

Run migrations before startup for versioned schema management. Startup also creates missing baseline tables for a convenient local demo. Future schema changes must add migrations rather than relying on `create_all`.

Optional UI preview: run `.venv/bin/python -m scripts.seed --fixtures`. Fixture cases are read-only because they have no LangGraph thread. They are clearly labelled static examples. New submissions use the real graph exclusively.

## 4. Workflow and human review

| Status | Entry / responsible actor |
| --- | --- |
| Submitted | Customer form saved and job queued |
| AI Review in Progress | Worker begins evidence gathering |
| Under Bank Review | Report saved; graph pauses for reviewer |
| Awaiting Customer Consent | Reviewer approves a proposal or sends an information request |
| Resolution Pending | Customer accepts the approved resolution |
| Closed | Simulated resolution and portal notification recorded |

Reviewer actions: **Approve & send**, **Rerun analysis**, **Request information**. Approval previews the exact report explanation and amount. Rerun and information requests require explanatory feedback. Prior reports and feedback remain in case history.

Customer actions: **Accept resolution**, **Disagree & explain**, or **Send information**, depending on the request type. Information submission is never treated as consent. Disagreement and new evidence return to the reviewer, who can approve again or rerun analysis. Information requests retain the agreed six-status model but are explicitly labelled in the response panel.

Final outcome is distinct from status: Approved, Partially Approved or Rejected. All amounts use integer minor units. A rejected outcome must propose zero credit; no credit may exceed the transaction or credit an already reversed charge.

LangGraph calls `interrupt()` in dedicated review and customer nodes, using each dispute ID as the stable thread ID. HTTP decisions enqueue `Command(resume=...)`; the worker resumes the same persisted graph. Customer consent records refer to the exact proposal version. SQLite transactions and expected versions reject stale or duplicate clicks.

Resolution writes use a unique case key. Retrying cannot insert a second credit. The demo completes resolution immediately, so Resolution Pending may be brief. No external payment request or real email is sent.

## 5. MCP tools and model execution

| Tool | Purpose |
| --- | --- |
| get_transaction_details | Retrieve scoped transaction amount, merchant, date and reversal state |
| get_related_transactions | Find transactions for the same customer and merchant |
| find_possible_duplicates | Identify same-day, same-amount candidate matches; not proof of fraud |
| get_existing_reversals | Detect an already reversed charge |
| get_dispute_policy | Retrieve a fictional demo policy |
| get_case_evidence | Retrieve statement and customer-provided evidence |

The host starts our MCP server as a child process using stdio. It discovers tool schemas, exposes their function descriptions to the OpenRouter model, and executes model requests through `ClientSession.call_tool`. Tool arguments containing customer/case/transaction IDs are bound to the current dispute context by the host.

Every report requires transaction, reversal, policy and case evidence checks; duplicate disputes also require a duplicate check. Tool selection and report generation are separate phases. If a model skips native tool calls, the workflow retrieves the remaining required evidence through MCP. Each tool executes at most once per investigation, with at most six selection turns and two report requests. The entire investigation has a four-minute deadline. Tool outputs and customer input are untrusted evidence, not instructions. Structured report validation checks outcome and amount. A banking tool failure is surfaced rather than silently treated as a successful check.

Model reports contain summary, evidence references, completed checks, missing information, recommended outcome, proposed amount and customer-facing explanation. The outcome uses a closed enum, the schema forbids extra properties, and the report phase requests strict structured output without tools. Tool-selection requests require function calls without a competing JSON report format. Routing requires parameter support and sets a maximum prompt/completion price of zero. One format-repair attempt is allowed. Actual approvals, consent and settlement remain backend actions unavailable to the model.

## 6. HTTP interfaces and records

- `GET /api/health`: model readiness and demo mode information, without secrets.
- `GET /api/identities`: seeded customer/reviewer identities.
- `GET /api/accounts`: account references within the selected identity.
- `GET /api/transactions`: selected customer's transactions, or reviewer explorer.
- `GET/POST /api/cases`: list disputes or submit a new claim.
- `GET /api/cases/{id}`: case, permitted history and transaction.
- `POST /api/cases/{id}/actions`: versioned human action or failed-operation retry.

Local identity selection uses `X-Identity`. This header is an intentional demo affordance, not authentication. APIs still enforce role and ownership for the selected identity. Unknown identities are rejected; inaccessible cases return 404. Customer API responses omit internal AI reports and tool traces until an approved proposal is present in history.

Action input: `{action, version, feedback}`. The allowed action values are approve, rerun, request_information, accept, disagree, provide_information, retry. Mutations check expected version and active jobs in an immediate SQLite transaction.

SQLite records: identities, transactions, cases, append-only history records (reports/tool results/evidence/proposals/consent/audits), jobs, unique resolutions. Accounts are represented by account IDs on seeded transactions rather than a separate account-management subsystem. Policies are static fictional tool content in v1.

## 7. UI design and animation

The application uses a monochrome operations design: charcoal navigation, white work surfaces and neutral gray details. See [the design reference map](DESIGN.md) for element-level Dribbble inspiration, palette, motion and follow-up refinements.

The overview uses four selectable metric cards as its single filter area and a read-only horizontal six-stage workflow journey with case counts. Selected cards use a light charcoal surface. AI-review attention appears beside the workflow heading. The queue places search beside Refresh and includes CSV export, merchant/case details and pagination with 5, 10, 20 or 50 rows. Search, identity, filter and page-size changes reset pagination; page boundaries clamp when records disappear. The page-size menu stays synchronized after navigating away and returning. Transaction explorer and case register share dashboard typography, compact spacing, the search component and shared pagination controls. Transaction status filters use a light charcoal selected surface. The full-width case register shows actual submissions in descending date order with Dubai timestamps and current statuses; promotional sidebar copy is removed. Investigation groups the return button, title, status and transaction context in one header. A compact Case history panel records actual case events. See the Banking tool activity popup for human-readable source evidence.

Animations cover counters, panel entrances, hover feedback, dialogs and decorative evidence illustrations. Reduced-motion preferences remove nonessential motion. There are no fabricated analytics or artificial investigation delays. All charts and operational counts use application records.

### Tool evidence and operational controls

Banking tool activity is a bank-reviewer-only popup beside the case status. The status is non-interactive; Retry processing and Banking tool activity are distinct primary buttons. Transaction results use labelled facts with formatted currency/dates and Yes/No flags. Duplicate candidates use a comparison table and an explicit possible-match note. Policies, statements and customer responses use readable text sections. Individual runs and timestamps remain accessible; MCP transport wrappers are decoded, not shown as escaped JSON.

Workflow errors appear once in a dismissible top-right toast and remain in the audit history. Nested task-group errors are classified into safe, actionable provider, connection, quota or report-format messages without exposing credentials or raw provider bodies.

The API exposes processing_state, ai_review_state and display_status. AI Review Failed, AI Review Queued, AI Setup Required and AI Review in Progress share the existing AI step; no extra workflow stage is added. Failures are persisted as failed and only a claimed running job is described as in progress. Retry clears the failure and queues work; it does not claim that work has started. Non-analysis failures, such as settlement errors, retain their own business stage. The API exposes processing_state. The frontend polls only queued/running jobs, stops immediately on failure or a human checkpoint, and caps each case/version watch at five minutes. The queue does not poll while a case is open. Health and identity APIs have no interval timers; background-tab polling and focus-triggered duplicate fetches are disabled. Use Refresh to retrieve changes from another session or restart an expired watch.

Free model limits are provider-controlled: consult https://openrouter.ai/docs/guides/routing/routers/free-router and https://openrouter.ai/pricing. At implementation, the free tier lists 20 requests/minute and 50 requests/day without purchased credits. Failed requests can count toward limits. No paid-model fallback is enabled.

## 8. Failure handling, checks and limitations

- Errors retain the dispute and failed job. Reviewer retry requeues that same operation.
- Restart changes running jobs back to queued and uses the graph checkpoint to continue work. Human resume payloads are versioned so a consumed decision is not submitted a second time.
- Tool traces and audit history expose workflow activity; exceptions shown to the customer do not include credentials or raw model requests.
- Missing configuration is not a synthetic report or a failed dispute outcome.
- Run pytest for authorization, versioned approval, consent separation, tool checks and persistence. Run the frontend production build and lint checks.
- Test data is synthetic. Policies are not legal, network or bank policy advice. Text evidence only; PDF/image parsing is outside v1.
- SQLite is appropriate for this local single-worker application. Horizontal scaling and production authentication are outside this implementation.
- Live OpenRouter behavior requires a user-provided key and is not verified by unit tests. Tests may replace the model with a deterministic stub; the application does not contain an offline analysis mode.

### Implementation verification

- Backend: 20 behavioral tests passed, including real MCP stdio discovery/execution, durable interrupt restoration, scoped model-selected checks, the required-check fallback when a model omits tool calls, and the complete worker flow with a test-only model stub.
- Frontend: 25 tests passed across API boundaries, aggregate views, transaction rendering, case-header context and CSV safety; ESLint and TypeScript/production build passed.
- Migration and seed commands completed; local API health, account list, case list and dashboard returned HTTP 200.
- Frontend dependency audit reported zero known vulnerabilities after updating build tooling.
- The former OpenAI report-validation failure was reproduced with synthetic data and its strict-schema fix was verified. The OpenRouter evidence/report phase separation completed a live test against an isolated fictional case with six real MCP tool calls and a valid report. Local request-contract tests also verify both native tool selection and the required-check fallback. Existing user disputes were not replayed during verification. The browser inspection host was unavailable, so visual/browser acceptance is still outstanding.
- `requirements.lock` records the verified Python environment; `package-lock.json` records frontend dependency versions. Use the lock file for repeatable installs on this local platform.

## 9. Test Data and Walkthroughs

### Demo identities

| Identity | Name | Use |
| --- | --- | --- |
| customer-1 | Shwetha J | Submit and respond to ACC-001 disputes |
| customer-2 | Omar Khalid | Ownership/isolation checks using ACC-002 |
| reviewer-1 | Shwetha | Review, approve, rerun and retry |

Choose identities with the header dropdown; no password is required in this intentionally local demo.

### Seed transactions

| Transaction | Merchant | Amount | Scenario |
| --- | --- | --- | --- |
| TX-1001 | Studio Supply | AED 485.00 | Possible duplicate of TX-1002 |
| TX-1002 | Studio Supply | AED 485.00 | Same merchant/date/amount candidate |
| TX-1003 | Cloudline Travel | AED 1,290.00 | Already reversed; no second credit |
| TX-1004 | North Coffee | AED 28.00 | Ordinary transaction / missing evidence |
| TX-1005 | Maison Home | AED 720.00 | Partial-resolution investigation |
| TX-2001 | Harbour Market | AED 150.00 | Omar's transaction, inaccessible to Shwetha J |

### Walkthrough A — complete dispute

1. Configure OpenRouter and restart the backend.
2. Select Shwetha J, open Transactions, then raise a dispute for TX-1001.
3. Select Duplicate charge; enter “Studio Supply charged the same purchase twice on 21 November.”
4. Submit. Observe Submitted → AI Review in Progress.
5. Select Shwetha; open the new case. Tool activity and report appear, followed by Under Bank Review.
6. Inspect evidence. Click Approve & send; review the exact proposal and confirm.
7. Select Shwetha J; open the case and accept the resolution.
8. Confirm Closed, the recorded outcome and the simulated-resolution history. Amounts and recommendations are model outputs constrained by evidence, not guaranteed fixture assertions.

### Walkthrough B — reviewer reanalysis

On an Under Bank Review case, enter “Check whether the original charge has already been reversed; cite the reversal check.” Click Rerun analysis. Verify a new report and tool history, followed by a fresh human pause. Older report versions remain visible.

### Walkthrough C — customer disagreement

Approve a proposal, switch to Shwetha J and disagree with “The proposed amount does not match my receipt; please investigate again.” Verify return to Under Bank Review. Shwetha chooses whether to rerun or resend a proposal; there is no automatic acceptance.

### Walkthrough D — missing information

Shwetha enters “Please provide the merchant receipt and the amount you expected to pay.” Choose Request information. Shwetha J sees an information form rather than consent buttons. Submit receipt text; verify return to the reviewer without a credit or consent record.

### Walkthrough E — already reversed / partial proposal

Submit TX-1003 with reason Charge already reversed; inspect evidence showing its reversal and zero allowable proposed credit. Submit TX-1005 with Incorrect amount and explain that only AED 360.00 was authorized; include fictional receipt text. Inspect the model's evidence-supported recommendation before approving.

### Walkthrough F — no key, errors and access

With no OpenRouter key, submit a dispute and confirm it waits for configuration with a header setup indicator. Add the key and restart to process it. For a deliberately invalid model name, observe a processing error, restore configuration, restart and retry as Shwetha. Switch to Omar and confirm Shwetha J's cases and transactions disappear.

### Optional visual fixtures and reset

`.venv/bin/python -m scripts.seed --fixtures` adds FIXTURE-001 (duplicate), FIXTURE-002 (reversed) and FIXTURE-003 (closed partial outcome). They are read-only layout examples, visibly labelled and not generated by AI.

To reset only this project's local synthetic database, stop both services and run:

```sh
.venv/bin/python -m scripts.seed --reset-local-demo --fixtures
```

This removes local cases and graph checkpoints. It does not contact a bank, call a model provider, or alter external data. Restart the services afterward. Back up local data first if you want to retain your demonstration history.
