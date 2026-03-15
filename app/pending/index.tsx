import { View, StyleSheet } from "react-native";
import { Text, Button, Title } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function PendingScreen() {
  const router = useRouter();

  return (
    <LinearGradient colors={["#FF6A6A", "#FFB88C"]} style={styles.gradient}>
      <View style={styles.container}>
        
        <MaterialCommunityIcons
          name="clock-outline"
          size={90}
          color="#fff"
          style={styles.icon}
        />

        <Title style={styles.title}>Request Sent!</Title>

        <View style={styles.card}>
          <Text style={styles.text}>
            Your request to join the house is waiting for admin approval.
          </Text>

          <Text style={styles.subText}>
            You will be able to access the dashboard once the admin approves
            your request.
          </Text>
        </View>

        <Button
          mode="contained"
          style={styles.button}
          labelStyle={{ fontSize: 16 }}
          onPress={() => router.replace("/(auth)/login")}
        >
          Back to Login
        </Button>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  container: {
    alignItems: "center",
    padding: 30,
  },

  icon: {
    marginBottom: 20,
  },

  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 25,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 25,
    borderRadius: 16,
    marginBottom: 30,
    width: 300,
    alignItems: "center",
  },

  text: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10,
  },

  subText: {
    textAlign: "center",
    color: "#555",
  },

  button: {
    borderRadius: 10,
    paddingVertical: 6,
    width: 200,
    backgroundColor: "#FF6A6A",
  },
});