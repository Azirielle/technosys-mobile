// faceModel: finds the face in a photo (Google ML Kit) and turns it into 128 numbers with MobileFaceNet
// (assets/models/README.md), then compares two faces. All on the phone, so it works with no signal.
// Photo → face box (with a little margin) → 112×112 → RGB 0–1 in the model's channel order → 128 numbers, length 1.
import { RNMLKitFaceDetector, type RNMLKitFace } from '@infinitered/react-native-mlkit-face-detection';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { loadTensorflowModel, type TfliteModel } from 'react-native-fast-tflite';

const SIZE = 112;
let detector: RNMLKitFaceDetector | null = null;
let model: TfliteModel | null = null;

async function getDetector() {
  if (!detector) {
    detector = new RNMLKitFaceDetector({ performanceMode: 'accurate', classificationMode: true }, true);
    await detector.initialize({ performanceMode: 'accurate', classificationMode: true });
  }
  return detector;
}

async function getModel() {
  model ??= await loadTensorflowModel(require('../../../assets/models/mobile_facenet.tflite'), []);
  return model;
}

/** The one face in the photo, or null when there is none (or more than one: we can't tell whose). */
export async function findFace(uri: string): Promise<RNMLKitFace | null> {
  const result = await (await getDetector()).detectFaces(uri);
  return result?.faces.length === 1 ? result.faces[0] : null;
}

/** Left / right head turn in degrees (0 = looking straight at the camera). */
export const headTurn = (face: RNMLKitFace) => face.headEulerAngleY ?? 0;

/** 128 numbers for the face in the photo (`width` × `height` = the photo's size in pixels). */
export async function faceNumbers(uri: string, face: RNMLKitFace, width: number, height: number): Promise<number[]> {
  const { origin, size } = face.frame;
  const margin = 0.1 * Math.max(size.x, size.y);
  const x = Math.max(0, Math.round(origin.x - margin)), y = Math.max(0, Math.round(origin.y - margin));
  const crop = {
    originX: x, originY: y,
    width: Math.min(width - x, Math.round(size.x + 2 * margin)), height: Math.min(height - y, Math.round(size.y + 2 * margin)),
  };
  const small = await manipulateAsync(uri, [{ crop }, { resize: { width: SIZE, height: SIZE } }], { format: SaveFormat.JPEG, compress: 1, base64: true });
  const bytes = Uint8Array.from(atob(small.base64 ?? ''), (ch) => ch.charCodeAt(0));
  const { data } = decode(bytes, { useTArray: true, formatAsRGBA: true });

  // The model wants all the reds, then all the greens, then all the blues (1 × 3 × 112 × 112), each 0–1
  const input = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    input[i] = data[i * 4] / 255;
    input[SIZE * SIZE + i] = data[i * 4 + 1] / 255;
    input[2 * SIZE * SIZE + i] = data[i * 4 + 2] / 255;
  }
  // The model compares two faces at once (img1, img2); give it the same face twice and keep the first answer
  const [out] = await (await getModel()).run([input.buffer, input.buffer]);
  return toLengthOne(Array.from(new Float32Array(out).slice(0, 128)));
}

const toLengthOne = (v: number[]) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };

/** Average of several faces' numbers (enrollment takes 3 photos). */
export const averageFace = (faces: number[][]) => toLengthOne(faces[0].map((_, i) => faces.reduce((sum, f) => sum + f[i], 0) / faces.length));

/** How alike two faces are: 1 = the same photo, around 0.6 and up = the same person (the database decides). */
export const similarity = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);
