// ConfirmDialog: a small "Are you sure?" pop-up with Cancel and a red confirm button (Android's own pop-up can't
// show red buttons). Use for actions that end something, e.g. Sign out.
import React from 'react';
import { View } from 'react-native';
import RNModal from 'react-native-modal';
import Button from './Button';
import Txt from './Txt';
import { useTokens } from './useTokens';

type Props = { open: boolean; title: string; text: string; confirmLabel: string; cancelLabel: string; busy?: boolean; onConfirm: () => void; onCancel: () => void };

export default function ConfirmDialog({ open, title, text, confirmLabel, cancelLabel, busy, onConfirm, onCancel }: Props) {
  const { c, radius } = useTokens();
  return (
    <RNModal isVisible={open} useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating
      onBackdropPress={busy ? undefined : onCancel} onBackButtonPress={busy ? undefined : onCancel} style={{ margin: 24, justifyContent: 'center' }}>
      <View style={{ backgroundColor: c.card, borderRadius: radius.card, padding: 20, gap: 10 }}>
        <Txt variant="heading">{title}</Txt>
        <Txt variant="body" color="ink2">{text}</Txt>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <View style={{ flex: 1 }}><Button kind="secondary" size="md" label={cancelLabel} onPress={onCancel} disabled={busy} /></View>
          <View style={{ flex: 1 }}><Button kind="danger" size="md" label={confirmLabel} onPress={onConfirm} loading={busy} /></View>
        </View>
      </View>
    </RNModal>
  );
}
