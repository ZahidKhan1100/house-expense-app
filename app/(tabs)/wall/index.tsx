import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";

import { useSettlementLock } from "../../../src/context/SettlementLockContext";
import {
  WALL_SNIPPET_PHOTO_RETENTION_DETAIL,
  WALL_SNIPPET_PHOTO_RETENTION_SHORT,
} from "../../../src/constants/wallSnippetRetention";
import { useTheme } from "../../../src/theme/ThemeContext";
import { useTabBarScrollSync } from "../../../src/context/TabBarScrollContext";
import NetInfo from "@react-native-community/netinfo";
import {
  countPendingRunningLow,
  enqueueFridgeNote,
  enqueueRunningLow,
  peekFridgeNotePending,
  subscribePendingSync,
} from "../../../src/offline/pendingActionsStore";
import { isLikelyUnreachableError } from "../../../src/offline/offlineUtils";
import { apiClient, getApiErrorMessage } from "../../../src/utils/apiClient";
import { extractReceiptFromImage } from "../../../src/services/receiptScanService";
import { RECEIPT_IMAGE_MAX_DIMENSION } from "../../../src/constants/receiptImage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  bindChannelDebug,
  createPusherClient,
} from "../../../src/realtime/realtimeClient";
import { useKarmaBurst } from "../../../src/rewards/useKarmaBurst";
import { useStoredUser } from "../../../src/hooks/useStoredUser";
import { UserAvatar } from "../../../src/components/UserAvatar";
import { profileAvatarUrl } from "../../../src/utils/profileAvatarUrl";

const { width } = Dimensions.get("window");
const CORAL = "#FF6A6A";
const REACTION_EMOJIS = ["😂", "🥲", "🔥", "🍕", "🧻", "🏠", "🥳", "🤦‍♂️", "😴", "☕️"] as const;

type WallPost = {
  id: number;
  type: "snippet" | "poll" | "system";
  caption?: string | null;
  image_url?: string | null;
  poll_question?: string | null;
  poll_options?: { id: number; text: string }[];
  counts?: Record<string, number> | Record<number, number>;
  my_vote_option_id?: number | null;
  hearts_count?: number;
  my_hearted?: boolean;
  emoji_counts?: Record<string, number>;
  my_emojis?: string[];
  user?: { id: number; name: string; avatar_url?: string | null } | null;
  created_at?: string | null;
  system_payload?: {
    kind?: string;
    starts_on?: string;
    ends_on?: string;
    reason_emoji?: string | null;
  } | null;
};

type MatePresenceRow = {
  user_id: number;
  name: string;
  avatar_url?: string | null;
  presence: "home" | "away";
  away_until: string | null;
  guest_plus: boolean;
};

