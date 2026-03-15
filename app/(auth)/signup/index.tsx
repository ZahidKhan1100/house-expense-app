import { useState } from "react";
import { ScrollView, StyleSheet, Dimensions } from "react-native";
import { TextInput, Button, Text, Title } from "react-native-paper";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../../firebase";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  doc,
  setDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";

const { width } = Dimensions.get("window");

export default function Signup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [houseCode, setHouseCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError("");

    if (!name || !email || !password) {
      setError("Please fill all fields!");
      return;
    }

    setLoading(true);

    try {
      console.log("STEP 1: Creating auth user...");

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      const user = userCredential.user;

      console.log("STEP 2: Auth created:", user.uid);

      // ==========================
      // CASE 1: USER ENTERED CODE
      // ==========================
      if (houseCode.trim()) {
        console.log("STEP 3: Searching house by code...");

        const houseQuery = query(
          collection(db, "houses"),
          where("code", "==", houseCode.trim().toUpperCase()),
        );

        const houseSnap = await getDocs(houseQuery);

        console.log("STEP 4: House query result:", houseSnap.size);

        if (houseSnap.empty) {
          throw new Error("Invalid house code!");
        }

        const houseDoc = houseSnap.docs[0];
        const houseId = houseDoc.id;

        console.log("STEP 5: Creating user doc...");

        await setDoc(doc(db, "users", user.uid), {
          name,
          email: email.toLowerCase(),
          role: "mate",
          status: "pending",
          houseId: "",
          createdAt: new Date(),
        });

        console.log("STEP 6: User document created");

        console.log("STEP 7: Creating join request...");

        await addDoc(collection(db, "houses", houseId, "joinRequests"), {
          userId: user.uid,
          name,
          email: email.toLowerCase(),
          requestedAt: new Date(),
        });

        console.log("STEP 8: Join request created");

        router.replace("/pending");
        return;
      }

      // ==========================
      // CREATE NEW HOUSE
      // ==========================

      console.log("STEP 3: Creating house...");

      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const houseRef = await addDoc(collection(db, "houses"), {
        name: `${name}'s House`,
        code: newCode,
        adminId: user.uid,
        mates: [user.uid],
        createdAt: new Date(),
      });

      console.log("STEP 4: House created:", houseRef.id);

      console.log("STEP 5: Creating user document...");

      await setDoc(doc(db, "users", user.uid), {
        name,
        email: email.toLowerCase(),
        role: "admin",
        status: "admin",
        houseId: houseRef.id,
        createdAt: new Date(),
      });

      console.log("STEP 6: User document created");

      router.replace("/(tabs)/dashboard");
    } catch (err: any) {
      console.error("🔥 SIGNUP ERROR:", err);
      console.error("🔥 ERROR CODE:", err.code);
      console.error("🔥 ERROR MESSAGE:", err.message);

      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#FF6A6A", "#FFB88C"]} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Title style={styles.title}>Create Account</Title>
        <Text style={styles.subtitle}>
          Start tracking expenses with your mates
        </Text>

        <TextInput
          label="Full Name"
          value={name}
          onChangeText={setName}
          style={styles.input}
          mode="outlined"
        />
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          mode="outlined"
          secureTextEntry
        />
        <TextInput
          label="House Code (optional)"
          value={houseCode}
          onChangeText={setHouseCode}
          style={styles.input}
          mode="outlined"
          autoCapitalize="characters"
          placeholder="Leave empty to create new"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          mode="contained"
          onPress={handleSignup}
          loading={loading}
          style={styles.button}
        >
          {houseCode ? "Request to Join House" : "Create House"}
        </Button>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flexGrow: 1, justifyContent: "center", padding: 25 },
  title: { fontSize: 32, fontWeight: "bold", color: "#fff" },
  subtitle: { color: "#fff", marginBottom: 25, opacity: 0.9 },
  input: { marginBottom: 12, backgroundColor: "rgba(255,255,255,0.1)" },
  button: { borderRadius: 8, paddingVertical: 5, marginTop: 10 },
  errorText: {
    color: "#800000",
    backgroundColor: "#FFC0C0",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    textAlign: "center",
  },
});
