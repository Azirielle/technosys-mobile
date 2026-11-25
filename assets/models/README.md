# mobile_facenet.tflite

MobileFaceNet (112×112 RGB face → 128-number embedding), TFLite float build from Qualcomm AI Hub v0.67.0
(https://huggingface.co/qualcomm/MobileFaceNet). License: Apache-2.0 (model page and the original implementation,
https://github.com/foamliu/MobileFaceNet). Trained on MS-Celeb-1M with ArcFace loss.
Inputs: `img1`, `img2`, each float32 [1, 3, 112, 112], RGB, 0–1 (the model normalizes inside). Output: `embeddings` [2, 128].
Used by `src/lib/face/` for the face check on time-in (CONSULTATION_FIXES B15).
