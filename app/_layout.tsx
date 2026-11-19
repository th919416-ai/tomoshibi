import '@/i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useSession } from '@/features/auth/useSession';
import { MissingEnvError } from '@/lib/env';
import { configureNotificationHandler } from '@/lib/notifications';
import { createQueryClient } from '@/lib/queryClient';
import { colors, LoadingView, MessageView } from '@/ui';
import { useAppFonts } from '@/ui/fonts';

void SplashScreen.preventAutoHideAsync();
configureNotificationHandler();

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const { loaded, error } = useAppFonts();
  // フォントが読めなくてもシステムフォントで続行する
  const ready = loaded || error !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <SessionGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg.night },
              animation: 'fade',
            }}
          />
        </SessionGate>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/** 匿名セッションを確保してから画面を出す */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const session = useSession();
  if (session.isPending) return <LoadingView label={t('boot.preparing')} />;
  if (session.isError) {
    const message =
      session.error instanceof MissingEnvError ? t('boot.configMissing') : t('boot.authFailed');
    return (
      <MessageView
        message={message}
        actionLabel={t('common.retry')}
        onAction={() => void session.refetch()}
      />
    );
  }
  return <>{children}</>;
}
