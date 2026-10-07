#!/usr/bin/env python3
"""Composes and renders Hamster Hideaway's music and sound effects into audio files.

The music is a gentle lullaby in G major for a cosy habitat: a soft Rhodes, a nylon
guitar picking slowly, a walking upright bass, and a music box, celesta or kalimba
singing a few unhurried notes, laid over a faint warm room tone with now and then
the rustle of bedding. It is written here as notes, rendered through real sampled
instruments (the FluidR3 General MIDI soundfont, through FluidSynth). Every melody
stays in G major pentatonic, and the sound effects (glass clinks for tubes, hamster
squeaks, music-box chimes) are pitched in the same key, so they always sit inside
the music.

Writes public/audio/*.mp3, public/audio/sfx/*.mp3, and src/audioManifest.js.
Adapted from Tiny Isles' scripts/compose-audio.py.

Needs: fluidsynth, the fluid-soundfont-gm soundfont, ffmpeg, numpy and scipy.
    python3 scripts/compose-audio.py [--seed=2026] [--only=music|sfx] [--tracks=play-1,play-2]
"""
import hashlib
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
    # Background music for every screen: slow, low, sparse and warm, so it never
    # pulls attention from the islands. (The engine also handles a livelier style:
    # tempo 80, lead_range (67, 88), density 0.85, guitar_up 12, groove and shaker 1,
    # accordion 0.7, glock 0.4 and no warm filter.)
    'play': dict(tempo=66, lead_range=(67, 88), density=0.36, guitar=0.6, guitar_up=0, groove=0.0, shaker=0.2, accordion=0.0, glock=0.25, bell=0.0, warm=3600),
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


def rustle(rng, level=1.0):
    """A hamster shuffling in its bedding: a few soft, dry scratches."""
    parts = []
    for _ in range(rng.integers(3, 7)):
        n = int(rng.uniform(0.03, 0.08) * RATE)
        t = np.arange(n) / RATE
        scratch = band(rng.standard_normal(n), low=1800, high=6500) * np.sin(np.pi * t / t[-1]) ** 2
        parts += [scratch, np.zeros(int(rng.uniform(0.02, 0.09) * RATE))]
    out = np.concatenate(parts)
    return out / (np.abs(out).max() + 1e-9) * level


def habitat(seconds, rng):
    """A faint warm room tone, and now and then a hamster rustling somewhere."""
    n = int(seconds * RATE)
    bed = band(rng.standard_normal((n, 2)), low=60, high=500) * 0.02
    layer = np.zeros_like(bed)
    t = rng.uniform(3, 8)
    while t < seconds - 3:
        sound = band(rustle(rng, rng.uniform(0.02, 0.05)), high=4500)
        start = int(t * RATE)
        end = min(n, start + len(sound))
        layer[start:end] += stereo(sound[:end - start], rng.uniform(-0.8, 0.8))
        t += rng.uniform(8, 18)
    return bed + room(layer, 1.2, 0.3, rng)

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
    bed = habitat(seconds, np.random.default_rng(seed))
    music = music / (np.sqrt(np.mean(music ** 2)) + 1e-9) * 0.08
    bed = bed / (np.sqrt(np.mean(bed ** 2)) + 1e-9) * 0.012
    return master(music + bed)


