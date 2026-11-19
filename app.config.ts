import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json を土台に、環境ごとの値（広告 ID・EAS のプロジェクト ID）を環境変数から入れる。
 * 秘密ではないが環境で変わる値なので、コードには書かない（§9, §13）。
 * 未設定のときは Google が公開しているテスト用のアプリ ID を使う（開発中は必ずテスト ID）。
 */
const ADMOB_TEST_APP_ID_IOS = 'ca-app-pub-3940256099942544~1458002511';
const ADMOB_TEST_APP_ID_ANDROID = 'ca-app-pub-3940256099942544~3347511713';

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EAS_PROJECT_ID;
  return {
    ...config,
    name: config.name ?? 'ともしび',
    slug: config.slug ?? 'tomoshibi',
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { projectId } } : {}),
    },
    plugins: [
      ...(config.plugins ?? []),
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#E07B39',
        },
      ],
      [
        'expo-tracking-transparency',
        {
          userTrackingPermission:
            'あなたに合った広告を表示するために使います。許可しなくても、アプリはすべて使えます。',
        },
      ],
      [
        'react-native-google-mobile-ads',
        {
          iosAppId: process.env.ADMOB_APP_ID_IOS ?? ADMOB_TEST_APP_ID_IOS,
          androidAppId: process.env.ADMOB_APP_ID_ANDROID ?? ADMOB_TEST_APP_ID_ANDROID,
          delayAppMeasurementInit: true,
        },
      ],
    ],
  };
};
