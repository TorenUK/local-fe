import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Circle, Region } from 'react-native-maps';
import { getCurrentPosition } from '../services/locationService';



export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(true);
   const router = useRouter();
     const [pulseRadius, setPulseRadius] = useState(200);

   const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const { latitude, longitude } = await getCurrentPosition();
        setRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (error: any) {
        Alert.alert('Location Error', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
  }, []);

useEffect(() => {
    // Pulse animation loop
    let growing = true;
    const interval = setInterval(() => {
      setPulseRadius((prev) => {
        if (prev >= 400) growing = false;
        if (prev <= 200) growing = true;
        return growing ? prev + 10 : prev - 10;
      });
    }, 50); // adjust speed here
    return () => clearInterval(interval);
  }, []);

  if (loading || !region) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  const redCirclePosition = {
    latitude: region.latitude + 0.009, // ~1km north
    longitude: region.longitude,
  };


  if (loading || !region) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }


  return (


    <View style={{ flex: 1 }}>
      {/* Back button */}
        <View style={styles.topLeftTextContainer}>
    <Text style={styles.topLeftText}>Nearby Alerts</Text>
  </View>
      <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/(auth)/signIn")}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <MapView
        style={styles.map}
        region={region}
        showsUserLocation
        // onRegionChangeComplete={setRegion}
      >
        {/* <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} title="You are here" /> */}
                <Circle
          center={{ latitude: region.latitude, longitude: region.longitude }}
          radius={5000} // 5 km
          fillColor="rgba(255, 191, 0, 0.2)" // amber with low opacity
          strokeColor="rgba(255, 191, 0, 0.4)" // optional border
          strokeWidth={2}
        />

        <Circle
          center={redCirclePosition}
          radius={pulseRadius}
          fillColor="rgba(255,0,0,0.3)"
          strokeColor="rgba(255,0,0,0.5)"
          strokeWidth={2}
        />
          <View style={styles.watermarkContainer}>
    <Text style={styles.watermarkText}>Local Safety & Community Alert App</Text>
  </View>
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    bottom: 50, // adjust for status bar / safe area
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  topLeftTextContainer: {
  position: 'absolute',
  top: 60,
  left: 20,
  zIndex: 10,
  backgroundColor: 'rgba(255,255,255,0.9)',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 8,
},
topLeftText: {
  fontSize: 16,
  fontWeight: '600',
},
watermarkContainer: {
  position: 'absolute',
  bottom: 20,
  left: 0,
  right: 0,
  alignItems: 'center',
  zIndex: 10,
},
watermarkText: {
  fontSize: 12,
  color: 'rgba(250, 250, 250, 0.3)',
  fontWeight: '500',
},
});
