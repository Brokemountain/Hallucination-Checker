# AGENTS.md

## Scope

This file is a backend-only project resume for future agents working on LegalCheck. It intentionally does not describe any UI work.

## Backend Objective

LegalCheck is currently structured as a legal citation-review backend with these responsibilities:

- create review sessions from uploaded document text
- extract candidate citations from each document
- verify whether authorities appear real or structurally plausible
- review whether a cited authority appears to support the draft proposition
- generate export artifacts from the session state

The engine is deterministic today and uses curated in-repo logic rather than external legal providers. The product direction is open source, open access, and BYOK: users should be able to use the website with their own provider key instead of relying on a hosted account gate or shared platform secret.

## Current Backend Architecture

### Entry points

All route handlers run in the Node.js runtime and live under `app/api/`.

- `GET /api/legal-review/capabilities`
- `POST /api/review-sessions`
- `GET /api/review-sessions/demo`
- `POST /api/review-sessions/upload`
- `GET /api/review-sessions/[sessionId]`
- `POST /api/review-sessions/[sessionId]/verify`
- `POST /api/review-sessions/[sessionId]/support`
- `POST /api/review-sessions/[sessionId]/export`

### Core modules

- `lib/legal-review/contracts.ts`
  Defines the backend data model:
  `ReviewSession`, `ReviewDocument`, `CitationRecord`, `ReviewMetrics`, `ReviewCapability`, `ExportRequest`, and related enums.

- `lib/legal-review/schema.ts`
  Validates JSON payloads with Zod.
  Current request schemas:
  `createReviewSessionSchema`, `scopedActionSchema`, `exportRequestSchema`.

- `lib/legal-review/errors.ts`
  Defines `LegalReviewError` and `toErrorResponse()` for normalized API failures.

- `lib/legal-review/extractor.ts`
  Performs citation draft extraction from document text.
  This is the first backend stage after intake.

- `lib/legal-review/knowledge-base.ts`
  Holds curated authority profiles used by the verification and support-review passes.
  This is the current substitute for live provider integrations.

- `lib/legal-review/service.ts`
  Main backend orchestration layer.
  Responsibilities include:
  session creation, demo-session bootstrapping, verification, support review, export generation, metrics, summaries, and in-memory storage.

- `lib/legal-review/utils.ts`
  Shared backend helpers including normalization, overlap scoring, relative time labels, and slug generation.

## Data Flow

### 1. Session creation

`POST /api/review-sessions`

Input:

- `matterName`
- optional `owner`
- `documents[]` with `name`, `format`, and raw `text`

Processing:

1. Validate payload with `createReviewSessionSchema`.
2. Extract citation drafts from each document.
3. Convert each draft into a pending `CitationRecord`.
4. Build a `ReviewSession`.
5. Store it in the in-memory global store.

Output:

- newly created session with pending citations

### 1a. Upload intake

`POST /api/review-sessions/upload`

Input:

- multipart `matterName`
- optional `owner`
- optional `notes`
- `files[]` for PDF, DOCX, TXT, Markdown, or HTML

Processing:

1. Validate file count and upload size.
2. Extract text server-side from TXT/Markdown/HTML/DOCX/PDF where possible.
3. Add pasted notes as a text document when present.
4. Create a normal review session through `createReviewSession()`.

Output:

- newly created session with pending citations

### 2. Authority verification

`POST /api/review-sessions/[sessionId]/verify`

Optional payload:

- `documentId`

Processing:

1. Validate payload with `scopedActionSchema`.
2. Load session from the in-memory store.
3. For each targeted citation, run `verifyCitation()`.
4. Use curated authority profiles when available.
5. Fall back to structural heuristics for statutes, rules, public laws, and case-like strings.
6. Recompute summaries, timestamps, metrics, and phase.

Possible authority states:

- `verified`
- `warning`
- `not_found`

### 3. Support review

`POST /api/review-sessions/[sessionId]/support`

Optional payload:

- `documentId`

Processing:

1. Validate payload with `scopedActionSchema`.
2. Load session.
3. For each targeted citation, run `reviewSupport()`.
4. Prefer curated profile support data when available.
5. Otherwise use overlap scoring between the memo claim and available holding/excerpt text.
6. Recompute metrics and phase.

Possible support verdicts:

