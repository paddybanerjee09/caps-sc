import { StyleSheet, Text, View } from 'react-native';

export default function StrengthConditioningScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>S&C</Text>
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
