# yu-core roadmap

This is a lightweight DDD core library (`@yu/core`). The goal is to keep it **small, stable, and boring**.

## P0 — Make the repo “green” and publishable

### 1) Fix dev setup + CI
- [ ] Ensure `npm i && npm test` works on a clean machine
  - Add missing dev deps (e.g. `@tsconfig/node-lts`)
  - Keep Vitest config compatible with current Vitest
- [ ] Add GitHub Actions CI (lint + test + build)

### 2) Packaging correctness
- [ ] Confirm `npm run build` produces `dist/**` matching `exports`
- [ ] Add `files` field (publish only `dist`, `README`, `LICENSE`)
- [ ] Add `prepack` script: build before publish
- [ ] Decide publish flow: manual `npm publish` or release-triggered GH Action

### 3) Versioning policy
- [ ] Document 0.x breaking policy (expect breaks)
- [ ] Tag releases + changelog entries (even if minimal)

## P1 — Fill missing modules + docs

### 4) Event-sourcing module (currently placeholder)
- [ ] Replace `src/event-sourcing/index.ts` placeholder with real primitives
  - candidates: `EventStore` interface, `EventStream`, `Replay`, `Snapshot` types
  - keep minimal; no storage implementation required
- [ ] Add tests + doc page under `doc/`

### 5) Docs improvements
- [ ] Expand `/doc` into a small “concepts” set:
  - Command + DomainEvent conventions
  - Event bus patterns (error channel usage)
  - AggregateRoot usage (record/pull)
  - Patch semantics

## P2 — Ergonomics + hardening

### 6) Stronger typing patterns
- [ ] Consider making `_tag` a generic literal type (`Command<Tag, Payload>`)
- [ ] Provide helpers for tag unions + matchers

### 7) Observability hooks
- [ ] EventBus: optional middleware hooks (before/after handler)
- [ ] More structured tracing metadata conventions (without adding heavy deps)

## P3 — Optional expansions (only if needed)

### 8) Snapshotting utilities
- [ ] Optional snapshot helpers for event streams

### 9) Runtime adapters
- [ ] Optional adapters for popular runtimes (e.g. Effect) kept in separate packages