TRACKS = [
    ('play-1', 'play', 23, MUSIC_BOX),
    ('play-2', 'play', 37, CELESTA),
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


def boing(f0, f1, length, level):
    """A springy little boing: a tone sliding up with a wobble that settles."""
    t = np.arange(int(length * RATE)) / RATE
    freq = (f0 * (f1 / f0) ** (t / length)) * (1 + 0.18 * np.sin(2 * np.pi * 16 * t) * np.exp(-t * 7))
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    env = np.minimum(1, t / 0.006) * np.exp(-t / (length / 3.5))
    return stereo((np.sin(phase) + 0.25 * np.sin(2 * phase)) * env * level)


def squeak(f0, length=0.14, level=0.4, rise=1.35, wobble=0.05):
    """A hamster squeak: a high, breathy chirp that rises then dips, with a little flutter."""
    t = np.arange(int(length * RATE)) / RATE
    x = t / length
    freq = f0 * (1 + (rise - 1) * np.sin(np.pi * np.clip(x / 0.45, 0, 1) / 2) - 0.25 * np.clip((x - 0.5) / 0.5, 0, 1)) * (1 + wobble * np.sin(2 * np.pi * 38 * t))
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    voice = np.sin(phase) + 0.35 * np.sin(2 * phase) + 0.12 * np.sin(3 * phase)
    breath = band(np.random.default_rng(int(f0)).standard_normal(len(t)), low=3000, high=9000) * 0.08
    env = np.minimum(1, t / 0.01) * np.sin(np.pi * np.clip(x, 0, 1)) ** 0.6
    return stereo(band((voice + breath) * env, low=900, high=9000) * level)


def clink(note, level=0.5):
    """A tube clicking into place: a glassy ping on the celesta with a bright tick."""
    ping = notes_sfx([(0, 0.4, 0, note, 84), (0, 0.2, 1, note + 12, 48)], {0: CELESTA, 1: GLOCKENSPIEL}, reverb=0.35)
    return mix(ping, tone(4200, 3000, 0.018, 0.18), bubble(midi_hz(note) * 0.5, 0.05, 0.25))


def effects():
    """Every sound effect, by name: a signal and how loud it should sit (peak)."""
    sfx = {}
    rng = np.random.default_rng(SEED)
    # Moving about.
    sfx['tap'] = (mix(notes_sfx([(0, 0.25, 0, 83, 72)], {0: MARIMBA}), bubble(640, 0.07, 0.35)), 0.5)
    sfx['back'] = (mix(notes_sfx([(0, 0.25, 0, 76, 66)], {0: MARIMBA}), tone(900, 520, 0.09, 0.3)), 0.45)
    sfx['swoosh'] = (hush(0.5, 500, 3200, 1.0, rng=rng, shape=lambda t: np.sin(np.pi * np.clip(t / 0.5, 0, 1)) ** 2), 0.3)
    sfx['start'] = (mix(squeak(1900, 0.12, 0.35), notes_sfx([(0, 0.4, 0, 79, 70), (0.09, 0.4, 0, 83, 74), (0.18, 0.8, 0, 86, 80)], {0: KALIMBA}), at=[0, 0.12]), 0.6)
    # Tapping a hamster: one of a few squeaks.
    for k, (f, rise) in enumerate([(1800, 1.35), (2100, 1.25), (1650, 1.5), (2300, 1.2)]):
        sfx[f'squeak-{k}'] = (mix(squeak(f, 0.13, 0.5, rise), squeak(f * 1.1, 0.09, 0.35, rise), at=[0, 0.16 if k % 2 else 0.5]) if k % 2 else squeak(f, 0.16, 0.5, rise), 0.42)
    # Laying tubes, each a little higher along a drag.
    for i in range(8):
        sfx[f'tube-{i}'] = (clink(PENTA[i]), 0.42)
    # Dropping a seed: a woody tick and a tiny pop. Clearing a cell: a soft pop down.
    sfx['seed'] = (mix(notes_sfx([(0, 0.1, 0, 81, 80)], {0: WOODBLOCK}, reverb=0.15), tone(500, 900, 0.05, 0.3)), 0.38)
    sfx['clear'] = (mix(tone(620, 300, 0.09, 0.5), hush(0.12, 900, 3000, 0.25, rng=rng)), 0.34)
    # A room comes right: a music-box ding-ding with a happy squeak, a step higher each time.
    for k in range(7):
        sfx[f'room-{k}'] = (mix(notes_sfx([(0, 1.0, 0, PENTA[4 + k], 84), (0.1, 1.4, 0, PENTA[6 + k], 88)], {0: MUSIC_BOX}, reverb=0.55), squeak(2000 + k * 90, 0.12, 0.22, 1.3), at=[0, 0.22]), 0.5)
    # Furniture popping in.
    sfx['item'] = (mix(bubble(520, 0.07, 0.4), notes_sfx([(0, 0.2, 0, 91, 50)], {0: GLOCKENSPIEL})), 0.22)
    sfx['hint'] = (notes_sfx([(i * 0.07, 0.8, 0, p, 64) for i, p in enumerate([86, 91, 95])], {0: CELESTA}), 0.4)
    # Tubes too wide: a soft wooden bonk and a sorry little boing.
    sfx['bonk'] = (mix(notes_sfx([(0, 0.2, 0, 60, 84)], {0: WOODBLOCK}, reverb=0.2), boing(200, 150, 0.32, 0.5), at=[0, 0.02]), 0.5)
    sfx['undo'] = (mix(notes_sfx([(0, 0.4, 0, 86, 68), (0.09, 0.6, 0, 79, 62)], {0: KALIMBA}), hush(0.25, 800, 3000, 0.5, rng=rng, shape=lambda t: (t / 0.25) ** 2 * (t < 0.25))), 0.45)
    sfx['restart'] = (hush(1.1, 200, 2400, 1.0, rng=rng, shape=lambda t: np.sin(np.pi * np.clip(t / 1.1, 0, 1)) ** 1.5), 0.35)
    # Everyone has a room: a kalimba and harp run, a celesta twinkle, and a chorus of squeaks.
    run = [(i * 0.1, 1.2, 0, p, 78 + i * 3) for i, p in enumerate([67, 71, 74, 79, 83, 86])]
    harp = [(0.05 + i * 0.06, 1.6, 1, p, 56) for i, p in enumerate([55, 59, 62, 67, 71, 74, 79])]
    twinkle = [(0.75 + i * 0.09, 1.6, 2, p, 58) for i, p in enumerate([91, 95, 93, 98])]
    pad = [(0, 2.8, 3, p, 46) for p in (55, 59, 62, 66)]
    fanfare = notes_sfx(run + harp + twinkle + pad, {0: KALIMBA, 1: HARP, 2: CELESTA, 3: PAD}, reverb=0.6)
    sfx['win'] = (mix(fanfare, squeak(1900, 0.13, 0.25), squeak(2250, 0.11, 0.22), squeak(1750, 0.15, 0.22), at=[0, 0.8, 1.0, 1.25]), 0.8)
    return sfx

# ---------------------------------------------------------------------------------------------

def main():
    only = ARGS.get('only')
    manifest = {'music': {}, 'effects': {}}
    if only in (None, 'music'):
        wanted = ARGS.get('tracks', '').split(',') if ARGS.get('tracks') else None
        for name, mood, seed, lead in TRACKS:
            if wanted and name not in wanted:
                manifest['music'].setdefault('habitat', []).append(f'audio/{name}.mp3')
                continue
            signal = piece(mood, SEED + seed, lead)
            path = os.path.join(OUT, f'{name}.mp3')
            encode(signal, path, '112k')
            manifest['music'].setdefault('habitat', []).append(f'audio/{name}.mp3')
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
    # Each file's address carries a hash of its contents, so browsers fetch a
    # re-rendered file instead of an old cached copy.
    def versioned(url):
        file = os.path.join(ROOT, 'public', url.split('?')[0])
        return f"{url.split('?')[0]}?v={hashlib.md5(open(file, 'rb').read()).hexdigest()[:8]}"
    manifest = {'music': {mood: [versioned(u) for u in urls] for mood, urls in manifest['music'].items()},
                'effects': {name: versioned(u) for name, u in manifest['effects'].items()}}
    with open(path, 'w') as f:
        f.write('// Generated by scripts/compose-audio.py. Do not edit by hand.\n')
        f.write('// Music tracks by mood, and every sound effect by name, relative to the page.\n')
        f.write('export const AUDIO = ' + json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
