import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * 端末内だけで持つ UI の状態（サーバーの判定には使わない）。CLAUDE.md §2: Zustand は UI ローカル状態のみ。
 */
type UiState = {
  /** 相談窓口の案内を見た day_key */
  supportAcknowledgedDay: string | null;
  /** 全画面広告を表示した day_key（1日1回まで。§9） */
  interstitialShownDay: string | null;
  /** 広告の同意・ATT の確認を済ませたか */
  adsConsentAsked: boolean;
  acknowledgeSupport: (dayKey: string) => void;
  markInterstitialShown: (dayKey: string) => void;
  markAdsConsentAsked: () => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      supportAcknowledgedDay: null,
      interstitialShownDay: null,
      adsConsentAsked: false,
      acknowledgeSupport: (dayKey) => set({ supportAcknowledgedDay: dayKey }),
      markInterstitialShown: (dayKey) => set({ interstitialShownDay: dayKey }),
      markAdsConsentAsked: () => set({ adsConsentAsked: true }),
    }),
    { name: 'tomoshibi-ui', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
