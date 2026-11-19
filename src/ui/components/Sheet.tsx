import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, space } from '../tokens';
import { AppText } from './AppText';

/** 下から出る確認・選択用のシート（OS の確認ダイアログより静かに） */
export function Sheet({
  visible,
  title,
  body,
  onClose,
  children,
}: {
  visible: boolean;
  title?: string;
  body?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={title} />
      <View style={styles.sheet} accessibilityViewIsModal>
        {title ? <AppText variant="label">{title}</AppText> : null}
        {body ? <AppText tone="muted">{body}</AppText> : null}
        <View style={styles.actions}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.bg.charcoal,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  actions: { gap: space.sm },
});
