# Demo Checklist

Use this for the required 2-minute walkthrough video.

## Before recording

- `.env` is filled
- bot is running
- `TELEGRAM_SESSION_STRING` works
- at least 2-3 public channels with recent posts are ready for demo
- `data/` is clean or in a known state

## Recording flow

1. Show the running bot or terminal with the service started.
2. Open Telegram and send `/start`.
3. Add one channel with `@channelname`.
4. Add one channel with `https://t.me/channelname`.
5. Run `/list` and show both tracked channels.
6. Run `/digest`.
7. Wait for digest output and scroll through:
   - top 5 themes
   - short summaries
   - source links
8. Run `/remove` for one tracked channel.
9. Run `/list` again to show removal worked.

## Nice-to-show edge cases

- Try adding a non-existent channel
- Try a private/inaccessible channel
- Show `/digest` on an empty list in a clean state

## What evaluators should clearly see

- All 5 required commands work
- The digest is based on real Telegram posts
- The result includes source links
- You tested the product manually, not just wrote code
