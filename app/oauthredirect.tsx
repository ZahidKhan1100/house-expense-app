import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { View } from "react-native";

import {
  GOOGLE_OAUTH_RETURN_HREF_KEY,
} from "../src/utils/googleOauthReturnPath";

const DEFAULT_HREF = "/(auth)/login" as const;

/**
 * Google native OAuth uses `com.ihabimate.habimate:/oauthredirect`.
 * Expo Router would otherwise show “Unmatched Route”. Root `_layout` already calls
 * `WebBrowser.maybeCompleteAuthSession()`; we only resolve the saved return href
 * and replace away immediately (no spinner) to avoid a visible double “reload”.
 */
export default function GoogleOauthRedirect() {
  const router = useRouter();
  const doneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let target = DEFAULT_HREF;
      try {
        const stored = await AsyncStorage.getItem(GOOGLE_OAUTH_RETURN_HREF_KEY);
        await AsyncStorage.removeItem(GOOGLE_OAUTH_RETURN_HREF_KEY);
        const t = stored?.trim();
        if (t) target = t;
      } catch {
        target = DEFAULT_HREF;
      }
      if (cancelled || doneRef.current) return;
      doneRef.current = true;
      router.replace(target as any);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return <View style={{ flex: 1 }} />;
}
