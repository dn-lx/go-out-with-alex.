#!/usr/bin/env python3
"""Generate original British-English bunny narration with Kokoro-82M.

Called in GitHub Actions on the develop branch. No external paid API, token,
or private voice reference is required. We never commit model weights.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from kokoro import KPipeline

SOURCE = Path("scripts/tts/bunny-lines.json")
OUT = Path("public/audio")
SAMPLE_RATE = 24000
VOICE = os.getenv("BUNNY_VOICE", "bf_emma")
SPEED = float(os.getenv("BUNNY_SPEED", "1.04"))

def create_mp3(samples, outfile):
    with tempfile.TemporaryDirectory() as temporary:
        wav = Path(temporary) / "voice.wav"
        sf.write(wav, samples, SAMPLE_RATE, subtype="PCM_16")
        subprocess.run(
            ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(wav),
             "-ac", "1", "-ar", str(SAMPLE_RATE), "-codec:a", "libmp3lame",
             "-b:a", "64k", str(outfile)],
            check=True,
        )

def main():
    document = json.loads(SOURCE.read_text(encoding="utf-8"))
    clips = document["clips"]
    if not clips or not isinstance(clips, dict):
        raise ValueError("Missing bunny narration clips")
    OUT.mkdir(parents=True, exist_ok=True)
    # 'b' is British English. The published voice 'bf_emma' is a female voice.
    narrator = KPipeline(lang_code="b")
    manifest = {"version": 1, "clips": {}}
    total_seconds = 0.0
    for key, words in clips.items():
        if not key.replace("-", "").replace("_", "").isalnum() or not words:
            raise ValueError(f"Invalid clip: {key}")
        segments = []
        for _, _, waveform in narrator(words, voice=VOICE, speed=SPEED):
            audio = waveform.detach().cpu().numpy() if hasattr(waveform, "detach") else np.asarray(waveform)
            audio = np.asarray(audio, dtype=np.float32).reshape(-1)
            if audio.size:
                segments.append(audio)
                segments.append(np.zeros(round(SAMPLE_RATE * 0.12), dtype=np.float32))
        if not segments:
            raise RuntimeError(f"Kokoro generated no sound for {key}")
        combined = np.concatenate(segments[:-1])
        duration = len(combined) / SAMPLE_RATE
        if duration < 0.4:
            raise RuntimeError(f"Suspiciously short narration for {key}")
        outfile = OUT / f"{key}.mp3"
        create_mp3(combined, outfile)
        if outfile.stat().st_size < 900:
            raise RuntimeError(f"Empty MP3: {outfile}")
        manifest["clips"][key] = f"/audio/{key}.mp3"
        total_seconds += duration
        print(f"{key:20s} {duration:6.2f}s {outfile.stat().st_size:7d} bytes", flush=True)
    # Only publish after ALL 16 clips succeeded.
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(manifest['clips'])} voice clips, total {total_seconds:.1f}s", flush=True)

if __name__ == "__main__":
    main()
