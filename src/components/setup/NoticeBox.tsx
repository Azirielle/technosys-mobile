// A message box on setup screens: the library Notice (problem, pending/warning or OK).
import React from 'react';
import { Notice } from '../../ui';

const TONES = { error: 'error', warning: 'pending', success: 'ok' } as const;

export default function NoticeBox({ kind, text }: { kind: keyof typeof TONES; text: string }) {
  return <Notice tone={TONES[kind]} text={text} />;
}
