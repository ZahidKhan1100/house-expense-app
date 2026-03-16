import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../config/api";

export const apiClient = async (
  endpoint: string,
  method: string = "GET",
  body?: any,
  token?: string
) => {

  try {

    if (!token) {
      token = await AsyncStorage.getItem("token");
    }

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();

    if (res.status === 401) {
      await AsyncStorage.removeItem("token");
      throw new Error("Session expired. Please login again.");
    }

    if (!res.ok) {
      if (data.errors) {
        const firstError = Object.values(data.errors)[0] as string[];
        throw new Error(firstError[0]);
      }

      throw new Error(data.message || "Something went wrong");
    }

    return data;

  } catch (error:any) {

    throw new Error(error.message || "Network error");

  }
};