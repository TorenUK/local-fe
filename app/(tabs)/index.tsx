import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps";
import { useAuth } from "../../hooks/useAuth";
import { useReports } from "../../hooks/useReport";
import { getCurrentPosition } from "../../services/locationService";

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

  const filteredReports = reports.filter((report) => filters[report.type]);

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
            Browsing as guest • Create account to submit reports
          </Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
        provider={PROVIDER_GOOGLE}
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
        <Text style={styles.addButtonText}>Add Alert</Text>
      </TouchableOpacity>

      {/* Report Detail Modal */}
      {selectedReport && (
        <ReportDetailModal
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

// ============================================
// Report Detail Modal
// ============================================
interface ReportDetailModalProps {
  report: Report;
  onClose: () => void;
}

function ReportDetailModal({ report, onClose }: ReportDetailModalProps) {
  const router = useRouter();

  const getTypeLabel = (type: Report["type"]) => {
    switch (type) {
      case "crime":
        return "Crime Report";
      case "lost_item":
        return "Lost Item";
      case "missing_pet":
        return "Missing Pet";
      case "hazard":
        return "Hazard";
      default:
        return "Report";
    }
  };

  const getTypeColor = (type: Report["type"]) => {
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

  return (
    <Modal
      visible={true}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View
                style={[
                  styles.modalTypeIcon,
                  { backgroundColor: getTypeColor(report.type) },
                ]}
              >
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
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        report.status === "open" ? "#34C759" : "#8E8E93",
                    },
                  ]}
                />
                <Text style={styles.statusText}>
                  {report.status === "open" ? "Active" : "Resolved"}
                </Text>
              </View>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Reported</Text>
              <Text style={styles.modalText}>
                {new Date(report.createdAt).toLocaleString()}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="arrow-up" size={20} color="#007AFF" />
                <Text style={styles.actionButtonText}>
                  Upvote ({report.upvotes})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="chatbubble-outline" size={20} color="#007AFF" />
                <Text style={styles.actionButtonText}>Comment</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="bookmark-outline" size={20} color="#007AFF" />
                <Text style={styles.actionButtonText}>Track</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.viewDetailsButton}
            onPress={() => {
              onClose();
              // Navigate to full report details

              router.push({
                pathname: "/report/[id]",
                params: { id: report.id },
              });
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
