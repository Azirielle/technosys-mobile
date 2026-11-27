// FaceCheckSheet: the face check before a time-in (CONSULTATION_FIXES B15, C3; lib/work/useWork decides pass / try again). Full-screen front camera
// with an oval to put your face in and a big prompt on top; photos are silent (no shutter sound or flash):
// 1. "Look at the camera": until one face looks straight (enrolling: 3 of them, averaged = your face).
// 2. "Turn your head a little to the left", then "to the right" (order picked at random), each with an arrow: two
//    turns of 15° from straight in OPPOSITE directions, so a printed photo or a one-way video doesn't pass. (Which
//    angle sign means "left" depends on whether the camera mirrors the photo, so the check doesn't rely on it.)
//    Then the straight photo is scored against your face.
// One try per opening: a failed turn or no face found is sent back as it is. The face is saved only after the turns pass.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
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
type Step = 'straight' | 'left' | 'right' | 'checking';
type Hint = 'noFace' | 'straight' | 'more' | 'good' | null;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HINT_KEY = { noFace: 'face.hintNoFace', straight: 'face.hintStraight', more: 'face.hintMore', good: 'face.hintGood' } as const;

export default function FaceCheckSheet({ enrolled, onEnrolled, onDone }: Props) {
  const t = useT();
  const { c } = useTokens();
  const camera = useRef<CameraView>(null);
  const [permission, askPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>('straight');
  const [hint, setHint] = useState<Hint>(null);
  const [firstTurn, setFirstTurn] = useState<Step | null>(null); // shown as step 2; the other turn is step 3
  // Photos fail until the camera says it's open (27 Nov: all tries were used up in a moment, so no face, no turns)
  const [camReady] = useState(() => { let open = () => {}; const p = new Promise<void>((r) => { open = r; }); return { p, open }; });

  useEffect(() => {
    let stopped = false;
    const snap = async () => {
      const p = await camera.current?.takePictureAsync({ quality: 0.5, shutterSound: false }).catch(() => null);
      const face = p ? await findFace(p.uri).catch(() => null) : null;
      if (!p || !face) { setHint('noFace'); await wait(400); return null; } // a pause, so the tries last a few seconds
      return { ...p, face };
    };
    (async () => {
      if (!(permission?.granted || (await askPermission()).granted)) return onDone(null);
      await Promise.race([camReady.p, wait(10000)]);
      await wait(800); // let the person look at the camera
      // 1. Straight photos (3 when enrolling)
      const straight: { uri: string; numbers: number[]; turn: number }[] = [];
      for (let i = 0; i < 12 && straight.length < (enrolled ? 1 : 3) && !stopped; i++) {
        const shot = await snap().catch(() => null);
        if (!shot) continue;
        if (Math.abs(headTurn(shot.face)) >= 12) { setHint('straight'); continue; }
        setHint('good');
        straight.push({ uri: shot.uri, numbers: await faceNumbers(shot.uri, shot.face, shot.width, shot.height), turn: headTurn(shot.face) });
      }
      if (stopped) return;
      if (!straight.length) return onDone(null);
      // 2. Two head turns in opposite directions, in a random order
      const sides: Step[] = Math.random() < 0.5 ? ['left', 'right'] : ['right', 'left'];
      setFirstTurn(sides[0]);
      let firstSign = 0;
      let live = false;
      for (const side of sides) {
        setStep(side);
        setHint(null);
        let turned = false;
        for (let i = 0; i < 10 && !turned && !stopped; i++) {
          const shot = await snap().catch(() => null);
          if (!shot) continue;
          const d = headTurn(shot.face) - straight[0].turn;
          // first turn: any direction; second turn: the other direction from the first
          turned = Math.abs(d) > 15 && (!firstSign || Math.sign(d) === -firstSign);
          if (turned && !firstSign) firstSign = Math.sign(d);
          setHint(turned ? 'good' : 'more');
        }
        if (!turned || stopped) break;
        live = side === sides[1];
      }
      if (stopped) return;
      setStep('checking');
      let mine = enrolled;
      if (!mine && live) { // never save a face that did not turn (a photo)
        mine = averageFace(straight.map((s) => s.numbers));
        await onEnrolled(straight[0].uri, mine).catch(() => { mine = null; }); // no signal: enroll next time
      }
      onDone({ uri: straight[0].uri, live, score: mine ? similarity(mine, straight[0].numbers) : 0 });
    })().catch((e) => { console.warn('face check stopped:', e); onDone(null); }); // in the phone log (adb logcat)
    return () => { stopped = true; };
    // Runs once when the sheet opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const turning = step === 'left' || step === 'right';
  const words = step === 'straight' ? t(enrolled ? 'face.look' : 'face.enrollLook') : step === 'checking' ? t('face.checking') : t(step === 'left' ? 'face.turnLeft' : 'face.turnRight');
  const ring = hint === 'good' ? c.ok : hint ? c.pending : c.brand;
  return (
    <Modal visible animationType="slide" onRequestClose={() => { /* finishes by itself in a few seconds */ }}>
      <View style={{ flex: 1, backgroundColor: c.canvas }}>
        {permission?.granted && <CameraView ref={camera} style={{ flex: 1 }} facing="front" animateShutter={false} onCameraReady={camReady.open} />}
        {/* The oval: where to put your face; green when the photo is good, amber when something needs fixing */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 250, height: 330, borderRadius: 165, borderWidth: 4, borderColor: ring }} />
        </View>
        <View style={{ position: 'absolute', top: 48, left: 16, right: 16, padding: 16, borderRadius: 16, gap: 6, backgroundColor: c.card }}>
          <Txt variant="caption" color="ink2">{t('face.step', { n: step === 'straight' ? 1 : step === firstTurn ? 2 : 3 })}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {turning && <Feather name={step === 'left' ? 'arrow-left' : 'arrow-right'} size={28} color={c.brand} />}
            <Txt variant="title" style={{ flex: 1 }} accessibilityLiveRegion="polite">{words}</Txt>
          </View>
          {hint && step !== 'checking' && <Txt variant="body" style={{ color: ring }}>{t(HINT_KEY[hint])}</Txt>}
        </View>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 24, paddingBottom: 48, gap: 6, backgroundColor: c.card }}>
          {!enrolled && <Txt variant="caption" color="ink2">{t('face.enrollNote')}</Txt>}
          <Txt variant="caption" color="ink2">{t('face.why')}</Txt>
        </View>
      </View>
    </Modal>
  );
}
