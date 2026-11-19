import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as TrackingTransparency from 'expo-tracking-transparency';
import { Platform } from 'react-native';

import { adsConfig } from './config';

/**
 * 広告ライブラリはネイティブモジュールを含むため、Expo Go には入っていない。
 * Expo Go で開いたとき（動作確認用）は広告を出さず、ライブラリも読み込まない。
 */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
type AdsLib = typeof import('react-native-google-mobile-ads');
const lib: AdsLib | null = isExpoGo
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('react-native-google-mobile-ads') as AdsLib);

let initialized: Promise<boolean> | null = null;
let personalized = false;

const useTestIds = __DEV__;

/**
 * 起動時の初回に、同意管理（UMP）→ iOS の ATT の順に確認してから SDK を初期化する（§9）。
 * 拒否されても、非パーソナライズ広告で動く。
 */
export function initAds(): Promise<boolean> {
  if (!adsConfig.enabled || !lib) return Promise.resolve(false);
  const ads = lib;
  initialized ??= (async () => {
    try {
      const consent = await ads.AdsConsent.gatherConsent();
      if (!consent.canRequestAds) return false;
      let tracking = true;
      if (Platform.OS === 'ios') {
        const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
        tracking = status === 'granted';
      }
      const choices = await ads.AdsConsent.getUserChoices().catch(() => null);
      personalized = tracking && (choices?.selectPersonalisedAds ?? false);
      await ads.default().initialize();
      return true;
    } catch {
      return false;
    }
  })();
  return initialized;
}

const requestOptions = () => ({ requestNonPersonalizedAdsOnly: !personalized });

/** 全画面広告を1回出す。読み込めなければ何もしない（待たせない） */
export async function showInterstitial(): Promise<void> {
  if (!lib || !(await initAds())) return;
  const { AdEventType, InterstitialAd, TestIds } = lib;
  const unitId =
    useTestIds || !adsConfig.interstitialUnitId
      ? TestIds.INTERSTITIAL
      : adsConfig.interstitialUnitId;
  const ad = InterstitialAd.createForAdRequest(unitId, requestOptions());
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(finish, adsConfig.interstitialLoadTimeoutMs);
    const subs = [
      ad.addAdEventListener(AdEventType.LOADED, () => {
        clearTimeout(timeout);
        ad.show().catch(finish);
      }),
      ad.addAdEventListener(AdEventType.CLOSED, finish),
      ad.addAdEventListener(AdEventType.ERROR, finish),
    ];
    function finish() {
      clearTimeout(timeout);
      subs.forEach((unsubscribe) => unsubscribe());
      resolve();
    }
    ad.load();
  });
}

/** アーカイブ画面下部のバナー（§9） */
export function AdBanner() {
  if (!adsConfig.enabled || !lib) return null;
  const { BannerAd, BannerAdSize, TestIds } = lib;
  const unitId =
    useTestIds || !adsConfig.bannerUnitId ? TestIds.ADAPTIVE_BANNER : adsConfig.bannerUnitId;
  return (
    <BannerAd
      unitId={unitId}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      requestOptions={requestOptions()}
    />
  );
}
