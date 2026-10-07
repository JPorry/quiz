#!/usr/bin/env python3
"""Composes and renders Tiny Isles' music and sound effects into audio files.

The music is low-key harbor lo-fi in G major: a soft Rhodes, a nylon guitar picking
gently, a walking upright bass, a shaker, and on the home screen a steel drum or
marimba singing little tunes, with an accordion breathing in now and then. It is
written here as notes, rendered through real sampled instruments (the FluidR3
General MIDI soundfont, through FluidSynth), and laid over a harbor bed made with
numpy: the sea swelling and lapping, seagulls calling, a distant buoy bell and a
breeze. Every melody stays in G major pentatonic, and the sound effects are
pitched in the same key, so they always sit inside the music.

Writes public/audio/*.mp3, public/audio/sfx/*.mp3, and src/audioManifest.js.
Most of the rendering helpers come from Tidal Garden's scripts/compose-audio.py.

Needs: fluidsynth, the fluid-soundfont-gm soundfont, ffmpeg, numpy and scipy.
    python3 scripts/compose-audio.py [--seed=2026] [--only=music|sfx] [--tracks=play-1,play-2]
"""
import json
import os
import random
import struct
import subprocess
import sys
import tempfile

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

RATE = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'audio')
SOUNDFONT = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
ARGS = dict(arg.lstrip('-').split('=', 1) for arg in sys.argv[1:] if '=' in arg)
SEED = int(ARGS.get('seed', 2026))

# General MIDI programs used.
RHODES, NYLON, BASS, STEEL_DRUM, MARIMBA, VIBES, KALIMBA, GLOCKENSPIEL = 4, 24, 32, 114, 12, 11, 108, 9
ACCORDION, CELESTA, MUSIC_BOX, HARP, PIZZICATO, WOODBLOCK, TUBULAR_BELLS, PAD = 21, 8, 10, 46, 45, 115, 14, 89
DRUMS = 9  # the General MIDI drum channel
KICK, SIDE_STICK, SHAKER = 36, 37, 82

TEMPO = 80
BEAT = 60 / TEMPO

# G major pentatonic (G A B D E) across the octaves.
PENTATONIC = [n for n in range(43, 100) if n % 12 in (7, 9, 11, 2, 4)]

# One chord a bar: (bass root, Rhodes voicing). A is I vi IV V, B is IV iii ii V.
A = [(43, [59, 62, 66, 69]), (40, [55, 59, 62, 66]), (48, [55, 59, 62, 64]), (50, [54, 57, 59, 64])]
B = [(48, [55, 59, 64, 67]), (47, [54, 57, 62, 66]), (45, [55, 60, 64, 67]), (50, [55, 57, 60, 64])]
FORM = [A, A, B, A, A, A, B, A]  # 32 bars, about a minute and a half

# How each mood plays.
MOODS = {
    'home': dict(tempo=80, lead_range=(67, 88), density=0.85, guitar=1.0, guitar_up=12, groove=1.0, shaker=1.0, accordion=0.7, glock=0.4, gulls=0.9, waves=0.8, bell=0.5, warm=None),
    # The puzzle music is background music: slower, lower, sparser and warmer, so it
    # never pulls attention from the islands.
    'play': dict(tempo=68, lead_range=(55, 76), density=0.32, guitar=0.6, guitar_up=0, groove=0.0, shaker=0.3, accordion=0.0, glock=0.0, gulls=0.35, waves=1.0, bell=0.35, warm=3200),
}

# ---------------------------------------------------------------------------------------------
# MIDI writing and rendering

def vlq(value):
    out = [value & 0x7F]
    value >>= 7
    while value:
        out.insert(0, (value & 0x7F) | 0x80)
        value >>= 7
    return bytes(out)


