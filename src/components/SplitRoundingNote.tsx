import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  SPLIT_ROUNDING_EXAMPLE_LINES,
  SPLIT_ROUNDING_EXAMPLE_TITLE,
  SPLIT_ROUNDING_SHORT,
  SPLIT_ROUNDING_TITLE,
  SPLIT_ROUNDING_WHO_GETS_CENT,
} from "../constants/splitRoundingRule";

type Props = {
  textColor: string;
  subColor: string;
  borderColor: string;
  bgColor: string;
  accent?: string;
  compact?: boolean;
  showFeatureGuideLink?: boolean;
};

export function SplitRoundingNote({
  textColor,
  subColor,
  borderColor,
  bgColor,
  accent = "#2EC4B6",
  compact = false,
  showFeatureGuideLink = true,
}: Props) {
  const router = useRouter();

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor,
          backgroundColor: bgColor,
        },
      ]}
    >
      <View style={styles.titleRow}>
        <MaterialCommunityIcons name="calculator-variant" size={18} color={accent} />
        <Text style={[styles.title, { color: textColor }]}>{SPLIT_ROUNDING_TITLE}</Text>
      </View>
      <Text style={[styles.body, { color: subColor }]}>{SPLIT_ROUNDING_SHORT}</Text>
      {!compact && (
        <>
          <Text style={[styles.exampleTitle, { color: textColor }]}>
            {SPLIT_ROUNDING_EXAMPLE_TITLE}
          </Text>
          {SPLIT_ROUNDING_EXAMPLE_LINES.map((line) => (
            <Text key={line} style={[styles.exampleLine, { color: subColor }]}>
              • {line}
            </Text>
          ))}
          <Text style={[styles.body, { color: subColor, marginTop: 8 }]}>
            {SPLIT_ROUNDING_WHO_GETS_CENT}
          </Text>
        </>
      )}
      {showFeatureGuideLink && (
        <TouchableOpacity
          onPress={() => router.push("/feature-guide")}
          style={styles.linkRow}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text style={[styles.link, { color: accent }]}>Full split & rounding guide</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  title: { fontSize: 14, fontWeight: "800" },
  body: { fontSize: 12, lineHeight: 18, fontWeight: "500" },
  exampleTitle: { fontSize: 13, fontWeight: "800", marginTop: 10, marginBottom: 4 },
  exampleLine: { fontSize: 12, lineHeight: 18, fontWeight: "600", marginLeft: 2 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 2,
  },
  link: { fontSize: 12, fontWeight: "800" },
});
