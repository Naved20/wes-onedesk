import * as faceapi from "face-api.js";

const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();

  return loadingPromise;
}

export async function getFaceDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  await loadFaceModels();
  const detection = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.35 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection?.descriptor ?? null;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function averageFaceDescriptors(descriptors: (Float32Array | number[])[]): Float32Array | null {
  if (descriptors.length === 0) return null;

  const length = descriptors[0].length;
  const average = new Float32Array(length);

  for (const descriptor of descriptors) {
    for (let i = 0; i < length; i++) {
      average[i] += descriptor[i] as number;
    }
  }

  for (let i = 0; i < length; i++) {
    average[i] /= descriptors.length;
  }

  return average;
}

export async function getAveragedFaceDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  attempts = 5,
  delayMs = 180
): Promise<Float32Array | null> {
  const descriptors: Float32Array[] = [];

  for (let i = 0; i < attempts; i++) {
    const descriptor = await getFaceDescriptor(input);
    if (descriptor) descriptors.push(descriptor);
    if (i < attempts - 1) await wait(delayMs);
  }

  return averageFaceDescriptors(descriptors);
}

export function euclideanDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] as number) - (b[i] as number);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export const MATCH_THRESHOLD = 0.68; // lower = stricter; averaged samples need a little room for live camera lighting

export function findBestMatch(
  candidate: Float32Array,
  enrolled: { user_id: string; descriptor: number[] }[]
): { user_id: string; distance: number } | null {
  let best: { user_id: string; distance: number } | null = null;
  for (const e of enrolled) {
    const d = euclideanDistance(candidate, e.descriptor);
    if (best === null || d < best.distance) {
      best = { user_id: e.user_id, distance: d };
    }
  }
  return best;
}