def write_midi(path, notes, programs, tempo=TEMPO, tail=6.0, settings=None):
    """notes: (start_beat, length_beats, channel, pitch, velocity). programs: {channel: program}."""
    tpq = 480
    events = []
    for channel, program in programs.items():
        events.append((0, 0, bytes([0xC0 | channel, program])))
        setting = (settings or {}).get(channel, {})
        for cc, value in ((7, setting.get('volume', 100)), (10, setting.get('pan', 64)), (91, setting.get('reverb', 70)), (93, setting.get('chorus', 10))):
            events.append((0, 0, bytes([0xB0 | channel, cc, value])))
    end = 0
    for start, length, channel, pitch, velocity in notes:
        on, off = int(start * tpq), int((start + length) * tpq)
        events.append((on, 2, bytes([0x90 | channel, pitch, max(1, min(127, int(velocity)))])))
        events.append((off, 1, bytes([0x80 | channel, pitch, 0])))
        end = max(end, off)
    end += int(tail / (60 / tempo) * tpq)
    events.sort(key=lambda e: (e[0], e[1]))
    track = bytearray(b'\x00\xff\x51\x03' + int(60_000_000 / tempo).to_bytes(3, 'big'))
    now = 0
    for tick, _, data in events:
        track += vlq(tick - now) + data
        now = tick
    track += vlq(end - now) + b'\xff\x2f\x00'
    with open(path, 'wb') as f:
        f.write(b'MThd' + struct.pack('>IHHH', 6, 0, 1, tpq))
        f.write(b'MTrk' + struct.pack('>I', len(track)) + track)


def render_midi(notes, programs, tempo=TEMPO, tail=6.0, settings=None, reverb=0.62, room=0.78):
    with tempfile.TemporaryDirectory() as tmp:
        mid, wav = os.path.join(tmp, 'x.mid'), os.path.join(tmp, 'x.wav')
        write_midi(mid, notes, programs, tempo, tail, settings)
        subprocess.run(['fluidsynth', '-ni', '-q', '-r', str(RATE), '-g', '0.5',
                        '-o', f'synth.reverb.room-size={room}', '-o', f'synth.reverb.level={reverb}', '-o', 'synth.reverb.width=1.0',
                        '-o', 'synth.reverb.damp=0.35', '-o', 'synth.chorus.active=0',
                        '-F', wav, SOUNDFONT, mid], check=True)
        return read_wav(wav)


def read_wav(path):
    data = open(path, 'rb').read()
    # Find the data chunk (FluidSynth writes plain 16-bit PCM).
    i = 12
    while i < len(data):
        chunk, size = data[i:i + 4], struct.unpack('<I', data[i + 4:i + 8])[0]
        if chunk == b'data':
            pcm = np.frombuffer(data[i + 8:i + 8 + size], dtype='<i2').astype(np.float32) / 32768
            return pcm.reshape(-1, 2)
        i += 8 + size
    raise ValueError('no data chunk')


def encode(signal, path, bitrate):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pcm = (np.clip(signal, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(RATE), '-ac', '2', '-i', '-',
                    '-codec:a', 'libmp3lame', '-b:a', bitrate, path], input=pcm, check=True)

# ---------------------------------------------------------------------------------------------
# Nature, made with numpy

def band(signal, low=None, high=None, order=2):
    if low and high:
        sos = butter(order, [low, high], btype='band', fs=RATE, output='sos')
    elif low:
        sos = butter(order, low, btype='high', fs=RATE, output='sos')
    else:
        sos = butter(order, high, btype='low', fs=RATE, output='sos')
    return sosfilt(sos, signal, axis=0)


def stereo(mono, pan=0.0):
    angle = (pan + 1) * np.pi / 4
    return np.stack([mono * np.cos(angle), mono * np.sin(angle)], axis=1)


def room(signal, seconds=1.6, wet=0.25, rng=None):
    rng = rng or np.random.default_rng(1)
    n = int(seconds * RATE)
    impulse = rng.standard_normal((n, 2)) * np.exp(-np.linspace(0, 7, n))[:, None]
    impulse = band(impulse, high=6000)
    impulse /= np.sqrt((impulse ** 2).sum(axis=0))
    out = np.stack([fftconvolve(signal[:, c], impulse[:, c])[:len(signal)] for c in range(2)], axis=1)
    return signal * (1 - wet) + out * wet


