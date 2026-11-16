// Styles shared by the sign-in forms (mobile number + PIN, email, other-phone notice), built on src/ui tokens.
import { StyleSheet } from 'react-native';
import { type, radius, shadow } from '../../ui/tokens';
import type { Palette } from '../../ui/tokens';

export const getLoginStyles = (c: Palette, isDark: boolean) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      width: '100%',
      padding: 22,
      borderRadius: radius.sheet,
      borderWidth: isDark ? 1 : 0,
      borderColor: c.line,
      ...(isDark ? {} : shadow.raised),
      gap: 0,
    },
    title: { ...type.title, color: c.ink, textAlign: 'center' },
    hint: { ...type.body, color: c.ink2, textAlign: 'center', marginTop: 4, marginBottom: 20 },
    label: { ...type.label, color: c.ink, marginBottom: 8 },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.cardSoft,
      borderRadius: radius.control,
      borderWidth: 1.5,
      borderColor: 'transparent',
      paddingHorizontal: 16,
      marginBottom: 16,
      height: 56,
    },
    inputWrapperFocus: { borderColor: c.brand, backgroundColor: c.card },
    inputWrapperError: { borderColor: c.error },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontFamily: type.body.fontFamily, fontSize: 17, color: c.ink },
    switchLink: { marginTop: 18, alignItems: 'center', paddingVertical: 8, gap: 2 },
    switchHint: { ...type.caption, color: c.ink2 },
    switchText: { ...type.label, color: c.brand, fontSize: 14 },
  });
