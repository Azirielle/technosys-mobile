// OfflineBanner: a small dot pill on Home and Jobs: green "Online", or red "Offline · 2 saved" (Round 6: the long
// sentence was too much). Tapping it explains what offline means: time-ins and time-outs are kept and sent later.
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useT } from '../lib/i18n';
import { syncQueue } from '../lib/syncQueue';
import { Txt, appAlert, useTokens } from '../ui';

export default function OfflineBanner({ online }: { online: boolean }) {
  const t = useT();
  const { c } = useTokens();
  const [saved, setSaved] = useState(0);
  useEffect(() => {
    const count = () => syncQueue.getQueue().then((q) => setSaved(q.filter((i) => i.type.startsWith('work_')).length)).catch(() => {});
    count();
    const timer = setInterval(count, 5000);
    return () => clearInterval(timer);
  }, [online]);
  const label = online ? t('offline.online') : saved ? `${t('offline.offline')} · ${t('offline.savedShort', { n: saved })}` : t('offline.offline');
  const explain = () => appAlert(label, online ? undefined : `${t('offline.banner')}${saved ? ` ${t('offline.bannerSaved', { n: saved })}` : ''}`);
  return (
    <Pressable onPress={explain} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 10, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: online ? c.okBg : c.errorBg }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: online ? c.ok : c.error }} />
      <Txt variant="caption" style={{ color: online ? c.ok : c.error }}>{label}</Txt>
    </Pressable>
  );
}
