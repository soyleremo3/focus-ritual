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

function generatePinkNoise() {
  // Voss-McCartney: sum a bank of noise generators, each updated at half the rate of the
  // last (chosen by the lowest set bit of the sample counter) — approximates the 1/f
  // spectral falloff of real pink noise without an FFT-based filter.
  const samples = new Float32Array(SAMPLE_COUNT);
  const NUM_ROWS = 16;
  const rows = new Array(NUM_ROWS).fill(0);
  let runningSum = 0;
  for (let r = 0; r < NUM_ROWS; r++) {
    rows[r] = Math.random() * 2 - 1;
    runningSum += rows[r];
  }

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const counter = i + 1;
    let n = counter;
    let rowIndex = 0;
    while ((n & 1) === 0 && rowIndex < NUM_ROWS - 1) {
      n >>= 1;
      rowIndex += 1;
    }
    runningSum -= rows[rowIndex];
    rows[rowIndex] = Math.random() * 2 - 1;
    runningSum += rows[rowIndex];
    samples[i] = runningSum / NUM_ROWS;
  }

  return normalize(Array.from(samples), 0.6);
}

function generateOceanWaves() {
  const samples = new Float32Array(SAMPLE_COUNT);
  let lp = 0;
  const alpha = 0.05; // deeper low-pass than rain — a heavier, rounder "whoosh"
  const WAVE_CYCLES = 3; // whole cycles across the loop duration → seamless

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const white = Math.random() * 2 - 1;
    lp = lp + alpha * (white - lp);

    const t = i / SAMPLE_COUNT;
    // Sharper crest, slower trough — real swell isn't a plain sine.
    const swell = 0.5 + 0.5 * Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * WAVE_CYCLES * t), 1.5);
    samples[i] = lp * (0.35 + 0.65 * swell);
  }

  return normalize(Array.from(samples), 0.85);
}

function generateWind() {
  const samples = new Float32Array(SAMPLE_COUNT);
  let lp = 0;
  const alpha = 0.08;
  const GUST_CYCLES_A = 5;
  const GUST_CYCLES_B = 7; // a second, non-aligned cycle count → gusts read as irregular, loop stays seamless

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const white = Math.random() * 2 - 1;
    lp = lp + alpha * (white - lp);

    const t = i / SAMPLE_COUNT;
    const gustA = Math.sin(2 * Math.PI * GUST_CYCLES_A * t);
    const gustB = Math.sin(2 * Math.PI * GUST_CYCLES_B * t + 1.3);
    const gust = 0.65 + 0.35 * (0.6 * gustA + 0.4 * gustB);
    samples[i] = lp * gust;
  }

  return normalize(Array.from(samples), 0.82);
}

function generateFireplace() {
  const samples = new Float32Array(SAMPLE_COUNT);
  let last = 0;

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.015 * white) / 1.015; // warm low rumble, quieter base than pure brown noise
    samples[i] = last * 0.6;
  }

  // Sparse crackle pops — sharper decay than rain's droplets, reads as a "pop" not a "drip".
  let nextPopAt = Math.floor(Math.random() * SAMPLE_RATE * 0.15);
  while (nextPopAt < SAMPLE_COUNT) {
    const decaySamples = Math.floor(SAMPLE_RATE * (0.008 + Math.random() * 0.025));
    const amplitude = 0.4 + Math.random() * 0.5;
    for (let j = 0; j < decaySamples && nextPopAt + j < SAMPLE_COUNT; j++) {
      const envelope = Math.exp(-j / (decaySamples * 0.2));
      const idx = nextPopAt + j;
      samples[idx] += (Math.random() * 2 - 1) * amplitude * envelope;
    }
    nextPopAt += Math.floor(SAMPLE_RATE * (0.1 + Math.random() * 0.35));
  }

  return normalize(Array.from(samples), 0.88);
}

writeWav('white-noise.wav', normalize(Array.from(generateWhiteNoise()), 0.5));
writeWav('brown-noise.wav', generateBrownNoise());
writeWav('rain.wav', generateRain());
writeWav('pink-noise.wav', generatePinkNoise());
writeWav('ocean-waves.wav', generateOceanWaves());
writeWav('wind.wav', generateWind());
writeWav('fireplace.wav', generateFireplace());
