import { StyleSheet, Text, View } from 'react-native';

export default function SportTrainingScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Sport Training</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
});
