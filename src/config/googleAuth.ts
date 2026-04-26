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
<<<<<<< Updated upstream
const FALLBACK = {
  expoClientId:
    "17026603435-ealfs4spvrgufc7sv7q9baq3hulu2hig.apps.googleusercontent.com",
  iosClientId:
    "17026603435-cmpmanevtpudrna3f43pf84umghf3pen.apps.googleusercontent.com",
  androidClientId:
    "17026603435-50nrfga3r3rs8dp36ai4m0vu861p6mqe.apps.googleusercontent.com",
  webClientId:
    "17026603435-i0ra3c5tq33449tuarsintt88gib9u85.apps.googleusercontent.com",
=======
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
>>>>>>> Stashed changes
};



type GoogleAuthExtra = Partial<typeof FALLBACK>;

<<<<<<< Updated upstream
export function getGoogleOAuthClientIds(): typeof FALLBACK {
  const extra = (Constants.expoConfig as { extra?: { googleAuth?: GoogleAuthExtra } } | null)
    ?.extra?.googleAuth;
  if (!extra) return FALLBACK;
  return {
    expoClientId: extra.expoClientId ?? FALLBACK.expoClientId,
    iosClientId: extra.iosClientId ?? FALLBACK.iosClientId,
    androidClientId: extra.androidClientId ?? FALLBACK.androidClientId,
    webClientId: extra.webClientId ?? FALLBACK.webClientId,
=======
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
>>>>>>> Stashed changes
  };
}

/**
 * True only inside the Expo Go app shell. There, Google must use the Web client + auth.expo.io.
 * Development APK / dev-client / EAS builds use native redirect + androidClientId / iosClientId
 * (see Google Cloud: Android OAuth client + SHA-1; redirect `com.ihabimate.habimate:/oauthredirect`).
 * If Google shows “custom URI scheme is not enabled”, open that Android client in Cloud Console
 * → Advanced settings → enable custom URI scheme (required for new Android clients since Oct 2023).
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
<<<<<<< Updated upstream
        const uri = AuthSession.makeRedirectUri({
          useProxy: true,
          projectNameForProxy: "@ihabimate/habimate",
        } as any);
        return uri && uri.startsWith("https://auth.expo.io/")
          ? uri
          : "https://auth.expo.io/@ihabimate/habimate";
=======
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
>>>>>>> Stashed changes
      })()
    : Platform.OS === "ios"
      ? getGoogleIosReversedOauthRedirectUri(ids.iosClientId)
      : (() => {
          const pkg =
            Application.applicationId ?? "com.ihabimate.habimate";
          return `${pkg}:/oauthredirect`;
        })();
  if (__DEV__) {
    console.log("[googleAuth] redirectUri:", redirectUri, "proxy:", useProxy);
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
