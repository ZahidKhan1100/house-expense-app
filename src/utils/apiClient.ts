import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../config/api";

export const apiClient = async (
  endpoint: string,
  method: string = "GET",
  body?: any,
  token?: string,
) => {
  if (!token) {
    token = await AsyncStorage.getItem("token");
  }

  let res: Response;
  let data: any = {};

  try {
    console.log(
      "➡️ Request:",
      method,
      endpoint,
      body,
      token ? "with token" : "no token",
    );

    res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    try {
      data = await res.json();
    } catch (jsonErr) {
      console.warn("⚠️ Failed to parse JSON:", jsonErr);
      data = {};
    }

    console.log("⬅️ Response status:", res.status, "data:", data);

    // 🔹 Handle 401 explicitly
    if (res.status === 401) {
      await AsyncStorage.removeItem("token");
      throw {
        message: data?.message || "Session expired. Please login again.",
        raw: data,
      };
    }

    // 🔹 Handle server success=false
    if (data?.success === false) {
      const error = new Error(data?.message || "Something went wrong") as any;
      error.response = data;
      throw error;
    }

    // 🔹 Handle other HTTP errors
    // 🔥 UPDATED LOGIC TO HANDLE NESTED 'ORIGINAL' RESPONSES
    if (!res.ok) {
      let errorMessage = "Something went wrong";

      // 1. Check for Laravel Validation Errors
      if (data?.errors) {
        const firstError = Object.values(data.errors)[0] as string[];
        errorMessage = firstError[0];
      }
      // 2. Check for your custom 'original' wrapper
      else if (data?.original?.message) {
        errorMessage = data.original.message;
      }
      // 3. Check for standard message
      else if (data?.message) {
        errorMessage = data.message;
      }

      throw {
        message: errorMessage,
        status: res.status,
        data: data?.original || data, // Unwrap data for easier access in screens
      };
    }

    return data;
  } catch (err: any) {
    console.error("🔥 API CLIENT ERROR:", err);
    throw err;
  }
};
