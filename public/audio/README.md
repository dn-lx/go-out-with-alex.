# Bunny character voice assets

**Current status (2026-11-11): ElevenLabs generation blocked by an insufficient fal balance. No prerecorded speech clips have been generated.**

The app already supports playing prerecorded MP3 files, with animated mouth shapes and automatic device-voice fallback on missing or failed audio. The `manifest.json` deliberately has `"clips": {}` so the website never implies audio exists when it does not.

## When the fal account has credits

1. Use the connected fal account and the actual endpoint `elevenlabs/tts/eleven-v4`.
2. Voice: `Roger` (original, playful American male rabbit — **not** a voice-clone of Bugs Bunny or any actor).
3. Choose `stability: 0.34`, `similarity_boost: 0.75`, `language_code: "en"`, output `mp3_44100_96`. Adjust only after listening.
4. Generate the 15 line IDs and exact prepared prompts in `scripts/voice-script.json`. Keep the same voice and settings for consistent narration. Audio tags can direct performance.
5. Name files `public/audio/<line-id>.mp3`; use real MP3 files, not placeholder text.
6. Update `public/audio/manifest.json`, for example:
   
   ```json
   {"version":1,"clips":{"intro":"/audio/intro.mp3","ask":"/audio/ask.mp3","detail-coffee":"/audio/detail-coffee.mp3"}}
   ```

7. Commit **to develop only**, test `npm test` and `node scripts/browser-smoke.cjs`, and verify Netlify branch deployment at `https://develop--go-out-with-alex.netlify.app`.

A path is only added to `clips` **after** the corresponding real audio file is committed and deployed. Playback from missing MP3s will fall back to device TTS.

## Playback behavior

- When a recorded clip is available for a scene, the app plays it, animates the mouth, and stops it when moving on.
- During development, lip animation is rhythmic and tied to the audio playback clock; it is **not phoneme-accurate** yet. The Eleven v4 model can also return timestamps for improved sync.
- If the clip is missing, cannot be fetched or autoplay is blocked, the browser's English speech synthesis is the fallback.
- No runtime fal or ElevenLabs API key is shipped to visitors or invoked from their browser.
- The visitor can mute narration, replay the current bunny message or select a device voice.
- This project should use an original cartoon rabbit rather than exact unlicensed TV character imagery or a cloned actor voice.

## Billing

The available ElevenLabs Eleven v4 endpoint recently advertised **$0.08 per 1,000 characters** on the connected fal account. This is indicative only; verify current rates and account balance before generating. The fal account previously returned HTTP 403, `balance_exhausted`. Do not retry jobs until the user adds credits.
