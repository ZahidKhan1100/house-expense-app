import AsyncStorage from "@react-native-async-storage/async-storage";
import { notifySessionTokenCommitted } from "../auth/sessionTokenBridge";
import { notifyStoredUserUpdated } from "../auth/userSessionBridge";
import { apiClient } from "../utils/apiClient";

/* ========================== SIGNUP ========================== */
export const signup = async (payload: {
  name: string;
  email: string;
  password: string;
  house_code?: string;
}) => {
  return await apiClient("/signup", "POST", payload);
};

/* ========================== LOGIN ========================== */
export const login = async (payload: {
  email: string;
  password: string;
}) => {
  const data = await apiClient("/login", "POST", payload);

  // ✅ store token only here (single source of truth)
  if (data?.token) {
    await AsyncStorage.setItem("token", data.token);
    await AsyncStorage.setItem("user", JSON.stringify(data.user));
    notifySessionTokenCommitted(data.token);
    notifyStoredUserUpdated();
  }

  return data;
};

export type SocialLoginExtras = {
  house_code?: string;
  mode?: "house" | "trip";
};

/* ========================== SOCIAL LOGIN ========================== */
export const socialLogin = async (
  provider: "google" | "apple",
  token: string,
  extras?: SocialLoginExtras,
) => {
  const data = await apiClient("/social-login", "POST", {
    provider,
    access_token: token,
    // Common Laravel / Socialite + mobile setups expect one of these for Google JWT:
    ...(provider === "google" ? { id_token: token } : {}),
    ...(provider === "apple" ? { identity_token: token } : {}),
    ...extras,
  });

  if (data?.token) {
    await AsyncStorage.setItem("token", data.token);
    await AsyncStorage.setItem("user", JSON.stringify(data.user));
    notifySessionTokenCommitted(data.token);
    notifyStoredUserUpdated();
  }

  return data;
};

/* ========================== LOGOUT ========================== */
export const logout = async () => {
  await AsyncStorage.multiRemove(["token", "user"]);
};

/* ========================== RESEND EMAIL ========================== */
export const resendVerification = async (email: string) => {
  return await apiClient("/resend-verification", "POST", { email });
};