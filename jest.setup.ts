// テスト共通のセットアップ
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// ネイティブモジュールのモック
jest.mock('react-native-reanimated', () => require('./jest/reanimatedMock'));
// expo-router のテスト用ヘルパーは react-native-reanimated/mock を読むため、同じものに差し替える
jest.mock('react-native-reanimated/mock', () => require('./jest/reanimatedMock'));
jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({ initialize: jest.fn().mockResolvedValue([]) }),
  AdsConsent: {
    gatherConsent: jest.fn().mockResolvedValue({ canRequestAds: false }),
    getUserChoices: jest.fn().mockResolvedValue({ selectPersonalisedAds: false }),
  },
  AdEventType: { LOADED: 'loaded', CLOSED: 'closed', ERROR: 'error' },
  BannerAd: () => null,
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
  InterstitialAd: { createForAdRequest: jest.fn() },
  TestIds: { INTERSTITIAL: 'test-interstitial', ADAPTIVE_BANNER: 'test-banner' },
}));
