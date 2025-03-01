// App.tsx (or App.js)
import React, { useEffect, useState, useCallback } from 'react';
import { 
  SafeAreaView, 
  FlatList, 
  Text, 
  StyleSheet, 
  View, 
  ActivityIndicator, 
  Alert, 
  TouchableOpacity, 
  Platform, 
  Linking,
  Image
} from 'react-native';
import axios from 'axios';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Update the URL to include both limit and before parameters
const getSpotifyUrl = (limit: number, before?: string) => {
  let url = `https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`;
  if (before) {
    url += `&before=${before}`;
  }
  return url;
};

// Ensure WebBrowser is initialized for authentication
WebBrowser.maybeCompleteAuthSession();

// --- Spotify Configuration ---
const CLIENT_ID = 'db3a036495f74b659a6d0fd60e476e17';
const SCOPES = ['user-read-recently-played'];

// Get the redirect URI based on the platform
const getRedirectUri = () => {
  if (Platform.OS === 'web') {
    // For web development, ensure we use the correct port and path
    return `${window.location.origin}/callback`;
  }
  
  if (__DEV__) {
    return AuthSession.makeRedirectUri({
      scheme: 'spotify-history'
    });
  }
  
  return 'https://bradygeorgen.com/callback';
};

// Create the Spotify auth discovery object
const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

interface Track {
  id: string;
  playedAt: string;
  timestamp: number; // Add this for pagination
  trackName: string;
  artist: string;
  spotifyUrl: string;
  trackId: string; // Add this field
  thumbnailUrl: string; // Add this field
}

interface SpotifyTrack {
  played_at: string;
  track: {
    id: string; // Add this field
    name: string;
    artists?: Array<{ name: string }>;
    external_urls: { spotify: string }; // Add this new field
    album: {
      images: Array<{
        url: string;
        height: number;
        width: number;
      }>;
    };
  };
}

interface SpotifyResponse {
  items: SpotifyTrack[];
  cursors?: {
    after: string;
    before: string;
  };
  error?: {
    message: string;
  };
}

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);
  const ITEMS_PER_PAGE = 20;

  // Set up auth request
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: SCOPES,
      redirectUri: getRedirectUri(),
      responseType: AuthSession.ResponseType.Token,
      extraParams: {
        show_dialog: 'true'
      },
    },
    discovery
  );

  // Handle the auth response
  useEffect(() => {
    if (response?.type === 'success') {
      console.log('Auth successful!');
      const { access_token } = response.params;
      setAccessToken(access_token);
    } else if (response) {
      console.log('Auth response:', response);
    }
  }, [response]);

  const handleLogin = async () => {
    try {
      console.log('Using redirect URI:', getRedirectUri());
      const result = await promptAsync();
      if (result.type === 'success') {
        const { access_token } = result.params;
        setAccessToken(access_token);
      } else {
        console.log('Authentication failed:', result);
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  // Fetch history function
  const fetchSpotifyHistory = async (before?: string) => {
    if (!accessToken) return;

    try {
      const res = await axios.get<SpotifyResponse>(
        getSpotifyUrl(ITEMS_PER_PAGE, before),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      
      if ('error' in res.data) {
        throw new Error(res.data.error?.message || 'Unknown error');
      }
      
      const items = res.data.items;
      const newTracks = items.map((item, index) => {
        const timestamp = new Date(item.played_at).getTime();
        // Get the smallest image as thumbnail (usually 64x64)
        const thumbnail = item.track.album.images[item.track.album.images.length - 1]?.url || '';
        
        return {
          id: `${item.track.id}-${timestamp}`,
          playedAt: new Date(item.played_at).toLocaleString(),
          timestamp,
          trackName: item.track.name,
          artist: item.track.artists?.[0]?.name ?? 'Unknown',
          spotifyUrl: item.track.external_urls.spotify,
          trackId: item.track.id,
          thumbnailUrl: thumbnail
        };
      });

      // If this is a new fetch (not pagination), replace tracks
      // Otherwise, append to existing tracks
      setTracks(prevTracks => 
        before ? [...prevTracks, ...newTracks] : newTracks
      );

      // Update pagination state
      if (newTracks.length > 0) {
        const oldestTimestamp = Math.min(...newTracks.map(t => t.timestamp));
        setLastTimestamp(oldestTimestamp);
        setHasMore(newTracks.length === ITEMS_PER_PAGE);
      } else {
        setHasMore(false);
      }

      return newTracks.length > 0;
    } catch (error) {
      Alert.alert("Error", `Failed to fetch Spotify history: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  // Initial load after authentication
  useEffect(() => {
    if (accessToken) {
      setLoading(true);
      fetchSpotifyHistory()
        .finally(() => setLoading(false));
    }
  }, [accessToken]);

  const openInSpotify = (url: string) => {
    Linking.openURL(url);
  };

  const renderItem = ({ item }: { item: Track }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => openInSpotify(item.spotifyUrl)}
    >
      <Image 
        source={{ uri: item.thumbnailUrl }}
        style={styles.thumbnail}
      />
      <View style={styles.trackInfo}>
        <Text style={styles.trackName} numberOfLines={1}>{item.trackName}</Text>
        <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
        <Text style={styles.timestamp} numberOfLines={1}>{item.playedAt}</Text>
      </View>
    </TouchableOpacity>
  );

  // Load more function for pagination
  const loadMore = async () => {
    if (loadingMore || !hasMore || !lastTimestamp) return;
    
    setLoadingMore(true);
    try {
      await fetchSpotifyHistory(lastTimestamp.toString());
    } catch (error) {
      console.error('Error loading more tracks:', error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  // Render footer for FlatList
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color="#1DB954" />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Recently Played</Text>
      
      {!accessToken ? (
        <View style={styles.loginContainer}>
          <Text style={styles.instructions}>
            Connect with Spotify to see your recently played tracks
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
          >
            <Text style={styles.loginButtonText}>CONNECT WITH SPOTIFY</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => {
              setLoading(true);
              fetchSpotifyHistory().finally(() => setLoading(false));
            }}
          >
            <Text style={styles.refreshButtonText}>REFRESH</Text>
          </TouchableOpacity>
          {loading ? (
            <ActivityIndicator size="large" color="#1DB954" />
          ) : (
            <FlatList
              data={tracks}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={renderFooter}
              initialNumToRender={ITEMS_PER_PAGE}
              maxToRenderPerBatch={ITEMS_PER_PAGE}
              windowSize={5}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  No tracks played in the last month were found.
                </Text>
              }
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191414', // Spotify's dark background
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    padding: 20,
    paddingTop: 40,
  },
  list: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#282828', // Subtle separator color
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 4,
    marginRight: 12,
  },
  trackInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  trackName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    marginBottom: 4,
  },
  artist: {
    fontSize: 14,
    color: '#B3B3B3', // Spotify's secondary text color
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#B3B3B3',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  instructions: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  refreshButton: {
    backgroundColor: '#282828',
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  empty: {
    color: '#B3B3B3',
    textAlign: 'center',
    padding: 20,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