function toInt(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getVoteCount(post: WallPost, optionId: number): number {
  const counts: any = post.counts || {};
  return Number(counts[String(optionId)] ?? counts[optionId] ?? 0);
}

function pollVoteTotal(p: WallPost): number {
  const counts = p.counts;
  if (!counts || typeof counts !== "object") return 0;
  return Object.keys(counts).reduce((sum, k) => {
    const n = Number((counts as Record<string, unknown>)[k]);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function wallPostAvatarUrl(
  post: WallPost,
  stored: Record<string, unknown> | null,
): string | null {
  const uid = post.user?.id != null ? Number(post.user.id) : NaN;
  const sid = stored?.id != null ? Number(stored.id) : NaN;
  if (Number.isFinite(uid) && Number.isFinite(sid) && uid === sid) {
    const fromStored = profileAvatarUrl(stored);
    if (fromStored) return fromStored;
  }
  const raw = post.user?.avatar_url;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function formatAwayUntil(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function Wall() {
  const router = useRouter();
  const storedUser = useStoredUser();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { onScroll, scrollEventThrottle } = useTabBarScrollSync();
  const { burst, KarmaBurst } = useKarmaBurst();
  const { settlementLocked } = useSettlementLock();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [houseName, setHouseName] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<"snippet" | "poll">("snippet");
  const [caption, setCaption] = useState("");
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const [fulfillmentPrefill, setFulfillmentPrefill] = useState<{
    id: number;
    label: string;
    emoji: string;
  } | null>(null);

  const pusherRef = useRef<any>(null);
  const lastTapRef = useRef<Record<number, number>>({});

  const [fridgeNote, setFridgeNote] = useState<string>("");
  /** True when a fridge note change is queued for sync (offline). */
  const [fridgeNotePendingSync, setFridgeNotePendingSync] = useState(false);
  const [runningLowPendingCount, setRunningLowPendingCount] = useState(0);
  const [status, setStatus] = useState<"home" | "out" | "away">("home");
  const [savingStatus, setSavingStatus] = useState(false);
  const [me, setMe] = useState<{ id: number; role?: string } | null>(null);
  const [around, setAround] = useState<
    {
      user_id: number;
      name: string;
      avatar_url?: string | null;
      role?: string | null;
      status?: "home" | "out" | "away" | null;
    }[]
  >([]);

  const [matePresence, setMatePresence] = useState<MatePresenceRow[]>([]);

  const [runningCatalog, setRunningCatalog] = useState<
    { item_key: string; emoji: string; label: string }[]
  >([]);
  const [runningOpen, setRunningOpen] = useState<
    {
      id: number;
      item_key: string;
      emoji: string;
      label: string;
      created_by_name: string;
    }[]
  >([]);
  const [fulfillmentRequestId, setFulfillmentRequestId] = useState<number | null>(null);
  /** When set, composer saves via PUT instead of POST. */
  const [composerEditingPost, setComposerEditingPost] = useState<WallPost | null>(null);
  const [clearSnippetImageOnSave, setClearSnippetImageOnSave] = useState(false);
  const [customLowInput, setCustomLowInput] = useState("");

  const colors = useMemo(
    () => ({
      bg: isDark ? "#070B14" : "#F4F6FA",
      surface: isDark ? "#141C2F" : "#FFFFFF",
      text: isDark ? "#F1F5F9" : "#0F172A",
      sub: isDark ? "#94A3B8" : "#64748B",
      muted: isDark ? "rgba(148,163,184,0.85)" : "#94A3B8",
      border: isDark ? "rgba(255,255,255,0.40)" : "rgba(255,255,255,0.55)",
      hairline: isDark ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.08)",
      glass: isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.85)",
      modalBg: isDark ? "#0F172A" : "#FFFFFF",
      inputBorder: isDark ? "rgba(255,255,255,0.14)" : "rgba(2,6,23,0.08)",
      inputBg: isDark ? "rgba(255,255,255,0.05)" : "rgba(2,6,23,0.03)",
      inputText: isDark ? "#FFFFFF" : "#0F172A",
      inputPlaceholder: isDark ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.42)",
      onCard: isDark ? "rgba(248,250,252,0.92)" : "#334155",
      onCardMuted: isDark ? "rgba(148,163,184,0.95)" : "#64748B",
      pollTrack: isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.06)",
    }),
    [isDark],
  );

  useEffect(() => {
    const id = toInt(storedUser?.id);
    if (!id) {
      setMe(null);
      return;
    }
    const role =
      typeof storedUser?.role === "string" ? storedUser.role : undefined;
    setMe({ id, role });
  }, [storedUser]);

  const cardElevation = useMemo(
    () =>
      Platform.OS === "ios"
        ? {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: isDark ? 0.38 : 0.07,
            shadowRadius: 22,
          }
        : { elevation: isDark ? 6 : 3 },
    [isDark],
  );

  const fetchFeed = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await apiClient("/house-wall", "GET");
      setPosts(res.posts || []);
    } catch (e: any) {
      console.log(e);
      Alert.alert("House Wall error", e?.message ?? "Could not load House Wall");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchRunningLow = useCallback(async () => {
    try {
      const res = await apiClient("/house-wall/running-low", "GET");
      setRunningCatalog(res?.items ?? []);
      setRunningOpen(res?.open ?? []);
    } catch {
      setRunningCatalog([]);
      setRunningOpen([]);
    }
  }, []);

  const refreshRunningLowQueueCount = useCallback(async () => {
    try {
      const n = await countPendingRunningLow();
      setRunningLowPendingCount(n);
    } catch {
      setRunningLowPendingCount(0);
    }
  }, []);

  const trimUrl = useCallback((u: unknown) => {
    if (typeof u !== "string") return null as string | null;
    const t = u.trim();
    return t ? t : null;
  }, []);

  const fetchMatePresence = useCallback(async () => {
    try {
      const [presRes, matesRes] = await Promise.all([
        apiClient("/house/calendar/presence", "GET"),
        apiClient("/mates", "GET").catch(() => null),
      ]);

      const rawMates = Array.isArray(presRes?.mates) ? presRes.mates : [];
      const avatarById = new Map<number, string>();

      const ingestAvatar = (id: unknown, url: unknown) => {
        const uid = typeof id === "number" ? id : Number(id);
        const av = trimUrl(url);
        if (Number.isFinite(uid) && av) avatarById.set(uid, av);
      };

      const mr = matesRes as Record<string, unknown> | null;
      const adminObj = mr?.admin as Record<string, unknown> | undefined;
      if (adminObj?.id != null) ingestAvatar(adminObj.id, adminObj.avatar_url);
      for (const m of Array.isArray(mr?.approved) ? (mr.approved as Record<string, unknown>[]) : []) {
        ingestAvatar(m?.id, m?.avatar_url);
      }
      for (const m of Array.isArray(mr?.pending) ? (mr.pending as Record<string, unknown>[]) : []) {
        ingestAvatar(m?.id, m?.avatar_url);
      }

      setMatePresence(
        rawMates.map((row: MatePresenceRow) => {
          const uid = Number(row.user_id);
          const fromPresence = trimUrl(row.avatar_url);
          const fallback = avatarById.get(uid);
          return {
            ...row,
            avatar_url: fromPresence ?? fallback ?? row.avatar_url,
          };
        }),
      );
    } catch {
      setMatePresence([]);
    }
  }, [trimUrl]);

  const fetchMeta = useCallback(async () => {
    try {
      const [noteRes, statusRes, profileRes] = await Promise.all([
        apiClient("/house-wall/fridge-note", "GET"),
        apiClient("/house-wall/statuses", "GET"),
        apiClient("/profile", "GET"),
      ]);

      const name =
        typeof profileRes?.house?.name === "string"
          ? profileRes.house.name.trim()
          : "";
      setHouseName(name || null);

      setFridgeNote(noteRes?.note?.body ?? "");
      const pendingNote = await peekFridgeNotePending();
      if (pendingNote) {
        setFridgeNote(pendingNote.body ?? "");
        setFridgeNotePendingSync(true);
      } else {
        setFridgeNotePendingSync(false);
      }

      // Try to infer current user status from statuses list
      const userStr = await AsyncStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const myId = toInt(user?.id);
      const rows = statusRes?.statuses ?? [];
      setAround(rows);
      const mine = myId ? rows.find((r: any) => Number(r.user_id) === myId) : null;
      const s = mine?.status;
      if (s === "home" || s === "out" || s === "away") setStatus(s);
    } catch (e) {
      console.log("Wall meta error", e);
    }
  }, []);

  useEffect(() => {
    return subscribePendingSync(() => {
      void fetchMeta();
      void refreshRunningLowQueueCount();
    });
  }, [fetchMeta, refreshRunningLowQueueCount]);

  useEffect(() => {
    fetchFeed(true);
    fetchMeta();
    void fetchRunningLow();
    void     fetchMatePresence();
    void refreshRunningLowQueueCount();
  }, [
    fetchFeed,
    fetchMeta,
    fetchRunningLow,
    fetchMatePresence,
    refreshRunningLowQueueCount,
  ]);

  useEffect(() => {
    if (settlementLocked) {
      router.replace("/(tabs)/payment" as any);
    }
  }, [settlementLocked, router]);

  // Realtime: listen on private-house-wall.{houseId}
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        const userStr = await AsyncStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : null;
        const userId = toInt(user?.id);
        const houseId = toInt(user?.house_id);
        if (!userId || !houseId) return;
        if (cancelled) return;

        const pusher = createPusherClient({ token, userId, houseId });
        pusherRef.current = pusher;

        const wallChannel = pusher.subscribe(`private-house-wall.${houseId}`);
        bindChannelDebug(wallChannel, `private-house-wall.${houseId}`);

        wallChannel.bind("wall.posted", (payload: any) => {
          setPosts((prev) => {
            const id = Number(payload?.id);
            if (!id) return prev;
            if (prev.some((p) => p.id === id)) return prev;
            return [payload as WallPost, ...prev];
          });
        });

        wallChannel.bind("wall.poll.voted", (payload: any) => {
          const postId = Number(payload?.postId);
          if (!postId) return;
          const counts = payload?.counts ?? {};
          setPosts((prev) =>
            prev.map((p) => (p.id === postId ? { ...p, counts } : p)),
          );
        });

        wallChannel.bind("wall.heart.toggled", (payload: any) => {
          const postId = Number(payload?.postId);
          if (!postId) return;
          const hearts_count = Number(payload?.heartsCount ?? 0);
          setPosts((prev) =>
            prev.map((p) => (p.id === postId ? { ...p, hearts_count } : p)),
          );
        });

        wallChannel.bind("wall.emoji.reacted", (payload: any) => {
          const postId = Number(payload?.postId);
          if (!postId) return;
          const emoji_counts = payload?.emoji_counts ?? {};
          setPosts((prev) =>
            prev.map((p) => (p.id === postId ? { ...p, emoji_counts } : p)),
          );
        });

        wallChannel.bind("wall.running_low", () => {
          void fetchRunningLow();
        });
      } catch (e) {
        console.log("Wall realtime boot failed", e);
      }
    };

    void boot();

    return () => {
      cancelled = true;
      try {
        pusherRef.current?.disconnect?.();
      } catch {}
      pusherRef.current = null;
    };
  }, [fetchRunningLow]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeed(false);
    await fetchMeta();
    await fetchRunningLow();
    await fetchMatePresence();
    await refreshRunningLowQueueCount();
  }, [
    fetchFeed,
    fetchMeta,
    fetchRunningLow,
    fetchMatePresence,
    refreshRunningLowQueueCount,
  ]);

  const vote = useCallback(async (postId: number, optionId: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, my_vote_option_id: optionId } : p,
      ),
    );
    try {
      const res = await apiClient(`/house-wall/polls/${postId}/vote`, "POST", {
        option_id: optionId,
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, counts: res.counts ?? p.counts, my_vote_option_id: optionId }
            : p,
        ),
      );
    } catch (e: any) {
      Toast.show({
        type: "realtime",
        text1: "Couldn’t vote",
        text2: e?.message ?? "Please try again",
      });
      await fetchFeed(false);
    }
  }, [fetchFeed]);

  const toggleHeart = useCallback(async (postId: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              my_hearted: !p.my_hearted,
              hearts_count: Math.max(
                0,
                Number(p.hearts_count ?? 0) + (p.my_hearted ? -1 : 1),
              ),
            }
          : p,
      ),
    );
    try {
      const res = await apiClient(`/house-wall/${postId}/heart`, "POST");
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                my_hearted: !!res.hearted,
                hearts_count: Number(res.hearts_count ?? p.hearts_count ?? 0),
              }
            : p,
        ),
      );
    } catch {
      await fetchFeed(false);
    }
  }, [fetchFeed]);

  const toggleEmoji = useCallback(
    async (postId: number, emoji: (typeof REACTION_EMOJIS)[number]) => {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const mine = new Set(p.my_emojis ?? []);
          const counts = { ...(p.emoji_counts ?? {}) } as Record<string, number>;

          const had = mine.has(emoji);
          if (had) {
            mine.delete(emoji);
            counts[emoji] = Math.max(0, Number(counts[emoji] ?? 0) - 1);
            if (counts[emoji] <= 0) delete counts[emoji];
          } else {
            mine.add(emoji);
            counts[emoji] = Number(counts[emoji] ?? 0) + 1;
          }

          return { ...p, my_emojis: Array.from(mine), emoji_counts: counts };
        }),
      );

      try {
        const res = await apiClient(`/house-wall/${postId}/emoji`, "POST", { emoji });
        const emoji_counts = res?.emoji_counts ?? null;
        if (emoji_counts) {
          setPosts((prev) =>
            prev.map((p) => (p.id === postId ? { ...p, emoji_counts } : p)),
          );
        }
      } catch (e: any) {
        Toast.show({
          type: "realtime",
          text1: "Reaction failed",
          text2: e?.message ?? "Please try again",
        });
        await fetchFeed(false);
      }
    },
    [fetchFeed],
  );

  const resetComposerState = useCallback(() => {
    setCaption("");
    setLocalImageUri(null);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setFulfillmentRequestId(null);
    setFulfillmentPrefill(null);
    setComposerEditingPost(null);
    setClearSnippetImageOnSave(false);
  }, []);

  const openComposer = useCallback(
    (mode: "snippet" | "poll") => {
      resetComposerState();
      setComposerMode(mode);
      setComposerOpen(true);
    },
    [resetComposerState],
  );

  const openGroceryHeroComposer = useCallback(
    (req: { id: number; label: string; emoji: string }) => {
      resetComposerState();
      setComposerMode("snippet");
      setCaption(`Picked up ${req.label}! ${req.emoji}`);
      setFulfillmentRequestId(req.id);
      setFulfillmentPrefill(req);
      setComposerOpen(true);
    },
    [resetComposerState],
  );

  const openEditPost = useCallback(
    (p: WallPost) => {
      resetComposerState();
      setComposerEditingPost(p);
      setFulfillmentRequestId(null);
      setFulfillmentPrefill(null);

      if (p.type === "snippet") {
        setComposerMode("snippet");
        setCaption((p.caption ?? "").slice(0, 100));
        setLocalImageUri(null);
      } else if (p.type === "poll") {
        setComposerMode("poll");
        setPollQuestion(p.poll_question ?? "");
        const opts = (p.poll_options ?? []).map((o) => o.text);
        setPollOptions(opts.length >= 2 ? [...opts] : ["", ""]);
      } else {
        return;
      }
      setComposerOpen(true);
    },
    [resetComposerState],
  );

  const pingRunningLowPreset = useCallback(
    async (itemKey: string) => {
      const successToast = () =>
        Toast.show({
          type: "realtime",
          text1: "House notified",
          text2: "Everyone got a heads-up — first receipt wins double Karma.",
        });
      const queuedToast = () =>
        Toast.show({
          type: "success",
          text1: "Alert queued",
          text2: "We’ll ping the house when you’re back online.",
        });
      try {
        const net = await NetInfo.fetch();
        const likelyOnline =
          net.isConnected === true && net.isInternetReachable !== false;
        if (!likelyOnline) {
          await enqueueRunningLow({ item_key: itemKey });
          await refreshRunningLowQueueCount();
          queuedToast();
          return;
        }
        await apiClient("/house-wall/running-low", "POST", { item_key: itemKey });
        await fetchRunningLow();
        successToast();
      } catch (e: any) {
        if (isLikelyUnreachableError(e)) {
          await enqueueRunningLow({ item_key: itemKey });
          await refreshRunningLowQueueCount();
          queuedToast();
          return;
        }
        Toast.show({
          type: "realtime",
          text1: "Couldn’t send alert",
          text2: getApiErrorMessage(e, "Try again"),
        });
      }
    },
    [fetchRunningLow, refreshRunningLowQueueCount],
  );

  const pingRunningLowCustom = useCallback(async () => {
    const t = customLowInput.trim();
    if (t.length < 2) {
      Toast.show({
        type: "realtime",
        text1: "Add a name",
        text2: "Type what’s running low (at least 2 characters).",
      });
      return;
    }
    const label = t.slice(0, 48);
    const successToast = () =>
      Toast.show({
        type: "realtime",
        text1: "House notified",
        text2: "Everyone got a heads-up — first receipt wins double Karma.",
      });
    const queuedToast = () =>
      Toast.show({
        type: "success",
        text1: "Alert queued",
        text2: "We’ll ping the house when you’re back online.",
      });
    try {
      const net = await NetInfo.fetch();
      const likelyOnline =
        net.isConnected === true && net.isInternetReachable !== false;
      if (!likelyOnline) {
        await enqueueRunningLow({ custom_label: label });
        setCustomLowInput("");
        await refreshRunningLowQueueCount();
        queuedToast();
        return;
      }
      await apiClient("/house-wall/running-low", "POST", {
        custom_label: label,
      });
      setCustomLowInput("");
      await fetchRunningLow();
      successToast();
    } catch (e: any) {
      if (isLikelyUnreachableError(e)) {
        await enqueueRunningLow({ custom_label: label });
        setCustomLowInput("");
        await refreshRunningLowQueueCount();
        queuedToast();
        return;
      }
      Toast.show({
        type: "realtime",
        text1: "Couldn’t send alert",
        text2: getApiErrorMessage(e, "Try again"),
      });
    }
  }, [customLowInput, fetchRunningLow, refreshRunningLowQueueCount]);

  const pickImage = useCallback(async () => {
    const choice = await new Promise<"camera" | "gallery" | null>((resolve) => {
      Alert.alert("Add a photo", "Choose a source", [
        { text: "Camera", onPress: () => resolve("camera") },
        { text: "Gallery", onPress: () => resolve("gallery") },
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ]);
    });
    if (!choice) return;

    if (choice === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Please allow camera access to take a photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 1,
        allowsEditing: true,
        aspect: [4, 5],
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (uri) {
        setClearSnippetImageOnSave(false);
        setLocalImageUri(uri);
      }
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access to pick an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: true,
      aspect: [4, 5],
    });
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (uri) {
      setClearSnippetImageOnSave(false);
      setLocalImageUri(uri);
    }
  }, []);

  const uploadToCloudinary = useCallback(async (uri: string) => {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: RECEIPT_IMAGE_MAX_DIMENSION } }],
      { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
    );

    const sig = await apiClient("/house-wall/upload-signature", "POST");
    const cloudName = sig?.cloud_name;
    const apiKey = sig?.api_key;
    const timestamp = sig?.timestamp;
    const signature = sig?.signature;
    const folder = sig?.folder;

    if (!cloudName || !apiKey || !timestamp || !signature) {
      throw new Error("Upload signature missing (backend Cloudinary config?)");
    }

    const form = new FormData();
    form.append("file", {
      uri: manipulated.uri,
      name: "snippet.jpg",
      type: "image/jpeg",
    } as any);
    form.append("api_key", String(apiKey));
    form.append("timestamp", String(timestamp));
    form.append("signature", String(signature));
    if (folder) form.append("folder", String(folder));

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: form,
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? "Upload failed");
    return {
      url: String(data.secure_url ?? data.url),
      publicId: data.public_id ? String(data.public_id) : null,
    };
  }, []);

  const createSnippet = useCallback(async () => {
    const capTrim = caption.trim();

    const keepingServerImage =
      composerEditingPost?.type === "snippet" &&
      !!(composerEditingPost.image_url && String(composerEditingPost.image_url).trim()) &&
      !clearSnippetImageOnSave;

    if (caption.length > 100) {
      Alert.alert("Too long", "Caption must be 100 characters or less.");
      return;
    }

    if (!localImageUri && !capTrim && !keepingServerImage) {
      Alert.alert("Add something", "Write a caption and/or attach a photo for this snippet.");
      return;
    }

    const editingSnippet = composerEditingPost?.type === "snippet" ? composerEditingPost : null;
    const isEdit = !!editingSnippet;

    setCreating(true);
    try {
      if (isEdit && editingSnippet) {
        let uploaded: { url: string; publicId: string | null } | null = null;
        if (localImageUri) {
          uploaded = await uploadToCloudinary(localImageUri);
        }
        const putBody: Record<string, unknown> = {
          caption: capTrim || null,
          ...(uploaded
            ? { image_url: uploaded.url, image_public_id: uploaded.publicId }
            : {}),
          ...(clearSnippetImageOnSave && !localImageUri ? { clear_image: true } : {}),
        };
        await apiClient(`/house-wall/snippets/${editingSnippet.id}`, "PUT", putBody);
        resetComposerState();
        setComposerOpen(false);
        await fetchFeed(false);
        return;
      }

      const restockReq = fulfillmentPrefill;
      const restockImageUri = localImageUri;
      let uploaded: { url: string; publicId: string | null } | null = null;
      if (localImageUri) {
        uploaded = await uploadToCloudinary(localImageUri);
      }
      const body: Record<string, unknown> = {
        caption: capTrim || null,
        ...(uploaded
          ? { image_url: uploaded.url, image_public_id: uploaded.publicId }
          : {}),
      };
      if (fulfillmentRequestId != null) {
        body.running_low_request_id = fulfillmentRequestId;
      }
      const res = await apiClient("/house-wall/snippets", "POST", body);
      const snippetPostId =
        typeof (res?.post as { id?: number } | undefined)?.id === "number"
          ? (res.post as { id: number }).id
          : null;
      const cloudinaryPidForDiscard = uploaded?.publicId ?? null;
      if (res?.post) setPosts((prev) => [res.post as WallPost, ...prev]);
      const pts = Number(res?.karma_points ?? 10);
      burst(`+${pts} Karma`);
      setFulfillmentRequestId(null);
      setFulfillmentPrefill(null);
      resetComposerState();
      setComposerOpen(false);
      void fetchRunningLow();

      // Restock flow: after posting the snippet, offer to add an expense too.
      if (restockReq && restockImageUri) {
        setTimeout(() => {
          Alert.alert(
            "Add this as an expense?",
            "If your photo is a receipt, we can scan it and prefill amount/title. Otherwise, you can enter it manually.",
            [
              { text: "Skip", style: "cancel" },
              {
                text: "Enter manually",
                onPress: () => {
                  router.push({
                    pathname: "/expenses/addExpense" as any,
                    params: {
                      open: "1",
                      title: `${restockReq.emoji} ${restockReq.label}`,
                    },
                  });
                },
              },
              {
                text: "Scan receipt (AI)",
                onPress: () => {
                  void (async () => {
                    try {
                      const ex = await extractReceiptFromImage(restockImageUri);
                      if (
                        snippetPostId != null &&
                        cloudinaryPidForDiscard &&
                        restockReq
                      ) {
                        try {
                          await apiClient("/house-wall/snippets/discard-upload", "POST", {
                            post_id: snippetPostId,
                            cloudinary_public_id: cloudinaryPidForDiscard,
                          });
                          setPosts((prev) =>
                            prev.map((p) =>
                              p.id === snippetPostId
                                ? { ...p, image_url: null }
                                : p,
                            ),
                          );
                        } catch {
                          /* keep Cloudinary thumbnail if unlink fails offline */
                        }
                      }
                      router.push({
                        pathname: "/expenses/addExpense" as any,
                        params: {
                          open: "1",
                          title:
                            (ex.merchant_name?.trim() || "") ||
                            `${restockReq.emoji} ${restockReq.label}`,
                          amount:
                            ex.total_amount != null && Number.isFinite(ex.total_amount)
                              ? ex.total_amount.toFixed(2)
                              : "",
                          date: ex.date ?? "",
                          category_hint: ex.category_hint ?? "",
                        },
                      });
                    } catch (e: any) {
                      router.push({
                        pathname: "/expenses/addExpense" as any,
                        params: {
                          open: "1",
                          title: `${restockReq.emoji} ${restockReq.label}`,
                        },
                      });
                      Toast.show({
                        type: "realtime",
                        text1: "Couldn’t scan receipt",
                        text2: e?.message ?? "Enter details manually",
                      });
                    }
                  })();
                },
              },
            ],
          );
        }, 50);
      }
    } catch (e: any) {
      Alert.alert("Couldn’t post snippet", e?.message ?? "Try again");
    } finally {
      setCreating(false);
    }
  }, [
    caption,
    localImageUri,
    uploadToCloudinary,
    fulfillmentRequestId,
    fulfillmentPrefill,
    composerEditingPost,
    clearSnippetImageOnSave,
    burst,
    fetchRunningLow,
    fetchFeed,
    resetComposerState,
    router,
    setPosts,
  ]);

  const createPoll = useCallback(async () => {
    const q = pollQuestion.trim();
    const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
    const editingPoll = composerEditingPost?.type === "poll" ? composerEditingPost : null;
    const locked = editingPoll ? pollVoteTotal(editingPoll) > 0 : false;

    if (!q) return Alert.alert("Question required", "Write a poll question.");
    if (!locked) {
      if (opts.length < 2) return Alert.alert("Add options", "Add at least 2 options.");
      if (opts.length > 4) return Alert.alert("Too many", "Max 4 options.");
    }

    setCreating(true);
    try {
      if (editingPoll) {
        if (locked) {
          await apiClient(`/house-wall/polls/${editingPoll.id}`, "PUT", {
            question: q,
          });
        } else {
          await apiClient(`/house-wall/polls/${editingPoll.id}`, "PUT", {
            question: q,
            options: opts,
          });
        }
        resetComposerState();
        setComposerOpen(false);
        await fetchFeed(false);
        return;
      }

      const res = await apiClient("/house-wall/polls", "POST", {
        question: q,
        options: opts,
      });
      if (res?.post) setPosts((prev) => [res.post as WallPost, ...prev]);
      burst("+10 Karma");
      resetComposerState();
      setComposerOpen(false);
    } catch (e: any) {
      Alert.alert("Couldn’t post poll", e?.message ?? "Try again");
    } finally {
      setCreating(false);
    }
  }, [composerEditingPost, burst, pollOptions, pollQuestion, resetComposerState, fetchFeed]);

  const onDoubleTap = useCallback(
    (postId: number) => {
      const now = Date.now();
      const last = lastTapRef.current[postId] ?? 0;
      lastTapRef.current[postId] = now;
      if (now - last < 280) {
        void toggleHeart(postId);
      }
    },
    [toggleHeart],
  );

  const saveFridgeNote = useCallback(async () => {
    const body = fridgeNote.trim() || null;
    try {
      const net = await NetInfo.fetch();
      const likelyOnline =
        net.isConnected === true && net.isInternetReachable !== false;
      if (!likelyOnline) {
        await enqueueFridgeNote(body);
        setFridgeNotePendingSync(true);
        Toast.show({
          type: "success",
          text1: "Saved locally",
          text2: "Fridge note will sync when you're back online.",
        });
        return;
      }
      await apiClient("/house-wall/fridge-note", "PUT", { body });
      setFridgeNotePendingSync(false);
      Toast.show({
        type: "realtime",
        text1: "Fridge note updated",
        text2: body ? "Saved for everyone" : "Cleared",
      });
    } catch (e: any) {
      if (isLikelyUnreachableError(e)) {
        await enqueueFridgeNote(body);
        setFridgeNotePendingSync(true);
        Toast.show({
          type: "success",
          text1: "Saved locally",
          text2: "Fridge note will sync when you're back online.",
        });
        return;
      }
      Alert.alert("Save failed", getApiErrorMessage(e, "Could not save note"));
    }
  }, [fridgeNote]);

  const clearFridgeNote = useCallback(async () => {
    setFridgeNote("");
    try {
      const net = await NetInfo.fetch();
      const likelyOnline =
        net.isConnected === true && net.isInternetReachable !== false;
      if (!likelyOnline) {
        await enqueueFridgeNote(null);
        setFridgeNotePendingSync(true);
        Toast.show({
          type: "success",
          text1: "Cleared locally",
          text2: "Will sync when you're back online.",
        });
        return;
      }
      await apiClient("/house-wall/fridge-note", "PUT", { body: null });
      setFridgeNotePendingSync(false);
      Toast.show({
        type: "realtime",
        text1: "Fridge note cleared",
      });
    } catch (e: any) {
      if (isLikelyUnreachableError(e)) {
        await enqueueFridgeNote(null);
        setFridgeNotePendingSync(true);
        Toast.show({
          type: "success",
          text1: "Cleared locally",
          text2: "Will sync when you're back online.",
        });
        return;
      }
      Alert.alert(
        "Save failed",
        getApiErrorMessage(e, "Could not clear note"),
      );
      await fetchMeta();
    }
  }, [fetchMeta]);

  const setMyStatus = useCallback(
    async (next: "home" | "out" | "away") => {
      setStatus(next);
      setSavingStatus(true);
      try {
        await apiClient("/house-wall/status", "PUT", { status: next });
        await fetchMeta();
      } catch {
        await fetchMeta();
      } finally {
        setSavingStatus(false);
      }
    },
    [fetchMeta],
  );

  const canDelete = useCallback(
    (p: WallPost) => {
      const isOwner = me?.id != null && p.user?.id != null && Number(p.user.id) === Number(me.id);
      const isAdmin = me?.role === "admin";
      return !!(isOwner || isAdmin);
    },
    [me],
  );

  const deletePost = useCallback(
    async (p: WallPost) => {
      Alert.alert(
        "Delete post?",
        "This will remove it for everyone in the house.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setPosts((prev) => prev.filter((x) => x.id !== p.id));
              try {
                await apiClient(`/house-wall/${p.id}`, "DELETE");
                Toast.show({ type: "realtime", text1: "Post deleted" });
              } catch (e: any) {
                Toast.show({
                  type: "realtime",
                  text1: "Delete failed",
                  text2: e?.message ?? "Please try again",
                });
                await fetchFeed(false);
              }
            },
          },
        ],
      );
    },
    [fetchFeed],
  );

  let composerSnippetPreviewUri =
    typeof localImageUri === "string" && localImageUri.trim() ? localImageUri.trim() : "";
  if (
    !composerSnippetPreviewUri &&
    composerEditingPost?.type === "snippet" &&
    !clearSnippetImageOnSave &&
    typeof composerEditingPost.image_url === "string"
  ) {
    const u = composerEditingPost.image_url.trim();
    composerSnippetPreviewUri = u ? u : "";
  }
  const composerSnippetCanSubmit =
    composerSnippetPreviewUri !== "" || caption.trim().length > 0;

  const composerPollEditing = composerEditingPost?.type === "poll" ? composerEditingPost : null;
  const composerPollOptionsLocked = !!(
    composerPollEditing && pollVoteTotal(composerPollEditing) > 0
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={CORAL} />
        <Text style={{ marginTop: 10, color: colors.sub, fontWeight: "700" }}>
          Loading House Wall…
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={["top"]}>
      <KarmaBurst />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(tabBarHeight + 24, insets.bottom + 120) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={CORAL}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHero}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.pageEyebrow, { color: colors.muted }]}>Your house</Text>
            <Text style={[styles.pageTitle, { color: colors.text }]} numberOfLines={2}>
              {houseName || "Wall"}
            </Text>
            <Text style={[styles.pageSub, { color: colors.sub }]}>
              Notes, essentials, and what everyone’s up to
            </Text>
            <Text style={[styles.pageRetention, { color: colors.muted }]}>
              {WALL_SNIPPET_PHOTO_RETENTION_SHORT}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.heroCta}
            activeOpacity={0.92}
            onPress={() => openComposer("snippet")}
          >
            <MaterialCommunityIcons name="plus" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {matePresence.length > 0 ? (
          <View style={{ marginBottom: 18 }}>
            <View style={styles.presenceHeaderRow}>
              <Text style={[styles.sectionLabel, { color: colors.muted, marginBottom: 0 }]}>
                WHO&apos;S HOME
              </Text>
              <TouchableOpacity onPress={() => router.push("/whos-home")} hitSlop={10}>
                <Text style={{ color: CORAL, fontWeight: "900", fontSize: 12 }}>Manage</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presenceScroll}
            >
              {matePresence.map((m) => {
                const away = m.presence === "away";
                const label = away
                  ? `Away until ${formatAwayUntil(m.away_until)}`
                  : m.guest_plus
                    ? "Home · +1 guest"
                    : "Home (Active)";
                const fromApi =
                  typeof m.avatar_url === "string" ? m.avatar_url.trim() : "";
                const isMe =
                  storedUser?.id != null &&
                  Number(storedUser.id) === Number(m.user_id);
                const presenceAvatarUri =
                  fromApi ||
                  (isMe ? profileAvatarUrl(storedUser) : null);
                return (
                  <View key={m.user_id} style={styles.presenceItem}>
                    <View
                      style={[
                        styles.presenceAvatarRing,
                        {
                          borderColor: away ? "#D1D5DB" : CORAL,
                          borderStyle: away ? "dashed" : "solid",
                          opacity: away ? 0.92 : 1,
                        },
                      ]}
                    >
                      <UserAvatar
                        name={m.name ?? "?"}
                        avatarUrl={presenceAvatarUri || null}
                        size={54}
                        borderRadius={18}
                        bg={away ? "#94A3B8" : CORAL + "22"}
                        letterColor={away ? "#F8FAFC" : CORAL}
                        onPress={() => router.push(`/mate/${m.user_id}` as any)}
                      />
                      {away ? (
                        <View style={styles.presencePlaneTag} pointerEvents="none">
                          <Text style={{ fontSize: 11 }}>✈️</Text>
                        </View>
                      ) : m.guest_plus ? (
                        <View style={styles.presenceGuestBadge} pointerEvents="none">
                          <Text style={styles.presenceGuestBadgeText}>+1</Text>
                        </View>
                      ) : (
                        <View style={styles.presenceHomeDot} pointerEvents="none" />
                      )}
                    </View>
                    <Pressable onPress={() => router.push("/whos-home")} style={{ alignItems: "center" }}>
                      <Text style={[styles.presenceName, { color: colors.text }]} numberOfLines={1}>
                        {m.name}
                      </Text>
                      <Text style={[styles.presenceSub, { color: colors.sub }]} numberOfLines={2}>
                        {label}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>PINNED</Text>
        <View
          style={[
            styles.sectionCard,
            cardElevation,
            { backgroundColor: colors.surface, borderColor: colors.hairline },
          ]}
        >
          <View style={styles.pinBlock}>
            <View style={styles.pinBlockHeader}>
              <View style={[styles.pinIconWrap, { backgroundColor: isDark ? "rgba(255,106,106,0.15)" : "rgba(255,106,106,0.12)" }]}>
                <MaterialCommunityIcons name="fridge-outline" size={20} color={CORAL} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pinBlockTitle, { color: colors.text }]}>Fridge note</Text>
                <Text style={[styles.pinBlockSub, { color: colors.sub }]}>
                  One shared sticky for Wi‑Fi, guests, and heads-ups
                </Text>
              </View>
              <View style={styles.pinActions}>
                <TouchableOpacity onPress={clearFridgeNote} hitSlop={10} style={styles.pinGhostBtn}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.onCardMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={saveFridgeNote} hitSlop={10} style={styles.pinGhostBtn}>
                  <MaterialCommunityIcons name="check" size={22} color={CORAL} />
                </TouchableOpacity>
              </View>
            </View>
            <TextInput
              value={fridgeNote}
              onChangeText={(t) => setFridgeNote(t.slice(0, 255))}
              placeholder="Landlord Tue 4pm · Wi‑Fi password · Away this weekend…"
              placeholderTextColor={colors.inputPlaceholder}
              style={[
                styles.pinInput,
                {
                  borderColor: colors.inputBorder,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                },
              ]}
              multiline
            />
            {fridgeNotePendingSync ? (
              <Text style={{ marginTop: 8, fontSize: 12, color: colors.sub, fontWeight: "600" }}>
                Syncing… will update everyone when you’re back online.
              </Text>
            ) : null}
          </View>

          <View style={[styles.sectionDivider, { backgroundColor: colors.hairline }]} />

          <View style={styles.statusBlock}>
            <View style={styles.pinTitleRow}>
              <MaterialCommunityIcons name="account-group-outline" size={18} color={colors.onCardMuted} />
              <Text style={[styles.statusBlockTitle, { color: colors.text }]}>Who’s around</Text>
            </View>
            <View style={styles.statusPills}>
              {(["home", "out", "away"] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setMyStatus(s)}
                  disabled={savingStatus}
                  style={[
                    styles.statusPill,
                    { borderColor: colors.hairline, backgroundColor: colors.inputBg },
                    status === s && {
                      backgroundColor: isDark ? "rgba(255,106,106,0.22)" : "rgba(255,106,106,0.14)",
                      borderColor: "rgba(255,106,106,0.45)",
                    },
                  ]}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.statusText, { color: colors.text }]}>
                    {s === "home" ? "🏠 Home" : s === "out" ? "🏃 Out" : "✈️ Away"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {around.length > 0 ? (
              <View style={{ marginTop: 12, gap: 8 }}>
                {around.map((r: any) => {
                  const st = r.status;
                  const chip =
                    st === "home" ? "🏠 Home" : st === "out" ? "🏃 Out" : st === "away" ? "✈️ Away" : "—";
                  const fromStatuses =
                    typeof r.avatar_url === "string" ? r.avatar_url.trim() : "";
                  const uidAround = Number(r.user_id);
                  const isMeAround =
                    storedUser?.id != null && Number(storedUser.id) === uidAround;
                  let aroundAvatarUri: string | null =
                    fromStatuses || null;
                  if (!aroundAvatarUri && isMeAround && storedUser) {
                    aroundAvatarUri = profileAvatarUrl(storedUser);
                  }
                  return (
                    <View
                      key={r.user_id}
                      style={[
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 14,
                          borderWidth: 1,
                          backgroundColor: colors.inputBg,
                          borderColor: colors.hairline,
                        },
                      ]}
                    >
                      <View
                        style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}
                      >
                        <UserAvatar
                          name={r.name || "Mate"}
                          avatarUrl={aroundAvatarUri}
                          size={34}
                          borderRadius={13}
                          bg={
                            isDark
                              ? "rgba(255,255,255,0.06)"
                              : "rgba(15,23,42,0.06)"
                          }
                          letterColor={colors.text}
                          onPress={() => router.push(`/mate/${uidAround}` as any)}
                        />
                        <Text
                          style={{ color: colors.text, fontWeight: "900", flex: 1 }}
                          numberOfLines={1}
                        >
                          {r.name || "Mate"}
                          {r.role === "admin" ? " (Admin)" : ""}
                        </Text>
                      </View>
                      <Text style={{ color: colors.sub, fontWeight: "900" }}>{chip}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={{ marginTop: 10, color: colors.sub, fontWeight: "700" }}>
                No statuses yet — tap a pill to set yours.
              </Text>
            )}
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>ESSENTIALS</Text>
        <View
          style={[
            styles.sectionCard,
            cardElevation,
            { backgroundColor: colors.surface, borderColor: colors.hairline },
          ]}
        >
          <View style={styles.lowStockTop}>
            <View style={[styles.pinIconWrap, { backgroundColor: isDark ? "rgba(255,106,106,0.15)" : "rgba(255,106,106,0.12)" }]}>
              <MaterialCommunityIcons name="cart-outline" size={20} color={CORAL} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.lowStockTitle, { color: colors.text }]}>Running low</Text>
              <Text style={[styles.lowStockHint, { color: colors.sub }]}>
                Tap to ping everyone · first receipt photo earns 2× Karma
              </Text>
              {runningLowPendingCount > 0 ? (
                <Text
                  style={[
                    styles.lowStockHint,
                    { color: colors.sub, marginTop: 6, fontWeight: "700" },
                  ]}
                >
                  {runningLowPendingCount} offline alert
                  {runningLowPendingCount === 1 ? "" : "s"} — will send when you’re
                  online.
                </Text>
              ) : null}
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.lowStockScroll}
          >
            {runningCatalog.map((it) => (
              <TouchableOpacity
                key={it.item_key}
                style={[styles.lowChip, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
                onPress={() => pingRunningLowPreset(it.item_key)}
                activeOpacity={0.88}
              >
                <Text style={styles.lowChipEmoji}>{it.emoji}</Text>
                <Text style={[styles.lowChipLbl, { color: colors.text }]} numberOfLines={1}>
                  {it.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.lowCustomRow}>
            <TextInput
              value={customLowInput}
              onChangeText={(txt) => setCustomLowInput(txt.slice(0, 48))}
              placeholder="Something else? (e.g. dish soap, batteries)"
              placeholderTextColor={colors.inputPlaceholder}
              style={[
                styles.lowCustomInput,
                {
                  borderColor: colors.inputBorder,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                },
              ]}
              returnKeyType="done"
              onSubmitEditing={() => void pingRunningLowCustom()}
            />
            <TouchableOpacity
              style={styles.lowCustomBtn}
              onPress={() => void pingRunningLowCustom()}
              activeOpacity={0.9}
            >
              <Text style={styles.lowCustomBtnText}>Alert house</Text>
            </TouchableOpacity>
          </View>
          {runningOpen.length > 0 ? (
            <View style={styles.lowOpenBlock}>
              <Text style={[styles.lowOpenTitle, { color: colors.sub }]}>Open requests</Text>
              {runningOpen.map((o) => (
                <View
                  key={o.id}
                  style={[styles.lowOpenRow, { backgroundColor: colors.inputBg, borderColor: colors.hairline }]}
                >
                  <Text style={[styles.lowOpenText, { color: colors.text }]}>
                    {o.emoji} {o.label}
                    <Text style={{ fontWeight: "700", color: colors.sub }}>
                      {" "}
                      · asked by {o.created_by_name}
                    </Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.lowRestockBtn}
                    onPress={() =>
                      openGroceryHeroComposer({
                        id: o.id,
                        label: o.label,
                        emoji: o.emoji,
                      })
                    }
                    activeOpacity={0.9}
                  >
                    <MaterialCommunityIcons name="camera" size={16} color="#fff" />
                    <Text style={styles.lowRestockBtnText}>Restock</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>ACTIVITY</Text>

        {posts.length === 0 ? (
          <View
            style={[
              styles.empty,
              cardElevation,
              {
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.hairline,
              },
            ]}
          >
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.inputBg }]}>
              <MaterialCommunityIcons name="post-outline" size={28} color={CORAL} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing here yet</Text>
            <Text style={[styles.emptySub, { color: colors.sub }]}>
              Tap + to share a photo or start a poll — your house sees it instantly.{" "}
              {WALL_SNIPPET_PHOTO_RETENTION_SHORT}
            </Text>
          </View>
        ) : (
          posts.map((p, idx) => {
            const author = p.user?.name ?? "Habimate";
            const isSnippet = p.type === "snippet";
            const isPoll = p.type === "poll";
            const isSystem = p.type === "system";
            const sysKind = p.system_payload?.kind;
            const isCalendarSystem =
              sysKind === "vacation_alert" || sysKind === "guest_stay";
            const totalVotes = (p.poll_options || []).reduce(
              (acc, o) => acc + getVoteCount(p, o.id),
              0,
            );

            return (
              <Animated.View
                key={p.id}
                entering={FadeInUp.delay(Math.min(idx * 40, 200)).duration(400)}
                style={{ marginBottom: 12 }}
              >
                <View
                  style={[
                    styles.feedCard,
                    cardElevation,
                    { backgroundColor: colors.surface, borderColor: colors.hairline },
                  ]}
                >
                  <View style={styles.feedCardBody}>
                    <View style={styles.cardTop}>
                      {isSystem ? (
                        <View style={styles.avatarSystem}>
                          <MaterialCommunityIcons
                            name={
                              isCalendarSystem
                                ? sysKind === "guest_stay"
                                  ? "account-multiple"
                                  : "airplane"
                                : "party-popper"
                            }
                            size={20}
                            color="#fff"
                          />
                        </View>
                      ) : (
                        <UserAvatar
                          name={author}
                          avatarUrl={wallPostAvatarUrl(p, storedUser)}
                          size={36}
                          borderRadius={14}
                          bg="rgba(255,106,106,0.22)"
                          letterColor="#fff"
                          onPress={
                            p.user?.id != null
                              ? () =>
                                  router.push(`/mate/${Number(p.user!.id)}` as any)
                              : undefined
                          }
                        />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.author, { color: colors.text }]}>
                          {author}
                        </Text>
                        <Text style={[styles.meta, { color: colors.sub }]}>
                          {isSystem
                            ? isCalendarSystem
                              ? sysKind === "guest_stay"
                                ? "Guest stay"
                                : "Vacation alert"
                              : "Milestone"
                            : isSnippet
                              ? p.image_url
                                ? "Snippet"
                                : "Note"
                              : isPoll
                                ? "Poll"
                                : "Update"}
                        </Text>
                      </View>
                      {(isSnippet || isPoll) && canDelete(p) && (
                        <TouchableOpacity
                          onPress={() => openEditPost(p)}
                          activeOpacity={0.85}
                          style={[styles.moreBtn, { backgroundColor: colors.inputBg }]}
                        >
                          <MaterialCommunityIcons
                            name="pencil-outline"
                            size={20}
                            color={colors.onCardMuted}
                          />
                        </TouchableOpacity>
                      )}
                      {canDelete(p) && (
                        <TouchableOpacity
                          onPress={() => deletePost(p)}
                          activeOpacity={0.85}
                          style={[styles.moreBtn, { backgroundColor: colors.inputBg }]}
                        >
                          <MaterialCommunityIcons
                            name="delete-outline"
                            size={20}
                            color={colors.onCardMuted}
                          />
                        </TouchableOpacity>
                      )}
                      {!isSystem && (
                        <TouchableOpacity
                          onPress={() => toggleHeart(p.id)}
                          activeOpacity={0.8}
                          style={[styles.heartBtn, { backgroundColor: colors.inputBg }]}
                        >
                          <MaterialCommunityIcons
                            name={p.my_hearted ? "heart" : "heart-outline"}
                            size={20}
                            color={p.my_hearted ? CORAL : colors.onCardMuted}
                          />
                          <Text style={[styles.heartCount, { color: colors.onCard }]}>
                            {Number(p.hearts_count ?? 0)}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {isSystem && !!p.caption && (
                      <LinearGradient
                        colors={
                          isCalendarSystem
                            ? sysKind === "guest_stay"
                              ? ["rgba(99,102,241,0.55)", "rgba(255,106,106,0.42)"]
                              : ["rgba(14,165,233,0.5)", "rgba(255,106,106,0.4)"]
                            : ["rgba(255,215,0,0.45)", "rgba(255,106,106,0.35)"]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.systemMilestone}
                      >
                        <MaterialCommunityIcons
                          name={
                            isCalendarSystem
                              ? sysKind === "guest_stay"
                                ? "account-multiple"
                                : "airplane"
                              : "party-popper"
                          }
                          size={24}
                          color="#fff"
                          style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.systemMilestoneText}>{p.caption}</Text>
                          {isCalendarSystem ? (
                            <Text style={styles.systemCalendarNote}>
                              {sysKind === "guest_stay"
                                ? "Extra person-days apply to utilities for this window."
                                : "Utility & variable splits exclude their away days automatically."}
                            </Text>
                          ) : null}
                        </View>
                      </LinearGradient>
                    )}

                    {!!p.caption && !isSystem && (
                      isSnippet && !p.image_url ? (
                        <TouchableOpacity
                          activeOpacity={0.92}
                          onPress={() => onDoubleTap(p.id)}
                          style={{ marginTop: 2 }}
                        >
                          <Text style={[styles.caption, { color: colors.text }]}>
                            {p.caption}
                          </Text>
                          <View style={[styles.snippetHintRowCaption, { marginTop: 6 }]}>
                            <MaterialCommunityIcons
                              name="gesture-double-tap"
                              size={14}
                              color={colors.sub}
                            />
                            <Text style={[styles.snippetHintTextMuted, { color: colors.sub }]}>
                              Double-tap to heart
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[styles.caption, { color: colors.text }]}>
                          {p.caption}
                        </Text>
                      )
                    )}

                    {isPoll && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={[styles.pollQ, { color: colors.text }]}>
                          {p.poll_question}
                        </Text>
                        <View style={{ marginTop: 10, gap: 10 }}>
                          {(p.poll_options || []).map((o) => {
                            const c = getVoteCount(p, o.id);
                            const pct = totalVotes > 0 ? c / totalVotes : 0;
                            const selected = p.my_vote_option_id === o.id;
                            return (
                              <TouchableOpacity
                                key={o.id}
                                onPress={() => vote(p.id, o.id)}
                                activeOpacity={0.9}
                                style={[
                                  styles.pollOpt,
                                  { borderColor: colors.hairline, backgroundColor: colors.pollTrack },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.pollBar,
                                    {
                                      width: `${Math.round(pct * 100)}%`,
                                      backgroundColor: selected
                                        ? "rgba(255,106,106,0.45)"
                                        : isDark
                                          ? "rgba(255,255,255,0.06)"
                                          : "rgba(255,255,255,0.65)",
                                    },
                                  ]}
                                />
                                <View style={styles.pollRow}>
                                  <Text
                                    style={[
                                      styles.pollText,
                                      { color: colors.text },
                                    ]}
                                  >
                                    {o.text}
                                  </Text>
                                  <Text style={[styles.pollCount, { color: colors.sub }]}>
                                    {c}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <Text style={[styles.pollMeta, { color: colors.sub }]}>
                          {totalVotes} votes
                        </Text>
                      </View>
                    )}

                    {isSnippet && p.image_url ? (
                      <View style={{ marginTop: 10 }}>
                        <TouchableOpacity
                          activeOpacity={0.95}
                          onPress={() => onDoubleTap(p.id)}
                          style={[
                            styles.snippetImageWrap,
                            { borderColor: colors.hairline },
                          ]}
                        >
                          <Image
                            source={{ uri: p.image_url }}
                            style={styles.snippetImage}
                            resizeMode="cover"
                          />
                          <View style={styles.snippetHint}>
                            <MaterialCommunityIcons
                              name="gesture-double-tap"
                              size={14}
                              color="rgba(255,255,255,0.85)"
                            />
                            <Text style={styles.snippetHintText}>Double-tap to heart</Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {isSnippet ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={[styles.reactionRow, { marginTop: isSnippet && p.image_url ? 10 : 12 }]}
                      >
                        {REACTION_EMOJIS.map((e) => {
                          const mine = (p.my_emojis ?? []).includes(e);
                          const c = Number((p.emoji_counts ?? {})[e] ?? 0);
                          return (
                            <TouchableOpacity
                              key={e}
                              onPress={() => toggleEmoji(p.id, e)}
                              activeOpacity={0.85}
                              style={[
                                styles.reactionPill,
                                {
                                  borderColor: mine
                                    ? "rgba(255,106,106,0.65)"
                                    : colors.inputBorder,
                                  backgroundColor: mine
                                    ? "rgba(255,106,106,0.18)"
                                    : colors.inputBg,
                                },
                              ]}
                            >
                              <Text style={styles.reactionEmoji}>{e}</Text>
                              <Text
                                style={[
                                  styles.reactionCount,
                                  { color: mine ? CORAL : colors.sub },
                                ]}
                              >
                                {c}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    ) : null}
                  </View>
                </View>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={composerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setComposerOpen(false);
          resetComposerState();
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 6 : 0}
          >
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.modalBg,
                  paddingBottom: Math.max(insets.bottom, 14) + 10,
                  maxHeight: "94%",
                },
              ]}
            >
            <View style={styles.modalTop}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {composerEditingPost ? "Edit post" : "Create"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setComposerOpen(false);
                  resetComposerState();
                }}
                hitSlop={10}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.sub} />
              </TouchableOpacity>
            </View>

            {!composerEditingPost ? (
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[
                    styles.modePill,
                    composerMode === "snippet" && styles.modePillActive,
                  ]}
                  onPress={() => setComposerMode("snippet")}
                >
                  <Text
                    style={[
                      styles.modeText,
                      { color: isDark ? "rgba(255,255,255,0.85)" : "#0F172A" },
                      composerMode === "snippet" && styles.modeTextActive,
                    ]}
                  >
                    Snippet
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modePill,
                    composerMode === "poll" && styles.modePillActive,
                  ]}
                  onPress={() => {
                    setComposerMode("poll");
                    setFulfillmentRequestId(null);
                  }}
                >
                  <Text
                    style={[
                      styles.modeText,
                      { color: isDark ? "rgba(255,255,255,0.85)" : "#0F172A" },
                      composerMode === "poll" && styles.modeTextActive,
                    ]}
                  >
                    Quick Poll
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 14) + 28 }}
            >
              {composerMode === "snippet" ? (
                <View style={{ gap: 12 }}>
                {fulfillmentRequestId != null ? (
                  <View style={styles.heroBanner}>
                    <MaterialCommunityIcons name="trophy-award" size={20} color="#FFD700" />
                    <Text style={[styles.heroBannerText, { color: colors.text }]}>
                      Grocery Hero race: upload a receipt photo for double Karma (+20).
                    </Text>
                  </View>
                ) : null}
                <TouchableOpacity style={styles.pickBtn} onPress={pickImage} activeOpacity={0.9}>
                  <MaterialCommunityIcons name="image" size={18} color="#fff" />
                  <Text style={styles.pickBtnText}>
                    {fulfillmentRequestId != null && !composerEditingPost
                      ? localImageUri
                        ? "Change receipt photo"
                        : "Pick receipt photo (recommended)"
                      : localImageUri
                        ? "Change photo"
                        : "Pick a photo (optional)"}
                  </Text>
                </TouchableOpacity>

                {!!composerSnippetPreviewUri && (
                  <Image
                    source={{ uri: composerSnippetPreviewUri }}
                    style={styles.preview}
                  />
                )}

                {composerEditingPost?.type === "snippet" && !!composerSnippetPreviewUri && (
                  <TouchableOpacity
                    style={[
                      styles.secondaryBtn,
                      { alignSelf: "flex-start", borderColor: "rgba(239,68,68,0.45)" },
                    ]}
                    onPress={() => {
                      setLocalImageUri(null);
                      if (composerEditingPost?.image_url) {
                        setClearSnippetImageOnSave(true);
                      } else {
                        setClearSnippetImageOnSave(false);
                      }
                    }}
                    activeOpacity={0.9}
                  >
                    <MaterialCommunityIcons name="image-off-outline" size={16} color="#fff" />
                    <Text style={styles.secondaryBtnText}>Remove photo</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.inputWrap}>
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: isDark ? "rgba(255,255,255,0.8)" : "#0F172A" },
                    ]}
                  >
                    {composerSnippetPreviewUri
                      ? "Caption (optional, max 100)"
                      : "Caption (required unless you add a photo, max 100)"}
                  </Text>
                  <TextInput
                    value={caption}
                    onChangeText={(t) => setCaption(t.slice(0, 100))}
                    placeholder="Burnt toast chronicles…"
                    placeholderTextColor={colors.inputPlaceholder}
                    style={[
                      styles.input,
                      {
                        borderColor: colors.inputBorder,
                        backgroundColor: colors.inputBg,
                        color: colors.inputText,
                      },
                    ]}
                    maxLength={100}
                  />
                  <Text
                    style={[
                      styles.inputCount,
                      { color: isDark ? "rgba(255,255,255,0.7)" : "rgba(15,23,42,0.6)" },
                    ]}
                  >
                    {caption.length}/100
                  </Text>
                </View>

                <View
                  style={[
                    styles.retentionNote,
                    {
                      borderColor: colors.hairline,
                      backgroundColor: isDark ? "rgba(46,196,182,0.08)" : "rgba(46,196,182,0.1)",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={16}
                    color="#2EC4B6"
                  />
                  <Text style={[styles.retentionNoteText, { color: colors.sub }]}>
                    {WALL_SNIPPET_PHOTO_RETENTION_DETAIL}
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.emojiRow}
                >
                  {["😂", "🥲", "🔥", "🍕", "🧻", "🏠", "🥳", "🤦‍♂️", "😴", "☕️"].map(
                    (e) => (
                      <TouchableOpacity
                        key={e}
                        onPress={() =>
                          setCaption((prev) =>
                            (prev + (prev ? " " : "") + e).slice(0, 100),
                          )
                        }
                        activeOpacity={0.85}
                        style={[
                          styles.emojiPill,
                          {
                            borderColor: colors.inputBorder,
                            backgroundColor: colors.inputBg,
                          },
                        ]}
                      >
                        <Text style={styles.emojiText}>{e}</Text>
                      </TouchableOpacity>
                    ),
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={[
                    styles.postBtn,
                    (creating || !composerSnippetCanSubmit) && { opacity: 0.45 },
                  ]}
                  onPress={createSnippet}
                  disabled={creating || !composerSnippetCanSubmit}
                  activeOpacity={0.9}
                >
                  {creating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="send" size={18} color="#fff" />
                      <Text style={styles.postBtnText}>
                        {composerEditingPost?.type === "snippet"
                          ? "Save snippet"
                          : "Post snippet"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {composerPollOptionsLocked ? (
                    <View style={styles.pollEditLockedBanner}>
                      <MaterialCommunityIcons name="vote-outline" size={20} color={CORAL} />
                      <Text style={[styles.pollEditLockedText, { color: colors.text }]}>
                        Votes are in — you can change the question, not the choices.
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: colors.sub, fontWeight: "800" }}>
                      Question + 2–4 options
                    </Text>
                  )}
                  <View style={styles.inputWrap}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { color: isDark ? "rgba(255,255,255,0.8)" : "#0F172A" },
                      ]}
                    >
                      Question
                    </Text>
                    <TextInput
                      value={pollQuestion}
                      onChangeText={setPollQuestion}
                      placeholder="Takeaway tonight?"
                      placeholderTextColor={colors.inputPlaceholder}
                      style={[
                        styles.input,
                        {
                          borderColor: colors.inputBorder,
                          backgroundColor: colors.inputBg,
                          color: colors.inputText,
                        },
                      ]}
                    />
                  </View>

                  <View style={{ gap: 10 }}>
                    {pollOptions.map((opt, idx) => (
                      <View key={idx} style={styles.optRow}>
                        <TextInput
                          value={opt}
                          onChangeText={(t) =>
                            setPollOptions((prev) =>
                              prev.map((p, i) => (i === idx ? t : p)),
                            )
                          }
                          placeholder={`Option ${idx + 1}`}
                          placeholderTextColor={colors.inputPlaceholder}
                          editable={!composerPollOptionsLocked}
                          style={[
                            styles.input,
                            {
                              flex: 1,
                              borderColor: colors.inputBorder,
                              backgroundColor: colors.inputBg,
                              color: colors.inputText,
                              opacity: composerPollOptionsLocked ? 0.75 : 1,
                            },
                          ]}
                        />
                        <TouchableOpacity
                          onPress={() =>
                            setPollOptions((prev) =>
                              prev.length <= 2 ? prev : prev.filter((_, i) => i !== idx),
                            )
                          }
                          disabled={composerPollOptionsLocked || pollOptions.length <= 2}
                          style={[
                            styles.optDel,
                            (composerPollOptionsLocked || pollOptions.length <= 2) && {
                              opacity: 0.35,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons name="close" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  {!composerPollOptionsLocked ? (
                    <View style={styles.optActions}>
                      <TouchableOpacity
                        onPress={() =>
                          setPollOptions((prev) => (prev.length >= 4 ? prev : [...prev, ""]))
                        }
                        style={[styles.secondaryBtn, pollOptions.length >= 4 && { opacity: 0.5 }]}
                        disabled={pollOptions.length >= 4}
                      >
                        <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                        <Text style={styles.secondaryBtnText}>Add option</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.postBtn, creating && { opacity: 0.7 }]}
                    onPress={createPoll}
                    disabled={creating}
                    activeOpacity={0.9}
                  >
                    {creating ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="send" size={18} color="#fff" />
                        <Text style={styles.postBtnText}>
                          {composerEditingPost?.type === "poll"
                            ? "Save poll"
                            : "Post poll"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 120 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  pageHero: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 22,
    marginTop: 4,
  },
  pageEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.1,
    lineHeight: 38,
  },
  pageSub: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    maxWidth: width * 0.62,
    opacity: 0.95,
  },
  heroCta: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: CORAL,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: CORAL,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.38,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  presenceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  presenceScroll: {
    flexDirection: "row",
    gap: 14,
    paddingRight: 12,
    paddingBottom: 4,
  },
  presenceItem: { width: 88, alignItems: "center" },
  presenceAvatarRing: {
    position: "relative",
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  presencePlaneTag: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "rgba(15,23,42,0.92)",
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  presenceGuestBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#6366F1",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: "#fff",
  },
  presenceGuestBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  presenceHomeDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#fff",
  },
  presenceName: {
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    maxWidth: 88,
  },
  presenceSub: { fontSize: 10, fontWeight: "700", textAlign: "center", marginTop: 2, lineHeight: 13 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 10,
    marginTop: 2,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    overflow: "hidden",
  },
  sectionDivider: { height: StyleSheet.hairlineWidth, width: "100%", marginVertical: 4 },
  pinBlock: {},
  pinBlockHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  pinIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pinBlockTitle: { fontSize: 17, fontWeight: "800" },
  pinBlockSub: { fontSize: 12, fontWeight: "600", marginTop: 4, lineHeight: 17 },
  pinActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  pinGhostBtn: { padding: 8, borderRadius: 12 },
  statusBlock: { paddingTop: 4 },
  statusBlockTitle: { fontSize: 14, fontWeight: "800", marginBottom: 10 },
  empty: {
    marginTop: 4,
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 32,
    gap: 10,
    borderRadius: 20,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: "900" },
  emptySub: { fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 19 },
  feedCard: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  feedCardBody: { padding: 15 },
  lowStockTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  lowStockTitle: { fontWeight: "900", fontSize: 15 },
  lowStockHint: { fontWeight: "700", fontSize: 11, lineHeight: 15, marginTop: 4 },
  lowStockScroll: { gap: 10, paddingRight: 8, alignItems: "center" },
  lowCustomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  lowCustomInput: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontWeight: "700",
    fontSize: 14,
  },
  lowCustomBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: CORAL,
  },
  lowCustomBtnText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  lowChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    maxWidth: 200,
  },
  lowChipEmoji: { fontSize: 18 },
  lowChipLbl: { fontWeight: "800", fontSize: 12, flexShrink: 1 },
  lowOpenBlock: { marginTop: 12, gap: 8 },
  lowOpenTitle: { fontWeight: "900", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 },
  lowOpenRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  lowOpenText: { flex: 1, fontWeight: "800", fontSize: 13 },
  lowRestockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: CORAL,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  lowRestockBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  heroBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,106,106,0.15)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,106,106,0.35)",
  },
  heroBannerText: { flex: 1, fontWeight: "800", fontSize: 13 },
  pollEditLockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(148,163,184,0.16)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
  },
  pollEditLockedText: { flex: 1, fontWeight: "800", fontSize: 13, lineHeight: 18 },
  pinTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pinInput: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontWeight: "600",
    fontSize: 15,
    minHeight: 88,
    lineHeight: 22,
  },
  statusPills: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: { fontWeight: "900", fontSize: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(255,106,106,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "900" },
  avatarSystem: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(255,106,106,0.45)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.45)",
  },
  author: { fontWeight: "900" },
  meta: { marginTop: 1, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  caption: { marginTop: 10, fontWeight: "700", lineHeight: 19 },
  heartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  heartCount: { fontWeight: "800", fontSize: 13 },
  pollQ: { fontWeight: "900", fontSize: 14 },
  pollOpt: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  pollBar: { position: "absolute", left: 0, top: 0, bottom: 0 },
  pollRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pollText: { fontWeight: "800" },
  pollCount: { fontWeight: "900" },
  pollMeta: { marginTop: 8, fontSize: 11, fontWeight: "800" },
  snippetImageWrap: {
    marginTop: 10,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  snippetImage: { width: "100%", height: Math.min(420, width * 1.15) },
  snippetHint: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  snippetHintText: { color: "rgba(255,255,255,0.9)", fontWeight: "900", fontSize: 11 },
  snippetHintRowCaption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  snippetHintTextMuted: { fontWeight: "800", fontSize: 11 },
  pageRetention: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
  retentionNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  retentionNoteText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },
  systemMilestone: {
    marginTop: 10,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  systemMilestoneText: { color: "#fff", fontWeight: "900", fontSize: 15, lineHeight: 21 },
  systemCalendarNote: {
    marginTop: 6,
    color: "rgba(255,255,255,0.92)",
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalCard: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 16,
    paddingBottom: 22,
  },
  modalTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 18, fontWeight: "900" },
  modeRow: { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 14 },
  modePill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  modePillActive: { backgroundColor: "rgba(255,106,106,0.18)", borderColor: "rgba(255,106,106,0.45)" },
  modeText: { fontWeight: "900", color: "rgba(255,255,255,0.85)" },
  modeTextActive: { color: CORAL },
  pickBtn: {
    backgroundColor: CORAL,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pickBtnText: { color: "#fff", fontWeight: "900" },
  preview: { width: "100%", height: 220, borderRadius: 18, marginTop: 6 },
  inputWrap: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  inputLabel: { fontWeight: "900", fontSize: 12, marginBottom: 8 },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "800",
  },
  inputCount: { marginTop: 8, fontWeight: "900", fontSize: 11, textAlign: "right" },
  optRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  optDel: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  optActions: { flexDirection: "row", justifyContent: "flex-end" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  secondaryBtnText: { color: "#fff", fontWeight: "900" },
  postBtn: {
    backgroundColor: CORAL,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: CORAL,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  postBtnText: { color: "#fff", fontWeight: "900" },
  emojiRow: { gap: 10, paddingVertical: 2 },
  emojiPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  emojiText: { fontSize: 18 },

  reactionRow: { gap: 10, paddingTop: 10, paddingBottom: 2 },
  reactionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  reactionEmoji: { fontSize: 16 },
  reactionCount: { fontWeight: "900", fontSize: 12 },
});

