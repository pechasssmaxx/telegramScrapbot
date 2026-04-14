# Roadmap: Telegram Digest Bot MVP

## Overview

This roadmap takes the project from an empty repo to a locally runnable Telegram digest bot that can be demonstrated end-to-end for the assignment. The work starts with runtime foundation and channel persistence, then adds the command surface, then solves channel reading and validation, then integrates LLM digest generation, and finally packages the submission assets needed for evaluation.

## Phases

- [ ] **Phase 1: Foundation Setup** - Establish project structure, runtime, persistence, Docker Compose, and configuration plumbing.
- [ ] **Phase 2: Bot Command Surface** - Implement Telegram bot commands for greeting and channel management.
- [ ] **Phase 3: Channel Ingestion** - Read recent posts from public channels and handle access failures cleanly.
- [ ] **Phase 4: Digest Generation** - Build the LLM-powered summarization flow and return digest results to the user.
- [ ] **Phase 5: Submission Packaging** - Finish README, business write-up, and a polished demo-ready local workflow.

## Phase Details

### Phase 1: Foundation Setup
**Goal**: Create a clean, extensible service skeleton that runs locally through Docker Compose and persists tracked channels.
**Depends on**: Nothing (first phase)
**Requirements**: [RUN-01, RUN-02, RUN-03]
**Success Criteria** (what must be TRUE):
  1. Project boots through Docker Compose with clearly defined environment variables.
  2. Application has a maintainable module structure for bot, Telegram reading, LLM integration, and storage.
  3. Local persistence survives restarts and is easy to inspect during debugging.
**Plans**: 3 plans

Plans:
- [ ] 01-01: Initialize codebase, dependency management, and configuration loading.
- [ ] 01-02: Implement local persistence schema and repository layer for tracked channels and sessions.
- [ ] 01-03: Add Docker Compose, container entrypoints, and baseline runtime validation.

### Phase 2: Bot Command Surface
**Goal**: Deliver the command UX for starting the bot and managing tracked channels.
**Depends on**: Phase 1
**Requirements**: [BOT-01, BOT-02, CHAN-01, CHAN-02, CHAN-03, CHAN-04, CHAN-05, ACCS-03]
**Success Criteria** (what must be TRUE):
  1. User can talk to the bot in Telegram and get a friendly `/start` response.
  2. User can add, list, and remove channels using the exact input forms required by the assignment.
  3. Invalid commands and empty-state cases return understandable guidance instead of crashes.
**Plans**: 3 plans

Plans:
- [ ] 02-01: Wire Telegram bot framework, command routing, and response helpers.
- [ ] 02-02: Implement normalized add/list/remove flows backed by local persistence.
- [ ] 02-03: Add command validation, duplicate handling, and user-facing error messages.

### Phase 3: Channel Ingestion
**Goal**: Fetch recent messages from tracked public channels in a way that is robust enough for the assignment demo.
**Depends on**: Phase 2
**Requirements**: [ACCS-01, ACCS-02, DIG-01, DIG-02, DIG-03]
**Success Criteria** (what must be TRUE):
  1. The system can resolve tracked channels and fetch posts from the last 24 hours.
  2. Missing, private, or inaccessible channels are reported clearly without breaking the whole digest run.
  3. Source metadata is preserved so later summaries can link back to original posts.
**Plans**: 3 plans

Plans:
- [ ] 03-01: Integrate Telegram channel-reading client and session handling.
- [ ] 03-02: Build recent-post collection pipeline with time filtering and normalization.
- [ ] 03-03: Add partial-failure handling and diagnostics for inaccessible channels.

### Phase 4: Digest Generation
**Goal**: Turn recent channel posts into a concise Telegram digest using an LLM with safe fallback behavior.
**Depends on**: Phase 3
**Requirements**: [DIG-04, LLM-01, LLM-02, LLM-03]
**Success Criteria** (what must be TRUE):
  1. `/digest` produces a readable top-5 summary based on the last 24 hours of posts.
  2. Each digest topic includes a title, short description, and original-post link.
  3. Oversized input is trimmed or chunked gracefully, and the user gets a clear message when limits are hit.
**Plans**: 3 plans

Plans:
- [ ] 04-01: Define digest prompt contract, input packing, and post-to-source mapping.
- [ ] 04-02: Integrate LLM client and response parsing into bot output.
- [ ] 04-03: Add overflow mitigation, retries, and end-to-end digest command handling.

### Phase 5: Submission Packaging
**Goal**: Make the MVP easy to evaluate, explain, and demo.
**Depends on**: Phase 4
**Requirements**: [SUB-01, SUB-02, SUB-03]
**Success Criteria** (what must be TRUE):
  1. README lets an evaluator launch and test the bot locally without guesswork.
  2. Repository includes the required one-page business/cost write-up.
  3. Demo steps are polished enough to support a short recording with all required commands.
**Plans**: 2 plans

Plans:
- [ ] 05-01: Write submission docs, rationale, limitations, and cost/monetization answers.
- [ ] 05-02: Verify local demo flow, tighten polish, and prepare recording checklist.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Setup | 0/3 | Not started | - |
| 2. Bot Command Surface | 0/3 | Not started | - |
| 3. Channel Ingestion | 0/3 | Not started | - |
| 4. Digest Generation | 0/3 | Not started | - |
| 5. Submission Packaging | 0/2 | Not started | - |