def waves(seconds, rng):
    """The sea lapping in slow, uneven swells, with a soft hiss of foam as each one breaks."""
    n = int(seconds * RATE)
    noise = rng.standard_normal((n, 2))
    body = band(np.cumsum(noise, axis=0) * 0.02, low=40, high=700)
    body = band(body, low=40)
    foam = band(rng.standard_normal((n, 2)), low=1500, high=7000)
    swell = np.full(n, 0.22)
    t = rng.uniform(0, 3)
    while t < seconds:
        rise, fall = rng.uniform(2.0, 3.2), rng.uniform(3.0, 4.5)
        idx = np.arange(n) / RATE - t
        shape = np.where(idx < 0, 0, np.where(idx < rise, np.sin(np.clip(idx / rise, 0, 1) * np.pi / 2) ** 2, np.exp(-(idx - rise) / fall * 2.2)))
        swell += shape * rng.uniform(0.6, 1.0)
        t += rng.uniform(5.5, 9.5)
    swell = band(swell[:, None].repeat(2, axis=1), high=3)
    body *= swell / np.abs(body).max()
    foam_env = np.roll(swell, int(0.6 * RATE), axis=0) ** 2
    foam *= foam_env / np.abs(foam).max() * 0.18
    return body + foam


def wind(seconds, rng):
    n = int(seconds * RATE)
    gust = band(rng.standard_normal((n, 2)), low=250, high=1400)
    envelope = band(np.abs(rng.standard_normal((n, 1))).repeat(2, axis=1), high=0.15)
    envelope = (envelope - envelope.min()) / (np.ptp(envelope) + 1e-9)
    return gust / np.abs(gust).max() * envelope ** 2


def gull(rng, level=1.0):
    """A herring gull somewhere over the harbor: a few rising-and-falling "kyow" calls, or a
    quick laughing run of "ha-ha-ha"."""
    laugh = rng.random() < 0.35
    calls = rng.integers(4, 7) if laugh else rng.integers(2, 4)
    base = rng.uniform(950, 1350)
    parts = []
    for k in range(calls):
        length = rng.uniform(0.08, 0.11) if laugh else rng.uniform(0.2, 0.3)
        t = np.arange(int(length * RATE)) / RATE
        x = t / length
        f0 = base * (1 - 0.05 * k) if laugh else base
        # up quickly, then down: the gull's "kyow"
        freq = f0 * (1 + 0.32 * np.sin(np.pi * np.clip(x / 0.35, 0, 1) / 2) - 0.45 * np.clip((x - 0.3) / 0.7, 0, 1) ** 1.4)
        phase = 2 * np.pi * np.cumsum(freq) / RATE
        voice = sum(np.sin(h * phase) / h ** 0.9 for h in range(1, 8))
        voice += rng.standard_normal(len(t)) * 0.25
        env = np.minimum(1, t / 0.015) * np.exp(-np.maximum(0, x - 0.55) * 5)
        parts += [voice * env, np.zeros(int(rng.uniform(0.07, 0.12 if laugh else 0.2) * RATE))]
    call = band(np.concatenate(parts), low=600, high=4500)
    return call / (np.abs(call).max() + 1e-9) * level


def harbor(seconds, mood, rng):
    """The sea swelling under the jetty, a breeze, and gulls calling now near, now far."""
    bed = waves(seconds, rng) * 0.55 * mood['waves']
    bed += wind(seconds, rng) * 0.04
    layer = np.zeros_like(bed)
    t = rng.uniform(1.5, 5)
    while t < seconds - 3:
        if rng.random() < mood['gulls']:
            near = rng.random() < 0.4
            call = gull(rng, rng.uniform(0.07, 0.1) if near else rng.uniform(0.03, 0.05))
            if mood['warm']:
                call *= 0.6  # quieter gulls while puzzling
            if not near:
                call = band(call, high=2600)
            start = int(t * RATE)
            end = min(len(layer), start + len(call))
            layer[start:end] += stereo(call[:end - start], rng.uniform(-0.8, 0.8))
        t += rng.uniform(6, 15)
    bed += room(layer, 1.8, 0.35, rng)
    return bed

# ---------------------------------------------------------------------------------------------
# The music

def nearest(pool, target):
    return min(pool, key=lambda n: abs(n - target))


