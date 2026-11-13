# Nibbles animation and zero-cost production

## Decision

Use the approved `public/video/nibbles-reference.webp` as the identity source, then render dialogue as H.264/AAC using a 20-pose animation atlas, existing Qwen3-TTS recordings, and CPU-only keyframing. The main atlas and extra mischievous poses are stored as `public/video/nibbles-pose-sheet.webp` and `public/video/nibbles-mischief-sheet.webp`; the renderer is `scripts/video/render_nibbles.py`.

The atlas preserves Nibbles' white fur, long pink-lined ears, blue eyes, pink nose, front teeth, and mischievous expression. Its key poses include blinks, talking mouth shapes, a wink, a paw wave, a crouch, a hop, celebration, an apologetic look, a whisper, a tail-bounce dance, and a tiptoe. The renderer picks poses by scene, tracks the actual audio energy to select among three mouth shapes, cuts cleanly between authored pose changes, and puts the same audio track into each MP4. The website keeps its existing invitation, password gate, invitation data, voice controls, Yes/No interactions, planning flow, forms, and owner dashboard.

This is a modest CPU keyframe animation pipeline. It avoids whole-image mesh warping and generates visible changes in the face and body pose. Nibbles now also does a silly tail-bounce dance, tiptoes like a rascal, and finishes with a tongue-out wink. It does not claim phoneme-level lip sync or continuous 3D character motion. The source MP3s contain no phoneme timestamps, so speech timing follows a short-window waveform envelope.

## Cost and compute check

- The Nibbles pose atlas was generated through the ChatGPT image capability already included in the user's existing subscription. No separate image or video provider was used.
- Rendering uses Python, Pillow, NumPy, and FFmpeg on the repository's existing standard Linux GitHub Actions runner. This public repository uses standard hosted runners; [GitHub documents those as free and unlimited for public repositories](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job). No GPU runner, paid model endpoint, API key, or model download is part of the animation workflow.
- Google Colab was not used. A free GPU session is not a reliable production dependency, and the project already has a deterministic CPU renderer.
- [Wan2.1](https://github.com/Wan-Video/Wan2.1) was evaluated and not selected for identity-preserving production. Its official repository lists the 1.3B model's 8.19 GB VRAM requirement for text-to-video and describes separate 14B image-to-video models. A standard CPU runner cannot satisfy that GPU requirement. A public model or free demonstration would not make hosted inference reliably free.
- [LTX Desktop](https://github.com/Lightricks/LTX-Desktop) was not selected: its published Linux desktop requirements specify an NVIDIA GPU with at least 24 GB VRAM.

## Regenerate

From the repository root, install FFmpeg, Python 3.11, Pillow 10 or 11, and NumPy 1.26 or 2.x, then run:

```bash
python -m py_compile scripts/video/render_nibbles.py
python scripts/video/render_nibbles.py
```

The `Render real Bunny MP4 videos` GitHub Actions workflow performs this on `develop`, validates all 16 videos and audio streams, commits generated assets back to `develop`, and retains a seven-day recovery artifact. No workflow targets `main`.

## Review limits

A 20-pose atlas is more expressive than repeated pixel displacement, but it remains a pose-sheet animation. A full continuous 3D model rig, phoneme-driven lip sync, and richer secondary acting would need substantial manual character modeling or access to a suitable GPU. This workflow deliberately does not assume free cloud GPU access or call paid generation APIs.
