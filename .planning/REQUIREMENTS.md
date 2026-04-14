# Requirements: Telegram Digest Bot MVP

**Defined:** 2026-04-15
**Core Value:** A user can reliably get a useful daily-style digest from many public Telegram channels in a few commands, without manual browsing.

## v1 Requirements

### Bot Basics

- [ ] **BOT-01**: User can start the bot with `/start` and receive a greeting with the available commands.
- [ ] **BOT-02**: Bot validates command arguments and returns clear usage help for malformed `/add` and `/remove` requests.

### Channel Management

- [ ] **CHAN-01**: User can add a public Telegram channel using `@channelname`.
- [ ] **CHAN-02**: User can add a public Telegram channel using `https://t.me/channelname`.
- [ ] **CHAN-03**: Added channels are normalized and stored without duplicates.
- [ ] **CHAN-04**: User can list all currently tracked channels with `/list`.
- [ ] **CHAN-05**: User can remove a tracked channel with `/remove`.

### Channel Access Validation

- [ ] **ACCS-01**: Bot detects and reports when a channel does not exist.
- [ ] **ACCS-02**: Bot detects and reports when a channel is private or inaccessible.
- [ ] **ACCS-03**: Bot reports when `/digest` is requested with an empty tracked-channel list.

### Digest Collection

- [ ] **DIG-01**: `/digest` collects messages from tracked public channels published within the last 24 hours.
- [ ] **DIG-02**: Digest flow skips channels with no recent posts without failing the whole run.
- [ ] **DIG-03**: Digest flow keeps enough source metadata to link each summary item back to an original Telegram post.
- [ ] **DIG-04**: Digest output is delivered back to the user in Telegram as a readable message or message sequence.

### LLM Summarization

- [ ] **LLM-01**: Bot sends recent-post content to an LLM and requests the top 5 most important themes for the period.
- [ ] **LLM-02**: Each digest item contains a one-line title, a 2-3 line explanation, and a source post link.
- [ ] **LLM-03**: Bot handles LLM context or token overflow gracefully and informs the user when summarization input had to be reduced or retried.

### Persistence and Runtime

- [ ] **RUN-01**: Tracked channels and required local state persist across restarts using local storage.
- [ ] **RUN-02**: Project starts locally through Docker Compose with documented environment variables and setup steps.
- [ ] **RUN-03**: Logs and configuration are organized well enough to support manual debugging during evaluation.

### Submission Artifacts

- [ ] **SUB-01**: Repository includes a README with launch steps, library/API choices, LLM choice rationale, known limitations, and next improvements.
- [ ] **SUB-02**: Repository includes a short document covering monthly cost estimate, three monetization hypotheses, and first acquisition channel.
- [ ] **SUB-03**: Repository supports a clear manual demo flow suitable for a 2-minute video.

## v2 Requirements

### Product Expansion

- **EXP-01**: Bot runs scheduled automatic daily digests without manual `/digest`.
- **EXP-02**: Bot supports multiple users with isolated tracked-channel lists.
- **EXP-03**: Bot supports per-user topic preferences or filtering rules.
- **EXP-04**: Bot supports hosted deployment and operational monitoring.

### Digest Quality

- **QLTY-01**: Bot clusters similar posts before LLM summarization to reduce duplicate topics.
- **QLTY-02**: Bot ranks importance using metadata such as reposts, reactions, or keyword boosts.
- **QLTY-03**: Bot stores historical digests for browsing and comparison.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user accounts | Explicitly excluded by the assignment for MVP |
| Automatic scheduler | Deferred to later iteration |
| Cloud database | Local persistence is acceptable for this test |
| Personalized recommendations | Assignment only requires top-5 by LLM importance |
| Full production deployment stack | Local Docker delivery is the main acceptance path |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BOT-01 | Phase 2 | Pending |
| BOT-02 | Phase 2 | Pending |
| CHAN-01 | Phase 2 | Pending |
| CHAN-02 | Phase 2 | Pending |
| CHAN-03 | Phase 2 | Pending |
| CHAN-04 | Phase 2 | Pending |
| CHAN-05 | Phase 2 | Pending |
| ACCS-01 | Phase 3 | Pending |
| ACCS-02 | Phase 3 | Pending |
| ACCS-03 | Phase 2 | Pending |
| DIG-01 | Phase 3 | Pending |
| DIG-02 | Phase 3 | Pending |
| DIG-03 | Phase 3 | Pending |
| DIG-04 | Phase 4 | Pending |
| LLM-01 | Phase 4 | Pending |
| LLM-02 | Phase 4 | Pending |
| LLM-03 | Phase 4 | Pending |
| RUN-01 | Phase 1 | Pending |
| RUN-02 | Phase 1 | Pending |
| RUN-03 | Phase 1 | Pending |
| SUB-01 | Phase 5 | Pending |
| SUB-02 | Phase 5 | Pending |
| SUB-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-04-15*
*Last updated: 2026-04-15 after initial definition*
