import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.watermarkContainer}>
        <Text style={styles.watermark}>Local 365</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },
  watermark: {
    fontSize: 36,
    color: "rgba(0,0,0,0.1)",
    fontWeight: "bold",
  },
});
