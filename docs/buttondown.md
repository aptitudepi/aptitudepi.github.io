# Buttondown RSS-to-email bridge (no backend)

Blog emails are rented, not built (PLAN-BLOG.md G5.3): our hand-rolled
`blog/rss.xml` feeds a Buttondown RSS-to-email automation on the free tier.
Zero own code, zero subscriber DB to run — Buttondown hosts subs/sends, the
canonical post URL stays ours.

- Feed: `https://dvxb.io/blog/rss.xml` (full text via `content:encoded`,
  absolute URLs, RFC-822 dates; gated by `npm run assert:rss` in CI).
- Owner setup (one time, dashboard only):
  1. Free Buttondown account → create newsletter.
  2. New automation from RSS feed: source `https://dvxb.io/blog/rss.xml`,
     cadence daily (Buttondown polls; no webhooks to maintain).
  3. Mode: **create draft** (not send immediately) — review every issue
     before it goes out.
  4. Enable canonical-URL passthrough so SEO points at the `dvxb.io` post,
     not the email copy.
- Web version of each email: the Buttondown archive URL per send (public
  visibility) — plus the canonical post itself, which is the source of truth.
- Safety by construction: drafts/future posts are excluded from `rss.xml`
  (build-blog.mjs builds the feed from published posts only), so unlisted
  previews can never trigger an email.
- First real post is an owner action: publish `posts/<slug>.md`, watch CI go
  green, then approve the drafted Buttondown issue.

Out of scope (phase-2-optional, needs a Worker): referral counting (`/r` +
KV), subscribe-box-without-third-party. Paywalls never (static + no-auth).
