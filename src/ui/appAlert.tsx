// appAlert: the app's own pop-up, called exactly like Android's Alert.alert(title, message, buttons), so every screen
// gets the app's look instead of the grey system box. <AlertHost /> sits once in the root layout and shows them.
// Buttons: style 'cancel' is the quiet one, 'destructive' is red, anything else is the main (blue) one.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import RNModal from 'react-native-modal';
import Button from './Button';
import Txt from './Txt';
import { useTokens } from './useTokens';

export type AlertButton = { text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };
type Shown = { title: string; message?: string; buttons: AlertButton[] };

let show: ((a: Shown) => void) | null = null;

export function appAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const a = { title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] };
  if (show) show(a);
}

export function AlertHost() {
  const { c, radius } = useTokens();
  const [queue, setQueue] = useState<Shown[]>([]);
  useEffect(() => { show = (a) => setQueue((q) => [...q, a]); return () => { show = null; }; }, []);
  const a = queue[0];

  const press = (b: AlertButton) => {
    setQueue((q) => q.slice(1));
    setTimeout(() => b.onPress?.(), 250); // after the pop-up has gone, so a next pop-up or screen opens cleanly
  };
  const cancel = a?.buttons.find((b) => b.style === 'cancel');
  const stacked = (a?.buttons.length ?? 0) > 2;

  return (
    <RNModal isVisible={!!a} useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating
      onBackdropPress={cancel ? () => press(cancel) : undefined} onBackButtonPress={() => press(cancel ?? a!.buttons[a!.buttons.length - 1])}
      style={{ margin: 24, justifyContent: 'center' }}>
      {a && (
        <View style={{ backgroundColor: c.card, borderRadius: radius.card, padding: 20, gap: 10 }}>
          <Txt variant="heading">{a.title}</Txt>
          {!!a.message && <Txt variant="body" color="ink2">{a.message}</Txt>}
          <View style={{ flexDirection: stacked ? 'column' : 'row', gap: 10, marginTop: 8 }}>
            {a.buttons.map((b, i) => (
              <View key={i} style={stacked ? undefined : { flex: 1 }}>
                <Button size="md" label={b.text ?? 'OK'} onPress={() => press(b)}
                  kind={b.style === 'cancel' ? 'secondary' : b.style === 'destructive' ? 'danger' : 'primary'} />
              </View>
            ))}
          </View>
        </View>
      )}
    </RNModal>
  );
}
