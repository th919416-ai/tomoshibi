import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { initAds } from '@/features/ads/ads';
import { useProfile } from '@/features/settings/api';
import { colors, LoadingView, MessageView } from '@/ui';

/** はじめての人にはオンボーディングを先に見せる */
export default function MainLayout() {
  const { t } = useTranslation();
  const profile = useProfile();
  const onboarded = profile.data?.onboarded === true;

  // 広告の同意（UMP）→ ATT はオンボーディングの後、最初にメイン画面を開いたときに一度だけ（§9）
  useEffect(() => {
    if (onboarded) void initAds();
  }, [onboarded]);

  if (profile.isPending) return <LoadingView />;
  if (profile.isError) {
    return (
      <MessageView
        message={t('errors.unknown')}
        actionLabel={t('common.retry')}
        onAction={() => void profile.refetch()}
      />
    );
  }
  if (!profile.data.onboarded) return <Redirect href="/onboarding" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.night },
        animation: 'fade',
      }}
    />
  );
}
