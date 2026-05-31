import AsyncStorage from "@react-native-async-storage/async-storage";

/** Where to send the user after Google redirects to `…/oauthredirect` (Expo Router screen). */
export const GOOGLE_OAUTH_RETURN_HREF_KEY = "google_oauth_return_href";

export async function setGoogleOauthReturnHref(href: string): Promise<void> {
  await AsyncStorage.setItem(GOOGLE_OAUTH_RETURN_HREF_KEY, href);
}
