import {
  NotoSansJP_400Regular,
  NotoSansJP_500Medium,
  useFonts as useSansFonts,
} from '@expo-google-fonts/noto-sans-jp';
import {
  NotoSerifJP_400Regular,
  NotoSerifJP_600SemiBold,
  useFonts as useSerifFonts,
} from '@expo-google-fonts/noto-serif-jp';

/** アプリで使うフォントを読み込む。両方そろったら true */
export function useAppFonts(): { loaded: boolean; error: Error | null } {
  const [serifLoaded, serifError] = useSerifFonts({
    NotoSerifJP_400Regular,
    NotoSerifJP_600SemiBold,
  });
  const [sansLoaded, sansError] = useSansFonts({ NotoSansJP_400Regular, NotoSansJP_500Medium });
  return { loaded: serifLoaded && sansLoaded, error: serifError ?? sansError ?? null };
}
