# Go Out with Alex 🐰

A mobile-friendly invitation hosted on Netlify: a fullscreen welcome, invitation password, animated talking bunny, expressive Yes/No buttons, and an optional mini-quiz about going out with Alex.

## Current setup

- GitHub source: https://github.com/dn-lx/go-out-with-alex.
- Netlify project: https://app.netlify.com/projects/go-out-with-alex
- **Status: GitHub source is uploaded; the Netlify project still requires a Git connection and a successful deploy.**
- Temporary recipient name: **Test Girl**
- Temporary invitation ID: `test-invite`
- The demo password is shared privately with the owner and **must never appear in this Git repository**.
- Nothing in PageChime, BailaCue, or Lexora has been changed.

## Publish on Netlify

1. In the existing Netlify project's **Build & deploy / Continuous deployment** settings, choose **Link repository**.
2. Select GitHub and find `dn-lx/go-out-with-alex.`. Note the repository accidentally has a **trailing dot**. If you rename it in GitHub Settings to `go-out-with-alex`, choose the renamed version.
3. Use branch `main`, publish directory `public`, and function directory `netlify/functions` (declared in `netlify.toml`). No build command is required for the static HTML.
4. Deploy, then open `https://go-out-with-alex.netlify.app`.
5. Verify the password screen unlocks the named invitation. The unlock endpoint is `/.netlify/functions/unlock`.
6. Verify Netlify Forms detected `going-out` and that a voluntary answer submission appears in **Forms**.

Do **not** deploy this app through a static-only drag-and-drop of the `public` directory: that would omit the serverless password function.

## Customize invitations

Edit `lib/invites.cjs` to replace `Test Girl` and the temporary digest with a new randomly generated invitation. To generate a new private passcode, on a trusted machine run:

```bash
node scripts/new-invite.cjs invite-2 "Her Name"
```

The command prints a private code and a SHA-256 hash entry. Add the hash entry to `lib/invites.cjs`, but **do not commit or paste the raw password into GitHub**. Redeploy after changing invites. For several recipients, each must have her own unique `id`, `name`, and `hash`.

A public website's password gate is not designed for highly sensitive information. For stronger protection, add robust server-side rate limiting and stronger password storage.

## Interaction and privacy

- The fullscreen gate requests fullscreen when the browser permits it; browsers that refuse offer a manual continue path.
- A friendly bunny speaks with the visitor's browser's own speech synthesis, which can be muted or replayed. Some devices do not have a suitable voice.
- The **Yes** face celebrates with hearts; the **No** face briefly dodges twice, then is fully available to select.
- The visitor may decline, and no decline response is sent to Alex.
- After **Yes**, three small questions cover activity, vibe and timing. Only an explicit **Send my choices to Alex** click submits them using Netlify Forms.
- There are no external analytics or paid speech services in the app.

## Test

```bash
npm test
```

The tests cover valid/invalid codes, a named invitation, case-insensitive matching, HTTP-method restriction, body-size limits and the temporary demo invitation. These are backend tests; real speech, fullscreen, and form delivery must also be verified on the live site.
