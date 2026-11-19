import { Redirect, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useUiStore } from '@/store/uiStore';
import { LoadingView, MessageView } from '@/ui';
import { RpcError } from '@/lib/rpc';

import { routeForState, type TodayRoute, type TodayState } from './types';
import { useToday } from './useToday';

export const ROUTE_HREF: Record<TodayRoute, Href> = {
  home: '/',
  timer: '/timer',
  write: '/write',
  support: '/support',
  letters: '/letters',
  done: '/done',
};

/**
 * 今日の状態に合った画面だけを表示する。別の画面に居るべき状態なら、そちらへ移す。
 * （状態はサーバーのタイムスタンプから導出され、端末の記憶には頼らない。§4）
 */
export function TodayGate({
  route,
  children,
}: {
  route: TodayRoute;
  children: (today: TodayState) => ReactNode;
}) {
  const { t } = useTranslation();
  const today = useToday();
  const supportDay = useUiStore((s) => s.supportAcknowledgedDay);

  if (today.isPending) return <LoadingView />;
  if (today.isError) {
    const code = today.error instanceof RpcError ? today.error.code : 'unknown';
    return (
      <MessageView
        message={t(`errors.${code}`)}
        actionLabel={t('common.retry')}
        onAction={() => void today.refetch()}
      />
    );
  }
  const target = routeForState(today.data, supportDay === today.data.dayKey);
  if (target !== route) return <Redirect href={ROUTE_HREF[target]} />;
  return <>{children(today.data)}</>;
}
