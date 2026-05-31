import { MaterialIcons } from "@expo/vector-icons";
import {
  Modal,
  Platform,
  View,
  Image,
  Pressable,
  StyleSheet,
} from "react-native";
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  uri: string | null | undefined;
  onClose: () => void;
};

/**
 * Full-screen viewer for profile / mate photos (contain fit, dark backdrop).
 * Uses explicit insets — RN Modals often get 0 from SafeAreaProvider, which
 * stacks the close control under the status bar / Dynamic Island.
 */
export function FullScreenImageModal({ visible, uri, onClose }: Props) {
  const hookInsets = useSafeAreaInsets();
  const init = initialWindowMetrics?.insets;

  const mergedTop = Math.max(hookInsets.top, init?.top ?? 0);
  /** Modal window often reports 0 insets; real devices still need clear of status bar / island. */
  const topPad =
    mergedTop > 0 ? mergedTop : Platform.OS === "ios" ? 47 : 24;
  const bottomPad = Math.max(hookInsets.bottom, init?.bottom ?? 0);
  const rightPad = Math.max(hookInsets.right, init?.right ?? 0, 12);

  if (!uri?.trim()) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <View style={[styles.root, { paddingBottom: bottomPad }]}>
        <View
          style={[styles.toolbar, { paddingTop: topPad + 6, paddingRight: rightPad }]}
        >
          <Pressable
            onPress={onClose}
            hitSlop={20}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            style={styles.closeFab}
          >
            <MaterialIcons name="close" size={26} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.imageWrap}>
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: uri.trim() }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    paddingLeft: 12,
    paddingBottom: 4,
  },
  /** 44pt min touch target below status bar — avoids overlap with Dynamic Island / battery area */
  closeFab: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  image: { width: "100%", flex: 1 },
});
