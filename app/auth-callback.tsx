import { Redirect } from 'expo-router';

/** アカウント連携のリダイレクト先（処理は linkAccount 側で行う） */
export default function AuthCallback() {
  return <Redirect href="/settings" />;
}
