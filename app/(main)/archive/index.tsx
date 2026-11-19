import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AdBanner } from '@/features/ads/ads';
import {
  archiveQueryKey,
  deleteMyAnswer,
  fetchArchive,
  neighborMonths,
  type ArchiveEntry,
} from '@/features/archive/api';
import { now } from '@/lib/clock';
import { dayKeyOf } from '@/lib/dayCycle';
import { formatDayKey, formatYearMonth } from '@/lib/format';
import {
  AppText,
  Button,
  colors,
  Header,
  LoadingView,
  MessageView,
  MIN_TOUCH_TARGET,
  Screen,
  Sheet,
  space,
} from '@/ui';

/** 自分の記録（§10-6）。月単位で切り替える（無限スクロールにしない） */
export default function ArchiveScreen() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [month, setMonth] = useState(() => dayKeyOf(now()).slice(0, 7));
  const [deleting, setDeleting] = useState<ArchiveEntry | null>(null);
  const query = useQuery({ queryKey: archiveQueryKey(month), queryFn: () => fetchArchive(month) });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMyAnswer(id),
    onSuccess: () => {
      setDeleting(null);
      void client.invalidateQueries({ queryKey: ['archive'] });
    },
  });

  if (query.isPending) return <LoadingView />;
  if (query.isError) {
    return (
      <MessageView
        message={t('errors.unknown')}
        actionLabel={t('common.retry')}
        onAction={() => void query.refetch()}
      />
    );
  }
  const { months, entries } = query.data;
  const { prev, next } = neighborMonths(months, month);
  // 今月に記録が無く、過去に記録があるときは「前の月」から辿れる
  const prevMonth = prev ?? (entries.length === 0 ? (months[0] ?? null) : null);

  return (
    <View style={styles.flex}>
      <Screen scroll>
        <Header back />
        <View style={styles.head}>
          <AppText variant="question" accessibilityRole="header">
            {t('archive.title')}
          </AppText>
          <AppText tone="muted">{t('archive.lead')}</AppText>
        </View>

        <View style={styles.monthNav}>
          <MonthButton
            label={t('archive.prevMonth')}
            disabled={!prevMonth}
            onPress={() => prevMonth && setMonth(prevMonth)}
          />
          <AppText variant="label">{formatYearMonth(month)}</AppText>
          <MonthButton
            label={t('archive.nextMonth')}
            disabled={!next}
            onPress={() => next && setMonth(next)}
          />
        </View>

        {entries.length === 0 ? (
          <AppText tone="muted" style={styles.empty}>
            {t('archive.empty')}
          </AppText>
        ) : (
          entries.map((e) => (
            <View key={e.answerId} style={styles.entry}>
              <View style={styles.meta}>
                <AppText variant="caption" tone="candle">
                  {t(`genre.${e.genre}`)}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {formatDayKey(e.dayKey)}
                </AppText>
                {e.timerMinutes ? (
                  <AppText variant="caption" tone="muted">
                    {t('archive.thoughtFor', {
                      label: t(`home.timerOption.${e.timerMinutes as 10 | 60 | 360}`),
                    })}
                  </AppText>
                ) : null}
                {e.status !== 'approved' ? (
                  <AppText variant="caption" tone="muted">
                    {t(`archive.status.${e.status}`)}
                  </AppText>
                ) : null}
              </View>
              <AppText variant="body" tone="muted">
                {e.question}
              </AppText>
              <AppText variant="letter">{e.body}</AppText>
              <Pressable
                onPress={() => setDeleting(e)}
                accessibilityRole="button"
                accessibilityLabel={t('archive.delete')}
                style={styles.delete}
              >
                <AppText variant="caption" tone="muted">
                  {t('archive.delete')}
                </AppText>
              </Pressable>
            </View>
          ))
        )}
      </Screen>
      <AdBanner />

      <Sheet
        visible={deleting !== null}
        title={t('archive.delete')}
        body={t('archive.deleteConfirm')}
        onClose={() => setDeleting(null)}
      >
        <Button
          label={t('archive.deleteDo')}
          disabled={remove.isPending}
          onPress={() => deleting && remove.mutate(deleting.answerId)}
        />
        <Button label={t('common.cancel')} variant="ghost" onPress={() => setDeleting(null)} />
      </Sheet>
    </View>
  );
}

function MonthButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.monthButton, disabled && styles.disabled]}
    >
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg.night },
  head: { gap: space.sm },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  empty: { paddingVertical: space.xl },
  entry: {
    gap: space.sm,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  delete: { alignSelf: 'flex-start', minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
});
