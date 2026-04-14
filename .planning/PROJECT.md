# Telegram Digest Bot MVP

## What This Is

This project is a technical MVP of a Telegram bot that helps one internal user monitor many public Telegram channels without manually checking each one. The bot stores a list of tracked channels, fetches posts from the last 24 hours on demand, and uses an LLM to send back a concise digest of the top 5 most important topics with links to the original posts.

The deliverable is intended for a test assignment, but it should be structured so the MVP can grow into a more production-ready monitoring product later. The primary usage mode is local execution through Docker Compose with a clear README and a repeatable demo flow.

## Core Value

A user can reliably get a useful daily-style digest from many public Telegram channels in a few commands, without manual browsing.

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] Telegram bot responds to `/start` with a clear greeting and usage hints.
- [ ] User can add public channels via `/add @channelname` and `/add https://t.me/channelname`.
- [ ] User can inspect tracked channels via `/list`.
- [ ] User can remove channels via `/remove`.
- [ ] User can trigger `/digest` to collect posts from the last 24 hours and receive an LLM-generated top-5 summary with links.
- [ ] Bot handles key failures gracefully: private channel, unknown channel, empty tracking list, and LLM token/context overflow.
- [ ] Project is runnable locally with Docker Compose and documented for evaluator setup.
- [ ] Submission package includes README, cost/monetization document, and a recorded demo scenario.

### Out of Scope

- Multi-user support - the assignment only requires one user and local state.
- Scheduled automatic digests - the current scope only needs manual `/digest`.
- Cloud database or hosted persistence - local file or SQLite is sufficient for MVP.
- Personalized filtering by user interests - digest is simply the top 5 important themes judged by the LLM.
- Production-grade auth, billing, or admin tooling - not needed for the test assignment.

## Context

The product is an internal monitoring assistant for scanning many niche Telegram channels efficiently. The assignment explicitly values a working artifact over partial architecture, so the project should optimize for dependable end-to-end behavior, ease of local startup, and a convincing manual demo.

The bot must interact with Telegram in two ways: as a bot for commands, and as a reader of public channel content. For a reliable MVP, the likely shape is a bot interface plus a Telegram client session for reading public channels, with local persistence for tracked channels and configuration.

The evaluator wants more than source code. The final repository should include:
- a primary Docker Compose flow,
- a README with setup and rationale,
- a short product/business write-up,
- and a two-minute demonstration video showing real commands and digest output.

The implementation should stay extensible so later iterations can add scheduling, multi-user support, richer ranking logic, and deployment packaging without reworking the whole codebase.

## Constraints

- **Timebox**: MVP-sized implementation in roughly 4-6 hours - scope discipline matters.
- **Execution**: Local-first delivery via Docker Compose - evaluator should be able to start it with minimal setup.
- **Telegram Access**: Must support monitoring public channels, which may require a Telegram client session in addition to a bot token.
- **LLM Cost/Context**: Digest generation must stay within token limits and degrade gracefully when content volume is too large.
- **Single User**: Design can stay simple, but code structure should not block later multi-user expansion.
- **Demoability**: Every critical feature must be testable manually in Telegram for video proof.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build a true end-to-end MVP in this repo | The assignment is judged on a working artifact, not just code sketches | - Pending |
| Optimize for reliable local Docker Compose startup | Local reproducibility is a required submission path | - Pending |
| Keep persistence local and simple | Single-user MVP does not justify cloud infra | - Pending |
| Favor an extensible architecture over a one-file throwaway bot | The user wants this to satisfy the test while remaining expandable | - Pending |
| Treat channel-reading reliability as a first-class concern | `/digest` only matters if we can actually access public channel posts consistently | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check -> still the right priority?
3. Audit Out of Scope -> reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-15 after initialization*
