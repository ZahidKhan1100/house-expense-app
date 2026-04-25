import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { SharedValue, useSharedValue, withSpring } from "react-native-reanimated";
import { useFocusEffect } from "expo-router";

const SPRING = { damping: 24, stiffness: 260 };

type TabBarScrollContextValue = {
  /** Slide distance for bottom chrome; use with useAnimatedStyle in the tab bar only. */
  chromeTranslateY: SharedValue<number>;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
  showTabBar: () => void;
  resetScrollTracking: () => void;
};

const TabBarScrollContext = createContext<TabBarScrollContextValue | null>(
  null,
);

export function TabBarScrollProvider({
  children,
  hideOffset,
}: {
  children: React.ReactNode;
  hideOffset: number;
}) {
  const translateY = useSharedValue(0);
  const hiddenRef = useRef(false);
  const lastY = useRef(0);

  const resetScrollTracking = useCallback(() => {
    lastY.current = 0;
  }, []);

  const showTabBar = useCallback(() => {
    hiddenRef.current = false;
    translateY.value = withSpring(0, SPRING);
  }, [translateY]);

  const hideTabBar = useCallback(() => {
    if (hiddenRef.current) {
      return;
    }
    hiddenRef.current = true;
    translateY.value = withSpring(hideOffset, SPRING);
  }, [hideOffset, translateY]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const delta = y - lastY.current;
      lastY.current = y;
      if (y <= 12) {
        showTabBar();
        return;
      }
      if (delta > 10) {
        hideTabBar();
      } else if (delta < -10) {
        showTabBar();
      }
    },
    [hideTabBar, showTabBar],
  );

  const value = useMemo(
    () => ({
      chromeTranslateY: translateY,
      onScroll,
      scrollEventThrottle: 16 as const,
      showTabBar,
      resetScrollTracking,
    }),
    [translateY, onScroll, showTabBar, resetScrollTracking],
  );

  return (
    <TabBarScrollContext.Provider value={value}>
      {children}
    </TabBarScrollContext.Provider>
  );
}

/** Call from each main tab screen; resets bar visibility when the tab gains focus. */
export function useTabBarScrollSync() {
  const ctx = useContext(TabBarScrollContext);

  useFocusEffect(
    useCallback(() => {
      ctx?.resetScrollTracking();
      ctx?.showTabBar();
      return undefined;
    }, [ctx]),
  );

  return {
    onScroll: ctx?.onScroll ?? (() => {}),
    scrollEventThrottle: ctx?.scrollEventThrottle ?? 16,
  };
}

export function useTabBarScrollChromeTranslateY() {
  const ctx = useContext(TabBarScrollContext);
  if (!ctx) {
    throw new Error(
      "useTabBarScrollChromeTranslateY must be used inside TabBarScrollProvider",
    );
  }
  return ctx.chromeTranslateY;
}
