import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LEGAL_DOCS, LEGAL_DOCS_ARE_DRAFT, type LegalDocId } from '@/content/legal';
import { AppText, colors, Header, Screen, space } from '@/ui';

/** 利用規約・プライバシーポリシーなど（文章の長さに上限のある画面） */
export default function LegalDocScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const content = LEGAL_DOCS[doc as LegalDocId];
  if (!content) return null;
  return (
    <Screen scroll>
      <Header back />
      <AppText variant="question" accessibilityRole="header">
        {content.title}
      </AppText>
      <AppText variant="caption" tone="muted">
        {content.updated}
      </AppText>
      {LEGAL_DOCS_ARE_DRAFT ? (
        <View style={styles.draft}>
          <AppText variant="caption" tone="candle">
            DRAFT
          </AppText>
        </View>
      ) : null}
      {content.sections.map((s) => (
        <View key={s.heading} style={styles.section}>
          <AppText variant="label">{s.heading}</AppText>
          <AppText tone="muted">{s.body}</AppText>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  draft: { borderWidth: 1, borderColor: colors.accent.ember, padding: space.sm },
});
