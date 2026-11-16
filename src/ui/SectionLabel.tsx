// SectionLabel: the small grey label above a group of cards ("Today's job", "Needs your attention").
import React from 'react';
import Txt from './Txt';

export default function SectionLabel({ children }: { children: string }) {
  return <Txt variant="label" color="ink2" accessibilityRole="header" style={{ marginTop: 18, marginBottom: 8, marginHorizontal: 4 }}>{children}</Txt>;
}
