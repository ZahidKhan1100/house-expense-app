import React, { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { Alert, StyleSheet, useWindowDimensions, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  BottomTabBar,
  BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettlementLock } from "../../src/context/SettlementLockContext";
import { useTheme } from "../../src/theme/ThemeContext";
import {
  TabBarScrollProvider,
  useTabBarScrollChromeTranslateY,
} from "../../src/context/TabBarScrollContext";
/** Solid fill behind the tab bar (Android: avoids SVG/fixed-width clipping vs tab items). */
function TabBarBackgroundFill({ isDark }: { isDark: boolean }) {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF" },
      ]}
    />
  );
}

function TabIcon({
  name,
  focused,
  color,
}: {
  name: string;
  focused: boolean;
  /** From React Navigation (matches label tint). */
  color: string;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.12 : 1);
  }, [focused, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <MaterialIcons name={name as any} size={24} color={color} />
    </Animated.View>
  );
}

function HabiMateTabBar(props: BottomTabBarProps) {
  const chromeY = useTabBarScrollChromeTranslateY();
  const chromeAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: chromeY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.chromeStack,
        chromeAnim,
      ]}
      pointerEvents="box-none"
    >
      <BottomTabBar {...props} />
    </Animated.View>
  );
}

function TabsLayoutBody() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const { settlementLocked } = useSettlementLock();

  const activeTint = "#FF6A6A";
  const inactiveTint = isDark ? "#9CA3AF" : "#65676B";

  return (
    <Tabs
      tabBar={(props) => <HabiMateTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        tabBarBackground: () => <TabBarBackgroundFill isDark={isDark} />,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: "transparent",
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: isDark ? "rgba(255,255,255,0.12)" : "#E4E6EB",
            elevation: 8,
            shadowOpacity: isDark ? 0 : 0.06,
            shadowOffset: { width: 0, height: -1 },
            shadowRadius: 4,
            width: windowWidth,
            height: 62 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 4,
          },
        ],
      }}
    >
      <Tabs.Screen
        name="dashboard/index"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="home" focused={focused} color={color} />
          ),
          listeners: {
            tabPress: (e) => {
              if (settlementLocked) {
                e.preventDefault();
                Alert.alert(
                  "Settle up first",
                  "You have pending settlement transfers. Use the Pay tab to mark them paid before using other areas of the app.",
                  [
                    {
                      text: "OK",
                      onPress: () =>
                        router.replace("/(tabs)/payment" as any),
                    },
                  ],
                );
                return;
              }
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            },
          },
        }}
      />

      <Tabs.Screen
        name="mates/index"
        options={{
          tabBarLabel: "Mates",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="group" focused={focused} color={color} />
          ),
          listeners: {
            tabPress: (e) => {
              if (settlementLocked) {
                e.preventDefault();
                Alert.alert(
                  "Settle up first",
                  "You have pending settlement transfers. Use the Pay tab to mark them paid before using other areas of the app.",
                  [
                    {
                      text: "OK",
                      onPress: () =>
                        router.replace("/(tabs)/payment" as any),
                    },
                  ],
                );
                return;
              }
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            },
          },
        }}
      />

      <Tabs.Screen
        name="wall/index"
        options={{
          tabBarLabel: "Wall",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="dashboard" focused={focused} color={color} />
          ),
          listeners: {
            tabPress: (e) => {
              if (settlementLocked) {
                e.preventDefault();
                Alert.alert(
                  "Settle up first",
                  "You have pending settlement transfers. Use the Pay tab to mark them paid before using other areas of the app.",
                  [
                    {
                      text: "OK",
                      onPress: () =>
                        router.replace("/(tabs)/payment" as any),
                    },
                  ],
                );
                return;
              }
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            },
          },
        }}
      />

      <Tabs.Screen
        name="payment/index"
        options={{
          tabBarLabel: "Pay",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="payments" focused={focused} color={color} />
          ),
          listeners: {
            tabPress: () =>
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
          },
        }}
      />

      <Tabs.Screen
        name="profile/index"
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="person" focused={focused} color={color} />
          ),
          listeners: {
            tabPress: () =>
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
          },
        }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const hideOffset = 128 + Math.max(insets.bottom, 0);

  return (
    <TabBarScrollProvider hideOffset={hideOffset}>
      <TabsLayoutBody />
    </TabBarScrollProvider>
  );
}

const styles = StyleSheet.create({
  chromeStack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabBar: {
    position: "absolute",
  },
  tabBarLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: -0.15,
    marginTop: 2,
  },
  tabBarItem: {
    flex: 1,
    paddingVertical: 4,
  },
});
