import { Platform } from 'react-native';

/**
 * 広告の設定（§9）。広告 ID は環境変数で渡し、コードに書かない。
 * 開発中（__DEV__）と、ID が設定されていないときは必ずテスト ID を使う。
 * `ads.enabled` は将来の「広告非表示プラン」で切れるようにするためのフラグ。
 */
export const adsConfig = {
  enabled: process.env.EXPO_PUBLIC_ADS_ENABLED !== 'false',
  interstitialUnitId:
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS
      : process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID,
  bannerUnitId:
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS
      : process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID,
  /** 全画面広告の読み込みを待つ上限。間に合わなければ出さずに進む */
  interstitialLoadTimeoutMs: 4000,
};
