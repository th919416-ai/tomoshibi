import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '../tokens';

/**
 * 全画面共通の夜の背景と余白。
 * scroll は中身の量に上限がある画面だけで使う（無限スクロールにしない。§1.1-1）。
 */
export function Screen({
  children,
  scroll = false,
  keyboard = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  keyboard?: boolean;
}) {
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={styles.inner}
      keyboardShouldPersistTaps="handled"
      style={styles.flex}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.inner, styles.flex]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.night },
  flex: { flex: 1 },
  inner: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    gap: space.lg,
  },
});
