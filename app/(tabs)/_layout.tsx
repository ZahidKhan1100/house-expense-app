import React from "react";
import { Tabs, useRouter } from "expo-router";
import {
  View,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableOpacity,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { MaterialIcons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeContext";

const { width } = Dimensions.get("window");
const TAB_HEIGHT = 80;

const TabBg = ({ isDark }: { isDark: boolean }) => {
  const center = width / 2;

  const d = `
    M0 0 
    H${center - 70} 
    C${center - 50} 0, ${center - 50} 40, ${center} 40 
    C${center + 50} 40, ${center + 50} 0, ${center + 70} 0 
    H${width} 
    V${TAB_HEIGHT} 
    H0 
    Z
  `;

  return (
    <View style={styles.svgContainer}>
      <Svg width={width} height={TAB_HEIGHT}>
        <Path d={d} fill={isDark ? "#1E1E1E" : "#fff"} />
      </Svg>
    </View>
  );
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const scale = useSharedValue(1);

  if (focused) scale.value = withSpring(1.4);
  else scale.value = withSpring(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <MaterialIcons
        name={name as any}
        size={28}
        color={focused ? "#FF6A6A" : "#94A3B8"}
      />
    </Animated.View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const { isDark } = useTheme();

  const buttonScale = useSharedValue(1);

  const animatedButton = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    buttonScale.value = withSpring(0.9);

    setTimeout(() => {
      buttonScale.value = withSpring(1.1);
    }, 80);

    setTimeout(() => {
      buttonScale.value = withSpring(1);
    }, 160);

    router.push("/addExpense");
  };

  return (
    <>
      <TabBg isDark={isDark} />

      {/* Floating Add Button */}
      <Animated.View style={[styles.floatingButtonContainer, animatedButton]}>
        <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
          <LinearGradient
            colors={["#FF6A6A", "#FF8E8E"]}
            style={styles.floatingButton}
          >
            <MaterialIcons name="add" size={34} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: [
            styles.tabBar,
            { backgroundColor: isDark ? "#1E1E1E" : "#fff" },
          ],
        }}
      >
        <Tabs.Screen
          name="dashboard/index"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="home" focused={focused} />
            ),
            listeners: {
              tabPress: () =>
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
            },
          }}
        />

        <Tabs.Screen
          name="mates/index"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="group" focused={focused} />
            ),
            listeners: {
              tabPress: () =>
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
            },
          }}
        />

        <Tabs.Screen
          name="payment/index"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="payments" focused={focused} />
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
            tabBarIcon: ({ focused }) => (
              <TabIcon name="person" focused={focused} />
            ),
            listeners: {
              tabPress: () =>
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
            },
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    borderTopWidth: 0,
    elevation: 8,
    height: 70,
    bottom: Platform.OS === "ios" ? 0 : 0,
    paddingTop:10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },

  svgContainer: {
    position: "absolute",
    bottom: 0,
    width: width,
    height: TAB_HEIGHT,
  },

  floatingButtonContainer: {
    position: "absolute",
    alignSelf: "center",
    bottom: TAB_HEIGHT / 2 - 20,
  },

  floatingButton: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF6A6A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
});
