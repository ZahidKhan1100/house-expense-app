import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";

import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";

import {
  enqueueExpenseCreate,
  listExpenseCreates,
  removeAction,
  subscribePendingSync,
  type ExpenseCreatePayload,
  type PendingRow,
} from "../../src/offline/pendingActionsStore";
import { syncPendingActions } from "../../src/offline/syncPendingActions";
import {
  loadExpenseFormCache,
  saveExpenseFormCache,
} from "../../src/offline/expenseFormCache";
import { isLikelyUnreachableError } from "../../src/offline/offlineUtils";
import { apiClient, getApiErrorMessage } from "../../src/utils/apiClient";
import { useKeyboardBottomPadding } from "../../src/hooks/useKeyboardBottomPadding";
import { useTheme } from "../../src/theme/ThemeContext";
import { SplitRoundingNote } from "../../src/components/SplitRoundingNote";
import { splitWeightedCents } from "../../src/utils/expenseSplit";
import {
  findCategoryByDescription,
  resolveExpenseDescription,
} from "../../src/utils/categoryFromDescription";
import {
  parseMoneyAmount,
  sanitizeMoneyAmountInput,
} from "../../src/utils/moneyAmount";
import {
  extractReceiptFromImage,
  isReceiptScanCanceled,
  type ReceiptExtraction,
} from "../../src/services/receiptScanService";

/** Map AI category_hint to a house category (name overlap + semantic bridges). */
function pickHouseCategoryFromHint(
  hint: string | null | undefined,
  cats: any[],
): any | null {
  const direct = findCategoryByDescription(hint, cats);
  if (direct) return direct;

  if (!hint?.trim() || !cats?.length) return null;
  const h = hint.trim().toLowerCase();

  let best: any = null;
  let bestScore = 0;
  const hintParts = h.split(/[\s,/]+/).filter((x) => x.length >= 3);

  for (const c of cats) {
    const n = String(c?.name ?? "").trim().toLowerCase();
    if (!n) continue;
    let score = 0;
    for (const part of hintParts) {
      if (n.includes(part)) score += 3;
    }
    const catParts = n.split(/[\s,/]+/).filter((x) => x.length >= 3);
    for (const hp of hintParts) {
      for (const cp of catParts) {
        if (hp === cp || hp.includes(cp) || cp.includes(hp)) score += 2;
      }
    }
    const bridges: [RegExp, RegExp][] = [
      [/grocery|groceries|supermarket|food store/i, /grocery|food|market|supermarket/i],
      [/dining|restaurant|cafe|coffee|meal|takeaway/i, /dining|restaurant|cafe|food|meal/i],
      [/rent|lease/i, /rent|lease|housing/i],
      [/utilit|electric|water|internet|gas bill/i, /utilit|electric|water|internet|gas/i],
      [/transport|fuel|parking|uber|taxi|metro/i, /transport|fuel|parking|car|travel/i],
      [/health|pharmacy|medical|drug/i, /health|pharmacy|medical|drug/i],
      [/entertain|movie|music|game|cinema/i, /entertain|movie|music|game|cinema/i],
      [/shop|retail|clothing|amazon|store/i, /shop|retail|clothing|store/i],
      [/subscrip|streaming|software/i, /subscrip|streaming|software/i],
      [/home|hardware|furniture|clean/i, /home|hardware|furniture|clean/i],
    ];
    for (const [reH, reN] of bridges) {
      if (reH.test(h) && reN.test(n)) score += 5;
    }

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return bestScore >= 3 ? best : null;
}

type SplitMethod = "equal" | "days";

function getDaysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return 30;
  // day 0 of next month = last day of current month
  return new Date(y, m, 0).getDate();
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function sameUserId(a: unknown, b: unknown): boolean {
  return String(a) === String(b);
}

type CalendarSummaryRow = { away_days: number; guest_extra_days: number };

function normalizeCalendarSummary(
  raw: Record<string, unknown> | null | undefined,
): Record<string, CalendarSummaryRow> {
  const out: Record<string, CalendarSummaryRow> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw)) {
    const row = v as { away_days?: unknown; guest_extra_days?: unknown };
    const away = Number(row?.away_days ?? 0);
    const gx = Number(row?.guest_extra_days ?? 0);
    out[k] = {
      away_days: Number.isFinite(away) ? away : 0,
      guest_extra_days: Number.isFinite(gx) ? gx : 0,
    };
  }
  return out;
}

function buildPendingExpenseDisplay(
  row: PendingRow,
  categories: any[],
  mates: any[],
): any {
  const p = JSON.parse(row.payload) as ExpenseCreatePayload;
  const cat = categories.find(
    (c) => Number(c?.id) === Number(p.category_id),
  );
  const payer = mates.find((m) => String(m.id) === String(p.paid_by));
  return {
    id: `pending:${row.action_id}`,
    _monthKey: p.month,
    description: p.description,
    amount:
      typeof p.amount === "number"
        ? p.amount
        : parseMoneyAmount(String(p.amount)),
    category: cat
      ? { id: cat.id, name: cat.name }
      : { id: p.category_id, name: "Category" },
    paid_by: { id: p.paid_by, name: payer?.name ?? "You" },
    included_mates: (p.included_mates || []).map((id) => {
      const mm = mates.find((m) => String(m.id) === String(id));
      return { id, name: mm?.name ?? "Mate" };
    }),
    timestamp: new Date(row.created_at).toISOString(),
    _pendingSync: true,
    _localActionId: row.action_id,
    split_method: p.split_method,
  };
}

