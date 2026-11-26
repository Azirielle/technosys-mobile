// OfflineBanner: a short line at the top of Home and Jobs while the phone has no signal, with how many time-ins /
// time-outs are saved on the phone waiting to be sent.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useT } from '../lib/i18n';
import { syncQueue } from '../lib/syncQueue';
import { Notice } from '../ui';

export default function OfflineBanner({ online }: { online: boolean }) {
  const t = useT();
  const [saved, setSaved] = useState(0);
  useEffect(() => {
    if (online) return;
    const count = () => syncQueue.getQueue().then((q) => setSaved(q.filter((i) => i.type.startsWith('work_')).length)).catch(() => {});
    count();
    const timer = setInterval(count, 5000);
    return () => clearInterval(timer);
  }, [online]);
  if (online) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Notice tone="pending" text={saved ? `${t('offline.banner')} ${t('offline.bannerSaved', { n: saved })}` : t('offline.banner')} />
    </View>
  );
}
