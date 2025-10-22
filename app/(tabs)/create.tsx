// app/(tabs)/create.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../hooks/useAuth";
import {
  callEmergency,
  EmergencyContact,
  getEmergencyNumbers,
} from "../../services/emergencyService";
import { createReport, ReportType } from "../../services/reportService";
import { uploadReportPhotos } from "../../services/storageService";

const REPORT_TYPES = [
  {
    id: "crime" as ReportType,
    label: "Crime",
    icon: "warning",
    color: "#FF3B30",
    description: "Report suspicious activity or crime",
  },
  {
    id: "lost_item" as ReportType,
    label: "Lost Item",
    icon: "help-circle",
    color: "#FF9500",
    description: "Report a lost item",
  },
  {
    id: "missing_pet" as ReportType,
    label: "Missing Pet",
    icon: "paw",
    color: "#34C759",
    description: "Report a missing pet",
  },
  {
    id: "hazard" as ReportType,
    label: "Hazard",
    icon: "alert-circle",
    color: "#FFCC00",
    description: "Report environmental hazards",
  },
];

interface FormData {
  type: ReportType;
  description: string;
  isAnonymous: boolean;
  itemType?: string;
  color?: string;
  brand?: string;
  species?: string;
  breed?: string;
  crimeCategory?: string;
  crimeSeverity?: string;
  hazardType?: string;
  hazardLevel?: string;
}

