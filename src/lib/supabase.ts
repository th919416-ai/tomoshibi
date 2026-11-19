import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import 'react-native-get-random-values';

import { readPublicEnv } from './env';

let client: SupabaseClient | null = null;

/** Supabase クライアント（アプリ全体で1つ）。設定が無い場合は MissingEnvError を投げる */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const { supabaseUrl, supabaseAnonKey } = readPublicEnv();
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // 匿名ユーザーのセッションを端末に保持し、再起動後も同じユーザーとして扱う
      storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

let appStateBound = false;

/** アプリが前面にあるときだけトークンを自動更新する（Supabase の React Native 推奨設定） */
export function bindAuthRefreshToAppState(): void {
  if (appStateBound || Platform.OS === 'web') return;
  appStateBound = true;
  const supabase = getSupabase();
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}

/** テスト用 */
export function __resetSupabaseForTests(): void {
  client = null;
  appStateBound = false;
}
