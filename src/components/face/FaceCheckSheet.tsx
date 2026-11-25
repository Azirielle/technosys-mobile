// FaceCheckSheet: the verified selfie right after a time-in (CONSULTATION_FIXES B15). Full-screen front camera, no form:
// 1. "Look at the camera": photos until one face looks straight (enrolling: 3 of them, averaged = your face).
// 2. "Turn your head a little to the left / right" (picked at random): photos for a few seconds until the head turns
//    15° from straight, so a printed photo doesn't pass. Then the straight photo is scored against your face.
// Nothing here blocks the time-in: a failed turn or no face found is sent as it is, and HR reviews it.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useT } from '../../lib/i18n';
import { averageFace, faceNumbers, findFace, headTurn, similarity } from '../../lib/face/faceModel';
import type { FaceResult } from '../../lib/face/faceCheck';
import { Txt, useTokens } from '../../ui';

type Props = {
  /** Your enrolled face, or null to enroll now (then `onEnrolled` gets the new one) */
  enrolled: number[] | null;
  onEnrolled: (uri: string, face: number[]) => Promise<void>;
  /** null when no face could be checked (no camera, no face found) */
  onDone: (result: FaceResult | null) => void;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function FaceCheckSheet({ enrolled, onEnrolled, onDone }: Props) {
  const t = useT();
  const { c } = useTokens();
  const camera = useRef<CameraView>(null);
  const [permission, askPermission] = useCameraPermissions();
  const [step, setStep] = useState<'straight' | 'left' | 'right' | 'checking'>('straight');

  useEffect(() => {
    let stopped = false;
    const snap = async () => {
      const p = await camera.current?.takePictureAsync({ quality: 0.7 });
      if (!p) return null;
      const face = await findFace(p.uri).catch(() => null);
      return face ? { ...p, face } : null;
    };
    (async () => {
      if (!(permission?.granted || (await askPermission()).granted)) return onDone(null);
      await wait(1200); // let the camera open and the person look at it
      // 1. Straight photos (3 when enrolling)
      const straight: { uri: string; numbers: number[]; turn: number }[] = [];
      for (let i = 0; i < 12 && straight.length < (enrolled ? 1 : 3) && !stopped; i++) {
        const shot = await snap().catch(() => null);
        if (shot && Math.abs(headTurn(shot.face)) < 12) {
          straight.push({ uri: shot.uri, numbers: await faceNumbers(shot.uri, shot.face, shot.width, shot.height), turn: headTurn(shot.face) });
        }
      }
      if (stopped) return;
      if (!straight.length) return onDone(null);
      // 2. The head turn
      const side = Math.random() < 0.5 ? 'left' : 'right';
      setStep(side);
      let live = false;
      for (let i = 0; i < 8 && !live && !stopped; i++) {
        const shot = await snap().catch(() => null);
        live = !!shot && Math.abs(headTurn(shot.face) - straight[0].turn) > 15;
      }
      if (stopped) return;
      setStep('checking');
      let mine = enrolled;
      if (!mine) {
        mine = averageFace(straight.map((s) => s.numbers));
        await onEnrolled(straight[0].uri, mine).catch(() => { mine = null; }); // no signal: enroll next time
      }
      onDone({ uri: straight[0].uri, live, score: mine ? similarity(mine, straight[0].numbers) : 0 });
    })().catch(() => onDone(null));
    return () => { stopped = true; };
    // Runs once when the sheet opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const words = step === 'straight' ? t(enrolled ? 'face.look' : 'face.enrollLook') : step === 'checking' ? t('face.checking') : t(step === 'left' ? 'face.turnLeft' : 'face.turnRight');
  return (
    <Modal visible animationType="slide" onRequestClose={() => { /* finishes by itself in a few seconds */ }}>
      <View style={{ flex: 1, backgroundColor: c.canvas }}>
        {permission?.granted && <CameraView ref={camera} style={{ flex: 1 }} facing="front" />}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 24, paddingBottom: 48, gap: 6, backgroundColor: c.card }}>
          {!enrolled && <Txt variant="caption" color="ink2">{t('face.enrollNote')}</Txt>}
          <Txt variant="title" accessibilityLiveRegion="polite">{words}</Txt>
          <Txt variant="caption" color="ink2">{t('face.why')}</Txt>
        </View>
      </View>
    </Modal>
  );
}
