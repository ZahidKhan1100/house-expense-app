import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  Modal,
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

import { useTheme } from "../../theme/ThemeContext";
import { apiClient } from "../../../src/utils/apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createPusherClient } from "../../../src/realtime/realtimeClient";
import { REALTIME } from "../../../src/realtime/realtimeConfig";

const { width } = Dimensions.get("window");
const CORAL = "#FF6A6A";

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
  user?: { id: number; name: string } | null;
  created_at?: string | null;
};

function toInt(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getVoteCount(post: WallPost, optionId: number): number {
  const counts: any = post.counts || {};
  return Number(counts[String(optionId)] ?? counts[optionId] ?? 0);
}

export default function Wall() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<WallPost[]>([]);

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<"snippet" | "poll">("snippet");
  const [caption, setCaption] = useState("");
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const pusherRef = useRef<any>(null);
  const lastTapRef = useRef<Record<number, number>>({});

  const [fridgeNote, setFridgeNote] = useState<string>("");
  const [status, setStatus] = useState<"home" | "out" | "away">("home");
  const [savingStatus, setSavingStatus] = useState(false);

  const colors = useMemo(
    () => ({
      bg: isDark ? "#0B1220" : "#F8FAFC",
      text: isDark ? "#F1F5F9" : "#0F172A",
      sub: isDark ? "#94A3B8" : "#64748B",
      border: isDark ? "rgba(255,255,255,0.40)" : "rgba(255,255,255,0.55)",
      glass: isDark ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.55)",
      modalBg: isDark ? "#0F172A" : "#FFFFFF",
      inputBorder: isDark ? "rgba(255,255,255,0.18)" : "rgba(2,6,23,0.10)",
      inputBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(2,6,23,0.03)",
      inputText: isDark ? "#FFFFFF" : "#0F172A",
      inputPlaceholder: isDark ? "rgba(255,255,255,0.6)" : "rgba(15,23,42,0.45)",
    }),
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

  const fetchMeta = useCallback(async () => {
    try {
      const [noteRes, statusRes] = await Promise.all([
        apiClient("/house-wall/fridge-note", "GET"),
        apiClient("/house-wall/statuses", "GET"),
      ]);

      setFridgeNote(noteRes?.note?.body ?? "");

      // Try to infer current user status from statuses list
      const userStr = await AsyncStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const myId = toInt(user?.id);
      const rows = statusRes?.statuses ?? [];
      const mine = myId ? rows.find((r: any) => Number(r.user_id) === myId) : null;
      const s = mine?.status;
      if (s === "home" || s === "out" || s === "away") setStatus(s);
    } catch (e) {
      console.log("Wall meta error", e);
    }
  }, []);

  useEffect(() => {
    fetchFeed(true);
    fetchMeta();
  }, [fetchFeed]);

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
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeed(false);
    await fetchMeta();
  }, [fetchFeed]);

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

  const openComposer = useCallback((mode: "snippet" | "poll") => {
    setComposerMode(mode);
    setCaption("");
    setLocalImageUri(null);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setComposerOpen(true);
  }, []);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access to post a snippet.");
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
    if (uri) setLocalImageUri(uri);
  }, []);

  const uploadToCloudinary = useCallback(async (uri: string) => {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
    );

    const form = new FormData();
    form.append("file", {
      uri: manipulated.uri,
      name: "snippet.jpg",
      type: "image/jpeg",
    } as any);
    form.append("upload_preset", REALTIME.cloudinary.uploadPreset);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${REALTIME.cloudinary.cloudName}/image/upload`,
      {
        method: "POST",
        body: form,
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? "Upload failed");
    return String(data.secure_url ?? data.url);
  }, []);

  const createSnippet = useCallback(async () => {
    if (!localImageUri) {
      Alert.alert("Add a photo", "Pick an image to post a snippet.");
      return;
    }
    if (caption.length > 100) {
      Alert.alert("Too long", "Caption must be 100 characters or less.");
      return;
    }
    setCreating(true);
    try {
      if (
        REALTIME.cloudinary.cloudName.includes("CLOUDINARY_") ||
        REALTIME.cloudinary.uploadPreset.includes("CLOUDINARY_")
      ) {
        Alert.alert(
          "Cloudinary not configured",
          "Set REALTIME.cloudinary.cloudName and REALTIME.cloudinary.uploadPreset in src/realtime/realtimeConfig.ts",
        );
        return;
      }

      const imageUrl = await uploadToCloudinary(localImageUri);
      const res = await apiClient("/house-wall/snippets", "POST", {
        caption: caption.trim() || null,
        image_url: imageUrl,
      });
      if (res?.post) setPosts((prev) => [res.post as WallPost, ...prev]);
      setComposerOpen(false);
    } catch (e: any) {
      Alert.alert("Couldn’t post snippet", e?.message ?? "Try again");
    } finally {
      setCreating(false);
    }
  }, [caption, localImageUri, uploadToCloudinary]);

  const createPoll = useCallback(async () => {
    const q = pollQuestion.trim();
    const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!q) return Alert.alert("Question required", "Write a poll question.");
    if (opts.length < 2) return Alert.alert("Add options", "Add at least 2 options.");
    if (opts.length > 4) return Alert.alert("Too many", "Max 4 options.");

    setCreating(true);
    try {
      const res = await apiClient("/house-wall/polls", "POST", {
        question: q,
        options: opts,
      });
      if (res?.post) setPosts((prev) => [res.post as WallPost, ...prev]);
      setComposerOpen(false);
    } catch (e: any) {
      Alert.alert("Couldn’t post poll", e?.message ?? "Try again");
    } finally {
      setCreating(false);
    }
  }, [pollOptions, pollQuestion]);

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
    try {
      await apiClient("/house-wall/fridge-note", "PUT", {
        body: fridgeNote.trim() || null,
      });
      Toast.show({
        type: "realtime",
        text1: "Fridge note updated",
        text2: fridgeNote.trim() ? "Saved for everyone" : "Cleared",
      });
    } catch (e: any) {
      Alert.alert("Save failed", e?.message ?? "Could not save note");
    }
  }, [fridgeNote]);

  const setMyStatus = useCallback(
    async (next: "home" | "out" | "away") => {
      setStatus(next);
      setSavingStatus(true);
      try {
        await apiClient("/house-wall/status", "PUT", { status: next });
      } catch {
        await fetchMeta();
      } finally {
        setSavingStatus(false);
      }
    },
    [fetchMeta],
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
      <LinearGradient
        colors={["rgba(255,106,106,0.22)", "transparent"]}
        style={styles.topGlow}
        pointerEvents="none"
      />

      <ScrollView
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
        <BlurView intensity={28} tint={isDark ? "dark" : "light"} style={styles.pinCard}>
          <View style={[styles.pinInner, { backgroundColor: colors.glass, borderColor: colors.border }]}>
            <View style={styles.pinTop}>
              <View style={styles.pinTitleRow}>
                <MaterialCommunityIcons
                  name="note-text-outline"
                  size={18}
                  color={isDark ? "#fff" : "#0F172A"}
                />
                <Text style={[styles.pinTitle, { color: colors.text }]}>Fridge Note</Text>
              </View>
              <TouchableOpacity onPress={saveFridgeNote} activeOpacity={0.9} style={styles.pinSave}>
                <MaterialCommunityIcons name="content-save" size={16} color="#fff" />
                <Text style={styles.pinSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={fridgeNote}
              onChangeText={(t) => setFridgeNote(t.slice(0, 255))}
              placeholder="Landlord visiting at 4 PM…"
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

            <View style={styles.statusRow}>
              <View style={styles.pinTitleRow}>
                <MaterialCommunityIcons
                  name="home-account"
                  size={18}
                  color={isDark ? "#fff" : "#0F172A"}
                />
                <Text style={[styles.pinTitle, { color: colors.text }]}>Who’s Home</Text>
              </View>
              <View style={styles.statusPills}>
                {(["home", "out", "away"] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setMyStatus(s)}
                    disabled={savingStatus}
                    style={[
                      styles.statusPill,
                      status === s && { backgroundColor: "rgba(255,106,106,0.30)", borderColor: "rgba(255,106,106,0.55)" },
                    ]}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.statusText, { color: isDark ? "#fff" : "#0F172A" }]}>
                      {s === "home" ? "🏠 Home" : s === "out" ? "🏃‍♂️ Out" : "✈️ Away"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </BlurView>

        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>House Wall</Text>
            <Text style={[styles.subtitle, { color: colors.sub }]}>
              Micro-moments, polls, and life updates
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerBtn}
              activeOpacity={0.9}
              onPress={() => setComposerOpen(true)}
            >
              <MaterialCommunityIcons name="plus" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {posts.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="post-outline"
              size={42}
              color={isDark ? "#334155" : "#CBD5E1"}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No posts yet
            </Text>
            <Text style={[styles.emptySub, { color: colors.sub }]}>
              Add a snippet or start a quick poll to kick things off.
            </Text>
          </View>
        ) : (
          posts.map((p, idx) => {
            const author = p.user?.name ?? "System";
            const isSnippet = p.type === "snippet";
            const isPoll = p.type === "poll";
            const totalVotes = (p.poll_options || []).reduce(
              (acc, o) => acc + getVoteCount(p, o.id),
              0,
            );

            return (
              <Animated.View
                key={p.id}
                entering={FadeInUp.delay(Math.min(idx * 40, 200)).duration(400)}
                style={{ marginBottom: 14 }}
              >
                <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={styles.card}>
                  <View
                    style={[
                      styles.cardInner,
                      {
                        backgroundColor: colors.glass,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.cardTop}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {author.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.author, { color: colors.text }]}>
                          {author}
                        </Text>
                        <Text style={[styles.meta, { color: colors.sub }]}>
                          {isSnippet ? "Snippet" : isPoll ? "Quick Poll" : "Update"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => toggleHeart(p.id)}
                        activeOpacity={0.8}
                        style={styles.heartBtn}
                      >
                        <MaterialCommunityIcons
                          name={p.my_hearted ? "heart" : "heart-outline"}
                          size={20}
                          color={p.my_hearted ? CORAL : "rgba(255,255,255,0.9)"}
                        />
                        <Text style={styles.heartCount}>
                          {Number(p.hearts_count ?? 0)}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {!!p.caption && (
                      <Text style={[styles.caption, { color: colors.text }]}>
                        {p.caption}
                      </Text>
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
                                  { borderColor: "rgba(255,255,255,0.35)" },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.pollBar,
                                    {
                                      width: `${Math.round(pct * 100)}%`,
                                      backgroundColor: selected
                                        ? "rgba(255,106,106,0.55)"
                                        : "rgba(255,255,255,0.14)",
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
                      <TouchableOpacity
                        activeOpacity={0.95}
                        onPress={() => onDoubleTap(p.id)}
                        style={styles.snippetImageWrap}
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
                    ) : null}
                  </View>
                </BlurView>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={composerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setComposerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.modalBg,
                paddingBottom: Math.max(insets.bottom, 14) + 10,
              },
            ]}
          >
            <View style={styles.modalTop}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create</Text>
              <TouchableOpacity onPress={() => setComposerOpen(false)} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={22} color={colors.sub} />
              </TouchableOpacity>
            </View>

            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[
                  styles.modePill,
                  composerMode === "snippet" && styles.modePillActive,
                ]}
                onPress={() => openComposer("snippet")}
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
                onPress={() => openComposer("poll")}
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

            {composerMode === "snippet" ? (
              <View style={{ gap: 12 }}>
                <TouchableOpacity style={styles.pickBtn} onPress={pickImage} activeOpacity={0.9}>
                  <MaterialCommunityIcons name="image" size={18} color="#fff" />
                  <Text style={styles.pickBtnText}>{localImageUri ? "Change photo" : "Pick a photo"}</Text>
                </TouchableOpacity>

                {!!localImageUri && (
                  <Image source={{ uri: localImageUri }} style={styles.preview} />
                )}

                <View style={styles.inputWrap}>
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: isDark ? "rgba(255,255,255,0.8)" : "#0F172A" },
                    ]}
                  >
                    Caption (optional, max 100)
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

                <TouchableOpacity
                  style={[styles.postBtn, creating && { opacity: 0.7 }]}
                  onPress={createSnippet}
                  disabled={creating}
                  activeOpacity={0.9}
                >
                  {creating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="send" size={18} color="#fff" />
                      <Text style={styles.postBtnText}>Post Snippet</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <Text style={{ color: colors.sub, fontWeight: "800" }}>
                  Question + 2–4 options
                </Text>
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
                        style={[
                          styles.input,
                          {
                            flex: 1,
                            borderColor: colors.inputBorder,
                            backgroundColor: colors.inputBg,
                            color: colors.inputText,
                          },
                        ]}
                      />
                      <TouchableOpacity
                        onPress={() =>
                          setPollOptions((prev) =>
                            prev.length <= 2 ? prev : prev.filter((_, i) => i !== idx),
                          )
                        }
                        disabled={pollOptions.length <= 2}
                        style={[
                          styles.optDel,
                          pollOptions.length <= 2 && { opacity: 0.35 },
                        ]}
                      >
                        <MaterialCommunityIcons name="close" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <View style={styles.optActions}>
                  <TouchableOpacity
                    onPress={() =>
                      setPollOptions((prev) => (prev.length >= 4 ? prev : [...prev, ""]))
                    }
                    style={[
                      styles.secondaryBtn,
                      pollOptions.length >= 4 && { opacity: 0.5 },
                    ]}
                    disabled={pollOptions.length >= 4}
                  >
                    <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                    <Text style={styles.secondaryBtnText}>Add option</Text>
                  </TouchableOpacity>
                </View>

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
                      <Text style={styles.postBtnText}>Post Poll</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 160 },
  scroll: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 120 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  title: { fontSize: 26, fontWeight: "900", letterSpacing: -0.6 },
  subtitle: { marginTop: 2, fontWeight: "700" },
  headerRight: { justifyContent: "center" },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: CORAL,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: CORAL,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  empty: {
    marginTop: 60,
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "900" },
  emptySub: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  card: { borderRadius: 22, overflow: "hidden" },
  cardInner: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
  },
  pinCard: { borderRadius: 22, overflow: "hidden", marginBottom: 16 },
  pinInner: { borderWidth: 1, borderRadius: 22, padding: 14 },
  pinTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pinTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pinTitle: { fontWeight: "900" },
  pinSave: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,106,106,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,106,106,0.55)",
  },
  pinSaveText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  pinInput: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "800",
    minHeight: 54,
  },
  statusRow: { marginTop: 12, gap: 10 },
  statusPills: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.10)",
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
  author: { fontWeight: "900" },
  meta: { marginTop: 1, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  caption: { marginTop: 10, fontWeight: "700", lineHeight: 19 },
  heartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  heartCount: { color: "rgba(255,255,255,0.85)", fontWeight: "900", fontSize: 12 },
  pollQ: { fontWeight: "900", fontSize: 14 },
  pollOpt: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
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
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
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
});

