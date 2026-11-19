import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { requestModeration } from '@/features/answer/api';
import { checkAnswerLength } from '@/features/answer/validation';
import { submitAnswer } from '@/features/today/api';
import { TodayGate } from '@/features/today/TodayGate';
import type { TodayState } from '@/features/today/types';
import { todayQueryKey } from '@/features/today/useToday';
import { formatTime } from '@/lib/format';
import { cancelTimerEnd } from '@/lib/notifications';
import { RpcError } from '@/lib/rpc';
import { AppText, Button, colors, fontFamily, radius, Screen, space } from '@/ui';

/** 回答入力（§10-3）。タイマーが終わるまでは開かない（サーバーが WRITABLE を返したときだけ） */
export default function WriteScreen() {
  return <TodayGate route="write">{(today) => <Write today={today} />}</TodayGate>;
}

function Write({ today }: { today: TodayState }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const rejected = today.answer?.status === 'rejected' ? today.answer : null;
  const [text, setText] = useState(rejected?.body ?? '');
  const check = checkAnswerLength(text, today.answerMinLength, today.answerMaxLength);

  const submit = useMutation({
    mutationFn: () => submitAnswer(text),
    onSuccess: (next) => {
      client.setQueryData(todayQueryKey, next);
      void cancelTimerEnd();
      if (next.answer) void requestModeration(next.answer.id);
      router.replace('/letters');
    },
  });

  const counter = check.ok
    ? t('write.remaining', { count: today.answerMaxLength - check.length })
    : check.reason === 'too_short'
      ? t('write.tooShort', { min: today.answerMinLength, count: check.length })
      : t('write.over', { max: today.answerMaxLength });

  return (
    <Screen scroll keyboard>
      <View style={styles.head}>
        <AppText variant="caption" tone="candle">
          {t('write.lead')}
        </AppText>
        {today.question ? <AppText variant="question">{today.question.body}</AppText> : null}
      </View>

      {rejected ? (
        <View style={styles.rejected} accessibilityLiveRegion="polite">
          <AppText variant="label">{t('write.rejectedTitle')}</AppText>
          <AppText tone="muted">
            {t(`write.rejected.${rejected.rejectionReason ?? 'other'}`)}
          </AppText>
        </View>
      ) : null}

      <View style={styles.sheet}>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder={t('write.placeholder')}
          placeholderTextColor={colors.text.muted}
          accessibilityLabel={t('write.inputLabel')}
          style={styles.input}
          textAlignVertical="top"
          autoFocus={!rejected}
        />
        <AppText
          variant="caption"
          tone={check.ok ? 'muted' : 'candle'}
          style={styles.counter}
          accessibilityLiveRegion="polite"
        >
          {counter}
        </AppText>
      </View>

      <Button
        label={submit.isPending ? t('write.submitting') : t('write.submit')}
        disabled={!check.ok || submit.isPending}
        onPress={() => submit.mutate()}
      />
      {submit.isError ? (
        <AppText tone="candle" accessibilityLiveRegion="polite">
          {t(`errors.${submit.error instanceof RpcError ? submit.error.code : 'unknown'}`)}
        </AppText>
      ) : null}
      <AppText variant="caption" tone="muted">
        {t('write.note')}
      </AppText>
      {today.writableUntil ? (
        <AppText variant="caption" tone="muted">
          {t('write.deadline', {
            time: formatTime(new Date(today.writableUntil.getTime() - 1000)),
          })}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.sm, paddingTop: space.md },
  rejected: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.ember,
  },
  sheet: {
    backgroundColor: colors.bg.charcoal,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    gap: space.sm,
  },
  input: {
    minHeight: 240,
    color: colors.text.paper,
    fontFamily: fontFamily.serif,
    fontSize: 17,
    lineHeight: 32,
  },
  counter: { textAlign: 'right', fontVariant: ['tabular-nums'] },
});
