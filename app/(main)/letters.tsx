import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { LETTER_SEEN_DWELL_MS, LETTERS_PER_DAY } from '@/config/constants';
import {
  blockLetterAuthor,
  fetchLetters,
  lettersQueryKey,
  markSeen,
  REACTION_TYPES,
  REPORT_REASONS,
  reportLetter,
  setReaction,
  type Letter,
  type LettersResult,
  type ReactionType,
} from '@/features/letters/api';
import { LetterCard } from '@/features/letters/LetterCard';
import { ReactionButton } from '@/features/letters/ReactionButton';
import { TodayGate } from '@/features/today/TodayGate';
import type { TodayState } from '@/features/today/types';
import { todayQueryKey } from '@/features/today/useToday';
import { RpcError } from '@/lib/rpc';
import {
  AppText,
  Button,
  colors,
  LoadingView,
  MessageView,
  MIN_TOUCH_TARGET,
  Screen,
  Sheet,
  space,
} from '@/ui';

/** 共感の広場（§7, §10-4）。1日10通まで。1枚ずつ横にめくる */
export default function LettersScreen() {
  return <TodayGate route="letters">{(today) => <Plaza today={today} />}</TodayGate>;
}

function Plaza({ today }: { today: TodayState }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: [...lettersQueryKey, today.dayKey],
    queryFn: fetchLetters,
    staleTime: 0,
  });

  if (query.isPending) return <LoadingView />;
  if (query.isError) {
    const code = query.error instanceof RpcError ? query.error.code : 'unknown';
    return (
      <MessageView
        message={t(`errors.${code}`)}
        actionLabel={t('common.retry')}
        onAction={() => void query.refetch()}
      />
    );
  }
  return <Pager data={query.data} dayKey={today.dayKey} />;
}

