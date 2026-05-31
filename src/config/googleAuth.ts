import * as Application from "expo-application";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Google OAuth client IDs (same GCP project). Override via app.json → expo.extra.googleAuth.
 *
 * You still need separate IDs per platform in Google Cloud — there is no single ID that
 * replaces Android + iOS + Web. "expoClientId" is the Web/Expo-style client used when
 * signing in through Expo Go (auth proxy); native APK/IPA use androidClientId / iosClientId.
 */
// Same OAuth clients as Laravel `house-expenses-backend` (GOOGLE_*). Overridden by
// app.json → expo.extra.googleAuth or `EXPO_PUBLIC_GOOGLE_*` in `.env`.
const FALLBACK = {
  expoClientId:
    "260136725302-02bbjcdegkf7pl4hl54rvsbst770p388.apps.googleusercontent.com",
  iosClientId:
    "260136725302-b97apatea1e0r043kk2k9ijra4n9nmq8.apps.googleusercontent.com",
  androidClientId:
    "260136725302-35311tt858bni9oan60kpgnsqic20ele.apps.googleusercontent.com",
  webClientId:
    "260136725302-02bbjcdegkf7pl4hl54rvsbst770p388.apps.googleusercontent.com",
};

type GoogleAuthExtra = Partial<typeof FALLBACK>;

function envClientIds(): GoogleAuthExtra {
  return {
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  };
}

export function getGoogleOAuthClientIds(): typeof FALLBACK {
  const fromExtra = (Constants.expoConfig as { extra?: { googleAuth?: GoogleAuthExtra } } | null)
    ?.extra?.googleAuth;
  const fromEnv = envClientIds();
  return {
    expoClientId:
      fromEnv.expoClientId ?? fromExtra?.expoClientId ?? FALLBACK.expoClientId,
    iosClientId: fromEnv.iosClientId ?? fromExtra?.iosClientId ?? FALLBACK.iosClientId,
    androidClientId:
      fromEnv.androidClientId ?? fromExtra?.androidClientId ?? FALLBACK.androidClientId,
    webClientId: fromEnv.webClientId ?? fromExtra?.webClientId ?? FALLBACK.webClientId,
  };
}

/**
 * True only inside the Expo Go app shell. There, Google must use the Web client + auth.expo.io.
 * Development APK / dev-client / EAS builds use native redirect + androidClientId / iosClientId.
 *
 * --------------------------------------------------------------------------------------------
 * Android: “Please wait…” then browser stays on google.com (redirect never returns to the app)
 * --------------------------------------------------------------------------------------------
 * Google must trust the **exact keystore** that signed that APK (iOS simulator working does not
 * prove Android is configured — iOS uses a different OAuth client + URL scheme).
 *
 * 1. Google Cloud Console → APIs & Services → Credentials → **Android** OAuth 2.0 Client ID
 *    (same client id as `androidClientId` / `GOOGLE_ANDROID_CLIENT_ID` on Laravel).
 *    - Application type: Android
 *    - Package name: `com.ihabimate.habimate` (must match `expo.android.package`)
 *    - **SHA-1 certificate fingerprint:** must include the key used to sign **this** APK:
 *        • **EAS build:** Expo dashboard → Project → Credentials → Android → open keystore →
 *          copy **SHA-1 Fingerprint** (add it to the Android OAuth client; dev + release may differ).
 *        • **Local debug:** `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey
 *          -storepass android -keypass android` → SHA1 line.
 *    - **Custom URI scheme:** on that Android client, Advanced / OAuth settings → enable custom URI
 *      scheme (required for many clients since ~2023).
 *
 * 2. After adding fingerprints, wait a few minutes and **reinstall** the app (or rebuild the APK).
 *
 * Redirect in this app: `com.ihabimate.habimate:/oauthredirect` (see `getGoogleIdTokenAuthRequestOptions`).
 * --------------------------------------------------------------------------------------------
 */
export function shouldUseGoogleAuthProxy(): boolean {
  return Constants.appOwnership === "expo";
}

/**
 * iOS Google OAuth 2.0 clients expect the `redirect_uri` to use the "reversed" URL scheme
 * (see `REVERSED_CLIENT_ID` in GoogleService-Info.plist), not the app bundle id.
 * Using only `${applicationId}:/oauthredirect` often still shows the account picker, but the
 * token exchange step fails with no UI feedback (expo-auth-session does not catch exchange errors).
 */
export function getGoogleIosReversedOauthRedirectUri(iosClientId: string): string {
  const idPart = iosClientId.replace(/\.apps\.googleusercontent\.com$/i, "");
  return `com.googleusercontent.apps.${idPart}:/oauthredirect`;
}

let lastGoogleAuthRedirectLogKey = "";

/** Options for Google.useIdTokenAuthRequest(...) */
export function getGoogleIdTokenAuthRequestOptions() {
  const ids = getGoogleOAuthClientIds();
  const useProxy = shouldUseGoogleAuthProxy();

  // Proxy: must match Google Cloud "Authorized redirect URIs" on the *Web* client (expoClientId).
  // Native: Android uses `${applicationId}:/oauthredirect`. iOS must use the reversed iOS
  // client id scheme (see getGoogleIosReversedOauthRedirectUri) and the same value must be
  // listed under iOS URL types in app config. Wrong URI → code exchange never completes.
  const redirectUri = useProxy
    ? (() => {
        const ex = Constants.expoConfig;
        const projectNameForProxy =
          ex?.owner && ex?.slug
            ? (`@${ex.owner}/${ex.slug}` as const)
            : ("@ihabimate/habimate" as const);
        const httpsFallback = `https://auth.expo.io/${projectNameForProxy}`;
        const uri = AuthSession.makeRedirectUri({
          useProxy: true,
          projectNameForProxy,
        } as any);
        return uri && uri.startsWith("https://auth.expo.io/")
          ? uri
          : httpsFallback;
      })()
    : Platform.OS === "ios"
      ? getGoogleIosReversedOauthRedirectUri(ids.iosClientId)
      : (() => {
          const pkg =
            Application.applicationId ?? "com.ihabimate.habimate";
          return `${pkg}:/oauthredirect`;
        })();
  if (__DEV__) {
    const key = `${redirectUri}|${useProxy}`;
    if (key !== lastGoogleAuthRedirectLogKey) {
      lastGoogleAuthRedirectLogKey = key;
      console.log("[googleAuth] redirectUri:", redirectUri, "proxy:", useProxy);
    }
  }
  return {
    expoClientId: ids.expoClientId,
    iosClientId: ids.iosClientId,
    androidClientId: ids.androidClientId,
    webClientId: ids.webClientId,
    selectAccount: true,
    useProxy,
    redirectUri,
  };
}
