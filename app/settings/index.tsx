import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SUPPORT_EMAIL } from '@/config/constants';
import { sessionQueryKey } from '@/features/auth/useSession';
import { linkAccount, linkedProviders, type LinkProvider } from '@/features/auth/linkAccount';
import {
  deleteMyAccount,
  enableQuestionNotifications,
  profileQueryKey,
  updateSettings,
  useProfile,
} from '@/features/settings/api';
import { cancelTimerEnd } from '@/lib/notifications';
import { getSupabase } from '@/lib/supabase';
import {
  AppText,
  Button,
  colors,
  Header,
  LoadingView,
  MIN_TOUCH_TARGET,
  Screen,
  Sheet,
  space,
} from '@/ui';

/** 設定（§10-7） */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const profile = useProfile();
  const providers = useQuery({ queryKey: ['linkedProviders'], queryFn: linkedProviders });
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggle = useMutation({
    mutationFn: async (v: { key: 'question' | 'timer'; on: boolean }) => {
      if (v.key === 'question' && v.on) {
        const ok = await enableQuestionNotifications();
        if (!ok) throw new Error('permission');
        return null;
      }
      if (v.key === 'timer' && !v.on) await cancelTimerEnd();
      return updateSettings(
        v.key === 'question' ? { notifyQuestion: v.on } : { notifyTimer: v.on },
      );
    },
    onError: () => setMessage(t('settings.permissionDenied')),
    onSettled: () => void client.invalidateQueries({ queryKey: profileQueryKey }),
  });

  const link = useMutation({
    mutationFn: (p: LinkProvider) => linkAccount(p),
    onError: () => setMessage(t('settings.linkFailed')),
    onSettled: () => void providers.refetch(),
  });

  const remove = useMutation({
    mutationFn: async () => {
      await deleteMyAccount();
      await cancelTimerEnd();
      await getSupabase().auth.signOut({ scope: 'local' });
    },
    onSuccess: () => {
      setConfirmDelete(false);
      client.clear();
      // 新しい匿名アカウントで最初から（オンボーディングへ）
      void client.invalidateQueries({ queryKey: sessionQueryKey });
      router.replace('/');
    },
    onError: () => setMessage(t('errors.unknown')),
  });

  if (profile.isPending) return <LoadingView />;
  const p = profile.data;
  const linked = providers.data ?? [];

  return (
    <Screen scroll>
      <Header back />
      <AppText variant="question" accessibilityRole="header">
        {t('settings.title')}
      </AppText>
      {message ? (
        <AppText variant="caption" tone="candle" accessibilityLiveRegion="polite">
          {message}
        </AppText>
      ) : null}

      <Section title={t('settings.notifications')}>
        <ToggleRow
          label={t('settings.notifyQuestion')}
          note={t('settings.notifyQuestionNote')}
          value={p?.notifyQuestion ?? false}
          onChange={(on) => toggle.mutate({ key: 'question', on })}
        />
        <ToggleRow
          label={t('settings.notifyTimer')}
          note={t('settings.notifyTimerNote')}
          value={p?.notifyTimer ?? true}
          onChange={(on) => toggle.mutate({ key: 'timer', on })}
        />
      </Section>

      <Section title={t('settings.account')}>
        {linked.length ? (
          linked.map((name) => (
            <AppText key={name} tone="muted">
              {t('settings.linked', { provider: name === 'apple' ? 'Apple' : 'Google' })}
            </AppText>
          ))
        ) : (
          <>
            <AppText variant="caption" tone="muted">
              {t('settings.anonymous')}
            </AppText>
            {Platform.OS === 'ios' ? (
              <Button
                label={t('settings.linkApple')}
                variant="ghost"
                disabled={link.isPending}
                onPress={() => link.mutate('apple')}
              />
            ) : null}
            <Button
              label={t('settings.linkGoogle')}
              variant="ghost"
              disabled={link.isPending}
              onPress={() => link.mutate('google')}
            />
          </>
        )}
      </Section>

      <Section title={t('settings.about')}>
        <LinkRow label={t('settings.terms')} href="/settings/terms" />
        <LinkRow label={t('settings.privacy')} href="/settings/privacy" />
        <LinkRow label={t('settings.externalTransmission')} href="/settings/external" />
        <LinkRow label={t('settings.licenses')} href="/settings/licenses" />
        <View style={styles.contact}>
          <AppText variant="label">{t('settings.contact')}</AppText>
          <AppText variant="caption" tone="muted">
            {t('settings.contactBody')}
          </AppText>
          {SUPPORT_EMAIL ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${SUPPORT_EMAIL} ${t('settings.copy')}`}
              onPress={() =>
                void Clipboard.setStringAsync(SUPPORT_EMAIL).then(() =>
                  setMessage(t('settings.copied')),
                )
              }
              style={styles.row}
            >
              <AppText selectable>{SUPPORT_EMAIL}</AppText>
              <AppText variant="caption" tone="muted">
                {t('settings.copy')}
              </AppText>
            </Pressable>
          ) : (
            <AppText variant="caption" tone="muted">
              —
            </AppText>
          )}
        </View>
        <AppText variant="caption" tone="muted">
          {t('settings.version', { version: Constants.expoConfig?.version ?? '' })}
        </AppText>
      </Section>

      <Button
        label={t('settings.deleteAccount')}
        variant="ghost"
        onPress={() => setConfirmDelete(true)}
      />

      <Sheet
        visible={confirmDelete}
        title={t('settings.deleteAccount')}
        body={t('settings.deleteConfirm')}
        onClose={() => setConfirmDelete(false)}
      >
        <Button
          label={t('settings.deleteDo')}
          disabled={remove.isPending}
          onPress={() => remove.mutate()}
        />
        <Button
          label={t('common.cancel')}
          variant="ghost"
          onPress={() => setConfirmDelete(false)}
        />
      </Sheet>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="caption" tone="candle">
        {title}
      </AppText>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  note,
  value,
  onChange,
}: {
  label: string;
  note: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <AppText>{label}</AppText>
        <AppText variant="caption" tone="muted">
          {note}
        </AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.accent.ember, false: colors.line }}
        thumbColor={colors.text.paper}
      />
    </View>
  );
}

function LinkRow({ label, href }: { label: string; href: Href }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      style={styles.row}
    >
      <AppText>{label}</AppText>
      <AppText tone="muted">›</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    minHeight: MIN_TOUCH_TARGET,
  },
  rowText: { flex: 1, gap: space.xs },
  contact: { gap: space.xs, paddingVertical: space.sm },
});
