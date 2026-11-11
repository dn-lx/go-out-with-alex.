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

## Development branch and Netlify preview

Branch deploy trigger: Netlify branch deployment was enabled by the site owner on November 11, 2026. The current `develop` commit must be verified in Netlify's deploy list before the preview can be considered live.



The `develop` branch is the active development branch. `main` remains production and must not be updated until an explicit release request.

The `[context.develop]` section in `netlify.toml` configures the branch build, but **does not turn on branch deployments by itself**. The Netlify project Owner must:

1. Open [go-out-with-alex Project configuration](https://app.netlify.com/projects/go-out-with-alex/configuration).
2. Go to **Developer settings → Continuous deployment → Branches and deploy contexts → Configure**.
3. Choose **Let me add individual branches**, enter `develop`, and **Save**.
4. Push a new commit to `develop` if Netlify does not build immediately.
5. Verify the actual ready deployment at `https://develop--go-out-with-alex.netlify.app`. Never treat a predicted URL as confirmation.

This prevents a development update from changing `https://go-out-with-alex.netlify.app` (production).

## Email when a visitor sends an answer

The existing `going-out` Netlify Form records the recipient and activity/vibe/timing answers **only after a visitor chooses Send**. Email notifications are a Netlify dashboard setting and have not been configured programmatically.

To send an email to **don.alex.perera@gmail.com** whenever a verified `going-out` form response is received:

1. Open Netlify → **Forms → Submission notifications → Add notification**.
2. Select **Email notification**, use `don.alex.perera@gmail.com`, and limit the notification to form `going-out`.
3. Complete any recipient confirmation Netlify sends and save.
4. Submit one explicitly consented test response on the branch deploy and check delivery and spam folders.

Declining is not silently reported. A visitor must explicitly agree to send her response. Avoid collecting or publishing password values in form data.

## Current UI details

- Only **🥰 (Yes)** and **😏 (No)** appear as face buttons; accessible labels still identify the choices for screen readers.
- The No face slips exactly **three** times with different expressions, then remains selectable, with a small idle wiggle.
- No transient text appears when No dodges.
- The bunny wiggles ears, bobs, animates its mouth when speaking, and speaks on every transition after the visitor activates the experience. Voice availability depends on the browser and device.
- The password panel uses Visual Viewport events to move upward as the mobile keyboard opens.
- `npm test` covers the unlock API plus UI contract and syntax tests. This is not a substitute for real-device voice and keyboard testing.
