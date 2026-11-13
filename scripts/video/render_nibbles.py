#!/usr/bin/env python3
"""Render Qwen3 dialogue with a hand-directed Nibbles pose-sheet animation.

The approved Nibbles image is the strict reference for a 4x4 set of authored
key poses. Each MP4 uses distinct facial and body poses, waveform-driven mouth
shapes, authored pose changes, and the original Qwen3 audio on the same timeline.
No hosted inference, GPU or paid service is used by this renderer.
"""
import json
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

FPS = 18
SIZE = 520
REFERENCE = Path('public/video/nibbles-reference.webp')
SHEET = Path('public/video/nibbles-pose-sheet.webp')
MISCHIEF_SHEET = Path('public/video/nibbles-mischief-sheet.webp')

# 4x4, row-major. These names describe the expression and body acting in each
# reference-consistent keyframe rather than deforming the whole still image.
IDLE_POSES = (0, 1, 2, 7, 0, 16, 17, 0)
GESTURES = {
    'password': 14, 'password-error': 13, 'intro': 6, 'ask': 2,
    'outing': 9, 'detail-coffee': 6, 'detail-walk': 9, 'detail-food': 6,
    'detail-sweet': 9, 'detail-surprise': 7, 'area': 8, 'schedule': 8,
    'success': 12, 'decline': 13, 'yes': 12, 'secret': 14,
}
HAPPY = {'success', 'yes'}


def load_poses():
    sheet = Image.open(SHEET).convert('RGB')
    w, h = sheet.size
    poses = []
    for row in range(4):
        for col in range(4):
            # Crop a small safety margin to remove the contact-sheet dividers.
            left = round(col * w / 4) + 3
            top = round(row * h / 4) + 3
            right = round((col + 1) * w / 4) - 3
            bottom = round((row + 1) * h / 4) - 3
            tile = sheet.crop((left, top, right, bottom))
            tile = ImageOps.fit(tile, (SIZE, SIZE), method=Image.Resampling.LANCZOS, centering=(.5, .48))
            poses.append(tile)
    mischief = Image.open(MISCHIEF_SHEET).convert('RGB')
    mw, mh = mischief.size
    for row in range(2):
        for col in range(2):
            left = round(col * mw / 2) + 3
            top = round(row * mh / 2) + 3
            right = round((col + 1) * mw / 2) - 3
            bottom = round((row + 1) * mh / 2) - 3
            tile = mischief.crop((left, top, right, bottom))
            tile = ImageOps.fit(tile, (SIZE, SIZE), method=Image.Resampling.LANCZOS, centering=(.5, .48))
            poses.append(tile)
    if len(poses) != 20:
        raise RuntimeError('Nibbles atlases must contain exactly 20 poses')
    return poses


def audio_envelope(path):
    data = subprocess.check_output([
        'ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', '16000',
        '-f', 'f32le', '-'
    ])
    signal = np.frombuffer(data, dtype='<f4')
    if signal.size < 1600:
        raise RuntimeError(f'Audio is empty or too short: {path}')
    block = 800  # 50 ms at 16 kHz
    count = math.ceil(signal.size / block)
    env = np.array([
        math.sqrt(float(np.mean(np.square(signal[i * block:(i + 1) * block]))))
        for i in range(count)
    ], dtype=np.float32)
    duration = signal.size / 16000
    norm = max(.004, float(np.percentile(env, 92)))
    return env, duration, norm


def voice_level(env, norm, t):
    index = max(0, min(len(env) - 1, int(t * 20)))
    local = float(np.mean(env[max(0, index - 1):min(len(env), index + 2)]))
    amount = max(0.0, min(1.0, (local / norm - .06) / .72))
    return amount * amount * (3 - 2 * amount)


def pose_at(name, t, duration, level):
    progress = t / max(duration, .01)
    if name == 'secret':
        return 19
    if name in ('outing', 'ask') and .60 <= progress <= .82:
        # A brief, silly side-to-side dance with a bouncing fluffy tail.
        return 16 + (int(t * 7) % 2)
    if name in ('intro', 'detail-surprise') and .68 <= progress <= .82:
        return 18
    if name in HAPPY and progress >= .70:
        # The large open smile is held through the final celebratory beat.
        return 12 if progress < .91 else 11
    if name == 'decline' and progress >= .73:
        return 13
    if name == 'password-error' and progress >= .68:
        return 13
    if name in ('intro', 'ask', 'outing', 'detail-surprise') and .72 <= progress <= .88 and level < .28:
        return GESTURES[name]
    if level < .12:
        # Keep the bunny alive during natural speech pauses with a blink or ear perk.
        phase = (t % 1.8) / 1.8
        return 1 if .45 <= phase < .56 else (2 if .56 <= phase < .76 else 0)
    # Three authored mouth shapes follow the actual Qwen waveform envelope.
    if level >= .66:
        return 5
    if level >= .30:
        return 4
    return 3


