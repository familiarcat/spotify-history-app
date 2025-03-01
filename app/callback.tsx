import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function Callback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    // Handle the auth callback
    if (params.access_token) {
      // Store the token and redirect back to home
      router.replace('/(tabs)');
    } else if (params.error) {
      console.error('Authentication error:', params.error);
      router.replace('/(tabs)');
    }
  }, [params]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Processing authentication...</Text>
    </View>
  );
}
