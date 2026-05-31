import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  name: string;
  avatarUrl?: string | null;
  /** Outer width/height of the avatar. */
  size: number;
  borderRadius?: number;
  bg?: string;
  letterColor?: string;
  /** Opens mate / user detail when provided. */
  onPress?: () => void;
};

export function UserAvatar({
  name,
  avatarUrl,
  size,
  borderRadius,
  bg = "rgba(255,106,106,0.15)",
  letterColor = "#fff",
  onPress,
}: Props) {
  const rad = borderRadius ?? Math.round(size * 0.35);
  const initial = (String(name ?? "").trim().charAt(0) || "?").toUpperCase();
  const uri = typeof avatarUrl === "string" ? avatarUrl.trim() : "";

  const shellStyle = [
    styles.wrap,
    {
      width: size,
      height: size,
      borderRadius: rad,
      backgroundColor: uri ? undefined : bg,
      overflow: "hidden",
    },
  ];

  const content = uri ? (
    <Image
      accessibilityIgnoresInvertColors
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: rad }}
    />
  ) : (
    <Text
      style={{
        color: letterColor,
        fontSize: Math.max(12, Math.round(size * 0.42)),
        fontWeight: "900",
      }}
    >
      {initial}
    </Text>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name.trim() || "User"} profile`}
        hitSlop={6}
        style={({ pressed }) => [...shellStyle, pressed ? { opacity: 0.86 } : null]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={shellStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
