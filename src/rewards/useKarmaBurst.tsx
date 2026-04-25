import { useCallback, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

export function useKarmaBurst() {
  const [label, setLabel] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const burst = useCallback(
    (text: string) => {
      setLabel(text);
      opacity.setValue(0);
      translateY.setValue(0);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -18,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setLabel(null));
      });
    },
    [opacity, translateY],
  );

  const KarmaBurst = useCallback(() => {
    if (!label) return null;
    return (
      <View pointerEvents="none" style={styles.wrap}>
        <Animated.View
          style={[
            styles.pill,
            { opacity, transform: [{ translateY }] },
          ]}
        >
          <Text style={styles.text}>{label}</Text>
        </Animated.View>
      </View>
    );
  }, [label, opacity, translateY]);

  return { burst, KarmaBurst };
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 90,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  pill: {
    backgroundColor: "rgba(255,106,106,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: "#FF6A6A",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  text: { color: "#fff", fontWeight: "900" },
});

