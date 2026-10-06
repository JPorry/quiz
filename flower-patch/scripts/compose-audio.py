#!/usr/bin/env python3
"""Composes and renders Flower Patch's music and sound effects into audio files.

The music is written here as notes and rendered through real sampled instruments (the FluidR3
General MIDI soundfont, through FluidSynth): a warm pad, a softly picked harp and nylon guitar, a
kalimba or music box singing little tunes, a flute now and then, and wind chimes. Under it lies a
garden made with numpy: songbirds, the odd bumblebee going by and a whisper of breeze.
Everything is in G major, and every melody keeps to the G major pentatonic scale, so the sound
effects (pitched in the same key) always sit inside the music.

Writes public/audio/*.mp3, public/audio/sfx/*.mp3, and src/audioManifest.js.

Needs: fluidsynth, the fluid-soundfont-gm soundfont, ffmpeg, numpy and scipy.
    python3 scripts/compose-audio.py [--seed=2026] [--only=music|sfx]
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
PAD, HARP, KALIMBA, MUSIC_BOX, CELESTA, FLUTE, MARIMBA, GUITAR = 89, 46, 108, 10, 8, 73, 12, 24
PIZZICATO, WOODBLOCK, GLOCKEN = 45, 115, 9

TEMPO = 72
BEAT = 60 / TEMPO
CHORD_BEATS = 8  # two bars of 4/4 per chord

# G major pentatonic (G A B D E) across the octaves.
PENTATONIC = [n for n in range(40, 100) if n % 12 in (7, 9, 11, 2, 4)]

# Two progressions that alternate: Gmaj7 Em7 Cmaj7 Dadd9, and Am7 Cmaj7 G/B Dsus4.
PROGRESSIONS = [
    [(43, [55, 59, 62, 66]), (40, [55, 59, 62, 64]), (48, [55, 59, 64, 67]), (50, [54, 57, 62, 64])],
    [(45, [55, 60, 64, 67]), (48, [55, 59, 64, 67]), (47, [55, 59, 62, 67]), (50, [55, 57, 62, 67])],
]

# How each mood plays, and how much of the garden comes through.
MOODS = {
    'garden': dict(harp=0.35, guitar=0.45, density=0.6, lead=KALIMBA, lead_vel=(44, 58), flute=0.3, chimes=0.25,
                   birds=0.85, breeze=0.6, bees=0.35),
    'bloom': dict(harp=0.7, guitar=0.3, density=0.8, lead=MUSIC_BOX, lead_vel=(48, 62), flute=0.4, chimes=0.5,
                  birds=1.0, breeze=0.4, bees=0.6),
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
        on, off = max(0, int(start * tpq)), max(1, int((start + length) * tpq))
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
                        '-F', wav, SOUNDFONT, mid], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return read_wav(wav)


def read_wav(path):
    data = open(path, 'rb').read()
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
# The garden, made with numpy

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


def slow(n, rng, rate=0.12):
    """A slow, smooth wander between 0 and 1."""
    env = band(np.abs(rng.standard_normal((n, 1))).repeat(2, axis=1), high=rate)
    return (env - env.min()) / (np.ptp(env) + 1e-9)


def breeze(seconds, rng):
    """A light breeze in the leaves: a soft, airy rustle that swells and fades."""
    n = int(seconds * RATE)
    leaves = band(rng.standard_normal((n, 2)), low=900, high=5200)
    leaves = leaves / np.abs(leaves).max() * slow(n, rng) ** 2.2
    air = band(rng.standard_normal((n, 2)), low=150, high=700)
    air = air / np.abs(air).max() * slow(n, rng, 0.08) * 0.5
    return leaves + air


def chirp(f0, f1, length, level=1.0, vibrato=0.0, rate=40.0):
    t = np.arange(int(length * RATE)) / RATE
    freq = f0 * (f1 / f0) ** (t / length)
    if vibrato:
        freq = freq * (1 + vibrato * np.sin(2 * np.pi * rate * t))
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    env = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 1.5
    return (np.sin(phase) + 0.18 * np.sin(2 * phase)) * env * level


def bird(rng):
    """One of five little songbirds: bright tweets, a warble, a two-note call, a trill or a whistle."""
    kind = rng.integers(5)
    parts = []
    if kind == 0:
        base = rng.uniform(2800, 3800)
        for _ in range(rng.integers(2, 5)):
            parts += [chirp(base, base * rng.uniform(1.25, 1.5), rng.uniform(0.05, 0.08)), np.zeros(int(rng.uniform(0.05, 0.1) * RATE))]
    elif kind == 1:
        base = rng.uniform(3000, 4200)
        parts += [chirp(base, base * 0.8, rng.uniform(0.35, 0.6), vibrato=0.08, rate=rng.uniform(25, 40))]
    elif kind == 2:
        base = rng.uniform(1700, 2300)
        parts += [chirp(base * 1.19, base * 1.16, 0.16), np.zeros(int(0.09 * RATE)), chirp(base, base * 0.97, 0.22)]
    elif kind == 3:
        base = rng.uniform(3500, 4500)
        for _ in range(rng.integers(6, 12)):
            parts += [chirp(base, base * 0.92, 0.03), np.zeros(int(0.025 * RATE))]
    else:
        base = rng.uniform(2000, 2600)
        parts += [chirp(base, base * 1.5, 0.22), np.zeros(int(0.05 * RATE)), chirp(base * 1.5, base * 1.1, 0.3)]
    return np.concatenate(parts)


def bee(rng):
    """A bumblebee drifting past: a soft buzzing hum that comes and goes."""
    length = rng.uniform(2.5, 4.5)
    t = np.arange(int(length * RATE)) / RATE
    f = rng.uniform(170, 230) * (1 + 0.03 * np.sin(2 * np.pi * rng.uniform(0.5, 1.2) * t))
    phase = 2 * np.pi * np.cumsum(f) / RATE
    buzz = sum(np.sin(k * phase) / k for k in range(1, 9))
    buzz = band(buzz, low=150, high=2500) * (0.8 + 0.2 * np.sin(2 * np.pi * 23 * t))
    env = np.sin(np.pi * t / length) ** 2
    pan = np.linspace(rng.uniform(-0.8, -0.2), rng.uniform(0.2, 0.8), len(t))
    if rng.random() < 0.5:
        pan = pan[::-1]
    angle = (pan + 1) * np.pi / 4
    mono = buzz * env
    return np.stack([mono * np.cos(angle), mono * np.sin(angle)], axis=1)


def scatter(seconds, rng, chance, gap, make, level, wet=0.3):
    n = int(seconds * RATE)
    layer = np.zeros((n, 2))
    t = rng.uniform(1, gap[0])
    while t < seconds - 2:
        if rng.random() < chance:
            sound = make(rng)
            if sound.ndim == 1:
                sound = stereo(sound, rng.uniform(-0.75, 0.75))
            s = int(t * RATE)
            e = min(n, s + len(sound))
            layer[s:e] += sound[:e - s] * rng.uniform(*level)
        t += rng.uniform(*gap)
    return room(layer, 1.2, wet, rng)


def garden(seconds, mood, rng):
    # only a whisper of breeze: louder wind (and the brook it once had) washed over the music
    bed = breeze(seconds, rng) * 0.012 * mood['breeze']
    bed += scatter(seconds, rng, mood['birds'], (2.5, 7), bird, (0.05, 0.1))
    bed += scatter(seconds, rng, mood['bees'], (14, 30), bee, (0.01, 0.018), wet=0.15)
    return bed

# ---------------------------------------------------------------------------------------------
# The music

def nearest(pool, target):
    return min(pool, key=lambda n: abs(n - target))


def compose(mood_name, chords, seed):
    """Writes the notes for a piece of `chords` chords in the given mood."""
    mood = MOODS[mood_name]
    rng = random.Random(seed)
    notes = []
    # Channels: 0 pad, 1 bass pad, 2 harp, 3 lead, 4 flute, 5 chimes, 6 guitar.
    step = rng.choice([2, 4, 5])
    motif = None
    for index in range(chords):
        progression = PROGRESSIONS[(index // 8) % 2]
        bass, voicing = progression[index % 4]
        start = index * CHORD_BEATS
        for pitch in voicing:
            notes.append((start, CHORD_BEATS + 0.6, 0, pitch, rng.randint(34, 42)))
        notes.append((start, CHORD_BEATS + 0.4, 1, bass + 12, 44))
        # The guitar picks a lilting pattern through the chord, or the harp rolls through it.
        if rng.random() < mood['guitar']:
            tones = [bass + 12] + voicing
            pattern = [0, 2, 1, 3, 4, 3, 2, 1] * 2
            for i, k in enumerate(pattern):
                notes.append((start + i * 0.5 + rng.uniform(-0.02, 0.02), 1.2, 6, tones[k % len(tones)], rng.randint(40, 54) - (6 if i % 2 else 0)))
        elif rng.random() < mood['harp']:
            tones = sorted(set(voicing + [p + 12 for p in voicing]))
            pattern = tones + tones[-2:0:-1] if rng.random() < 0.5 else tones
            for i, pitch in enumerate(pattern[:12]):
                notes.append((start + i * 0.5 + rng.uniform(-0.02, 0.02), 1.6, 2, pitch, rng.randint(36, 50)))
        # The lead sings a little tune every two chords, repeating it with a twist.
        if index % 2 == 0 and rng.random() < mood['density'] + 0.15:
            if motif is None or rng.random() < 0.4:
                motif = make_motif(rng, mood)
            phrase = vary(motif, rng) if rng.random() < 0.6 else motif
            pool = [p for p in PENTATONIC if 67 <= p <= 91]
            chord_tones = [p for p in pool if p % 12 in {v % 12 for v in voicing}]
            current = pool.index(nearest(chord_tones or pool, 74 + step))
            for offset, length, move in phrase:
                current = max(0, min(len(pool) - 1, current + move))
                notes.append((start + offset + rng.uniform(-0.03, 0.03), length, 3, pool[current], rng.randint(*mood['lead_vel'])))
            step = pool[current] - 74
        # Now and then a flute breathes a long note from the chord.
        if rng.random() < mood['flute'] and index % 4 == 1:
            pitch = nearest([p for p in PENTATONIC if 74 <= p <= 86 and p % 12 in {v % 12 for v in voicing}] or [79], 79)
            notes.append((start + 2, 5.5, 4, pitch, rng.randint(36, 46)))
        # A breeze stirs the wind chimes.
        if rng.random() < mood['chimes']:
            at = start + rng.uniform(1, 6)
            for k in range(rng.randint(3, 5)):
                notes.append((at + k * rng.uniform(0.15, 0.3), 2.5, 5, rng.choice([p for p in PENTATONIC if 86 <= p <= 98]), rng.randint(26, 38)))
    return notes


def make_motif(rng, mood):
    """A short rhythmic idea: (beat offset, length, scale steps to move)."""
    rhythms = [[1, 1, 2], [0.5, 0.5, 1, 2], [1.5, 0.5, 2], [2, 1, 1], [1, 0.5, 0.5, 2], [3, 1]]
    offset, motif = rng.choice([0, 0.5, 1]), []
    while offset < 7:
        for length in rng.choice(rhythms):
            if offset >= 7:
                break
            if rng.random() < 0.82:
                motif.append((offset, length * 1.6, rng.choice([-2, -1, -1, 1, 1, 2, 0])))
            offset += length
        offset += rng.choice([0, 0.5, 1, 2]) * (1.4 - mood['density'])
    return motif


def vary(motif, rng):
    out = list(motif)
    if out:
        i = rng.randrange(len(out))
        offset, length, move = out[i]
        out[i] = (offset, length, move + rng.choice([-1, 1]))
    return out


SETTINGS = {
    0: dict(volume=74, pan=64, reverb=90),
    1: dict(volume=68, pan=64, reverb=70),
    2: dict(volume=80, pan=44, reverb=100),
    3: dict(volume=96, pan=78, reverb=95),
    4: dict(volume=68, pan=58, reverb=110),
    5: dict(volume=62, pan=86, reverb=120),
    6: dict(volume=82, pan=48, reverb=80),
}


def master(signal, target_rms=0.07, fade_in=3.0, fade_out=5.0):
    rms = np.sqrt(np.mean(signal ** 2))
    signal = signal * (target_rms / (rms + 1e-9))
    signal = np.tanh(signal * 1.15) / 1.15
    n = len(signal)
    ramp_in, ramp_out = int(fade_in * RATE), int(fade_out * RATE)
    signal[:ramp_in] *= np.linspace(0, 1, ramp_in)[:, None] ** 2
    signal[n - ramp_out:] *= np.linspace(1, 0, ramp_out)[:, None] ** 2
    return signal


def piece(mood_name, chords, seed):
    mood = MOODS[mood_name]
    programs = {0: PAD, 1: PAD, 2: HARP, 3: mood['lead'], 4: FLUTE, 5: CELESTA, 6: GUITAR}
    music = render_midi(compose(mood_name, chords, seed), programs, settings=SETTINGS)
    seconds = len(music) / RATE
    bed = garden(seconds, mood, np.random.default_rng(seed))
    music = music / (np.sqrt(np.mean(music ** 2)) + 1e-9) * 0.08
    # The garden sits well under the music: birds and the odd bee, never a wash of noise.
    bed = bed / (np.sqrt(np.mean(bed ** 2)) + 1e-9) * 0.022
    return master(music + bed)


TRACKS = [
    ('garden-1', 'garden', 20, 37),
    ('garden-2', 'garden', 20, 41),
    ('bloom', 'bloom', 12, 53),
]

# ---------------------------------------------------------------------------------------------
# Sound effects: soft, round and happy, all in G major pentatonic

def tone(f0, f1, length, level, attack=0.005):
    t = np.arange(int(length * RATE)) / RATE
    freq = f0 * (f1 / f0) ** (t / length)
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    env = np.minimum(1, t / attack) * np.exp(-t / (length / 4))
    return stereo(np.sin(phase) * env * level)


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


# the scale for effects, from G4 up
SCALE = [p for p in PENTATONIC if p >= 67]


def effects():
    """Every sound effect, by name: a signal and how loud it should sit (peak)."""
    sfx = {}
    rng = np.random.default_rng(SEED)
    rustle = lambda length, level=1.0: hush(length, 1200, 6000, level, attack=0.01, rng=rng)
    soil = lambda length, level=1.0: hush(length, 150, 900, level, attack=0.008, rng=rng)
    for n in range(1, 7):
        note = SCALE[n + 1]
        # Picking a bag: a paper rustle and a soft wooden note, higher for bigger seeds.
        sfx[f'pick-{n}'] = (mix(rustle(0.12, 0.25), notes_sfx([(0, 0.4, 0, note, 74)], {0: MARIMBA})), 0.5)
        # Planting: a soft pat of earth and a warm kalimba note for the seed.
        sfx[f'plant-{n}'] = (mix(tone(150, 85, 0.18, 0.7, attack=0.006), soil(0.15, 0.25),
                                 notes_sfx([(0.01, 0.7, 0, SCALE[n - 1], 66)], {0: KALIMBA}), at=[0, 0, 0.01]), 0.55)
        # A seedling opens its leaves: a tiny bright chirp of two music box notes.
        sfx[f'awake-{n}'] = (notes_sfx([(0, 0.5, 0, note + 12, 62), (0.07, 0.6, 0, SCALE[n + 3] + 12, 66)], {0: MUSIC_BOX}, reverb=0.5), 0.42)
        # A bed comes into flower: a little harp run that climbs with the bed's size, and a sparkle.
        run = [(i * 0.07, 1.4, 0, SCALE[i + n // 2], 66 + i * 3) for i in range(4)]
        sfx[f'bed-{n}'] = (notes_sfx(run + [(0.3, 1.6, 1, SCALE[n + 6], 52)], {0: HARP, 1: CELESTA}, reverb=0.6), 0.6)
    # The soil swells and cracks as a seedling wakes.
    sfx['sprout'] = (mix(soil(0.35, 0.6), tone(110, 160, 0.25, 0.3, attack=0.05)), 0.32)
    for r in range(6):
        # A plant pops into flower: a round little pop and a plucked note, rising with each plant.
        sfx[f'bud-{r}'] = (mix(bubble(midi_hz(SCALE[r]) * 0.5, 0.08, 0.35), notes_sfx([(0.01, 0.6, 0, SCALE[r + 2], 70)], {0: PIZZICATO})), 0.5)
    for k in range(7):
        # The finale: each flower opens with a soft music box note.
        sfx[f'bloom-{k}'] = (notes_sfx([(0, 0.9, 0, SCALE[k + 3], 58)], {0: MUSIC_BOX}, reverb=0.6), 0.32)
    for k in range(4):
        # The count of flowering beds ticks up.
        sfx[f'tick-{k}'] = (mix(notes_sfx([(0, 0.4, 0, SCALE[k + 6], 64)], {0: GLOCKEN}), bubble(1300, 0.05, 0.2)), 0.4)
    sfx['dig'] = (mix(soil(0.28, 1.0), rustle(0.18, 0.3), notes_sfx([(0.04, 0.4, 0, 55, 60)], {0: MARIMBA})), 0.45)
    sfx['droop'] = (notes_sfx([(0, 0.5, 0, 62, 62), (0.12, 0.7, 0, 59, 56)], {0: KALIMBA}), 0.45)
    sfx['bonk'] = (notes_sfx([(0, 0.2, 0, 64, 70)], {0: WOODBLOCK}, reverb=0.2), 0.4)
    sfx['boing'] = (mix(tone(260, 780, 0.2, 0.4, attack=0.01), notes_sfx([(0.04, 0.4, 0, 79, 70)], {0: PIZZICATO})), 0.45)
    sfx['undo'] = (notes_sfx([(0, 0.3, 0, 83, 64), (0.09, 0.4, 0, 79, 60)], {0: KALIMBA}), 0.45)
    sfx['open'] = (mix(bubble(560, 0.08, 0.5), bubble(820, 0.09, 0.45), at=[0, 0.08]), 0.4)
    sfx['close'] = (mix(bubble(820, 0.08, 0.45), bubble(560, 0.09, 0.4), at=[0, 0.07]), 0.38)
    sfx['tap'] = (mix(notes_sfx([(0, 0.25, 0, 86, 70)], {0: MARIMBA}), bubble(640, 0.07, 0.3)), 0.5)
    sfx['gust'] = (hush(2.6, 500, 3800, 1.0, rng=rng, shape=lambda t: np.sin(np.pi * np.clip(t / 2.6, 0, 1)) ** 2), 0.22)
    # The garden blooms: a harp run up the scale, celesta sparkles, a warm pad and a happy bird.
    arp = [(i * 0.12, 1.8, 0, p, 70 + i * 3) for i, p in enumerate([67, 71, 74, 79, 83, 86, 91])]
    sparkle = [(0.9 + i * 0.09, 1.6, 1, p, 56) for i, p in enumerate([95, 98, 93, 98])]
    music = notes_sfx(arp + sparkle + [(0, 2.8, 2, p, 44) for p in (55, 59, 62, 66)], {0: HARP, 1: CELESTA, 2: PAD}, reverb=0.65)
    song = stereo(bird(np.random.default_rng(SEED + 5)), 0.4) * 0.12
    sfx['win'] = (mix(music, song, at=[0, 1.1]), 0.8)
    return sfx

# ---------------------------------------------------------------------------------------------

def main():
    only = ARGS.get('only')
    manifest = {'music': {}, 'effects': {}}
    if only in (None, 'music'):
        for name, mood, chords, seed in TRACKS:
            signal = piece(mood, chords, SEED + seed)
            path = os.path.join(OUT, f'{name}.mp3')
            encode(signal, path, '96k')
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