function Counter({
  value,
  onChange,
  min = 0,
  max = 999,
  accent,
  border,
  text,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  accent: string;
  border: string;
  text: string;
}) {
  return (
    <View style={[styles.counterWrap, { borderColor: border }]}>
      <TouchableOpacity
        onPress={() => onChange(clampInt(value - 1, min, max))}
        style={[styles.counterBtn, { borderColor: border }]}
        hitSlop={8}
        accessibilityLabel="Decrease excluded days"
      >
        <Text style={[styles.counterBtnText, { color: accent }]}>-</Text>
      </TouchableOpacity>
      <Text style={[styles.counterValue, { color: text }]}>{value}</Text>
      <TouchableOpacity
        onPress={() => onChange(clampInt(value + 1, min, max))}
        style={[styles.counterBtn, { borderColor: border }]}
        hitSlop={8}
        accessibilityLabel="Increase excluded days"
      >
        <Text style={[styles.counterBtnText, { color: accent }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function Expenses() {
  const insets = useSafeAreaInsets();
  const modalKeyboardPad = useKeyboardBottomPadding(28);
  const router = useRouter();
  const prefillParams = useLocalSearchParams<{
    open?: string;
    title?: string;
    amount?: string;
    date?: string; // YYYY-MM-DD
    category_hint?: string;
  }>();
  const { isDark } = useTheme();

  const CUSTOM_TAB_BAR_HEIGHT = 70 + insets.bottom;

  const colors = {
    bg: isDark ? "#0F172A" : "#F8FAFC",
    card: isDark ? "#1E293B" : "#FFFFFF",
    text: isDark ? "#F1F5F9" : "#0F172A",
    sub: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "#334155" : "#E2E8F0",
    primary: "#FF6A6A",
    accent: "#FF6A6A",
  };

  const sectionListRef = useRef<SectionList>(null);

  // States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mates, setMates] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [currency, setCurrency] = useState("$");
  const [sections, setSections] = useState<any[]>([]);
  const [currentMonthKey, setCurrentMonthKey] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [currentUser, setCurrentUser] = useState<{
    id: any;
    role: string;
  } | null>(null);

  // Form States
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedMates, setSelectedMates] = useState<string[]>([]);
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [editExpense, setEditExpense] = useState<any>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  /** Full-screen blocker while the receipt image is uploading / AI extract runs */
  const [receiptAiOverlayVisible, setReceiptAiOverlayVisible] = useState(false);
  /** Shown after a few seconds so users know slow responses are normal */
  const [receiptAiLongWait, setReceiptAiLongWait] = useState(false);
  /** Blocks double-submit before any await; button also disabled while saving. */
  const saveExpenseInFlightRef = useRef(false);
  const [saveExpenseBusy, setSaveExpenseBusy] = useState(false);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const pendingCategoryHintRef = useRef<string | null>(null);
  const receiptScanAbortRef = useRef<AbortController | null>(null);
  const receiptAiLongWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receiptAiRequestActiveRef = useRef(false);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equal");
  const [advancedSplit, setAdvancedSplit] = useState(false);
  const [excludedDaysByMate, setExcludedDaysByMate] = useState<Record<string, number>>({});
  const [guestExtraDaysByMate, setGuestExtraDaysByMate] = useState<Record<string, number>>({});
  const [calendarSummary, setCalendarSummary] = useState<Record<string, CalendarSummaryRow>>({});
  /** Each guest night counts as this % of one full bill day (from house settings; 100 = 1:1). */
  const [guestDayWeightPercent, setGuestDayWeightPercent] = useState(100);

  /** Optimistic rows for expenses saved offline (SQLite queue). */
  const [pendingExpenseDisplays, setPendingExpenseDisplays] = useState<any[]>(
    [],
  );

  const reloadPendingExpenseQueue = useCallback(async () => {
    try {
      const rows = await listExpenseCreates();
      setPendingExpenseDisplays(
        rows.map((row) => buildPendingExpenseDisplay(row, categories, mates)),
      );
    } catch {
      setPendingExpenseDisplays([]);
    }
  }, [categories, mates]);

  useEffect(() => {
    void reloadPendingExpenseQueue();
  }, [reloadPendingExpenseQueue]);

  const applyReceiptExtraction = (ex: ReceiptExtraction) => {
    if (ex.merchant_name) {
      setTitle(ex.merchant_name);
    }
    if (ex.total_amount != null && Number.isFinite(ex.total_amount)) {
      setAmount(String(ex.total_amount.toFixed(2)));
    }
    if (ex.date && /^\d{4}-\d{2}-\d{2}$/.test(ex.date)) {
      // align the month picker to receipt month
      setCurrentMonthKey(ex.date.slice(0, 7));
    }
    const cats = categoriesRef.current;
    const picked = pickHouseCategoryFromHint(ex.category_hint, cats);
    if (picked) {
      setSelectedCategory(picked);
      pendingCategoryHintRef.current = null;
    } else if (ex.category_hint?.trim()) {
      pendingCategoryHintRef.current = ex.category_hint.trim();
    }
  };

  // One-shot prefill entry (e.g. from "Restock" → post snippet → add expense).
  const prefillAppliedRef = useRef(false);
  useEffect(() => {
    if (prefillAppliedRef.current) return;
    if (prefillParams?.open !== "1") return;
    // Wait until we have mates (for default split) + currentUser for payer default.
    if (!mates.length || !currentUser) return;

    prefillAppliedRef.current = true;

    resetForm();

    const t = typeof prefillParams.title === "string" ? prefillParams.title.trim() : "";
    const a = typeof prefillParams.amount === "string" ? prefillParams.amount.trim() : "";
    const d = typeof prefillParams.date === "string" ? prefillParams.date.trim() : "";
    const hint =
      typeof prefillParams.category_hint === "string"
        ? prefillParams.category_hint.trim()
        : "";

    if (t) {
      setTitle(t.slice(0, 48));
      const matched = findCategoryByDescription(t, categories);
      if (matched) setSelectedCategory(matched);
    }
    if (a) setAmount(sanitizeMoneyAmountInput(a));
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setCurrentMonthKey(d.slice(0, 7));
    }
    if (hint) {
      pendingCategoryHintRef.current = hint;
    }

    setModalVisible(true);
  }, [prefillParams, mates.length, currentUser, categories.length]);

  const clearReceiptAiLongWaitTimer = () => {
    if (receiptAiLongWaitTimerRef.current) {
      clearTimeout(receiptAiLongWaitTimerRef.current);
      receiptAiLongWaitTimerRef.current = null;
    }
  };

  const cancelReceiptAiScan = () => {
    receiptScanAbortRef.current?.abort();
  };

  useEffect(() => {
    if (modalVisible) return;
    if (!receiptAiRequestActiveRef.current) return;
    receiptScanAbortRef.current?.abort();
  }, [modalVisible]);

  const scanReceipt = async () => {
    if (scanningReceipt) return;
    setScanningReceipt(true);
    receiptScanAbortRef.current = new AbortController();
    try {
      const choice = await new Promise<"camera" | "gallery" | null>((resolve) => {
        Alert.alert("Receipt quick-scan", "Choose a photo source", [
          { text: "Camera", onPress: () => resolve("camera") },
          { text: "Gallery", onPress: () => resolve("gallery") },
          { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
        ]);
      });
      if (!choice) return;

      let result: ImagePicker.ImagePickerResult;
      if (choice === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== "granted") {
          Alert.alert("Permission needed", "Please allow camera access to scan receipts.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 0.9,
          allowsEditing: true,
          ...(Platform.OS === "ios"
            ? {
                preferredAssetRepresentationMode:
                  ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
              }
            : {}),
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== "granted") {
          Alert.alert("Permission needed", "Please allow photo access to scan receipts.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.9,
          allowsEditing: true,
          ...(Platform.OS === "ios"
            ? {
                preferredAssetRepresentationMode:
                  ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
              }
            : {}),
        });
      }

      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      receiptAiRequestActiveRef.current = true;
      setReceiptAiOverlayVisible(true);
      setReceiptAiLongWait(false);
      clearReceiptAiLongWaitTimer();
      receiptAiLongWaitTimerRef.current = setTimeout(
        () => setReceiptAiLongWait(true),
        7000,
      );

      const extraction = await extractReceiptFromImage(uri, {
        signal: receiptScanAbortRef.current.signal,
      });
      applyReceiptExtraction(extraction);
      Alert.alert("Receipt scanned", "We filled what we could — review before saving.");
    } catch (e: any) {
      if (isReceiptScanCanceled(e)) {
        return;
      }
      Alert.alert("Receipt scan failed", e?.message ?? "Please try again.");
    } finally {
      clearReceiptAiLongWaitTimer();
      receiptAiRequestActiveRef.current = false;
      setReceiptAiOverlayVisible(false);
      setReceiptAiLongWait(false);
      setScanningReceipt(false);
      receiptScanAbortRef.current = null;
    }
  };

  const formatMonth = (month: string) =>
    new Date(month + "-01").toLocaleString("default", {
      month: "short",
      year: "numeric",
    });

  const formatMonthLong = (ym: string) =>
    new Date(ym + "-02").toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

  const fetchData = async () => {
    try {
      setRefreshing(true);
      // Run independent requests in parallel to reduce perceived load time on Android.
      const [dashboard, cats, expenses] = await Promise.all([
        apiClient("/dashboard", "GET"),
        apiClient("/categories", "GET"),
        apiClient("/expenses", "GET"),
      ]);

      setMates(dashboard?.mates || []);
      setCurrency(dashboard?.currency || "$");
      const gwp = Number(dashboard?.house?.guest_day_weight_percent);
      setGuestDayWeightPercent(
        Number.isFinite(gwp) && gwp >= 0 ? gwp : 100,
      );
      setCategories(cats || []);

      const houseId =
        (dashboard as { user?: { house_id?: number } })?.user?.house_id ??
        (dashboard as { house?: { id?: number } })?.house?.id ??
        null;
      await saveExpenseFormCache({
        mates: dashboard?.mates || [],
        categories: cats || [],
        currency: dashboard?.currency || "$",
        guestDayWeightPercent:
          Number.isFinite(gwp) && gwp >= 0 ? gwp : 100,
        houseId,
      });

      const grouped = (expenses || []).map((monthData: any) => ({
        title: formatMonth(monthData.month),
        monthKey: monthData.month,
        data: (monthData.records || [])
          .slice()
          .sort((a: any, b: any) => {
            const ta = new Date(a?.timestamp ?? a?.created_at ?? 0).getTime();
            const tb = new Date(b?.timestamp ?? b?.created_at ?? 0).getTime();
            return tb - ta; // newest first
          })
          .map((record: any) => ({
            ...record,
            amount: parseFloat(record.amount),
            included_mates: (record.included_mates || []).map((mate: any) => ({
              id: mate.id,
              name: mate.name || "Unknown",
            })),
            paid_by: { id: record.paid_by, name: record.paid_by_name },
          })),
      }));

      setSections(grouped);
    } catch (e) {
      console.log("fetchData error:", e);
      try {
        const cached = await loadExpenseFormCache();
        if (cached) {
          setMates(cached.mates);
          setCategories(cached.categories);
          setCurrency(cached.currency || "$");
          setGuestDayWeightPercent(
            Number.isFinite(cached.guestDayWeightPercent) &&
              cached.guestDayWeightPercent >= 0
              ? cached.guestDayWeightPercent
              : 100,
          );
        }
      } catch {
        /* ignore */
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      void reloadPendingExpenseQueue();
    }
  };

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useEffect(() => {
    return subscribePendingSync(() => {
      void reloadPendingExpenseQueue();
      void fetchDataRef.current();
    });
  }, [reloadPendingExpenseQueue]);

  useFocusEffect(
    useCallback(() => {
      void syncPendingActions();
    }, []),
  );

  const filteredSections = useMemo(() => {
    const pendingForMonth = pendingExpenseDisplays.filter(
      (i) => i._monthKey === currentMonthKey,
    );
    const base = sections.filter((s) => s.monthKey === currentMonthKey);
    if (base.length === 0) {
      if (pendingForMonth.length === 0) return [];
      return [
        {
          title: formatMonth(currentMonthKey),
          monthKey: currentMonthKey,
          data: pendingForMonth,
        },
      ];
    }
    const s = base[0];
    return [
      {
        ...s,
        data: [...pendingForMonth, ...s.data],
      },
    ];
  }, [sections, currentMonthKey, pendingExpenseDisplays]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const userStr = await AsyncStorage.getItem("user");
      if (userStr && !cancelled) {
        try {
          setCurrentUser(JSON.parse(userStr));
        } catch {
          /* ignore */
        }
      }

      const cached = await loadExpenseFormCache();
      if (cached && !cancelled) {
        setMates(cached.mates);
        setCategories(cached.categories);
        setCurrency(cached.currency || "$");
        setGuestDayWeightPercent(
          Number.isFinite(cached.guestDayWeightPercent) &&
            cached.guestDayWeightPercent >= 0
            ? cached.guestDayWeightPercent
            : 100,
        );
        setLoading(false);
      }

      if (!cancelled) {
        await fetchData();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** If receipt was scanned before /categories loaded, apply category_hint when data arrives. */
  useEffect(() => {
    const hint = pendingCategoryHintRef.current;
    if (!hint || !categories.length) return;
    const picked = pickHouseCategoryFromHint(hint, categories);
    if (picked) {
      setSelectedCategory(picked);
      pendingCategoryHintRef.current = null;
    }
  }, [categories]);

  useEffect(() => {
    if (!modalVisible) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient(
          `/house/calendar?month=${encodeURIComponent(currentMonthKey)}`,
          "GET",
          undefined,
        );
        if (!cancelled && data?.summary) {
          setCalendarSummary(normalizeCalendarSummary(data.summary));
        }
      } catch {
        /* optional feature */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalVisible, currentMonthKey]);

  // Rules: Default Selection & Admin Restrictions
  const resetForm = () => {
    pendingCategoryHintRef.current = null;
    setTitle("");
    setAmount("");
    setSelectedCategory(null);
    setSelectedMates(mates.map((m) => m.id)); // Default: Select All
    setPaidBy(currentUser?.id || null); // Default: Current User Paid
    setEditExpense(null);
    setSplitMethod("equal");
    setAdvancedSplit(false);
    setExcludedDaysByMate({});
    setGuestExtraDaysByMate({});
  };

  const categoryName = String(selectedCategory?.name ?? "");
  const categoryKey = categoryName.trim().toLowerCase();
  const isRentCategory = useMemo(() => categoryKey.includes("rent"), [categoryKey]);
  const isUtilityCategory = useMemo(
    () =>
      categoryKey.includes("electric") ||
      categoryKey.includes("water") ||
      categoryKey.includes("utility") ||
      categoryKey.includes("utilities"),
    [categoryKey],
  );
  const isGroceriesCategory = useMemo(
    () =>
      categoryKey.includes("grocery") ||
      categoryKey.includes("groceries") ||
      categoryKey.includes("suppl") ||
      categoryKey.includes("supply"),
    [categoryKey],
  );

  // Category defaults / locking behavior (name-based fallback).
  useEffect(() => {
    if (!selectedCategory) return;

    // Rent: always excluded_days = 0; do not allow Advanced Split.
    if (isRentCategory) {
      setAdvancedSplit(false);
      setExcludedDaysByMate({});
      setGuestExtraDaysByMate({});
      return;
    }

    // Utilities + groceries: allow advanced, but don't force-enable.
    if (isUtilityCategory || isGroceriesCategory) {
      return;
    }
  }, [selectedCategory, isRentCategory, isUtilityCategory, isGroceriesCategory]);

  const handleTitleChange = useCallback(
    (text: string) => {
      const next = text.slice(0, 48);
      setTitle(next);
      const matched = findCategoryByDescription(next, categories);
      if (matched) {
        setSelectedCategory(matched);
      }
    },
    [categories],
  );

  const handleMonthStep = (step: number) => {
    const [year, monthNum] = currentMonthKey.split("-").map(Number);
    const date = new Date(year, monthNum - 1 + step, 1);
    setCurrentMonthKey(
      `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`,
    );
  };

  const saveExpense = async () => {
    if (!amount || !selectedCategory || !paidBy) {
      return Alert.alert("Please fill all fields", "Amount, category, and who paid are required.");
    }
    const description = resolveExpenseDescription(title, selectedCategory?.name);
    if (!description) {
      return Alert.alert("Please fill all fields", "Choose a category or enter a description.");
    }
    const amountValue = parseMoneyAmount(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return Alert.alert(
        "Invalid amount",
        "Enter a valid amount (use 45.40 or 45,40 — decimals are supported).",
      );
    }
    if (selectedMates.length === 0) {
      return Alert.alert(
        "Split required",
        "Choose at least one person to share the cost. The person who paid can be left out if they are not part of this split.",
      );
    }
    if (saveExpenseInFlightRef.current) return;
    saveExpenseInFlightRef.current = true;
    setSaveExpenseBusy(true);
    try {
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      Alert.alert("Error", "Please log in again");
      return;
    }

    const periodDays = getDaysInMonth(currentMonthKey);
    const guestCapSave = periodDays * 3;
    const awayFor = (mateId: string) => {
      if (isRentCategory) return 0;
      if (advancedSplit) {
        return clampInt(Number(excludedDaysByMate[mateId] ?? 0), 0, periodDays);
      }
      const row =
        calendarSummary[mateId] ?? calendarSummary[String(mateId)];
      return clampInt(Number(row?.away_days ?? 0), 0, periodDays);
    };
    const guestFor = (mateId: string) => {
      if (isRentCategory) return 0;
      if (advancedSplit) {
        return clampInt(Number(guestExtraDaysByMate[mateId] ?? 0), 0, guestCapSave);
      }
      const row =
        calendarSummary[mateId] ?? calendarSummary[String(mateId)];
      return clampInt(Number(row?.guest_extra_days ?? 0), 0, guestCapSave);
    };
    const excluded_days_by_user: Record<string, number> = {};
    const guest_extra_days_by_user: Record<string, number> = {};
    if (splitMethod === "days") {
      for (const id of selectedMates) {
        excluded_days_by_user[id] = awayFor(id);
        guest_extra_days_by_user[id] = guestFor(id);
      }
    }
    const payload: ExpenseCreatePayload = {
      description,
      amount: amountValue,
      category_id: selectedCategory.id,
      included_mates: selectedMates,
      paid_by: paidBy,
      month: currentMonthKey,
      split_method: splitMethod,
      ...(splitMethod === "days"
        ? { excluded_days_by_user, guest_extra_days_by_user }
        : {}),
    };

    if (editExpense) {
      try {
        await apiClient(`/records/${editExpense.id}`, "PUT", payload, token);
        resetForm();
        setModalVisible(false);
        fetchData();
      } catch (e) {
        Alert.alert("Error", getApiErrorMessage(e, "Something went wrong"));
      }
      return;
    }

    const enqueueLocal = async () => {
      await enqueueExpenseCreate(payload);
      Toast.show({
        type: "success",
        text1: "Saved",
        text2: "We'll sync this expense when you're back online.",
      });
      resetForm();
      setModalVisible(false);
      await reloadPendingExpenseQueue();
    };

    try {
      const net = await NetInfo.fetch();
      // Match PendingSyncListener: isInternetReachable is often false right after Wi‑Fi/cell comes back.
      const likelyOnline = net.isConnected === true;

      if (!likelyOnline) {
        await enqueueLocal();
        return;
      }

      await apiClient("/records", "POST", payload, token);
      resetForm();
      setModalVisible(false);
      fetchData();
    } catch (e) {
      if (isLikelyUnreachableError(e)) {
        await enqueueLocal();
        return;
      }
      Alert.alert("Error", getApiErrorMessage(e, "Something went wrong"));
    }
    } finally {
      saveExpenseInFlightRef.current = false;
      setSaveExpenseBusy(false);
    }
  };

  const discardPendingExpense = (actionId: string) => {
    Alert.alert(
      "Discard unsynced expense?",
      "This removes it from your device only. It was not sent to the server yet.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            await removeAction(actionId);
            await reloadPendingExpenseQueue();
          },
        },
      ],
    );
  };

  // const toggleMate = (id: string) => {
  //   setSelectedMates((prev) => {
  //     return prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id];
  //   });
  // };

  const toggleMate = (id: string | number) => {
    setSelectedMates((prev) =>
      prev.some((x) => sameUserId(x, id))
        ? prev.filter((m) => !sameUserId(m, id))
        : [...prev, id],
    );
  };

  const billDays = useMemo(() => getDaysInMonth(currentMonthKey), [currentMonthKey]);

  const selectedMateObjs = useMemo(() => {
    return mates.filter((m) =>
      selectedMates.some((x) => sameUserId(x, m.id)),
    );
  }, [mates, selectedMates]);

  const guestCap = billDays * 3;

  const daysPreview = useMemo(() => {
    if (splitMethod !== "days") return null;
    const total = parseMoneyAmount(amount);
    if (!Number.isFinite(total) || total <= 0) return null;

    const awayFor = (mateId: string) => {
      if (isRentCategory) return 0;
      if (advancedSplit) {
        return clampInt(Number(excludedDaysByMate[mateId] ?? 0), 0, billDays);
      }
      const row =
        calendarSummary[mateId] ?? calendarSummary[String(mateId)];
      return clampInt(Number(row?.away_days ?? 0), 0, billDays);
    };
    const guestFor = (mateId: string) => {
      if (isRentCategory) return 0;
      if (advancedSplit) {
        return clampInt(Number(guestExtraDaysByMate[mateId] ?? 0), 0, guestCap);
      }
      const row =
        calendarSummary[mateId] ?? calendarSummary[String(mateId)];
      return clampInt(Number(row?.guest_extra_days ?? 0), 0, guestCap);
    };

    const gwp = guestDayWeightPercent >= 0 ? guestDayWeightPercent : 100;
    const effectiveById: Record<string, number> = {};
    let totalActive = 0;
    for (const m of selectedMateObjs) {
      const ex = awayFor(m.id);
      const gx = guestFor(m.id);
      const guestPart = gx * (gwp / 100);
      const eff = Math.max(0, billDays - ex) + guestPart;
      effectiveById[m.id] = eff;
      totalActive += eff;
    }
    if (totalActive <= 0) return { effectiveById, shareById: {} as Record<string, number> };

    const weighted = selectedMateObjs.map((m) => ({
      id: Number(m.id),
      weight: effectiveById[m.id] ?? 0,
    }));
    const shareById = splitWeightedCents(total, weighted);
    return { effectiveById, shareById };
  }, [
    splitMethod,
    amount,
    selectedMateObjs,
    billDays,
    advancedSplit,
    excludedDaysByMate,
    guestExtraDaysByMate,
    calendarSummary,
    isRentCategory,
    guestCap,
    guestDayWeightPercent,
  ]);

  const handleDelete = (expense: any) => {
    Alert.alert("Delete Expense", "Are you sure you want to remove this?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            await apiClient(
              `/records/${expense.id}`,
              "DELETE",
              undefined,
              token!,
            );
            fetchData(); // Refresh list after deletion
          } catch (e) {
            Alert.alert("Error", "Failed to delete expense");
          }
        },
      },
    ]);
  };

  if (loading)
    return (
      <ActivityIndicator
        style={{ flex: 1 }}
        size="large"
        color={colors.primary}
      />
    );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={["top", "left", "right"]}
    >
      {/* Header */}
      <View style={styles.newHeader}>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/dashboard")}
          style={styles.circularBackBtn}
        >
          <FontAwesome5 name="arrow-left" size={16} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <View style={styles.monthToggleRow}>
            <TouchableOpacity onPress={() => handleMonthStep(-1)} hitSlop={15}>
              <MaterialIcons
                name="chevron-left"
                size={28}
                color={colors.primary}
              />
            </TouchableOpacity>
            <View style={styles.titleCenter}>
              <Text style={[styles.screenTitle, { color: colors.text }]}>
                Expenses
              </Text>
              <Text style={[styles.monthSubtitle, { color: colors.sub }]}>
                {formatMonthLong(currentMonthKey)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleMonthStep(1)} hitSlop={15}>
              <MaterialIcons
                name="chevron-right"
                size={28}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.headerActionBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <FontAwesome5 name="plus" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <SectionList
        ref={sectionListRef}
        sections={filteredSections}
        keyExtractor={(item) => String(item.id)}
        stickySectionHeadersEnabled
        contentContainerStyle={[
          styles.listPadding,
          { paddingBottom: CUSTOM_TAB_BAR_HEIGHT + 20 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5
              name="calendar-times"
              size={40}
              color={colors.border}
            />
            <Text style={[styles.emptyText, { color: colors.sub }]}>
              No expenses this month.
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: colors.bg }]}>
            <Text style={[styles.sectionHeaderText, { color: colors.text }]}>
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const pendingSync = !!(item as any)._pendingSync;
          const canEdit =
            !pendingSync &&
            (currentUser?.role === "admin" ||
              currentUser?.id === item.paid_by?.id);
          return (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: pendingSync ? colors.sub + "55" : colors.border,
                  opacity: pendingSync ? 0.96 : 1,
                },
              ]}
            >
              <View style={styles.cardInfo}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {item.description}
                  </Text>
                  {pendingSync ? (
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 }}>
                      <MaterialIcons name="schedule" size={14} color={colors.sub} />
                      <Text style={{ fontSize: 11, color: colors.sub, fontWeight: "700" }}>
                        Syncing…
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.metaRow}>
                    <View style={styles.paidByBadge}>
                      <Text style={styles.paidByText}>
                        Paid by {item.paid_by?.name}
                      </Text>
                    </View>
                    <Text style={[styles.cardSub, { color: colors.sub }]}>
                      {" "}
                      • {item.category?.name}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.cardAmount, { color: colors.text }]}>
                  {currency}
                  {item.amount.toFixed(2)}
                </Text>
              </View>

              <View style={styles.splitRow}>
                <Text style={[styles.splitLabel, { color: colors.sub }]}>
                  Split with:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {item.included_mates?.map((m: any) => (
                      <View
                        key={m.id}
                        style={[
                          styles.splitPill,
                          { backgroundColor: isDark ? "#334155" : "#F1F5F9" },
                        ]}
                      >
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: 11,
                            fontWeight: "600",
                          }}
                        >
                          {m.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {pendingSync ? (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() =>
                      discardPendingExpense(String((item as any)._localActionId))
                    }
                  >
                    <Text style={{ color: "#EF4444", fontWeight: "700" }}>
                      Discard
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : canEdit ? (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditExpense(item);
                      setTitle(item.description);
                      setAmount(item.amount.toString());
                      setPaidBy(item.paid_by?.id);
                      setSelectedCategory(item.category);
                      setSelectedMates(
                        item.included_mates.map((m: any) => m.id),
                      );
                      setSplitMethod((item as any)?.split_method === "days" ? "days" : "equal");
                      setExcludedDaysByMate((item as any)?.excluded_days_by_user || {});
                      setGuestExtraDaysByMate((item as any)?.guest_extra_days_by_user || {});
                      setAdvancedSplit(
                        Object.keys((item as any)?.excluded_days_by_user || {}).length > 0 ||
                          Object.keys((item as any)?.guest_extra_days_by_user || {}).length > 0,
                      );
                      setModalVisible(true);
                    }}
                  >
                    <Text
                      style={{
                        color: colors.accent,
                        fontWeight: "700",
                        marginRight: 20,
                      }}
                    >
                      Edit
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item)}>
                    <Text style={{ color: "#EF4444", fontWeight: "700" }}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              await syncPendingActions();
              await fetchData();
            }}
            tintColor={colors.primary}
          />
        }
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: colors.card,
                  paddingBottom: Math.max(insets.bottom, 20),
                },
              ]}
            >
              <LinearGradient
                colors={
                  isDark ? ["#FF6A6A", "#EF4444"] : ["#FF8E8E", "#FF6A6A"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalHero}
              >
                <View style={styles.modalHeroRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalHeroTitle}>
                      {editExpense ? "Edit Expense" : "New Expense"}
                    </Text>
                    <Text style={styles.modalHeroSub}>
                      {formatMonthLong(currentMonthKey)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setModalVisible(false);
                      resetForm();
                    }}
                    style={styles.modalCloseBtn}
                    hitSlop={10}
                  >
                    <MaterialIcons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: modalKeyboardPad }}
              >
                <View style={styles.summaryRow}>
                  <View
                    style={[
                      styles.summaryPill,
                      { borderColor: colors.border },
                      { backgroundColor: isDark ? "#0B1220" : "#FFFFFF" },
                    ]}
                  >
                    <Text style={[styles.summaryLabel, { color: colors.sub }]}>
                      Amount
                    </Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      {currency}
                      {(parseMoneyAmount(amount) || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.summaryPill,
                      { borderColor: colors.border },
                      { backgroundColor: isDark ? "#0B1220" : "#FFFFFF" },
                    ]}
                  >
                    <Text style={[styles.summaryLabel, { color: colors.sub }]}>
                      Paid by
                    </Text>
                    <Text
                      style={[styles.summaryValue, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {mates.find((m) => String(m.id) === String(paidBy))?.name ??
                        (paidBy ? "Mate" : "—")}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.summaryPill,
                      { borderColor: colors.border },
                      { backgroundColor: isDark ? "#0B1220" : "#FFFFFF" },
                    ]}
                  >
                    <Text style={[styles.summaryLabel, { color: colors.sub }]}>
                      Split
                    </Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      {selectedMates?.length ?? 0}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.formCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.label, { color: colors.text }]}>
                    Expense details
                  </Text>
                  <TouchableOpacity
                    onPress={scanReceipt}
                    disabled={scanningReceipt}
                    activeOpacity={0.9}
                    style={[
                      styles.miniBtn,
                      {
                        alignSelf: "flex-start",
                        backgroundColor: colors.primary + "20",
                        marginBottom: 12,
                      },
                    ]}
                  >
                    {scanningReceipt ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <MaterialIcons
                          name="document-scanner"
                          size={18}
                          color={colors.primary}
                        />
                        <Text
                          style={{
                            color: colors.primary,
                            fontSize: 12,
                            fontWeight: "800",
                          }}
                        >
                          Scan receipt (AI)
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={styles.fieldRow}>
                    <View style={styles.fieldIcon}>
                      <MaterialIcons name="notes" size={18} color={colors.sub} />
                    </View>
                    <TextInput
                      placeholder={
                        selectedCategory?.name
                          ? `Description (optional — uses “${selectedCategory.name}”)`
                          : "Description (optional — uses category if empty)"
                      }
                      placeholderTextColor={colors.sub}
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                          borderColor: colors.border,
                          flex: 1,
                          marginBottom: 0,
                        },
                      ]}
                      value={title}
                      onChangeText={handleTitleChange}
                      maxLength={48}
                    />
                  </View>

                  <View style={[styles.fieldRow, { marginTop: 10 }]}>
                    <View style={styles.fieldIcon}>
                      <MaterialIcons
                        name="payments"
                        size={18}
                        color={colors.sub}
                      />
                    </View>
                    <View
                      style={[
                        styles.amountWrap,
                        { borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.currencyPill, { color: colors.sub }]}>
                        {currency}
                      </Text>
                      <TextInput
                        placeholder="0.00"
                        placeholderTextColor={colors.sub}
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        style={[styles.amountInput, { color: colors.text }]}
                        value={amount}
                        onChangeText={(t) => setAmount(sanitizeMoneyAmountInput(t))}
                      />
                    </View>
                  </View>
                </View>

                <Text style={[styles.label, { color: colors.text }]}>
                  Category
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.selectorScroll}
                >
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedCategory(cat)}
                      style={[
                        styles.selectorPill,
                        {
                          borderColor:
                            selectedCategory?.id === cat.id
                              ? colors.primary
                              : colors.border,
                          backgroundColor:
                            selectedCategory?.id === cat.id
                              ? colors.primary + "10"
                              : "transparent",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            selectedCategory?.id === cat.id
                              ? colors.primary
                              : colors.text,
                          fontWeight:
                            selectedCategory?.id === cat.id ? "800" : "600",
                        }}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.label, { color: colors.text }]}>
                  Who paid?
                </Text>
                {currentUser?.role !== "admin" ? (
                  <Text style={[styles.helperText, { color: colors.sub }]}>
                    You can only select yourself. Ask the admin if you need to change
                    the payer.
                  </Text>
                ) : (
                  <Text style={[styles.helperText, { color: colors.sub }]}>
                    Pick the person who actually paid this bill.
                  </Text>
                )}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.selectorScroll}
                >
                  {mates.map((m) => {
                    const isDisabled =
                      currentUser?.role !== "admin" && m.id !== currentUser?.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        disabled={isDisabled}
                        onPress={() => setPaidBy(m.id)}
                        style={[
                          styles.selectorPill,
                          {
                            borderColor:
                              paidBy === m.id ? colors.primary : colors.border,
                            backgroundColor:
                              paidBy === m.id
                                ? colors.primary + "10"
                                : "transparent",
                            opacity: isDisabled ? 0.4 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color:
                              paidBy === m.id ? colors.primary : colors.text,
                          }}
                        >
                          {m.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.label, { color: colors.text }]}>
                  Split with who?
                </Text>
                <View style={{ flexDirection: "row", marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedMates(mates.map((m) => m.id))}
                    style={[
                      styles.miniBtn,
                      { backgroundColor: colors.primary + "20" },
                    ]}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      Select All
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (!paidBy) return;
                      setSelectedMates([paidBy]);
                    }}
                    style={[styles.miniBtn, { backgroundColor: "#EF444415" }]}
                  >
                    <Text
                      style={{
                        color: "#EF4444",
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      Deselect Others
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text
                  style={{
                    fontSize: 12,
                    color: colors.sub,
                    marginBottom: 10,
                    lineHeight: 17,
                  }}
                >
                  Who paid can leave the split unchecked if they floated the bill but are not sharing this expense.
                </Text>

                <View style={styles.mateGrid}>
                  {mates.map((m) => {
                    const selected = selectedMates.some((x) =>
                      sameUserId(x, m.id),
                    );
                    const payerChip =
                      paidBy != null && sameUserId(m.id, paidBy);
                    const isYouChip =
                      currentUser != null && sameUserId(m.id, currentUser.id);
                    return (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => toggleMate(m.id)}
                      style={[
                        styles.mateCheck,
                        {
                          backgroundColor: selected
                            ? colors.accent
                            : colors.border + "50",
                          borderWidth: payerChip ? 2 : 1,
                          borderColor: payerChip ? colors.text : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: selected ? "#fff" : colors.text,
                          fontSize: 12,
                          fontWeight: selected ? "800" : "700",
                        }}
                      >
                        {m.name}{" "}
                        {payerChip
                          ? "⭐"
                          : isYouChip && !payerChip
                            ? "(you)"
                            : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                  })}
                </View>

                {/* Split settings */}
                <Text style={[styles.label, { color: colors.text }]}>Split settings</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.selectorScroll}
                >
                  {([
                    { id: "equal", label: "Equal split" },
                    { id: "days", label: "Split by days" },
                  ] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => setSplitMethod(opt.id)}
                      style={[
                        styles.selectorPill,
                        {
                          borderColor:
                            splitMethod === opt.id ? colors.primary : colors.border,
                          backgroundColor:
                            splitMethod === opt.id
                              ? colors.primary + "10"
                              : "transparent",
                        },
                      ]}
                      activeOpacity={0.9}
                    >
                      <Text
                        style={{
                          color: splitMethod === opt.id ? colors.primary : colors.text,
                          fontWeight: splitMethod === opt.id ? "800" : "600",
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {splitMethod === "equal" && selectedMates.length >= 2 && (
                  <SplitRoundingNote
                    textColor={colors.text}
                    subColor={colors.sub}
                    borderColor={colors.border}
                    bgColor={isDark ? "#0f172a" : "#f8fafc"}
                    accent="#2EC4B6"
                    compact={selectedMates.length > 4}
                  />
                )}

                {splitMethod === "days" && (
                  <View
                    style={[
                      styles.splitSettingsCard,
                      { borderColor: colors.border, backgroundColor: colors.bg },
                    ]}
                  >
                      <View style={styles.advancedRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.advancedTitle, { color: colors.text }]}>
                          Advanced Split
                        </Text>
                        <Text style={[styles.advancedSub, { color: colors.sub }]}>
                          {isRentCategory
                            ? "Disabled for Rent (you pay rent even if you travel)"
                            : advancedSplit
                              ? "Manual per-person days for this bill only"
                              : `Using Who's Home for ${formatMonthLong(currentMonthKey)}`}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setAdvancedSplit((v) => {
                            const next = !v;
                            if (next && !v && !isRentCategory) {
                              const ex: Record<string, number> = {};
                              const gx: Record<string, number> = {};
                              for (const mm of mates) {
                                const row =
                                  calendarSummary[mm.id] ??
                                  calendarSummary[String(mm.id)];
                                ex[mm.id] = clampInt(
                                  Number(row?.away_days ?? 0),
                                  0,
                                  billDays,
                                );
                                gx[mm.id] = clampInt(
                                  Number(row?.guest_extra_days ?? 0),
                                  0,
                                  billDays * 3,
                                );
                              }
                              setExcludedDaysByMate(ex);
                              setGuestExtraDaysByMate(gx);
                            }
                            return next;
                          });
                        }}
                        activeOpacity={0.85}
                        disabled={isRentCategory}
                        style={[
                          styles.advancedToggle,
                          {
                            backgroundColor: advancedSplit
                              ? colors.primary
                              : colors.border + "55",
                            opacity: isRentCategory ? 0.55 : 1,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.advancedKnob,
                            { left: advancedSplit ? 22 : 3 },
                          ]}
                        />
                      </TouchableOpacity>
                    </View>

                    {!isRentCategory && splitMethod === "days" && (
                      <>
                        <TouchableOpacity
                          onPress={() => router.push("/whos-home")}
                          style={{ marginBottom: 6 }}
                          hitSlop={8}
                        >
                          <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 12 }}>
                            Open Who's Home calendar →
                          </Text>
                        </TouchableOpacity>
                        <Text
                          style={{
                            fontSize: 11,
                            color: colors.sub,
                            marginBottom: 10,
                            lineHeight: 15,
                          }}
                        >
                          Guest nights use your house&apos;s guest billing % (Profile → House
                          Settings). Each guest night adds {guestDayWeightPercent}% of one full
                          bill day to that roommate&apos;s weight.
                        </Text>
                      </>
                    )}

                    <View style={{ marginTop: 10, gap: 10 }}>
                      {selectedMateObjs.map((m) => {
                        const row =
                          calendarSummary[m.id] ?? calendarSummary[String(m.id)];
                        const autoAway = clampInt(
                          Number(row?.away_days ?? 0),
                          0,
                          billDays,
                        );
                        const autoGx = clampInt(
                          Number(row?.guest_extra_days ?? 0),
                          0,
                          guestCap,
                        );
                        const excluded = advancedSplit
                          ? clampInt(Number(excludedDaysByMate[m.id] ?? 0), 0, billDays)
                          : autoAway;
                        const guestX = advancedSplit
                          ? clampInt(Number(guestExtraDaysByMate[m.id] ?? 0), 0, guestCap)
                          : autoGx;
                        const gwp =
                          guestDayWeightPercent >= 0 ? guestDayWeightPercent : 100;
                        const effective =
                          Math.max(0, billDays - excluded) +
                          guestX * (gwp / 100);
                        const share = daysPreview?.shareById?.[m.id];
                        const showPlane = !advancedSplit && autoAway > 0;
                        return (
                          <View key={m.id} style={styles.dayRow}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text
                                  style={[styles.dayName, { color: colors.text }]}
                                  numberOfLines={1}
                                >
                                  {m.name}
                                </Text>
                                {showPlane ? <Text style={{ fontSize: 13 }}>✈️</Text> : null}
                              </View>
                              <Text style={[styles.dayMeta, { color: colors.sub }]}>
                                {billDays} days in month → {effective} billable days
                                {!advancedSplit && autoAway > 0
                                  ? ` (${autoAway} away auto)`
                                  : ""}
                                {!advancedSplit && autoGx > 0
                                  ? ` · +${autoGx} guest days`
                                  : ""}
                                {advancedSplit && excluded > 0
                                  ? ` (${excluded} away)`
                                  : ""}
                                {advancedSplit && guestX > 0
                                  ? ` · +${guestX} guest`
                                  : ""}
                              </Text>
                            </View>

                            {advancedSplit && (
                              <View style={{ alignItems: "flex-end", gap: 6 }}>
                                <Text style={{ fontSize: 10, fontWeight: "800", color: colors.sub }}>
                                  Away
                                </Text>
                                <Counter
                                  value={excluded}
                                  min={0}
                                  max={billDays}
                                  onChange={(next) =>
                                    setExcludedDaysByMate((prev) => ({
                                      ...prev,
                                      [m.id]: next,
                                    }))
                                  }
                                  accent={colors.primary}
                                  border={colors.border}
                                  text={colors.text}
                                />
                                <Text style={{ fontSize: 10, fontWeight: "800", color: colors.sub }}>
                                  Guest+
                                </Text>
                                <Counter
                                  value={guestX}
                                  min={0}
                                  max={guestCap}
                                  onChange={(next) =>
                                    setGuestExtraDaysByMate((prev) => ({
                                      ...prev,
                                      [m.id]: next,
                                    }))
                                  }
                                  accent={colors.primary}
                                  border={colors.border}
                                  text={colors.text}
                                />
                              </View>
                            )}

                            {share != null && Number.isFinite(share) && (
                              <Text style={[styles.dayShare, { color: colors.text }]}>
                                {currency}
                                {Number(share).toFixed(2)}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    saveExpenseBusy && { opacity: 0.82 },
                  ]}
                  onPress={saveExpense}
                  activeOpacity={0.9}
                  disabled={saveExpenseBusy}
                >
                  {saveExpenseBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.saveBtnText}>
                        {editExpense ? "Update expense" : "Save expense"}
                      </Text>
                      <MaterialIcons name="check-circle" size={18} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>

          {receiptAiOverlayVisible ? (
            <View
              style={styles.receiptAiBackdrop}
              pointerEvents="box-none"
              accessibilityLabel="Receipt scan in progress"
            >
              <View
                style={[
                  styles.receiptAiCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.receiptAiTitle, { color: colors.text }]}>
                  {receiptAiLongWait ? "AI is busy" : "Scanning receipt"}
                </Text>
                <Text style={[styles.receiptAiBody, { color: colors.sub }]}>
                  {receiptAiLongWait
                    ? "Still reading your receipt — this can take a little while."
                    : "Analyzing your receipt…"}
                </Text>
                <TouchableOpacity
                  onPress={cancelReceiptAiScan}
                  activeOpacity={0.85}
                  style={[styles.receiptAiCancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.text, fontWeight: "800" }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  newHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  circularBackBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FF6A6A",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: { flex: 1, alignItems: "center" },
  monthToggleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleCenter: { alignItems: "center" },
  screenTitle: { fontSize: 20, fontWeight: "900" },
  monthSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  headerActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  listPadding: { paddingHorizontal: 20 },
  sectionHeader: { paddingVertical: 12 },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  card: { padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  cardInfo: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  paidByBadge: {
    backgroundColor: "#FF6A6A15",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  paidByText: { fontSize: 11, color: "#FF6A6A", fontWeight: "700" },
  cardSub: { fontSize: 12 },
  cardAmount: { fontSize: 18, fontWeight: "800" },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.03)",
  },
  splitLabel: { fontSize: 12, marginRight: 8, fontWeight: "600" },
  splitPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 4,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
    gap: 15,
  },
  emptyText: { fontSize: 14, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 18,
    maxHeight: "90%",
  },
  modalHero: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  modalHeroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  modalHeroTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  modalHeroSub: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "700" },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  summaryPill: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  summaryLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  summaryValue: { fontSize: 14, fontWeight: "900", marginTop: 2 },
  helperText: { fontSize: 12, fontWeight: "600", marginTop: -4, marginBottom: 8 },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 4,
    marginBottom: 6,
  },
  label: { fontSize: 14, fontWeight: "700", marginBottom: 8, marginTop: 15 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    fontSize: 16,
  },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  amountWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10,
  },
  currencyPill: { fontWeight: "900", fontSize: 14 },
  amountInput: { flex: 1, fontSize: 16, fontWeight: "800" },
  selectorScroll: { marginBottom: 10 },
  selectorPill: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  miniBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 10,
  },
  splitSettingsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 6,
  },
  advancedRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  advancedTitle: { fontSize: 13, fontWeight: "900" },
  advancedSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  advancedToggle: {
    width: 44,
    height: 26,
    borderRadius: 999,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  advancedKnob: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  dayRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayName: { fontSize: 13, fontWeight: "900" },
  dayMeta: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  dayShare: { fontSize: 12, fontWeight: "900" },
  counterWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  counterBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
  },
  counterBtnText: { fontSize: 16, fontWeight: "900" },
  counterValue: { width: 28, textAlign: "center", fontWeight: "900" },
  mateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  mateCheck: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12 },
  saveBtn: {
    backgroundColor: "#FF6A6A",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  receiptAiBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    zIndex: 100,
    elevation: 24,
  },
  receiptAiCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 10,
  },
  receiptAiTitle: { fontSize: 17, fontWeight: "900", textAlign: "center", marginTop: 4 },
  receiptAiBody: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 4,
  },
  receiptAiCancelBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    borderWidth: 1,
  },
});
