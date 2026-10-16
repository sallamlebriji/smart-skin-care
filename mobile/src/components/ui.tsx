import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colors = { ink: '#28243c', muted: '#6e687b', primary: '#7453a6', background: '#faf7f5', line: '#e6deeb', error: '#a12e43' };
export function Screen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
    <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.screen}>
        <Text style={s.eyebrow}>SMART SKIN CARE</Text><Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}{children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function Card({ children }: { children: ReactNode }) { return <View style={s.card}>{children}</View>; }
export function Heading({ children }: { children: ReactNode }) { return <Text style={s.heading}>{children}</Text>; }
export function Copy({ children }: { children: ReactNode }) { return <Text style={s.copy}>{children}</Text>; }
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return children ? <Text accessibilityRole={error ? 'alert' : undefined} style={[s.notice, error && { color: colors.error }]}>{children}</Text> : null;
}
export function Button({ title, onPress, disabled, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.button, secondary && s.secondary, { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>
    <Text style={[s.buttonText, secondary && { color: colors.primary }]}>{title}</Text>
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 6 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...props} style={[s.input, props.style]} /></View>;
}
export function Busy() { return <ActivityIndicator color={colors.primary} style={{ padding: 16 }} accessibilityLabel="Loading" />; }
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: { width: '100%', maxWidth: 700, alignSelf: 'center', padding: 22, gap: 16, paddingBottom: 40 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2.5 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23, marginBottom: 6 },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 20, borderWidth: 1, borderColor: colors.line, gap: 13 },
  heading: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  notice: { color: colors.primary, backgroundColor: '#f1ebf5', padding: 14, borderRadius: 12, lineHeight: 21 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: colors.line, padding: 13, borderRadius: 12, color: colors.ink, backgroundColor: '#fff', fontSize: 16 },
  button: { padding: 15, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  secondary: { backgroundColor: '#f1ebf5' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
