# Go Out with Alex 🐰

A playful mobile-first bunny invitation, with a fullscreen prompt, one-time test invite, animated Yes/No responses, optional spoken bunny messages, and a short preference quiz.

This repository is **not yet connected or deployed** to Netlify. A separate project exists at https://app.netlify.com/projects/go-out-with-alex.

## Setup

Netlify: connect this repository to the existing `go-out-with-alex` site. Its `netlify.toml` sets the publish folder to `public` and functions directory to `netlify/functions`.

Run `npm test` to check the invitation unlock function. The demo invite recipient is `Test Girl`; keep the raw password outside Git and replace this temporary test invitation before sharing broadly.

Visitor choices are submitted to Netlify Forms only with consent; declining never submits. Fullscreen is requested when supported, but browsers can refuse; there is a manual fallback.

## Security

Only the SHA-256 digest of the temporary passcode is in `lib/invites.cjs`. For a production-grade gate, add server-side rate limits and store secrets in environment variables. This invitation is intended for low-sensitivity use, not authentication for private data.
