import { View, Text } from "react-native";

export default function SmartSuggestions({ budget, spent, daysLeft }: any) {
  const remaining = budget - spent;
  const dailyLimit = remaining / (daysLeft || 1);

  let message = "";
  let color = "#22C55E";

  if (spent < budget * 0.6) {
    message = "✅ You're on track. Enjoy your trip!";
  } else if (spent < budget) {
    message = "⚠️ Spending is rising. Try reducing food or travel.";
    color = "#F59E0B";
  } else {
    message = "🚨 Over budget! Cut down expenses.";
    color = "#EF4444";
  }

  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color }}>{message}</Text>
      <Text style={{ fontSize: 12, marginTop: 5 }}>
        Daily limit: ${dailyLimit.toFixed(2)}
      </Text>
    </View>
  );
}