def make_motif(rng, density):
    """A short rhythmic idea over two bars: (beat offset, length, scale steps to move)."""
    rhythms = [[1, 0.5, 0.5, 2], [0.5, 0.5, 1], [1.5, 0.5, 1, 1], [0.75, 0.75, 0.5, 2], [1, 1, 2], [0.5, 1, 0.5, 2]]
    offset, motif = rng.choice([0, 0.5, 1]), []
    while offset < 7:
        for length in rng.choice(rhythms):
            if offset >= 7:
                break
            if rng.random() < 0.85:
                motif.append((offset, length * 1.3, rng.choice([-2, -1, -1, 1, 1, 2, 0, 1])))
            offset += length
        offset += rng.choice([0, 0.5, 1, 2]) * (1.3 - density)
    return motif


def vary(motif, rng):
    out = list(motif)
    if out:
        i = rng.randrange(len(out))
        offset, length, move = out[i]
        out[i] = (offset, length, move + rng.choice([-1, 1]))
    return out


def compose(mood_name, seed):
    mood = MOODS[mood_name]
    rng = random.Random(seed)
    notes = []
    # Channels: 0 Rhodes, 1 bass, 2 guitar, 3 lead, 4 accordion, 5 glockenspiel, 6 buoy bell, 9 drums.
    bars = [chord for section in FORM for chord in section]
    low, high = mood['lead_range']
    pool = [p for p in PENTATONIC if low <= p <= high]
    motif, last = None, (low + high) // 2
    for index, (root, voicing) in enumerate(bars):
        start = index * 4
        intro = index < 2
        outro = index >= len(bars) - 2
        section = FORM[index // 4]
        # A soft Rhodes holds the chord, a touch late for a lazy feel.
        for pitch in voicing:
            notes.append((start + 0.04, 3.9, 0, pitch, rng.randint(40, 50)))
        # The bass walks: root, fifth, and a step towards the next chord.
        next_root = bars[(index + 1) % len(bars)][0]
        notes.append((start, 1.6, 1, root, 74))
        if not intro:
            notes.append((start + 2, 1.0, 1, root + 7 if root + 7 <= 55 else root - 5, 62))
            approach = next_root + (1 if next_root < root else -1) * rng.choice([1, 2])
            notes.append((start + 3.5, 0.45, 1, approach, 56))
        # The nylon guitar picks through the chord in eighths, softly.
        if rng.random() < mood['guitar'] and not outro:
            tones = sorted(set(voicing + [voicing[1] + 12]))
            order = [0, 2, 1, 3, 2, 4, 3, 1] if rng.random() < 0.6 else [0, 1, 2, 3, 4, 3, 2, 1]
            step = 0.5 if mood['guitar'] > 0.8 else 1.0
            for k in range(int(4 / step)):
                if step == 0.5 and k in (0,) and rng.random() < 0.5:
                    continue
                pitch = tones[order[k % len(order)] % len(tones)] + mood['guitar_up']
                notes.append((start + k * step + rng.uniform(0, 0.03), step * 1.8, 2, pitch, rng.randint(34, 48)))
        # The drums: a shaker in eighths, with a soft kick and side stick on the home theme.
        if not intro and not outro:
            if mood['shaker'] >= 1:
                for k in range(8):
                    if rng.random() < 0.55 + 0.4 * mood['groove']:
                        notes.append((start + k * 0.5, 0.2, DRUMS, SHAKER, (40 if k % 2 else 24) + rng.randint(0, 8)))
            else:
                # just a whisper of shaker on the off-beats
                for k in (1, 3):
                    if rng.random() < mood['shaker']:
                        notes.append((start + k, 0.2, DRUMS, SHAKER, 20 + rng.randint(0, 6)))
            if mood['groove'] > 0.6:
                notes.append((start, 0.3, DRUMS, KICK, 52))
                notes.append((start + 2.5, 0.3, DRUMS, KICK, 40))
                notes.append((start + 2, 0.3, DRUMS, SIDE_STICK, 34))
        # The lead sings a motif every two bars, repeating it with a twist.
        lead_channel_on = index % 2 == 0 and not intro and not outro
        if lead_channel_on and rng.random() < mood['density'] + 0.1:
            if motif is None or rng.random() < 0.35:
                motif = make_motif(rng, mood['density'])
            phrase = vary(motif, rng) if rng.random() < 0.6 else motif
            chord_tones = [p for p in pool if p % 12 in {v % 12 for v in voicing}]
            current = pool.index(nearest(chord_tones or pool, last))
            for offset, length, move in phrase:
                current = max(0, min(len(pool) - 1, current + move))
                notes.append((start + offset + rng.uniform(-0.02, 0.02), length * (1.5 if mood['warm'] else 1), 3, pool[current], rng.randint(50, 66) - (8 if mood['warm'] else 0)))
            last = pool[current]
        # An accordion breathes long notes through the B sections.
        if section is B and rng.random() < mood['accordion']:
            top = nearest([p for p in range(64, 80) if p % 12 in {v % 12 for v in voicing}], 71)
            notes.append((start + 0.5, 3.2, 4, top, rng.randint(30, 40)))
        # Now and then the glockenspiel twinkles.
        if rng.random() < mood['glock'] * 0.35:
            at = start + rng.choice([1.5, 2.5, 3])
            for k in range(rng.randint(2, 3)):
                notes.append((at + k * 0.25, 1.0, 5, rng.choice([p for p in PENTATONIC if 86 <= p <= 98]), rng.randint(26, 36)))
        # Out past the harbor wall, the buoy bell tolls.
        if index % 8 == 5 and rng.random() < mood['bell']:
            notes.append((start + 1, 6, 6, 62, rng.randint(22, 30)))
    return notes


SETTINGS = {
    0: dict(volume=74, pan=56, reverb=80, chorus=30),
    1: dict(volume=92, pan=64, reverb=30),
    2: dict(volume=70, pan=40, reverb=60),
    3: dict(volume=88, pan=82, reverb=80),
    4: dict(volume=56, pan=74, reverb=100),
    5: dict(volume=58, pan=90, reverb=110),
    6: dict(volume=50, pan=30, reverb=127),
    9: dict(volume=70, pan=64, reverb=40),
}


def master(signal, target_rms=0.07, fade_in=2.0, fade_out=4.0):
    rms = np.sqrt(np.mean(signal ** 2))
    signal = signal * (target_rms / (rms + 1e-9))
    signal = np.tanh(signal * 1.15) / 1.15
    n = len(signal)
    ramp_in, ramp_out = int(fade_in * RATE), int(fade_out * RATE)
    signal[:ramp_in] *= np.linspace(0, 1, ramp_in)[:, None] ** 2
    signal[n - ramp_out:] *= np.linspace(1, 0, ramp_out)[:, None] ** 2
    return signal


def piece(mood_name, seed, lead):
    mood = MOODS[mood_name]
    programs = {0: RHODES, 1: BASS, 2: NYLON, 3: lead, 4: ACCORDION, 5: GLOCKENSPIEL, 6: TUBULAR_BELLS, DRUMS: 0}
    music = render_midi(compose(mood_name, seed), programs, tempo=mood['tempo'], settings=SETTINGS, reverb=0.5, room=0.6)
    if mood['warm']:
        music = band(music, high=mood['warm'])
    seconds = len(music) / RATE
    bed = harbor(seconds, mood, np.random.default_rng(seed))
    music = music / (np.sqrt(np.mean(music ** 2)) + 1e-9) * 0.08
    bed = bed / (np.sqrt(np.mean(bed ** 2)) + 1e-9) * 0.032
    return master(music + bed)


TRACKS = [
    ('home', 'home', 11, STEEL_DRUM),
    ('play-1', 'play', 23, VIBES),
    ('play-2', 'play', 37, MARIMBA),
]

# ---------------------------------------------------------------------------------------------
# Sound effects
def tone(f0, f1, length, level, kind='sine', attack=0.005):
    t = np.arange(int(length * RATE)) / RATE
    freq = f0 * (f1 / f0) ** (t / length)
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    wave = np.sin(phase) if kind == 'sine' else (np.sin(phase) + 0.3 * np.sin(2 * phase) + 0.12 * np.sin(3 * phase))
    env = np.minimum(1, t / attack) * np.exp(-t / (length / 4))
    return stereo(wave * env * level)


def hush(length, low, high, level, attack=0.02, rng=None, shape=None):
    rng = rng or np.random.default_rng(3)
    n = int(length * RATE)
    noise = band(rng.standard_normal((n, 2)), low=low, high=high)
    t = np.arange(n) / RATE
    env = shape(t) if shape else np.minimum(1, t / attack) * np.exp(-t / (length / 4))
    return noise / (np.abs(noise).max() + 1e-9) * env[:, None] * level


def bubble(f0, length=0.09, level=0.5):
    return tone(f0, f0 * 1.9, length, level)


def mix(*parts, at=None):
    at = at or [0] * len(parts)
    n = max(int(a * RATE) + len(p) for a, p in zip(at, parts))
    out = np.zeros((n, 2))
    for a, p in zip(at, parts):
        s = int(a * RATE)
        out[s:s + len(p)] += p
    return out


def notes_sfx(notes, programs, reverb=0.45):
    """Renders a few notes through the soundfont: (start_seconds, length, channel, pitch, velocity)."""
    beat_notes = [(s / BEAT, l / BEAT, c, p, v) for s, l, c, p, v in notes]
    return render_midi(beat_notes, programs, tail=1.6, settings={c: dict(volume=110, reverb=60) for c in programs}, reverb=reverb, room=0.55)


def trim(signal, floor=0.0008):
    loud = np.where(np.abs(signal).max(axis=1) > floor)[0]
    if not len(loud):
        return signal
    end = min(len(signal), loud[-1] + int(0.05 * RATE))
    out = signal[loud[0]:end].copy()
    fade = min(len(out), int(0.04 * RATE))
    out[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return out



def midi_hz(note):
    return 440 * 2 ** ((note - 69) / 12)


PENTA = [p for p in PENTATONIC if 67 <= p <= 100]


def horn(length, notes=(67, 71), level=0.25):
    """A little boat's horn: two warm reedy tones a third apart, with a gentle swell."""
    t = np.arange(int((length + 0.15) * RATE)) / RATE
    out = np.zeros(len(t))
    for hz in map(midi_hz, notes):
        phase = 2 * np.pi * hz * t * (1 + 0.004 * np.sin(2 * np.pi * 5 * t))
        out += sum(np.sin(k * phase) / k ** 1.4 for k in range(1, 7))
    env = np.minimum(1, t / 0.04) * np.where(t < length, 1, np.exp(-(t - length) / 0.05))
    return stereo(band(out * env, high=2000) * level)


def boing(f0, f1, length, level):
    """A springy little boing: a tone sliding up with a wobble that settles."""
    t = np.arange(int(length * RATE)) / RATE
    freq = (f0 * (f1 / f0) ** (t / length)) * (1 + 0.18 * np.sin(2 * np.pi * 16 * t) * np.exp(-t * 7))
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    env = np.minimum(1, t / 0.006) * np.exp(-t / (length / 3.5))
    return stereo((np.sin(phase) + 0.25 * np.sin(2 * phase)) * env * level)


def splashy(length, level, rng):
    """Water slapping and fizzing: bright noise that blooms and fades."""
    return hush(length, 300, 5000, level, rng=rng, shape=lambda t: np.minimum(1, t / 0.012) * np.exp(-t / (length / 4.5)))


def effects():
    """Every sound effect, by name: a signal and how loud it should sit (peak)."""
    sfx = {}
    rng = np.random.default_rng(SEED)
    # Moving about.
    sfx['tap'] = (mix(notes_sfx([(0, 0.25, 0, 83, 72)], {0: MARIMBA}), bubble(640, 0.07, 0.35)), 0.5)
    sfx['back'] = (mix(notes_sfx([(0, 0.25, 0, 76, 66)], {0: MARIMBA}), tone(900, 520, 0.09, 0.3)), 0.45)
    sfx['swoosh'] = (hush(0.5, 500, 3200, 1.0, rng=rng, shape=lambda t: np.sin(np.pi * np.clip(t / 0.5, 0, 1)) ** 2), 0.3)
    sfx['start'] = (mix(horn(0.13, level=0.3), horn(0.22, level=0.3), notes_sfx([(0, 0.4, 0, 79, 70), (0.09, 0.4, 0, 83, 74), (0.18, 0.8, 0, 86, 80)], {0: KALIMBA}), at=[0, 0.2, 0.42]), 0.6)
    # Touching an island: a soft round bloop with a woody tick.
    sfx['press'] = (mix(tone(300, 470, 0.11, 0.6, attack=0.006), notes_sfx([(0, 0.2, 0, 79, 62)], {0: MARIMBA}), at=[0, 0.005]), 0.45)
    # Planks, each a little higher: a woody tok on the marimba with a click of wood.
    for i in range(8):
        tok = notes_sfx([(0, 0.18, 0, PENTA[i], 78), (0, 0.1, 1, 76 + i, 40)], {0: MARIMBA, 1: WOODBLOCK}, reverb=0.25)
        sfx[f'plank-{i}'] = (mix(tok, tone(1800, 1200, 0.02, 0.12)), 0.4)
    # The drag passing halfway: a bright pluck and a springy little boing.
    sfx['snap'] = (mix(notes_sfx([(0, 0.3, 0, 86, 90)], {0: PIZZICATO}), boing(520, 880, 0.18, 0.4)), 0.5)
    # A bridge opens: a kalimba runs up and a celesta twinkles; a stone one rings fuller.
    sfx['open-1'] = (mix(notes_sfx([(0, 0.5, 0, 79, 78), (0.07, 0.5, 0, 83, 80), (0.14, 0.9, 0, 86, 84), (0.3, 1.4, 1, 95, 60)], {0: KALIMBA, 1: CELESTA}), bubble(700, 0.08, 0.3), bubble(950, 0.08, 0.25), at=[0, 0.02, 0.12]), 0.6)
    sfx['open-2'] = (mix(notes_sfx([(0, 0.5, 0, 74, 80), (0.07, 0.5, 0, 79, 82), (0.14, 0.5, 0, 83, 84), (0.21, 1.0, 0, 86, 88), (0.36, 1.6, 1, 98, 64), (0.46, 1.6, 1, 95, 58)], {0: STEEL_DRUM, 1: GLOCKENSPIEL})), 0.68)
    # A city grows a step: a glockenspiel sparkle, higher for bigger cities.
    for k in range(1, 9):
        sfx[f'grow-{k}'] = (mix(notes_sfx([(0, 0.9, 0, PENTA[3 + k], 64), (0.06, 0.9, 0, PENTA[5 + k], 54)], {0: GLOCKENSPIEL}), tone(900, 1500, 0.06, 0.15)), 0.4)
    # An island gets exactly its number: a cute ding-ding on the music box.
    for k in range(7):
        sfx[f'happy-{k}'] = (notes_sfx([(0, 1.0, 0, PENTA[4 + k], 84), (0.1, 1.4, 0, PENTA[6 + k], 88)], {0: MUSIC_BOX}, reverb=0.55), 0.5)
    # A bridge taken down: planks splashing into the sea and a few bubbles rising.
    sfx['splash'] = (mix(splashy(0.6, 1.0, rng), *[tone(f, f * 0.75, 0.09, 0.35) for f in (620, 480, 380)], at=[0, 0.1, 0.18, 0.27]), 0.42)
    # A swipe cutting a bridge: a quick swish and a snip-snip.
    sfx['snip'] = (mix(hush(0.2, 2200, 9500, 1.0, rng=rng, shape=lambda t: np.sin(np.pi * np.clip(t / 0.2, 0, 1)) ** 2),
                       notes_sfx([(0, 0.08, 0, 84, 90), (0.08, 0.08, 0, 88, 96)], {0: WOODBLOCK}, reverb=0.15), at=[0, 0.04]), 0.45)
    # A bridge that would cross another: a soft wooden bonk and a sorry little boing.
    sfx['bonk'] = (mix(notes_sfx([(0, 0.2, 0, 60, 84)], {0: WOODBLOCK}, reverb=0.2), boing(200, 150, 0.32, 0.5), at=[0, 0.02]), 0.5)
    sfx['undo'] = (mix(notes_sfx([(0, 0.4, 0, 86, 68), (0.09, 0.6, 0, 79, 62)], {0: KALIMBA}), hush(0.25, 800, 3000, 0.5, rng=rng, shape=lambda t: (t / 0.25) ** 2 * (t < 0.25))), 0.45)
    sfx['restart'] = (hush(1.1, 200, 2400, 1.0, rng=rng, shape=lambda t: np.sin(np.pi * np.clip(t / 1.1, 0, 1)) ** 1.5), 0.35)
    # Tapping the open sea: a drop of water, in a few pitches.
    for k in range(4):
        f = midi_hz(PENTA[5 + k * 2]) * 0.5
        sfx[f'drip-{k}'] = (mix(tone(f, f * 2.4, 0.06, 0.6, attack=0.004), tone(f * 1.5, f * 2.2, 0.05, 0.2), at=[0, 0.05]), 0.32)
    # Every island joined: a steel-drum fanfare with a harp, a celesta twinkle, a gull, and two toots.
    run = [(i * 0.1, 1.2, 0, p, 78 + i * 3) for i, p in enumerate([67, 71, 74, 79, 83, 86])]
    harp = [(0.05 + i * 0.06, 1.6, 1, p, 56) for i, p in enumerate([55, 59, 62, 67, 71, 74, 79])]
    twinkle = [(0.75 + i * 0.09, 1.6, 2, p, 58) for i, p in enumerate([91, 95, 93, 98])]
    pad = [(0, 2.8, 3, p, 46) for p in (55, 59, 62, 66)]
    fanfare = notes_sfx(run + harp + twinkle + pad, {0: STEEL_DRUM, 1: HARP, 2: CELESTA, 3: PAD}, reverb=0.6)
    sfx['win'] = (mix(fanfare, stereo(gull(np.random.default_rng(5), 0.22), 0.5), horn(0.12, (74, 79), 0.25), horn(0.3, (74, 79), 0.25), at=[0, 0.9, 1.75, 1.95]), 0.8)
    return sfx

# ---------------------------------------------------------------------------------------------

def main():
    only = ARGS.get('only')
    manifest = {'music': {}, 'effects': {}}
    if only in (None, 'music'):
        wanted = ARGS.get('tracks', '').split(',') if ARGS.get('tracks') else None
        for name, mood, seed, lead in TRACKS:
            if wanted and name not in wanted:
                manifest['music'].setdefault(mood, []).append(f'audio/{name}.mp3')
                continue
            signal = piece(mood, SEED + seed, lead)
            path = os.path.join(OUT, f'{name}.mp3')
            encode(signal, path, '112k')
            manifest['music'].setdefault(mood, []).append(f'audio/{name}.mp3')
            peak, rms = np.abs(signal).max(), np.sqrt(np.mean(signal ** 2))
            print(f'{name}: {len(signal) / RATE:.0f}s, peak {peak:.2f}, rms {rms:.3f}, {os.path.getsize(path) // 1024} KB')
    if only in (None, 'sfx'):
        for name, (signal, peak) in effects().items():
            signal = trim(signal)
            signal = signal / (np.abs(signal).max() + 1e-9) * peak
            encode(signal, os.path.join(OUT, 'sfx', f'{name}.mp3'), '96k')
            manifest['effects'][name] = f'audio/sfx/{name}.mp3'
        print(f'{len(manifest["effects"])} effects')
    path = os.path.join(ROOT, 'src', 'audioManifest.js')
    if only:
        previous = json.loads(open(path).read().split('=', 1)[1].strip().rstrip(';')) if os.path.exists(path) else {'music': {}, 'effects': {}}
        for key in manifest:
            if not manifest[key]:
                manifest[key] = previous.get(key, {})
    with open(path, 'w') as f:
        f.write('// Generated by scripts/compose-audio.py. Do not edit by hand.\n')
        f.write('// Music tracks by mood, and every sound effect by name, relative to the page.\n')
        f.write('export const AUDIO = ' + json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
