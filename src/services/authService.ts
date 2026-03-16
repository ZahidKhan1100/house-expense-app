import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "../utils/apiClient";

export const signup = async (payload: {
  name: string;
  email: string;
  password: string;
  house_code?: string;
}) => {
  return apiClient("/signup", "POST", payload);
};

export const login = async (payload: {
  email: string;
  password: string;
}) => {
  const data = await apiClient("/login", "POST", payload);

  if (data.token) {
    await AsyncStorage.setItem("token", data.token);
  }

  return data;
};

export const socialLogin = async (
  provider: "google" | "apple",
  token: string
) => {
  const data = await apiClient(`/social-login/${provider}`, "POST", {
    token,
  });

  if (data.token) {
    await AsyncStorage.setItem("token", data.token);
  }

  return data;
};

export const logout = async () => {
  await AsyncStorage.removeItem("token");
};