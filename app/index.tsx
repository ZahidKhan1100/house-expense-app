// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { useRouter } from "expo-router";
// import { useEffect, useState } from "react";
// import Splash from "./splash";

// export default function Index() {
//   const router = useRouter();
//   const [checking, setChecking] = useState(true);

//   useEffect(() => {
//     console.log("Index useEffect triggered");

//     (async () => {
//       try {
//         const keys = await AsyncStorage.getAllKeys();
//         console.log("Stored keys:", keys);

//         const token = await AsyncStorage.getItem("token");
//         console.log("BOOT TOKEN:", token);

//         const userStr = await AsyncStorage.getItem("user");
//         const user = userStr ? JSON.parse(userStr) : null;

//         if (token && user) {
//           if (user.house_id) {
//             router.replace("/(tabs)/dashboard");
//           } else {
//             router.replace("/choose-house");
//           }
//         } else {
//           router.replace("/login");
//         }
//       } catch (err) {
//         console.error("Boot check error:", err);
//         router.replace("/login");
//       } finally {
//         setChecking(false);
//       }
//     })();
//   }, []);

//   if (checking) return <Splash />;

//   return null;
// }

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import Splash from "./splash";

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    boot();
  }, []);

  const authenticate = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const supported =
      await LocalAuthentication.supportedAuthenticationTypesAsync();

    if (
      !hasHardware ||
      !supported.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      )
    ) {
      return true; // skip if not supported
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock with Face ID",
      fallbackLabel: "Use Passcode",
      disableDeviceFallback: false,
    });

    return result.success;
  };

  const boot = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userStr = await AsyncStorage.getItem("user");
      const faceIdEnabled = await AsyncStorage.getItem("faceIdEnabled");

      const user = userStr ? JSON.parse(userStr) : null;

      // ❌ Not logged in
      if (!token || !user) {
        return router.replace("/login");
      }

      // 🔐 Face ID check
      if (faceIdEnabled === "true") {
        const success = await authenticate();

        if (!success) {
          return Alert.alert(
            "Authentication Failed",
            "Unable to verify Face ID",
            [
              { text: "Retry", onPress: boot },
              {
                text: "Logout",
                style: "destructive",
                onPress: async () => {
                  await AsyncStorage.multiRemove([
                    "token",
                    "user",
                    "faceIdEnabled",
                  ]);
                  router.replace("/login");
                },
              },
            ],
          );
        }
      }

      // ✅ Navigate after auth
      if (user.house_id) {
        router.replace("/(tabs)/dashboard");
      } else {
        router.replace("/choose-house");
      }
    } catch (err) {
      console.error("Boot error:", err);
      router.replace("/login");
    } finally {
      setChecking(false);
    }
  };

  if (checking) return <Splash />;

  return null;
}
