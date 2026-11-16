// The big bottom button on setup screens: the library Button (primary, or a plain outlined one).
import React from 'react';
import { Button } from '../../ui';

type Props = { label: string; onPress: () => void; kind?: 'primary' | 'plain'; disabled?: boolean; busy?: boolean };

export default function SetupButton({ label, onPress, kind = 'primary', disabled, busy }: Props) {
  return <Button label={label} onPress={onPress} kind={kind === 'primary' ? 'primary' : 'secondary'} disabled={disabled} loading={busy} />;
}
