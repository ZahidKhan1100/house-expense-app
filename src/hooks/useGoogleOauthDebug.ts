import * as Linking from "expo-linking";
import { useEffect } from "react";

const TAG = "[google-oauth-debug]";

type GoogleSessionResponse = {
  type?: string;
  params?: Record<string, string | undefined>;
  authentication?: { idToken?: string };
} | null;

function summarizeGoogleResponse(response: GoogleSessionResponse) {
  if (response == null) {
    return { phase: "null" as const };
  }
  const { type, params, authentication } = response;
  const keys = params ? Object.keys(params) : [];
  const hasIdToken = Boolean(
    (params?.id_token && params.id_token.length > 0) ||
      (authentication?.idToken && authentication.idToken.length > 0),
  );
  return {
    phase: "response" as const,
    type: type ?? "(missing)",
    paramKeys: keys,
    hasIdToken,
    error: params?.error,
    errorDescription: params?.error_description?.slice(0, 200),
    code: params?.code ? "(present)" : undefined,
  };
}

/**
 * __DEV__ only: logs AuthSession results and any deep links (OAuth redirect).
 * Watch Metro: look for `Linking url event` with `com.ihabimate.habimate` after Google.
 */
export function useGoogleOauthDebug(screen: string, response: GoogleSessionResponse) {
  useEffect(() => {
    if (!__DEV__) return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      console.log(TAG, screen, "Linking url event:", url);
    });
    void Linking.getInitialURL().then((url) => {
      if (url) console.log(TAG, screen, "Linking getInitialURL:", url);
    });
    return () => sub.remove();
  }, [screen]);

  useEffect(() => {
    if (!__DEV__) return;
    // `response` is null until the user finishes (or dismisses) the Google UI — no need to log every mount.
    if (response == null) return;
    console.log(TAG, screen, "response snapshot:", summarizeGoogleResponse(response));
  }, [screen, response]);
}
