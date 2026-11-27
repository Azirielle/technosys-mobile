// Setup step (technicians): save your face once, so every time-in can be compared with it (lib/face, B15).
// Same face screen as the time-in: 3 straight photos, then a left and right head turn; the face is saved only
// after the turns pass. No signal or no luck: "Later" goes on, and the first time-in saves the face instead.
import React, { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useT } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { enroll } from '../../lib/face/faceCheck';
import { goAfter, stepNumber } from '../../lib/setup';
import FaceCheckSheet from '../../components/face/FaceCheckSheet';
import SetupFrame from '../../components/setup/SetupFrame';
import SetupButton from '../../components/setup/SetupButton';
import InfoCard from '../../components/setup/InfoCard';
import NoticeBox from '../../components/setup/NoticeBox';

export default function FaceStep() {
  const router = useRouter();
  const t = useT();
  const { step, total } = stepNumber('face');
  const [open, setOpen] = useState(0); // > 0 = the face screen is open (a new number per try)
  const [failed, setFailed] = useState(false);
  const saved = useRef(false);

  const save = async (uri: string, face: number[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('signed out');
    await enroll(user.id, uri, face);
    saved.current = true;
  };

  return (
    <SetupFrame
      step={step}
      total={total}
      title={t('setup.face.title')}
      subtitle={t('setup.face.subtitle')}
      footer={
        <>
          <SetupButton label={t(failed ? 'face.tryAgain' : 'setup.face.start')} onPress={() => setOpen((n) => n + 1)} />
          {failed && <SetupButton kind="plain" label={t('setup.face.later')} onPress={() => goAfter(router, 'face')} />}
        </>
      }
    >
      <InfoCard index={1} icon="smile" title={t('setup.face.howTitle')} text={t('setup.face.howText')} />
      <InfoCard index={2} icon="shield" title={t('setup.face.whyTitle')} text={t('setup.face.whyText')} />
      {failed && <NoticeBox kind="warning" text={t('setup.face.failed')} />}
      {open > 0 && (
        <FaceCheckSheet
          key={open}
          enrolled={null}
          onEnrolled={save}
          onDone={() => {
            setOpen(0);
            if (saved.current) goAfter(router, 'face');
            else setFailed(true);
          }}
        />
      )}
    </SetupFrame>
  );
}
