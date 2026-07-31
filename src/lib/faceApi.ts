// Dynamically load face-api from CDN to avoid TensorFlow.js dependency conflicts
// @vladmandic/face-api includes all TensorFlow dependencies correctly bundled
let FaceAPI: any = null;

async function loadFaceAPILibrary() {
  if (FaceAPI) return FaceAPI;
  
  try {
    // Load the library from CDN (includes all deps)
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.min.js';
    script.type = 'application/javascript';
    
    return new Promise((resolve, reject) => {
      script.onload = () => {
        FaceAPI = (window as any).FaceAPI;
        console.log("[FaceAPI] Face-API library loaded from CDN");
        resolve(FaceAPI);
      };
      script.onerror = () => {
        reject(new Error("Failed to load FaceAPI from CDN"));
      };
      document.head.appendChild(script);
    });
  } catch (e) {
    console.error("[FaceAPI] Error loading library:", e);
    throw e;
  }
}

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      console.log("[FaceAPI] Starting to load face models...");
      
      // Ensure FaceAPI library is loaded first
      if (!FaceAPI) {
        await loadFaceAPILibrary();
      }
      
      const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
      
      // Load all models
      await Promise.all([
        FaceAPI.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        FaceAPI.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        FaceAPI.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      
      modelsLoaded = true;
      console.log("[FaceAPI] All face models loaded successfully");
    } catch (e) {
      console.error("[FaceAPI] Failed to load face models:", e);
      modelsLoaded = false;
      loadingPromise = null;
      throw e;
    }
  })();

  return loadingPromise;
}

export async function getFaceDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  try {
    await loadFaceModels();
    
    if (!FaceAPI) {
      throw new Error("FaceAPI library not loaded");
    }
    
    const detection = await FaceAPI
      .detectSingleFace(input, new FaceAPI.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    
    return detection?.descriptor ?? null;
  } catch (e) {
    console.error("[FaceAPI] Error getting face descriptor:", e);
    return null;
  }
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
    try {
      const descriptor = await getFaceDescriptor(input);
      if (descriptor) descriptors.push(descriptor);
    } catch (e) {
      console.warn(`[FaceAPI] Attempt ${i + 1} failed:`, e);
    }
    if (i < attempts - 1) await wait(delayMs);
  }

  if (descriptors.length === 0) {
    console.warn("[FaceAPI] No valid face descriptors generated from any attempt");
    return null;
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

export const MATCH_THRESHOLD = 0.40; // Stricter threshold - distance must be below 0.40 for match

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