def animate_frame(poses, name, t, duration, level):
    index = pose_at(name, t, duration, level)
    frame = poses[index]
    # Gentle camera breathing and framing give each held pose a little life;
    # identity and facial/body features come from the distinct authored poses.
    phase = t * (4.8 if level > .12 else 2.4)
    zoom = 1.0 + .012 * (0.5 + 0.5 * math.sin(phase))
    frame = ImageOps.fit(frame, (round(SIZE * zoom), round(SIZE * zoom)),
                         method=Image.Resampling.LANCZOS, centering=(.5, .48))
    if frame.size != (SIZE, SIZE):
        left = (frame.width - SIZE) // 2
        top = (frame.height - SIZE) // 2
        frame = frame.crop((left, top, left + SIZE, top + SIZE))
    return frame, index


def encode_video(frames, audio_path, out_path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
        '-f', 'rawvideo', '-vcodec', 'rawvideo', '-pix_fmt', 'rgb24',
        '-s', f'{SIZE}x{SIZE}', '-r', str(FPS), '-i', 'pipe:0',
    ]
    if audio_path:
        command += ['-i', str(audio_path), '-map', '0:v:0', '-map', '1:a:0']
    command += ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
                '-pix_fmt', 'yuv420p']
    if audio_path:
        command += ['-c:a', 'aac', '-b:a', '96k', '-shortest']
    else:
        command += ['-an']
    command += ['-movflags', '+faststart', str(out_path)]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE)
    try:
        for frame in frames:
            encoder.stdin.write(np.asarray(frame, dtype=np.uint8).tobytes())
    finally:
        encoder.stdin.close()
    if encoder.wait() != 0 or not out_path.exists() or out_path.stat().st_size < 15000:
        raise RuntimeError(f'Failed to encode {out_path}')


def render_idle(poses, path, seconds=5):
    frames = []
    for i in range(seconds * FPS):
        t = i / FPS
        segment = (t % seconds) / (seconds / len(IDLE_POSES))
        a = IDLE_POSES[int(segment) % len(IDLE_POSES)]
        b = IDLE_POSES[(int(segment) + 1) % len(IDLE_POSES)]
        blend = segment - int(segment)
        frames.append(Image.blend(poses[a], poses[b], min(1.0, max(0.0, blend))))
    encode_video(frames, None, path)


def render_clip(poses, key, audio_path, out_path):
    env, duration, norm = audio_envelope(audio_path)
    duration += .10
    count = math.ceil(duration * FPS)
    frames = []
    for i in range(count):
        t = i / FPS
        level = voice_level(env, norm, t)
        frame, _ = animate_frame(poses, key, t, duration, level)
        frames.append(frame)
    encode_video(frames, audio_path, out_path)
    print('OK', key, count, 'frames', out_path.stat().st_size, 'bytes', flush=True)


def main():
    manifest = json.loads(Path('public/audio/manifest.json').read_text())
    clips = manifest.get('clips', {})
    if manifest.get('engine') != 'Qwen3-TTS-12Hz-1.7B-CustomVoice' or len(clips) != 16:
        raise RuntimeError('Expected the complete 16 Qwen3 audio clips')
    if not REFERENCE.is_file():
        raise RuntimeError('The approved Nibbles reference image is missing')
    if not MISCHIEF_SHEET.is_file():
        raise RuntimeError('The approved Nibbles mischief poses are missing')
    poses = load_poses()
    folder = Path('public/video')
    folder.mkdir(parents=True, exist_ok=True)
    poses[0].save(folder / 'poster.png')
    render_idle(poses, folder / 'idle.mp4')
    output = {
        'version': 3,
        'character': 'Nibbles',
        'art': 'approved reference with 20 reference-consistent animated key poses',
        'engine': 'CPU pose-sheet animation with waveform mouth cues and playful mischief',
        'source': 'Qwen3-TTS',
        'codec': 'H.264/AAC',
        'clips': {},
    }
    for name, audio_url in clips.items():
        destination = folder / (name + '.mp4')
        render_clip(poses, name, Path('public' + audio_url), destination)
        output['clips'][name] = '/video/' + name + '.mp4'
    (folder / 'manifest.json').write_text(json.dumps(output, indent=2) + '\n')
    print('Nibbles keyframe animation complete:', len(output['clips']), 'voiced scenes', flush=True)


if __name__ == '__main__':
    main()
