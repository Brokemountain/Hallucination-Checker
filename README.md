# LegalCheck

LegalCheck is an open source, open access legal citation-review project built with Next.js. The product is shaped around one core idea: any user should be able to open the website, bring their own provider key (BYOK), verify authority, review proposition support, and generate circulation-ready packets from one review engine.

The current backend is deterministic and does not require an external provider key for the demo flow. The BYOK surface is in place for the user-controlled provider model, and provider-backed review adapters are the next integration step.

## What is in this workspace

- `app/`: App Router pages, route handlers, and the global visual system
- `components/workspace-showcase.tsx`: the live review console for matters, citations, support review, and packet previews
- `lib/legal-review/`: typed contracts, citation extraction, review logic, and export composition
- `app/api/review-sessions/*`: session creation, verification, support review, and export endpoints that power the product
- `app/api/review-sessions/upload`: multipart upload intake for PDF, DOCX, TXT, Markdown, HTML, and pasted text

## Current product scope

- grayscale tool workbench with an open-access BYOK path
- client-side BYOK setup panel for user-supplied provider keys
- file-drop review intake for users who want to upload drafts directly
- live matter workspace with citation queues and legal review states
- authority verification and proposition support review
- HTML, CSV, and JSON packet generation
- responsive layouts for desktop, tablet, and mobile

## BYOK model

- no hosted account gate
- no shared platform key requirement
- users bring their own provider key
- current key entry is stored in the user's browser
- future provider adapters should consume user-supplied keys without hardcoding project-wide secrets

## License

LegalCheck is released under the MIT License. See `LICENSE`.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Backend verification

```bash
npm run typecheck
npm run build
npm run smoke:backend
```

The smoke check starts a temporary Next.js dev server and exercises capabilities, demo loading, session creation, verification, support review, scoped exports, and scoped error handling.
