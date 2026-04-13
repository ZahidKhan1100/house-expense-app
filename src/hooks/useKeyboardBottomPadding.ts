import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardHeight } from "./useKeyboardHeight";

/**
 * Extra bottom padding for ScrollView/FlatList content so fields stay above the keyboard.
 */
export function useKeyboardBottomPadding(extra = 24): number {
  const kb = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  return kb + Math.max(insets.bottom, 8) + extra;
}
