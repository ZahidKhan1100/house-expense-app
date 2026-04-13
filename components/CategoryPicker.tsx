import { View, Text, TouchableOpacity } from "react-native";
import { CATEGORIES } from "../src/constants/categories";

export default function CategoryPicker({ selected, setSelected }: any) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {CATEGORIES.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          onPress={() => setSelected(cat.id)}
          style={{
            padding: 10,
            borderRadius: 20,
            backgroundColor: selected === cat.id ? "#FF6A6A" : "#eee",
          }}
        >
          <Text>
            {cat.icon} {cat.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}