function Pager({ data, dayKey }: { data: LettersResult; dayKey: string }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Letter>>(null);
  const [index, setIndex] = useState(() => {
    const firstUnseen = data.letters.findIndex((l) => !l.seen);
    return firstUnseen === -1 ? Math.max(0, data.letters.length - 1) : firstUnseen;
  });
  const [completed, setCompleted] = useState(data.completed);
  const [menu, setMenu] = useState<'none' | 'menu' | 'report' | 'block'>('none');
  const [notice, setNotice] = useState<string | null>(null);
  const key = [...lettersQueryKey, dayKey];
  const letters = data.letters;
  const current = letters[index];

  // 2秒以上表示したカードを既読にする（§7.5）
  useEffect(() => {
    if (!current || current.seen) return;
    const id = setTimeout(() => {
      void markSeen(current.answerId)
        .then((r) => {
          client.setQueryData<LettersResult>(key, (old) =>
            old
              ? {
                  ...old,
                  letters: old.letters.map((l) =>
                    l.answerId === current.answerId ? { ...l, seen: true } : l,
                  ),
                }
              : old,
          );
          if (r.completed) setCompleted(true);
        })
        .catch(() => {});
    }, LETTER_SEEN_DWELL_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.answerId, current?.seen]);

  const react = useMutation({
    mutationFn: (v: { answerId: string; type: ReactionType; on: boolean }) =>
      setReaction(v.answerId, v.type, v.on),
    onSuccess: (r, v) =>
      client.setQueryData<LettersResult>(key, (old) =>
        old
          ? {
              ...old,
              letters: old.letters.map((l) =>
                l.answerId === v.answerId
                  ? { ...l, lightLevel: r.lightLevel, myReactions: r.myReactions }
                  : l,
              ),
            }
          : old,
      ),
  });

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(letters.length - 1, i));
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };
  const finish = () => {
    void client.invalidateQueries({ queryKey: todayQueryKey });
    router.replace('/done');
  };

  if (!letters.length) {
    return <MessageView message={t('letters.shortage')} />;
  }

  const isLast = index === letters.length - 1;
  const allSeen = letters.every((l) => l.seen);
  const position = t('letters.position', { current: index + 1, total: LETTERS_PER_DAY });

  return (
    <Screen>
      <View style={styles.top}>
        <AppText variant="caption" tone="candle" accessibilityRole="header">
          {t('letters.title')}
        </AppText>
        <AppText variant="caption" tone="muted">
          {position}
        </AppText>
        <Pressable
          onPress={() => setMenu('menu')}
          accessibilityRole="button"
          accessibilityLabel={t('letters.more')}
          hitSlop={8}
          style={styles.more}
        >
          <AppText tone="muted">…</AppText>
        </Pressable>
      </View>

      <View
        style={styles.dots}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: LETTERS_PER_DAY }, (_, i) => (
          <View
            key={i}
            style={[styles.dot, letters[i]?.seen && styles.dotSeen, i === index && styles.dotNow]}
          />
        ))}
      </View>

      <FlatList
        ref={listRef}
        data={letters}
        keyExtractor={(l) => l.answerId}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.list}
        renderItem={({ item, index: i }) => (
          <View style={{ width, paddingHorizontal: space.lg }}>
            <LetterCard
              letter={item}
              position={t('letters.position', { current: i + 1, total: LETTERS_PER_DAY })}
            />
          </View>
        )}
      />

      {current ? (
        <View style={styles.reactions} accessibilityLabel={t('letters.title')}>
          {REACTION_TYPES.map((type) => {
            const on = current.myReactions.includes(type);
            return (
              <ReactionButton
                key={type}
                type={type}
                on={on}
                disabled={react.isPending}
                onToggle={() => react.mutate({ answerId: current.answerId, type, on: !on })}
              />
            );
          })}
        </View>
      ) : null}

      {notice ? (
        <AppText variant="caption" tone="candle" accessibilityLiveRegion="polite">
          {notice}
        </AppText>
      ) : null}

      {isLast && allSeen && !data.isFull && !completed ? (
        <AppText variant="caption" tone="muted">
          {t('letters.shortage')}
        </AppText>
      ) : null}

      <View style={styles.nav}>
        <View style={styles.navSide}>
          {index > 0 ? (
            <Button label={t('letters.prev')} variant="ghost" onPress={() => goTo(index - 1)} />
          ) : null}
        </View>
        <View style={styles.navSide}>
          {completed && isLast ? (
            <Button label={t('letters.finish')} onPress={finish} />
          ) : !isLast ? (
            <Button label={t('letters.next')} onPress={() => goTo(index + 1)} />
          ) : null}
        </View>
      </View>
      <AppText variant="caption" tone="muted">
        {t('letters.note')}
      </AppText>

      <Sheet visible={menu === 'menu'} title={t('letters.more')} onClose={() => setMenu('none')}>
        <Button label={t('letters.report')} variant="ghost" onPress={() => setMenu('report')} />
        <Button label={t('letters.block')} variant="ghost" onPress={() => setMenu('block')} />
        <Button label={t('common.cancel')} variant="ghost" onPress={() => setMenu('none')} />
      </Sheet>
      <Sheet
        visible={menu === 'report'}
        title={t('letters.reportTitle')}
        onClose={() => setMenu('none')}
      >
        {REPORT_REASONS.map((reason) => (
          <Button
            key={reason}
            label={t(`letters.reportReasons.${reason}`)}
            variant="ghost"
            onPress={() => {
              if (current) void reportLetter(current.answerId, reason).catch(() => {});
              setMenu('none');
              setNotice(t('letters.reported'));
            }}
          />
        ))}
      </Sheet>
      <Sheet
        visible={menu === 'block'}
        title={t('letters.block')}
        body={t('letters.blockConfirm')}
        onClose={() => setMenu('none')}
      >
        <Button
          label={t('letters.block')}
          onPress={() => {
            if (current) void blockLetterAuthor(current.answerId).catch(() => {});
            setMenu('none');
            setNotice(t('letters.blocked'));
          }}
        />
        <Button label={t('common.cancel')} variant="ghost" onPress={() => setMenu('none')} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: MIN_TOUCH_TARGET },
  more: { marginLeft: 'auto', minWidth: MIN_TOUCH_TARGET, alignItems: 'flex-end' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 16, height: 3, borderRadius: 2, backgroundColor: colors.line },
  dotSeen: { backgroundColor: colors.accent.ember },
  dotNow: { backgroundColor: colors.accent.candle },
  list: { flexGrow: 0, marginHorizontal: -space.lg },
  reactions: { flexDirection: 'row', gap: space.sm },
  nav: { flexDirection: 'row', gap: space.sm },
  navSide: { flex: 1 },
});
