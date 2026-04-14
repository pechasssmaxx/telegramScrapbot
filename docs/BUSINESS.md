# Business Notes

## 1. Estimated monthly cost for 1 user monitoring 30 channels and running `/digest` once per day

This is a rough MVP estimate, not a production finance model.

### Assumptions

- 30 public channels monitored
- 1 digest request per day
- Average 3-8 relevant posts per channel per day, but only a trimmed subset is sent to the LLM
- Claude Haiku is used for summarization
- Local or very small VPS deployment

### LLM cost

Rough working assumption for one digest:

- Input to LLM: about `40k-80k` tokens after trimming/packing
- Output from LLM: about `800-1,200` tokens

At 30 digests per month, this stays in a low single-digit to low double-digit USD range depending on actual posting volume and the current Anthropic pricing tier. A practical MVP planning estimate is:

- `LLM monthly cost`: about `$3-$12`

If channels are unusually noisy, this can increase quickly unless we add pre-clustering before the model call.

### Hosting cost

For a small always-on bot:

- Small VPS or container host: about `$4-$10 / month`

If run locally on an internal machine, hosting cost can be treated as near-zero incremental cost for the MVP.

### Storage and misc

- Local JSON or SQLite storage: effectively `$0`
- Telegram API usage: `$0` direct platform fee for this MVP flow
- Logs / backups / monitoring: `$0-$2` at this stage, depending on setup

### Total estimate

- Lean local/internal setup: about `$3-$12 / month`
- Small hosted setup: about `$7-$22 / month`

The main cost driver is not bot hosting, but LLM input size.

## 2. Three monetization hypotheses

### Hypothesis A: Competitive intelligence for founders and PMs

- Audience: startup founders, solo operators, product managers
- Need: monitor niche channels, competitor launches, ecosystem chatter, and customer pain points
- Model: subscription, for example `$19-$79 / month` depending on number of tracked channels and digest frequency

### Hypothesis B: Agency and analyst monitoring tool

- Audience: boutique agencies, market researchers, investment analysts
- Need: track many Telegram-native ecosystems without manual scanning
- Model: team plan or analyst seat pricing, for example `$99-$299 / month`

### Hypothesis C: Vertical intelligence product

- Audience: users in specific Telegram-heavy niches such as crypto, OSINT, regional media, or gaming communities
- Need: niche-aware curated digests with higher signal than a generic summarizer
- Model: premium vertical package with templates, saved watches, and historical archive

## 3. First acquisition channel if this were a commercial product

I would start with direct distribution inside Telegram itself.

Why:

- The target users already live there
- Pain is immediate and easy to demonstrate
- A short video or before/after example is enough to show value
- Early adopters can be reached inside founder, analyst, crypto, research, and media-monitoring communities

The first tactic would be:

- a short demo video
- a landing page with a waitlist
- direct outreach into a few relevant Telegram communities and founder/operator chats

This is the fastest path to validate whether users care about “save me from reading 50 channels manually” strongly enough to pay.
