import React from "react";
import { Tabs } from "expo-router";
import { View, StyleSheet, Dimensions, Platform, TouchableOpacity, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { MaterialIcons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");
const TAB_HEIGHT = 80;

const TabBg = () => {
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
      <Svg width={width} height={TAB_HEIGHT} viewBox={`0 0 ${width} ${TAB_HEIGHT}`}>
        <Path d={d} fill="#fff" />
        <Path d={d} fill="none" stroke="#FF1493" strokeWidth={2} opacity={0.2} />
      </Svg>
    </View>
  );
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1.4 : 1) }],
    shadowColor: focused ? "#FF1493" : "#000",
    shadowOpacity: focused ? 0.35 : 0,
    shadowRadius: focused ? 10 : 0,
    shadowOffset: { width: 0, height: 0 },
  }));

  return (
    <Animated.View style={animatedStyle}>
      <MaterialIcons
        name={name as any}
        size={28}
        color={focused ? "#FF1493" : "#94A3B8"}
      />
    </Animated.View>
  );
}

export default function TabsLayout() {
  const router = useRouter();

  return (
    <>
      {/* Curved Tab Background */}
      <TabBg />

      {/* Floating Add Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        // onPress={() => router.push("/payment/add")}
        style={styles.floatingButton}
      >
        <MaterialIcons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Tabs */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: styles.tabBar,
        }}
      >
        <Tabs.Screen
          name="dashboard/index"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="mates/index"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon name="group" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="payment/index"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon name="payments" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="profile/index"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
          }}
        />
      </Tabs>
    </>
  );
}
const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    backgroundColor: "#fff", // solid white
    borderTopWidth: 0,
    elevation: 5,
    height: 70,
    bottom: Platform.OS === "ios" ? 15 : 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  svgContainer: {
    position: "absolute",
    bottom: 0,
    width: width,
    height: TAB_HEIGHT,
  },
  floatingButton: {
    position: "absolute",
    alignSelf: "center",
    bottom: TAB_HEIGHT / 2 - 20,
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: "#FF1493",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF1493",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
});