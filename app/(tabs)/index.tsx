import { db } from "@/firebase/config";
import { createNotification } from "@/services/notificationService";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import {
  doc,
  getDoc,
  increment,
  updateDoc
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, {
  Circle,
  Marker,
  Region
} from "react-native-maps";
import { useAuth } from "../../hooks/useAuth";
import { useReports } from "../../hooks/useReport";
import { getCurrentPosition } from "../../services/locationService";
import { trackReport, untrackReport } from '../../services/reportService';

interface Report {
  id: string;
  type: "crime" | "lost_item" | "missing_pet" | "hazard";
  description: string;
  location: {
    latitude: number;
    longitude: number;
  };
  createdAt: Date;
  status: "open" | "resolved";
  userId: string | null;
  upvotes: number;
}

function getDistanceFromLatLonInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371; // Radius of the earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { user, userProfile } = useAuth();
  const router = useRouter();

  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    crime: true,
    lost_item: true,
    missing_pet: true,
    hazard: true,
  });

  // This will be replaced with real Firestore data
  const { reports, loading: reportsLoading } = useReports(region);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const { latitude, longitude } = await getCurrentPosition();
        setRegion({
          latitude,
          longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } catch (error: any) {
        Alert.alert("Location Error", error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
  }, []);

  const handleAddAlert = () => {
    if (user?.isAnonymous) {
      Alert.alert(
        "Create Account",
        "Please create an account to submit reports.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Create Account",
            onPress: () => router.push("/(auth)/signUp"),
          },
        ]
      );
      return;
    }
    router.push("/(tabs)/create");
  };

  const handleCenterLocation = async () => {
    try {
      const { latitude, longitude } = await getCurrentPosition();
      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const getMarkerColor = (type: Report["type"]) => {
    switch (type) {
      case "crime":
        return "#FF3B30";
      case "lost_item":
        return "#FF9500";
      case "missing_pet":
        return "#34C759";
      case "hazard":
        return "#FFCC00";
      default:
        return "#007AFF";
    }
  };

  const getMarkerIcon = (type: Report["type"]) => {
    switch (type) {
      case "crime":
        return "warning";
      case "lost_item":
        return "help-circle";
      case "missing_pet":
        return "paw";
      case "hazard":
        return "alert-circle";
      default:
        return "location";
    }
  };

  // const filteredReports = reports.filter((report) => filters[report.type]);
  const alertRadiusKm = userProfile?.settings?.alertRadius || 5;

const filteredReports = region
  ? reports.filter(
      (report) =>
        filters[report.type] &&
        Math.sqrt(
          Math.pow(
            (report.location.latitude - region.latitude) * 111,
            2
          ) +
            Math.pow(
              (report.location.longitude - region.longitude) *
                111 *
                Math.cos((region.latitude * Math.PI) / 180),
              2
            )
        ) <= (userProfile?.settings?.alertRadius || 5)
    )
  : [];

  if (loading || !region) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loaderText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nearby Alerts</Text>
        <View style={styles.headerRight}>
          <Text style={styles.reportCount}>
            {filteredReports.length}{" "}
            {filteredReports.length === 1 ? "alert" : "alerts"}
          </Text>
        </View>
      </View>

      {/* Anonymous User Banner */}
      {user?.isAnonymous && (
        <View style={styles.anonymousBanner}>
          <Ionicons name="information-circle" size={20} color="#FF9500" />
          <Text style={styles.anonymousBannerText}>
            Viewing as guest • Create account to submit reports
          </Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
        // provider={PROVIDER_GOOGLE}
        // onRegionChangeComplete={setRegion}
      >
        {/* User Location Radius */}
        <Circle
          center={{ latitude: region.latitude, longitude: region.longitude }}
          radius={(userProfile?.settings?.alertRadius || 5) * 1000}
          fillColor="rgba(0, 122, 255, 0.1)"
          strokeColor="rgba(0, 122, 255, 0.3)"
          strokeWidth={2}
        />

        {/* Report Markers */}

        {filteredReports.map((report) => (
          <Marker
            key={report.id}
            coordinate={report.location}
            onPress={() =>
              setSelectedReport({
                ...report,
                createdAt:
                  report.createdAt instanceof Date
                    ? report.createdAt
                    : report.createdAt.toDate(),
              })
            }
          >
            <View
              style={[
                styles.markerContainer,
                { backgroundColor: getMarkerColor(report.type) },
              ]}
            >
              <Ionicons
                name={getMarkerIcon(report.type) as any}
                size={20}
                color="#fff"
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={handleCenterLocation}>
          <Ionicons name="locate" size={24} color="#007AFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.fab, { marginTop: 12 }]}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="filter" size={24} color="#007AFF" />
          {Object.values(filters).filter((v) => !v).length > 0 && (
            <View style={styles.filterBadge} />
          )}
        </TouchableOpacity>
      </View>

      {/* Add Alert Button */}
      <TouchableOpacity style={styles.addButton} onPress={handleAddAlert}>
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Create Alert</Text>
      </TouchableOpacity>

      {/* Report Detail Modal */}
      {selectedReport && (
        <ReportDetailModalComplete
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}

      {/* Filter Modal */}
      <FilterModal
        visible={showFilters}
        filters={filters}
        onClose={() => setShowFilters(false)}
        onApply={setFilters}
      />

      {/* Watermark */}
      <View style={styles.watermarkContainer}>
        <Text style={styles.watermarkText}>
          Local Safety & Community Alert App
        </Text>
      </View>
    </View>
  );
}

interface FilterModalProps {
  visible: boolean;
  filters: {
    crime: boolean;
    lost_item: boolean;
    missing_pet: boolean;
    hazard: boolean;
  };
  onClose: () => void;
  onApply: (filters: {
    crime: boolean;
    lost_item: boolean;
    missing_pet: boolean;
    hazard: boolean;
  }) => void;
}

type FilterKey = "crime" | "lost_item" | "missing_pet" | "hazard";

function FilterModal({ visible, filters, onClose, onApply }: FilterModalProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  const filterOptions = [
    { key: "crime", label: "Crime Reports", icon: "warning", color: "#FF3B30" },
    {
      key: "lost_item",
      label: "Lost Items",
      icon: "help-circle",
      color: "#FF9500",
    },
    {
      key: "missing_pet",
      label: "Missing Pets",
      icon: "paw",
      color: "#34C759",
    },
    { key: "hazard", label: "Hazards", icon: "alert-circle", color: "#FFCC00" },
  ];

  const handleToggle = (key: FilterKey) => {
    setLocalFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters = Object.keys(localFilters).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {} as {
        crime: boolean;
        lost_item: boolean;
        missing_pet: boolean;
        hazard: boolean;
      }
    );
    setLocalFilters(resetFilters);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.filterModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Reports</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.filterSubtitle}>
              Show or hide report types on the map
            </Text>
            {filterOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={styles.filterOption}
                onPress={() => handleToggle(option.key as FilterKey)}
              >
                <View style={styles.filterOptionLeft}>
                  <View
                    style={[
                      styles.filterIcon,
                      { backgroundColor: option.color },
                    ]}
                  >
                    <Ionicons
                      name={option.icon as any}
                      size={20}
                      color="#fff"
                    />
                  </View>
                  <Text style={styles.filterLabel}>{option.label}</Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    localFilters[option.key as FilterKey] &&
                      styles.checkboxChecked,
                  ]}
                >
                  {localFilters[option.key as FilterKey] && (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={[styles.filterButton, styles.resetButton]}
              onPress={handleReset}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterButton, styles.applyButton]}
              onPress={handleApply}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Report Detail Modal

interface ReportDetailModalProps {
  report: Report;
  onClose: () => void;
}

/**
 * Get list of reports user has upvoted (React Native version)
 */
const getUpvotedReportsRN = async (userId: string): Promise<string[]> => {
  try {
    const key = `upvoted_${userId}`;
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting upvoted reports:', error);
    return [];
  }
};

/**
 * Save upvoted report (React Native version)
 */
const saveUpvotedReportRN = async (userId: string, reportId: string): Promise<void> => {
  try {
    const key = `upvoted_${userId}`;
    const upvoted = await getUpvotedReportsRN(userId);
    
    if (!upvoted.includes(reportId)) {
      upvoted.push(reportId);
      await AsyncStorage.setItem(key, JSON.stringify(upvoted));
    }
  } catch (error) {
    console.error('Error saving upvoted report:', error);
  }
};

function ReportDetailModalComplete({ report, onClose }: ReportDetailModalProps) {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  
  const [isTracking, setIsTracking] = useState(false);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [localUpvotes, setLocalUpvotes] = useState(report.upvotes);

  // Check if user is tracking
  useEffect(() => {
    if (userProfile && report) {
      setIsTracking(userProfile.trackedReports?.includes(report.id) || false);
    }
  }, [userProfile, report]);

  // Check if user has upvoted (async for RN)
  useEffect(() => {
    const checkUpvoted = async () => {
      if (user) {
        const upvoted = await getUpvotedReportsRN(user.uid);
        setHasUpvoted(upvoted.includes(report.id));
      }
    };
    checkUpvoted();
  }, [user, report.id]);

  const handleUpvote = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to upvote reports.');
      return;
    }

    if (hasUpvoted) {
      Alert.alert('Already Upvoted', 'You have already upvoted this report.');
      return;
    }

    try {
      setActionLoading(true);
      await upvoteReport(report.id, user.uid);
      await saveUpvotedReportRN(user.uid, report.id);
      
      setHasUpvoted(true);
      setLocalUpvotes(prev => prev + 1);
      Alert.alert('Success', 'Report upvoted!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTrack = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to track reports.');
      return;
    }

    try {
      setActionLoading(true);
      if (isTracking) {
        await untrackReport(user.uid, report.id);
        setIsTracking(false);
        Alert.alert('Success', 'Report untracked');
      } else {
        await trackReport(user.uid, report.id);
        setIsTracking(true);
        Alert.alert('Success', 'Report tracked! You will receive updates.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleComment = () => {
    onClose();
    router.push({
      pathname: "/report/[id]",
      params: { id: report.id, scrollTo: 'comments' },
    });
  };

  const getTypeLabel = (type: Report["type"]) => {
    const labels = {
      crime: "Crime Report",
      lost_item: "Lost Item",
      missing_pet: "Missing Pet",
      hazard: "Hazard",
    };
    return labels[type] || "Report";
  };

  const getTypeColor = (type: Report["type"]) => {
    const colors = {
      crime: "#FF3B30",
      lost_item: "#FF9500",
      missing_pet: "#34C759",
      hazard: "#FFCC00",
    };
    return colors[type] || "#007AFF";
  };

  return (
    <Modal visible={true} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={[styles.modalTypeIcon, { backgroundColor: getTypeColor(report.type) }]}>
                <Ionicons name="warning" size={20} color="#fff" />
              </View>
              <Text style={styles.modalTitle}>{getTypeLabel(report.type)}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Description</Text>
              <Text style={styles.modalText}>{report.description}</Text>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: report.status === "open" ? "#34C759" : "#8E8E93" }]} />
                <Text style={styles.statusText}>{report.status === "open" ? "Active" : "Resolved"}</Text>
              </View>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Reported</Text>
              <Text style={styles.modalText}>{new Date(report.createdAt).toLocaleString()}</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.actionButton, hasUpvoted && styles.actionButtonActive]}
                onPress={handleUpvote}
                disabled={actionLoading || hasUpvoted}
              >
                <Ionicons name={hasUpvoted ? "arrow-up" : "arrow-up-outline"} size={20} color={hasUpvoted ? "#fff" : "#007AFF"} />
                <Text style={[styles.actionButtonText, hasUpvoted && styles.actionButtonTextActive]}>
                  {hasUpvoted ? 'Upvoted' : 'Upvote'} ({localUpvotes})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={handleComment}>
                <Ionicons name="chatbubble-outline" size={20} color="#007AFF" />
                <Text style={styles.actionButtonText}>Comment</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, isTracking && styles.actionButtonActive]}
                onPress={handleTrack}
                disabled={actionLoading}
              >
                <Ionicons name={isTracking ? "bookmark" : "bookmark-outline"} size={20} color={isTracking ? "#fff" : "#007AFF"} />
                <Text style={[styles.actionButtonText, isTracking && styles.actionButtonTextActive]}>
                  {isTracking ? 'Tracking' : 'Track'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.viewDetailsButton}
            onPress={() => {
              onClose();
              router.push({ pathname: "/report/[id]", params: { id: report.id } });
            }}
          >
            <Text style={styles.viewDetailsButtonText}>View Full Details</Text>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// Helper Functions for Upvote Tracking
// ============================================

/**
 * Get list of reports user has upvoted (from AsyncStorage)
 */
const getUpvotedReports = (userId: string): string[] => {
  try {
    const key = `upvoted_${userId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting upvoted reports:', error);
    return [];
  }
};

/**
 * Save upvoted report to prevent duplicate upvotes
 */
const saveUpvotedReport = (userId: string, reportId: string): void => {
  try {
    const key = `upvoted_${userId}`;
    const upvoted = getUpvotedReports(userId);
    
    if (!upvoted.includes(reportId)) {
      upvoted.push(reportId);
      localStorage.setItem(key, JSON.stringify(upvoted));
    }
  } catch (error) {
    console.error('Error saving upvoted report:', error);
  }
};

// ============================================
// Updated upvoteReport function in reportsService.ts
// ============================================

/**
 * Upvote a report (with user tracking to prevent duplicates)
 */
export const upvoteReport = async (
  reportId: string, 
  voterId: string
): Promise<void> => {
  try {
    const reportRef = doc(db, 'reports', reportId);
    const reportSnap = await getDoc(reportRef);
    
    if (!reportSnap.exists()) {
      throw new Error('Report not found');
    }

    const reportData = reportSnap.data();

    // Increment upvote count
    await updateDoc(reportRef, {
      upvotes: increment(1),
    });

    // Notify report creator (if not the voter)
    if (reportData.userId && reportData.userId !== voterId) {
      await createNotification(
        reportData.userId,
        'upvote',
        '👍 New Upvote',
        'Someone upvoted your report',
        reportId
      );
    }
    
    console.log('Report upvoted successfully');
  } catch (error) {
    console.error('Error upvoting report:', error);
    throw error;
  }
};

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
  },
  loaderText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  header: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  reportCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
  actionButtonActive: {
    backgroundColor: '#007AFF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  actionButtonTextActive: {
    color: '#fff',
  },
  anonymousBanner: {
    position: "absolute",
    top: 130,
    left: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: "rgba(255, 149, 0, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  anonymousBannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
  },
  fabContainer: {
    position: "absolute",
    right: 16,
    bottom: 100,
    zIndex: 10,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  filterBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF3B30",
    borderWidth: 2,
    borderColor: "#fff",
  },
  addButton: {
    position: "absolute",
    bottom: 24,
    right: 16,
    left: 16,
    zIndex: 10,
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  watermarkContainer: {
    position: "absolute",
    bottom: 90,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1,
  },
  watermarkText: {
    fontSize: 11,
    color: "rgba(0, 0, 0, 0.2)",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  modalTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    flex: 1,
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 16,
    color: "#000",
    lineHeight: 22,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
  viewDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 24,
    marginTop: 16,
    paddingVertical: 16,
    backgroundColor: "#007AFF",
    borderRadius: 12,
  },
  viewDetailsButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  filterModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: "70%",
  },
  filterSubtitle: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 20,
  },
  filterOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  filterOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  filterIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#C7C7CC",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  filterActions: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 24,
    marginTop: 20,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  resetButton: {
    backgroundColor: "#F2F2F7",
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  applyButton: {
    backgroundColor: "#007AFF",
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});

const additionalStyles = {
  actionButtonActive: {
    backgroundColor: '#007AFF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  actionButtonTextActive: {
    color: '#fff',
  },
};
