// Procedurally synthesizes the bundled ambient loops in assets/sounds/ — original audio,
// generated for this project, no external source or license. Re-run after editing to
// regenerate: node scripts/generate-sound-assets.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'assets', 'sounds');
const SAMPLE_RATE = 44100;
const DURATION_SECONDS = 20;
const SAMPLE_COUNT = SAMPLE_RATE * DURATION_SECONDS;

function writeWav(filename, samples) {
  const dataLength = samples.length * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataLength);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, filename), buffer);
  console.log(`wrote ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
}

function normalize(samples, targetPeak = 0.9) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  if (peak === 0) return samples;
  const scale = targetPeak / peak;
  return samples.map((s) => s * scale);
}

function generateWhiteNoise() {
  const samples = new Float32Array(SAMPLE_COUNT);
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    samples[i] = (Math.random() * 2 - 1) * 0.5;
  }
  return samples;
}

function generateBrownNoise() {
  const samples = new Float32Array(SAMPLE_COUNT);
  let last = 0;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02; // leaky integrator, avoids DC drift
    samples[i] = last;
  }
  return normalize(Array.from(samples), 0.85);
}

function generateRain() {
  const samples = new Float32Array(SAMPLE_COUNT);
  let lp = 0;
  const alpha = 0.12; // one-pole low-pass — turns white noise into a "shhh" hiss

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const white = Math.random() * 2 - 1;
    lp = lp + alpha * (white - lp);

    // Slow amplitude surge, exactly one cycle over the loop duration so the loop is seamless.
    const t = i / SAMPLE_COUNT;
    const surge = 0.82 + 0.18 * Math.sin(2 * Math.PI * t);

    samples[i] = lp * surge;
  }

  // Layer in sparse decaying "droplet" clicks.
  let nextDropletAt = Math.floor(Math.random() * SAMPLE_RATE * 0.2);
  while (nextDropletAt < SAMPLE_COUNT) {
    const decaySamples = Math.floor(SAMPLE_RATE * (0.005 + Math.random() * 0.015));
    const amplitude = 0.25 + Math.random() * 0.35;
    for (let j = 0; j < decaySamples && nextDropletAt + j < SAMPLE_COUNT; j++) {
      const envelope = Math.exp(-j / (decaySamples * 0.3));
      const idx = nextDropletAt + j;
      samples[idx] += (Math.random() * 2 - 1) * amplitude * envelope;
    }
    nextDropletAt += Math.floor(SAMPLE_RATE * (0.03 + Math.random() * 0.12));
  }

  return normalize(Array.from(samples), 0.88);
}

writeWav('white-noise.wav', normalize(Array.from(generateWhiteNoise()), 0.5));
writeWav('brown-noise.wav', generateBrownNoise());
writeWav('rain.wav', generateRain());
