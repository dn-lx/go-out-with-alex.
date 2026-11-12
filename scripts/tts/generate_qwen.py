#!/usr/bin/env python3
"""Generate natural Qwen3-TTS 1.7B English character recordings for the bunny.

The public develop branch is updated only after ALL recordings have passed
basic duration, signal and file-integrity checks. No private API is used.
"""
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

LINES = Path("scripts/tts/bunny-lines.json")
AUDIO = Path("public/audio")
MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
SPEAKER = "Ryan"
BASE_STYLE = (
    "Speak in a very natural, relaxed, friendly and expressive English voice. "
    "You are a witty, mischievous but sweet cartoon rabbit: warm, sincere, "
    "charmingly cheeky, with excellent comic timing. Light pauses, subtle "
    "smiles and gentle playfulness. Avoid robotic cadence, exaggerated pitch, "
    "sing-song narration and shouting. Never sing."
)
STYLES = {
    "password": "Playful conspiratorial whisper, as if sharing a funny secret.",
    "password-error": "Warm reassurance with a playful oops, not judgemental.",
    "intro": "Genuinely funny, a bit self-deprecating; sound like a real friend.",
    "ask": "Endearingly nervous and mischievous, with a smiling tease.",
    "outing": "Cheerful, curious and lightly amused.",
    "area": "Warm and considerate; naturally gentle comic timing.",
    "schedule": "Easygoing and clear, as if planning something fun with a friend.",
    "success": "Delighted excitement and laughter in the voice, but never yelling.",
    "decline": "Sincere, respectful and reassuring, with a tiny friendly smile.",
    "yes": "Delighted, celebratory, softly chuckling, naturally expressive.",
    "secret": "Quietly conspiratorial and mischievously funny.",
}
STYLE_DETAIL = "Interested and amused, with a tiny grin and conversational timing."


def encode_mp3(samples: np.ndarray, sample_rate: int, target: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="bunny-qwen-") as directory:
        intermediate = Path(directory) / "audio.wav"
        sf.write(intermediate, samples, sample_rate, subtype="PCM_16")
        subprocess.run(
            ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
             "-y", "-i", str(intermediate), "-ar", "24000", "-ac", "1",
             "-codec:a", "libmp3lame", "-b:a", "96k", str(target)],
            check=True,
        )


def check_wave(samples: np.ndarray, sample_rate: int, name: str) -> float:
    duration = len(samples) / sample_rate
    if not (0.7 <= duration <= 80.0):
        raise RuntimeError(f"{name}: unexpected duration {duration:.2f}s")
    if not np.all(np.isfinite(samples)):
        raise RuntimeError(f"{name}: invalid audio values")
    rms = float(np.sqrt(np.mean(np.square(samples))))
    peak = float(np.max(np.abs(samples)))
    if rms < 0.0015 or peak < 0.008:
        raise RuntimeError(f"{name}: silent/near-silent waveform, rms {rms}, peak {peak}")
    return duration


def main() -> None:
    torch.set_num_threads(min(4, os.cpu_count() or 2))
    torch.set_num_interop_threads(1)
    doc = json.loads(LINES.read_text(encoding="utf-8"))
    lines = doc["clips"]
    if len(lines) < 12:
        raise ValueError("Missing bunny scripts")
    AUDIO.mkdir(parents=True, exist_ok=True)
    print(f"Loading {MODEL_ID} for CPU narration...", flush=True)
    model = Qwen3TTSModel.from_pretrained(
        MODEL_ID,
        device_map="cpu",
        dtype=torch.float32,
        attn_implementation="sdpa",
    )
    generated = {}
    start = time.monotonic()
    for i, (name, content) in enumerate(lines.items()):
        if not name.replace("-", "").replace("_", "").isalnum():
            raise ValueError(f"Unsafe recording name {name!r}")
        torch.manual_seed(2500 + i)
        mood = STYLES.get(name, STYLE_DETAIL)
        print(f"Rendering {i+1}/{len(lines)}: {name}...", flush=True)
        with torch.inference_mode():
            wavs, sr = model.generate_custom_voice(
                text=content,
                language="English",
                speaker=SPEAKER,
                instruct=f"{BASE_STYLE} {mood}",
                max_new_tokens=2048,
            )
        audio = np.asarray(wavs[0], dtype=np.float32).reshape(-1)
        seconds = check_wave(audio, int(sr), name)
        dest = AUDIO / f"{name}.mp3"
        encode_mp3(audio, int(sr), dest)
        if dest.stat().st_size < 2500:
            raise RuntimeError(f"{name}: unexpectedly small MP3")
        generated[name] = f"/audio/{name}.mp3"
        print(f"OK {name}: {seconds:.1f}s; {dest.stat().st_size} bytes", flush=True)

    # Do not re-enable the prerecording manifest until every scene exists.
    manifest = {
        "version": 1,
        "engine": "Qwen3-TTS-12Hz-1.7B-CustomVoice",
        "voice": SPEAKER,
        "language": "en",
        "clips": generated,
    }
    (AUDIO / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"SUCCESS: {len(generated)} natural-voice recordings in {time.monotonic() - start:.1f}s", flush=True)


if __name__ == "__main__":
    main()