export default function CreateReportScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [emergencyNumbers] = useState<EmergencyContact[]>(
    getEmergencyNumbers()
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    defaultValues: { type: "crime", description: "", isAnonymous: false },
  });

  const handleEmergencyCall = (contact: EmergencyContact) => {
    callEmergency(contact.number);
  };

  const isAnonymous = watch("isAnonymous");

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      Alert.alert("Success", "Location captured successfully");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLocationLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 5 - photos.length,
        quality: 0.8,
      });
      if (!result.canceled) {
        const newPhotos = result.assets.map((a) => a.uri);
        setPhotos([...photos, ...newPhotos].slice(0, 5));
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera permission required.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos([...photos, result.assets[0].uri].slice(0, 5));
    }
  };

  const removePhoto = (i: number) =>
    setPhotos(photos.filter((_, idx) => idx !== i));

  const onSubmit = async (data: FormData) => {
    if (!selectedType) return Alert.alert("Error", "Select a report type");
    if (!location) return Alert.alert("Error", "Capture your location");
    if (!user) return Alert.alert("Error", "You must be signed in");

    try {
      setLoading(true);
      let photoUrls: string[] = [];
      if (photos.length) photoUrls = await uploadReportPhotos(photos);

      const metadata: any = {};

      if (selectedType === "lost_item") {
        metadata.lost_item = {
          itemType: data.itemType || "",
          color: data.color || "",
          brand: data.brand || "",
        };
      }

      if (selectedType === "missing_pet") {
        metadata.missing_pet = {
          // species: data.species || "",
          breed: data.breed || "",
          color: data.color || "",
        };
      }

      if (selectedType === "crime") {
        metadata.crime = {
          category: data.crimeCategory || "",
          severity:
            (data.crimeSeverity as "low" | "medium" | "high") || "medium",
        };
      }

      if (selectedType === "hazard") {
        metadata.hazard = {
          type: data.hazardType || "",
          level:
            (data.hazardLevel as "warning" | "danger" | "critical") ||
            "warning",
        };
      }

      await createReport(user.uid, {
        type: selectedType,
        description: data.description,
        latitude: location.latitude,
        longitude: location.longitude,
        photos: photoUrls,
        metadata,
        isAnonymous: data.isAnonymous,
      });

      Alert.alert("Success", "Report created successfully", [
        { text: "OK", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedType) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>What would you like to report?</Text>
        <Text style={styles.subtitle}>Help keep your community safe.</Text>
        <View style={styles.typeGrid}>
          {REPORT_TYPES.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.typeCard, { borderColor: t.color }]}
              onPress={() => {
                setSelectedType(t.id);
                setValue("type", t.id);
              }}
            >
              <View
                style={[styles.typeIconContainer, { backgroundColor: t.color }]}
              >
                <Ionicons name={t.icon as any} size={32} color="#fff" />
              </View>
              <Text style={styles.typeLabel}>{t.label}</Text>
              <Text style={styles.typeDescription}>{t.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.container}>
          <Text style={styles.emergencySectionSubtitle}>
            Quick access to emergency contacts
          </Text>

          {emergencyNumbers.map((contact, index) => (
            <TouchableOpacity
              key={index}
              style={styles.emergencyCard}
              onPress={() => handleEmergencyCall(contact)}
            >
              <View
                style={[
                  styles.emergencyIcon,
                  index === 0 && styles.emergencyIconPrimary,
                ]}
              >
                <Ionicons
                  name={index === 0 ? "call" : "call-outline"}
                  size={24}
                  color={index === 0 ? "#fff" : "#FF3B30"}
                />
              </View>
              <View style={styles.emergencyContent}>
                <Text style={styles.emergencyName}>{contact.name}</Text>
                <Text style={styles.emergencyDescription}>
                  {contact.description}
                </Text>
              </View>
              <View style={styles.emergencyNumber}>
                <Text style={styles.emergencyNumberText}>{contact.number}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  }

  const selectedTypeData = REPORT_TYPES.find((t) => t.id === selectedType);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => setSelectedType(null)}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <View style={styles.formHeaderText}>
            <View
              style={[
                styles.formHeaderIcon,
                { backgroundColor: selectedTypeData?.color },
              ]}
            >
              <Ionicons
                name={selectedTypeData?.icon as any}
                size={20}
                color="#fff"
              />
            </View>
            <Text style={styles.formHeaderTitle}>
              {selectedTypeData?.label}
            </Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Description <Text style={styles.required}>*</Text>
          </Text>
          <Controller
            control={control}
            rules={{
              required: "Description is required",
              minLength: { value: 10, message: "At least 10 characters" },
            }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[
                  styles.textArea,
                  errors.description && styles.inputError,
                ]}
                placeholder="Provide details..."
                multiline
                value={value}
                onChangeText={onChange}
              />
            )}
            name="description"
          />
          {errors.description && (
            <Text style={styles.errorText}>{errors.description.message}</Text>
          )}
        </View>

        {/* Type-specific fields */}
        {selectedType === "lost_item" && (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>
                Item Type <Text style={styles.required}>*</Text>
              </Text>
              <Controller
                control={control}
                rules={{ required: "Item type is required" }}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, errors.itemType && styles.inputError]}
                    placeholder="e.g., Wallet, Keys, Phone"
                    value={value}
                    onChangeText={onChange}
                  />
                )}
                name="itemType"
              />
              {errors.itemType && (
                <Text style={styles.errorText}>{errors.itemType.message}</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Color</Text>
              <Controller
                control={control}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Black, Blue"
                    value={value}
                    onChangeText={onChange}
                  />
                )}
                name="color"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Brand/Make</Text>
              <Controller
                control={control}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Apple, Nike"
                    value={value}
                    onChangeText={onChange}
                  />
                )}
                name="brand"
              />
            </View>
          </>
        )}

        {selectedType === "missing_pet" && (
          <>
            {/* <View style={styles.section}>
              <Text style={styles.label}>
                Species <Text style={styles.required}>*</Text>
              </Text>
              <Controller
                control={control}
                rules={{ required: "Species is required" }}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, errors.species && styles.inputError]}
                    placeholder="e.g., Dog, Cat"
                    value={value}
                    onChangeText={onChange}
                  />
                )}
                name="species"
              />
              {errors.species && (
                <Text style={styles.errorText}>{errors.species.message}</Text>
              )}
            </View> */}

            <View style={styles.section}>
              <Text style={styles.label}>Breed</Text>
              <Controller
                control={control}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Labrador, Persian"
                    value={value}
                    onChangeText={onChange}
                  />
                )}
                name="breed"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Color/Markings</Text>
              <Controller
                control={control}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Golden, White with brown spots"
                    value={value}
                    onChangeText={onChange}
                  />
                )}
                name="color"
              />
            </View>
          </>
        )}

        {selectedType === "crime" && (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>
                Category <Text style={styles.required}>*</Text>
              </Text>
              <Controller
                control={control}
                rules={{ required: "Category is required" }}
                render={({ field: { onChange, value } }) => (
                  <View style={styles.optionsContainer}>
                    {[
                      "Theft",
                      "Vandalism",
                      "Assault",
                      "Suspicious Activity",
                      "Other",
                    ].map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.optionButton,
                          value === cat && styles.optionButtonSelected,
                        ]}
                        onPress={() => onChange(cat)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            value === cat && styles.optionTextSelected,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                name="crimeCategory"
              />
              {errors.crimeCategory && (
                <Text style={styles.errorText}>
                  {errors.crimeCategory.message}
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Severity</Text>
              <Controller
                control={control}
                render={({ field: { onChange, value } }) => (
                  <View style={styles.optionsContainer}>
                    {[
                      { value: "low", label: "Low", color: "#34C759" },
                      { value: "medium", label: "Medium", color: "#FF9500" },
                      { value: "high", label: "High", color: "#FF3B30" },
                    ].map((sev) => (
                      <TouchableOpacity
                        key={sev.value}
                        style={[
                          styles.optionButton,
                          value === sev.value && {
                            ...styles.optionButtonSelected,
                            borderColor: sev.color,
                            backgroundColor: sev.color,
                          },
                        ]}
                        onPress={() => onChange(sev.value)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            value === sev.value && styles.optionTextSelected,
                          ]}
                        >
                          {sev.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                name="crimeSeverity"
              />
            </View>
          </>
        )}

        {selectedType === "hazard" && (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>
                Hazard Type <Text style={styles.required}>*</Text>
              </Text>
              <Controller
                control={control}
                rules={{ required: "Hazard type is required" }}
                render={({ field: { onChange, value } }) => (
                  <View style={styles.optionsContainer}>
                    {[
                      "Road Damage",
                      "Fallen Tree",
                      "Flooding",
                      "Fire Risk",
                      "Other",
                    ].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.optionButton,
                          value === type && styles.optionButtonSelected,
                        ]}
                        onPress={() => onChange(type)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            value === type && styles.optionTextSelected,
                          ]}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                name="hazardType"
              />
              {errors.hazardType && (
                <Text style={styles.errorText}>
                  {errors.hazardType.message}
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Severity Level</Text>
              <Controller
                control={control}
                render={({ field: { onChange, value } }) => (
                  <View style={styles.optionsContainer}>
                    {[
                      { value: "warning", label: "Warning", color: "#FFCC00" },
                      { value: "danger", label: "Danger", color: "#FF9500" },
                      {
                        value: "critical",
                        label: "Critical",
                        color: "#FF3B30",
                      },
                    ].map((level) => (
                      <TouchableOpacity
                        key={level.value}
                        style={[
                          styles.optionButton,
                          value === level.value && {
                            ...styles.optionButtonSelected,
                            borderColor: level.color,
                            backgroundColor: level.color,
                          },
                        ]}
                        onPress={() => onChange(level.value)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            value === level.value && styles.optionTextSelected,
                          ]}
                        >
                          {level.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                name="hazardLevel"
              />
            </View>
          </>
        )}

        {/* Photo upload */}
        <View style={styles.section}>
          <Text style={styles.label}>Photos (Optional)</Text>
          <View style={styles.photosContainer}>
            {photos.map((p, i) => (
              <View key={i} style={styles.photoItem}>
                <Image source={{ uri: p }} style={styles.photo} />
                <TouchableOpacity
                  onPress={() => removePhoto(i)}
                  style={styles.removePhotoButton}
                >
                  <Ionicons name="close-circle" size={22} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          {photos.length < 5 && (
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.photoActionButton}
                onPress={takePhoto}
              >
                <Ionicons name="camera" size={22} color="#007AFF" />
                <Text style={styles.photoActionText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoActionButton}
                onPress={pickImage}
              >
                <Ionicons name="images" size={22} color="#007AFF" />
                <Text style={styles.photoActionText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Location <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[
              styles.locationButton,
              location && styles.locationButtonActive,
            ]}
            onPress={getCurrentLocation}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator color="#007AFF" />
            ) : (
              <>
                <Ionicons
                  name={location ? "checkmark-circle" : "location"}
                  size={24}
                  color={location ? "#34C759" : "#007AFF"}
                />
                <Text
                  style={[
                    styles.locationButtonText,
                    location && styles.locationButtonTextActive,
                  ]}
                >
                  {location ? "Location Captured" : "Capture Current Location"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Anonymous toggle */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <Ionicons name="eye-off" size={22} color="#666" />
              <View>
                <Text style={styles.switchLabel}>Post Anonymously</Text>
                <Text style={styles.switchSublabel}>
                  Your name won't be shown
                </Text>
              </View>
            </View>
            <Controller
              control={control}
              name="isAnonymous"
              render={({ field: { onChange, value } }) => (
                <Switch
                  value={value}
                  onValueChange={onChange}
                  thumbColor={value ? "#007AFF" : "#f4f3f4"}
                />
              )}
            />
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, loading && { opacity: 0.7 }]}
          disabled={loading}
          onPress={handleSubmit(onSubmit)}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Report</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, paddingBottom: 80, marginTop: 40 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 24 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  typeCard: {
    flexBasis: "47%",
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  typeIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  typeLabel: { fontWeight: "700", marginBottom: 4 },
  typeDescription: { fontSize: 12, color: "#666", textAlign: "center" },
  formHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  formHeaderText: { flexDirection: "row", alignItems: "center", marginLeft: 8 },
  formHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  formHeaderTitle: { fontWeight: "700", fontSize: 18 },
  section: { marginBottom: 24 },
  label: { fontWeight: "600", marginBottom: 8 },
  required: { color: "#FF3B30" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  textArea: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    textAlignVertical: "top",
  },
  inputError: { borderColor: "#FF3B30" },
  errorText: { color: "#FF3B30", marginTop: 4, fontSize: 12 },
  optionsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#f5f5f5",
  },
  optionButtonSelected: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  optionText: { fontSize: 14, color: "#333" },
  optionTextSelected: { color: "#fff", fontWeight: "600" },
  photosContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoItem: { position: "relative" },
  photo: { width: 80, height: 80, borderRadius: 8 },
  removePhotoButton: { position: "absolute", top: -6, right: -6 },
  photoActions: { flexDirection: "row", marginTop: 12, gap: 16 },
  photoActionButton: { alignItems: "center" },
  photoActionText: { fontSize: 12, color: "#007AFF", marginTop: 4 },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
  },
  locationButtonActive: { borderColor: "#34C759", backgroundColor: "#E8FCEB" },
  locationButtonText: { marginLeft: 8, color: "#007AFF" },
  locationButtonTextActive: { color: "#34C759" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchLabel: { fontWeight: "600" },
  switchSublabel: { fontSize: 12, color: "#666" },
  submitButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  submitButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  emergencySectionSubtitle: {
    fontSize: 20,
    color: "#000",
    fontWeight: "bold",
    marginTop: 24,
    marginBottom: 16,
  },
  emergencyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  emergencyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFEBEE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  emergencyIconPrimary: {
    backgroundColor: "#FF3B30",
  },
  emergencyContent: {
    flex: 1,
  },
  emergencyName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  emergencyDescription: {
    fontSize: 12,
    color: "#666",
  },
  emergencyNumber: {
    backgroundColor: "#E8F4FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  emergencyNumberText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#007AFF",
  },
});