- `supported`
- `partial`
- `unsupported`

### 4. Export generation

`POST /api/review-sessions/[sessionId]/export`

Payload:

- `format`: `html | csv | json`
- optional `documentId`

Processing:

1. Validate payload with `exportRequestSchema`.
2. Load session.
3. Mark phase as `export_ready`.
4. Build artifact content using:
   - `buildHtmlReport()`
   - `buildCsvReport()`
   - JSON serialization fallback

Output:

- `{ session, artifact }`

## Storage Model

Storage is currently in-memory only.

`service.ts` uses a process-level global store:

- `sessions: Map<string, StoredReviewSession>`
- `aliases: Map<string, string>`

Important implications:

- data resets when the server restarts
- no persistence across deployments
- no multi-instance safety
- no concurrency control
- suitable only for local development and deterministic demos

## Demo Session

`GET /api/review-sessions/demo`

The demo endpoint is a bootstrap helper that:

1. creates a sample session from hardcoded documents if no demo alias exists
2. immediately runs verification
3. immediately runs support review
4. returns the hydrated session

The current demo alias is versioned in `service.ts` to force regeneration when demo behavior changes.

## Metrics and Risk Model

Metrics are recomputed after every state-changing action.

Tracked counts include:

- total documents
- total citations
- verified / warning / not found
- supported / partial / unsupported
- readiness score

Risk is derived from authority status and support verdict:

- `critical` for `not_found` or `unsupported`
- `high` for `warning` or `partial`
- `low` for `verified` plus `supported`
- otherwise `medium`

## Validation and Error Handling

### Validation

All JSON bodies are parsed through `parseJsonBody()` in `schema.ts`.

Validation guarantees:

- typed input shape
- bounded string sizes
- bounded document count
- normalized 400 responses for bad requests

### Errors

Known structured error patterns include:

- `INVALID_JSON`
- `INVALID_REQUEST`
- `SESSION_NOT_FOUND`
- `DOCUMENT_NOT_FOUND`

Unhandled failures are returned as:

- `INTERNAL_ERROR`

## Current Limitations

The backend is functional but still prototype-grade in several ways:

- no database
- no authentication or authorization
- no background jobs
- upload intake exists for PDF, DOCX, TXT, Markdown, HTML, and pasted text, but it is not yet backed by durable file storage
- no provider integrations yet for CourtListener, Cornell LII, GovInfo, or PACER-like sources
- no LLM-backed proposition analysis
- BYOK keys are currently captured in the browser UI but are not yet consumed by backend provider adapters
- no persistent audit log beyond the exported artifact content
- no rate limiting, tracing, or structured observability

## Recommended Backend Priorities

### Priority 1

- add durable persistence for sessions, documents, citations, and exports
- separate transient demo logic from real session storage
- add request logging and basic observability

### Priority 2

- integrate authoritative legal-source providers
- replace heuristic-only verification with provider-backed source resolution
- store provider evidence and citation provenance in a structured way
- wire BYOK provider keys into source resolution and model-backed proposition analysis without hardcoding global secrets

### Priority 3

- add async job orchestration for long-running review passes
- split extraction, verification, support review, and export into explicit pipeline stages
- support partial reruns and job history per document

### Priority 4

- add team-safe auth and permissions
- support matter ownership, reviewer identity, and audit history
- persist manual overrides to authority/support decisions

## Backend Conventions For Future Agents

- keep `contracts.ts` as the canonical source for API-facing shapes
- add new request schemas in `schema.ts` before extending routes
- prefer extending `service.ts` orchestration behind stable route handlers
- use `LegalReviewError` for expected operational failures
- preserve deterministic demo behavior unless intentionally changing the sample
- avoid mixing provider-specific parsing logic directly into route handlers

## Minimal Backend Verification

Use these checks after backend changes:

- `npm run typecheck`
- `npm run build`
- `GET /api/legal-review/capabilities`
- `GET /api/review-sessions/demo`
- create a session through `POST /api/review-sessions`
- run `verify`, `support`, and `export` on a real session id

## Short Resume

Today's backend is a typed, deterministic legal-review engine with route handlers, validation, error normalization, an in-memory session store, curated authority knowledge, heuristic support review, and export generation. The next serious backend step is persistence plus provider-backed verification.
