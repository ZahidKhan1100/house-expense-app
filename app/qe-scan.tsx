import { useEffect } from "react";
import { useRouter } from "expo-router";

// Back-compat / typo route: redirect to the real QR scanner screen.
export default function QeScanRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/scan-qr");
  }, [router]);
  return null;
}

