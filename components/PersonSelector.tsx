import { View, Text, TouchableOpacity } from "react-native";

export default function PersonSelector({ people, selected, setSelected }: any) {
  const toggle = (id: number) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((x: any) => x !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {people.map((p: any) => (
        <TouchableOpacity
          key={p.id}
          onPress={() => toggle(p.id)}
          style={{
            padding: 10,
            borderRadius: 20,
            backgroundColor: selected.includes(p.id) ? "#FF6A6A" : "#eee",
          }}
        >
          <Text>{p.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}