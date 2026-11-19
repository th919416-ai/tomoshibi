// Web・テスト用（広告は出さない）。ネイティブは ads.native.tsx
export function initAds(): Promise<boolean> {
  return Promise.resolve(false);
}
export async function showInterstitial(): Promise<void> {}
export function AdBanner() {
  return null;
}
