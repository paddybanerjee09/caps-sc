import { StyleSheet, Text, View } from 'react-native';

export default function ProgressScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Progress</Text>
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
