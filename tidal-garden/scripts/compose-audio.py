#!/usr/bin/env python3
"""Composes and renders Tidal Garden's music and sound effects into audio files.

The music is written here as notes, rendered through real sampled instruments (the FluidR3 General
MIDI soundfont, through FluidSynth), and laid over a nature bed made with numpy: lapping waves,
birdsong, wind, and crickets at dusk. Everything is in F major, and every melody stays in the F major
pentatonic scale, so the sound effects (pitched in the same key) always sit inside the music.

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
PAD, HARP, KALIMBA, MUSIC_BOX, VIBES, CELESTA, FLUTE, MARIMBA = 89, 46, 108, 10, 11, 8, 73, 12
STRINGS, PIZZICATO, BELLS, WOODBLOCK = 49, 45, 14, 115

TEMPO = 66
BEAT = 60 / TEMPO
CHORD_BEATS = 8  # two bars of 4/4 per chord

# F major pentatonic (F G A C D) across the octaves.
PENTATONIC = [n for n in range(41, 100) if n % 12 in (5, 7, 9, 0, 2)]

# Two progressions that alternate: Fmaj7 Am7 B♭maj7 Cadd9, and Dm9 B♭maj7 F/A Csus4.
PROGRESSIONS = [
    [(41, [53, 57, 60, 64]), (45, [52, 57, 60, 64]), (46, [50, 53, 57, 62]), (48, [52, 55, 60, 62])],
    [(38, [53, 57, 60, 64]), (46, [50, 53, 57, 62]), (45, [53, 57, 60, 65]), (48, [53, 55, 60, 65])],
]

# How each mood plays: how often the harp arpeggiates, how busy the melody is, which instrument
# sings, and how much of the nature bed comes through.
MOODS = {
    'title': dict(harp=0.55, density=0.75, lead=KALIMBA, lead_vel=(52, 66), flute=0.35, chimes=0.3, waves=0.8, birds=0.75, wind=0.3, crickets=0),
    'map': dict(harp=0.65, density=0.85, lead=MUSIC_BOX, lead_vel=(46, 60), flute=0.2, chimes=0.35, waves=0.6, birds=0.9, wind=0.4, crickets=0),
    'garden': dict(harp=0.3, density=0.45, lead=KALIMBA, lead_vel=(40, 54), flute=0.0, chimes=0.15, waves=1.0, birds=0.35, wind=0.25, crickets=0),
    'evening': dict(harp=0.4, density=0.5, lead=VIBES, lead_vel=(38, 52), flute=0.0, chimes=0.2, waves=0.8, birds=0.0, wind=0.2, crickets=1.0),
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


def chirp(f0, f1, length, level=1.0, vibrato=0.0, rate=40.0):
    t = np.arange(int(length * RATE)) / RATE
    freq = f0 * (f1 / f0) ** (t / length)
    if vibrato:
        freq = freq * (1 + vibrato * np.sin(2 * np.pi * rate * t))
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    env = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 1.5
    return (np.sin(phase) + 0.18 * np.sin(2 * phase)) * env * level


def bird(rng):
    """One of three little songbirds: a few bright tweets, a quick warble, or a soft two-note call."""
    kind = rng.integers(3)
    parts = []
    if kind == 0:
        base = rng.uniform(2800, 3800)
        for _ in range(rng.integers(2, 5)):
            parts += [chirp(base, base * rng.uniform(1.25, 1.5), rng.uniform(0.05, 0.08)), np.zeros(int(rng.uniform(0.05, 0.1) * RATE))]
    elif kind == 1:
        base = rng.uniform(3000, 4200)
        parts += [chirp(base, base * 0.8, rng.uniform(0.35, 0.6), vibrato=0.08, rate=rng.uniform(25, 40))]
    else:
        base = rng.uniform(1700, 2300)
        parts += [chirp(base * 1.19, base * 1.16, 0.16), np.zeros(int(0.09 * RATE)), chirp(base, base * 0.97, 0.22)]
    return np.concatenate(parts)


def crickets(seconds, rng):
    n = int(seconds * RATE)
    out = np.zeros((n, 2))
    for pan, pitch, period in ((-0.6, rng.uniform(4300, 4600), rng.uniform(0.75, 0.95)), (0.55, rng.uniform(4600, 4900), rng.uniform(0.85, 1.1))):
        t = rng.uniform(0, 1)
        while t < seconds - 0.2:
            for k in range(3):
                start = int((t + k * 0.042) * RATE)
                length = int(0.026 * RATE)
                tt = np.arange(length) / RATE
                pulse = np.sin(2 * np.pi * pitch * tt) * np.sin(np.pi * tt / tt[-1]) ** 2
                out[start:start + length] += stereo(pulse, pan)[:max(0, min(length, n - start))]
            t += period * rng.uniform(0.9, 1.1)
    return out


def nature(seconds, mood, rng):
    bed = waves(seconds, rng) * 0.5 * mood['waves']
    bed += wind(seconds, rng) * 0.05 * mood['wind']
    if mood['birds']:
        layer = np.zeros_like(bed)
        t = rng.uniform(2, 6)
        while t < seconds - 2:
            if rng.random() < mood['birds']:
                song = bird(rng)
                start = int(t * RATE)
                end = min(len(layer), start + len(song))
                layer[start:end] += stereo(song[:end - start], rng.uniform(-0.75, 0.75)) * rng.uniform(0.05, 0.09)
            t += rng.uniform(4, 11)
        bed += room(layer, 1.2, 0.3, rng)
    if mood['crickets']:
        bed += crickets(seconds, rng) * 0.035 * mood['crickets']
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
    # Channels: 0 pad, 1 bass pad, 2 harp, 3 lead, 4 flute, 5 chimes.
    step = rng.choice([4, 5, 6])
    motif = None
    for index in range(chords):
        progression = PROGRESSIONS[(index // 8) % 2]
        bass, voicing = progression[index % 4]
        start = index * CHORD_BEATS
        # A warm pad holds the chord, with a soft low root beneath.
        for pitch in voicing:
            notes.append((start, CHORD_BEATS + 0.6, 0, pitch, rng.randint(38, 46)))
        notes.append((start, CHORD_BEATS + 0.4, 1, bass + 12, 46))
        # The harp sometimes rolls gently through the chord.
        if rng.random() < mood['harp']:
            tones = sorted(set(voicing + [p + 12 for p in voicing]))
            pattern = tones + tones[-2:0:-1] if rng.random() < 0.5 else tones
            for i, pitch in enumerate(pattern[:12]):
                notes.append((start + i * 0.5 + rng.uniform(-0.02, 0.02), 1.6, 2, pitch, rng.randint(36, 52)))
        # The lead sings a little motif every two chords, repeating it with a twist.
        if index % 2 == 0 and rng.random() < mood['density'] + 0.15:
            if motif is None or rng.random() < 0.4:
                motif = make_motif(rng, mood)
            phrase = vary(motif, rng) if rng.random() < 0.6 else motif
            pool = [p for p in PENTATONIC if 65 <= p <= 89]
            # Each phrase starts on a note of the chord, near where the last one ended.
            chord_tones = [p for p in pool if p % 12 in {v % 12 for v in voicing}]
            current = pool.index(nearest(chord_tones or pool, 72 + step))
            for offset, length, move in phrase:
                current = max(0, min(len(pool) - 1, current + move))
                pitch = pool[current]
                notes.append((start + offset + rng.uniform(-0.03, 0.03), length, 3, pitch, rng.randint(*mood['lead_vel'])))
            step = pool[current] - 72
        # Now and then a flute breathes a long note from the chord.
        if rng.random() < mood['flute'] and index % 4 == 1:
            pitch = nearest([p for p in PENTATONIC if 72 <= p <= 84 and p % 12 in {v % 12 for v in voicing}] or [77], 77)
            notes.append((start + 2, 5.5, 4, pitch, rng.randint(38, 48)))
        # A breeze stirs the wind chimes.
        if rng.random() < mood['chimes']:
            at = start + rng.uniform(1, 6)
            for k in range(rng.randint(3, 5)):
                notes.append((at + k * rng.uniform(0.15, 0.3), 2.5, 5, rng.choice([p for p in PENTATONIC if 84 <= p <= 98]), rng.randint(28, 40)))
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
    0: dict(volume=78, pan=64, reverb=90),
    1: dict(volume=70, pan=64, reverb=70),
    2: dict(volume=82, pan=44, reverb=100),
    3: dict(volume=96, pan=78, reverb=95),
    4: dict(volume=70, pan=58, reverb=110),
    5: dict(volume=64, pan=86, reverb=120),
}


def master(signal, target_rms=0.07, fade_in=3.0, fade_out=5.0):
    rms = np.sqrt(np.mean(signal ** 2))
    signal = signal * (target_rms / (rms + 1e-9))
    # A soft limiter: transparent below about -3 dB, rounding off anything above.
    signal = np.tanh(signal * 1.15) / 1.15
    n = len(signal)
    ramp_in, ramp_out = int(fade_in * RATE), int(fade_out * RATE)
    signal[:ramp_in] *= np.linspace(0, 1, ramp_in)[:, None] ** 2
    signal[n - ramp_out:] *= np.linspace(1, 0, ramp_out)[:, None] ** 2
    return signal


def piece(mood_name, chords, seed):
    mood = MOODS[mood_name]
    programs = {0: PAD, 1: PAD, 2: HARP, 3: mood['lead'], 4: FLUTE, 5: CELESTA}
    music = render_midi(compose(mood_name, chords, seed), programs, settings=SETTINGS)
    seconds = len(music) / RATE
    bed = nature(seconds, mood, np.random.default_rng(seed))
    music = music / (np.sqrt(np.mean(music ** 2)) + 1e-9) * 0.08
    # The nature bed sits well under the music, a little more present where the sea matters most.
    bed = bed / (np.sqrt(np.mean(bed ** 2)) + 1e-9) * 0.03 * (0.6 + 0.4 * mood['waves'])
    return master(music + bed)


TRACKS = [
    ('title', 'title', 20, 11),
    ('map', 'map', 20, 23),
    ('garden-1', 'garden', 24, 37),
    ('garden-2', 'garden', 24, 41),
    ('evening', 'evening', 12, 53),
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


PENTA_SFX = [p for p in PENTATONIC if 65 <= p <= 86]


def effects():
    """Every sound effect, by name: a signal and how loud it should sit (peak)."""
    sfx = {}
    rng = np.random.default_rng(SEED)
    # Menus.
    sfx['tap'] = (mix(notes_sfx([(0, 0.25, 0, 84, 70)], {0: MARIMBA}), bubble(620, 0.07, 0.35)), 0.55)
    sfx['back'] = (mix(notes_sfx([(0, 0.25, 0, 77, 66)], {0: MARIMBA}), tone(900, 520, 0.09, 0.3)), 0.5)
    sfx['swoosh'] = (hush(0.75, 400, 2600, 1.0, rng=rng, shape=lambda t: np.sin(np.pi * np.clip(t / 0.75, 0, 1)) ** 2), 0.32)
    sfx['start'] = (mix(notes_sfx([(0, 0.3, 0, 72, 80), (0.08, 0.3, 0, 74, 80), (0.16, 0.3, 0, 77, 84), (0.24, 0.6, 0, 81, 88), (0.4, 1.2, 1, 89, 70)], {0: KALIMBA, 1: CELESTA})), 0.75)
    for i in range(7):
        sfx[f'select-{i}'] = (notes_sfx([(0, 0.5, 0, PENTA_SFX[2 + i], 82)], {0: MARIMBA}), 0.6)
    sfx['locked'] = (notes_sfx([(0, 0.15, 0, 72, 70), (0.11, 0.15, 0, 67, 60)], {0: WOODBLOCK}, reverb=0.2), 0.45)
    sfx['open'] = (mix(bubble(520, 0.08, 0.5), bubble(760, 0.09, 0.45), at=[0, 0.08]), 0.45)
    sfx['hop'] = (notes_sfx([(0, 0.3, 0, 74, 85), (0.45, 0.4, 0, 81, 90)], {0: PIZZICATO}), 0.6)
    sfx['unlock'] = (notes_sfx([(i * 0.07, 1.4, 0, p, 70) for i, p in enumerate([81, 84, 86, 89])], {0: MUSIC_BOX}, reverb=0.6), 0.6)
    # The three pieces.
    sfx['water'] = (mix(*[bubble(f, 0.08, 0.45) for f in (430, 560, 720)], at=[0, 0.06, 0.13]), 0.5)
    # Land: two soft, round boops rising a fifth (water's bubbles, but lower and warmer) and a gentle
    # kalimba note. Only pure tones, no noise, so it's as smooth as the water.
    sfx['land'] = (mix(tone(midi_hz(65), midi_hz(65) * 1.12, 0.16, 0.5, attack=0.008), tone(midi_hz(72), midi_hz(72) * 1.08, 0.2, 0.45, attack=0.008),
                       notes_sfx([(0.0, 0.6, 0, 77, 56)], {0: KALIMBA}), at=[0, 0.09, 0.1]), 0.5)
    sfx['erase'] = (hush(0.45, 2500, 9000, 1.0, attack=0.06, rng=rng), 0.32)
    # Placing tiles: a bloop of water or a soft thump of earth, with a note pitched by where the tile
    # lands.
    for i in range(7):
        # Water: a round, low bloop that rises like a real droplet, a small bubble after it, and a
        # soft kalimba note. Only pure tones that sweep gently upwards, so nothing cracks or whips.
        f = midi_hz(PENTA_SFX[3 + i])
        bloop = tone(f * 0.5, f * 0.5 * 1.5, 0.09, 0.55, attack=0.008)
        after = bubble(f * 0.75, 0.07, 0.22)
        sfx[f'place-water-{i}'] = (mix(bloop, after, notes_sfx([(0.0, 0.6, 0, PENTA_SFX[3 + i], 56)], {0: KALIMBA}), at=[0, 0.075, 0.015]), 0.55)
        # A soft, low thump of earth and a small round pop, with the marimba note on top.
        thump = tone(160, 80, 0.2, 0.75, attack=0.008)
        pop = tone(midi_hz(PENTA_SFX[i] + 12) * 0.9, midi_hz(PENTA_SFX[i] + 12), 0.12, 0.2, attack=0.006)
        sfx[f'place-land-{i}'] = (mix(thump, pop, notes_sfx([(0.0, 0.5, 0, PENTA_SFX[i], 72)], {0: MARIMBA}), at=[0, 0.01, 0.012]), 0.6)
    sfx['place-erase'] = (hush(0.3, 600, 2400, 1.0, attack=0.02, rng=rng), 0.3)
    # Game actions.
    sfx['undo'] = (notes_sfx([(0, 0.3, 0, 81, 70), (0.09, 0.4, 0, 77, 66)], {0: KALIMBA}), 0.5)
    sfx['hint'] = (notes_sfx([(0, 1.0, 0, 84, 70), (0.13, 1.2, 0, 86, 74)], {0: CELESTA}, reverb=0.6), 0.5)
    sfx['oops'] = (notes_sfx([(0, 0.4, 0, 57, 70), (0.12, 0.5, 0, 53, 64)], {0: MARIMBA}), 0.5)
    sfx['restart'] = (hush(1.3, 200, 2200, 1.0, rng=rng, shape=lambda t: np.sin(np.pi * np.clip(t / 1.3, 0, 1)) ** 1.5), 0.4)
    gust = hush(1.0, 380, 1800, 1.0, rng=rng, shape=lambda t: np.sin(np.pi * np.clip(t / 1.0, 0, 1)) ** 2)
    sfx['flourish'] = (mix(gust, notes_sfx([(0.15 + i * 0.05, 1.0, 0, p, 50) for i, p in enumerate([65, 69, 72, 74, 77, 81])], {0: HARP})), 0.5)
    # The clues' celebrations.
    sfx['village'] = (notes_sfx([(0.0, 0.8, 0, 72, 80), (0.16, 0.8, 0, 77, 84), (0.32, 1.2, 0, 81, 86)], {0: KALIMBA}), 0.62)
    sfx['lighthouse'] = (notes_sfx([(0, 2.5, 0, 84, 72), (0.3, 1.6, 1, 89, 66), (0.45, 1.6, 1, 93, 62)], {0: BELLS, 1: CELESTA}, reverb=0.65), 0.6)
    sfx['ferry'] = (mix(horn(0.24), horn(0.42), at=[0, 0.36]), 0.5)
    sfx['pilgrim'] = (notes_sfx([(0, 3.5, 0, 65, 80), (0, 3.5, 1, 53, 50)], {0: BELLS, 1: BELLS}, reverb=0.75), 0.6)
    arp = [(0.0 + i * 0.13, 1.6, 0, p, 70 + i * 3) for i, p in enumerate([65, 69, 72, 77, 81, 84])]
    sparkle = [(0.9 + i * 0.09, 1.6, 1, p, 56) for i, p in enumerate([89, 93, 91, 96])]
    sfx['win'] = (notes_sfx(arp + sparkle + [(0, 2.6, 2, p, 44) for p in (53, 57, 60, 64)], {0: HARP, 1: CELESTA, 2: PAD}, reverb=0.65), 0.8)
    return sfx


def midi_hz(note):
    return 440 * 2 ** ((note - 69) / 12)


def horn(length):
    """A soft little ferry horn: two warm reedy tones a third apart, with a gentle swell."""
    t = np.arange(int((length + 0.15) * RATE)) / RATE
    out = np.zeros(len(t))
    for hz in (midi_hz(65), midi_hz(69)):
        phase = 2 * np.pi * hz * t * (1 + 0.004 * np.sin(2 * np.pi * 5 * t))
        out += sum(np.sin(k * phase) / k ** 1.4 for k in range(1, 7))
    env = np.minimum(1, t / 0.05) * np.where(t < length, 1, np.exp(-(t - length) / 0.05))
    return stereo(band(out * env, high=1800) * 0.25)

# ---------------------------------------------------------------------------------------------

def main():
    only = ARGS.get('only')
    manifest = {'music': {}, 'effects': {}}
    if only in (None, 'music'):
        for name, mood, chords, seed in TRACKS:
            signal = piece(mood, chords, SEED + seed)
            path = os.path.join(OUT, f'{name}.mp3')
            encode(signal, path, '128k')
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
        # Keep the half that wasn't rebuilt.
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
