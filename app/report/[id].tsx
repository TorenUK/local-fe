// app/report/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useAuth } from "../../hooks/useAuth";
import { getUserProfile } from "../../services/auth";
import { createComment, getReportComments } from "../../services/commentService";
import {
  deleteReport,
  getReportById,
  Report,
  trackReport,
  untrackReport,
  updateReportStatus,
  upvoteReport
} from "../../services/reportService";

const { width } = Dimensions.get("window");

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

interface Comment {
  id: string;
  userId: string;
  content: string;
  createdAt: any;
  flagged: boolean;
}

export default function ReportDetailScreen() {
  const { id, scrollTo } = useLocalSearchParams();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const commentsRef = useRef<View>(null);

  const [report, setReport] = useState<Report | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [reporterName, setReporterName] = useState<string>("Anonymous");
  const [isTracking, setIsTracking] = useState(false);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [localUpvotes, setLocalUpvotes] = useState(0);

  useEffect(() => {
    fetchReportData();
  }, [id]);

  useEffect(() => {
    if (userProfile && report) {
      setIsTracking(userProfile.trackedReports?.includes(report.id) || false);
    }
  }, [userProfile, report]);

  useEffect(() => {
    const checkUpvoted = async () => {
      if (user && report) {
        const upvoted = await getUpvotedReportsRN(user.uid);
        setHasUpvoted(upvoted.includes(report.id));
      }
    };
    checkUpvoted();
  }, [user, report]);

  useEffect(() => {
    if (scrollTo === 'comments' && commentsRef.current) {
      setTimeout(() => {
        commentsRef.current?.measureLayout(
          scrollViewRef.current as any,
          (x, y) => {
            scrollViewRef.current?.scrollTo({ y: y - 20, animated: true });
          },
          () => {}
        );
      }, 500);
    }
  }, [scrollTo, comments]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const reportData = await getReportById(id as string);
      if (!reportData) {
        Alert.alert("Error", "Report not found");
        router.back();
        return;
      }
      setReport(reportData);
      setLocalUpvotes(reportData.upvotes || 0);

      // Fetch reporter name if not anonymous
      if (reportData.userId && !reportData.isAnonymous) {
        const profile = await getUserProfile(reportData.userId);
        if (profile?.name) {
          setReporterName(profile.name);
        }
      }

      // Fetch comments
      const commentsData = await getReportComments(id as string);
      setComments(commentsData as Comment[]);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

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
      await upvoteReport(report!.id, user.uid);
      await saveUpvotedReportRN(user.uid, report!.id);
      
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
        await untrackReport(user.uid, report!.id);
        setIsTracking(false);
        Alert.alert('Success', 'Report untracked');
      } else {
        await trackReport(user.uid, report!.id);
        setIsTracking(true);
        Alert.alert('Success', 'Report tracked! You will receive updates.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to comment.");
      return;
    }

    if (!commentText.trim()) {
      Alert.alert("Error", "Comment cannot be empty");
      return;
    }

    try {
      setSubmittingComment(true);
      await createComment({
        reportId: id as string,
        userId: user.uid,
        content: commentText.trim(),
      });

      setCommentText("");
      await fetchReportData();
      Alert.alert("Success", "Comment posted!");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStatusChange = async (newStatus: "open" | "resolved") => {
    if (!user || !report) return;

    // Only creator or admin can change status
    if (report.userId !== user.uid) {
      Alert.alert("Error", "Only the report creator can change the status");
      return;
    }

    Alert.alert(
      "Change Status",
      `Mark this report as ${newStatus}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              await updateReportStatus(report.id, newStatus);
              setReport({ ...report, status: newStatus });
              Alert.alert("Success", `Report marked as ${newStatus}`);
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteReport = async () => {
    if (!user || !report) return;

    if (report.userId !== user.uid) {
      Alert.alert("Error", "Only the report creator can delete this report");
      return;
    }

    Alert.alert(
      "Delete Report",
      "Are you sure you want to delete this report? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteReport(report.id, user.uid);
              Alert.alert("Success", "Report deleted", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      crime: "Crime Report",
      lost_item: "Lost Item",
      missing_pet: "Missing Pet",
      hazard: "Hazard Alert",
    };
    return labels[type] || "Report";
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      crime: "#FF3B30",
      lost_item: "#FF9500",
      missing_pet: "#34C759",
      hazard: "#FFCC00",
    };
    return colors[type] || "#007AFF";
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      crime: "warning",
      lost_item: "help-circle",
      missing_pet: "paw",
      hazard: "alert-circle",
    };
    return icons[type] || "alert-circle";
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loaderText}>Loading report...</Text>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.loader}>
        <Text style={styles.loaderText}>Report not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Details</Text>
        {user && report.userId === user.uid && (
          <TouchableOpacity onPress={handleDeleteReport}>
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView ref={scrollViewRef} style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Type Badge */}
        <View style={[styles.typeBadge, { backgroundColor: getTypeColor(report.type) }]}>
          <Ionicons name={getTypeIcon(report.type)} size={20} color="#fff" />
          <Text style={styles.typeBadgeText}>{getTypeLabel(report.type)}</Text>
        </View>

        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, report.status === "open" ? styles.statusOpen : styles.statusResolved]}>
            <View style={[styles.statusDot, { backgroundColor: report.status === "open" ? "#34C759" : "#8E8E93" }]} />
            <Text style={styles.statusText}>
              {report.status === "open" ? "Active" : "Resolved"}
            </Text>
          </View>
          {user && report.userId === user.uid && (
            <TouchableOpacity
              style={styles.changeStatusButton}
              onPress={() => handleStatusChange(report.status === "open" ? "resolved" : "open")}
            >
              <Text style={styles.changeStatusText}>
                Mark as {report.status === "open" ? "Resolved" : "Active"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{report.description}</Text>
        </View>

        {/* Type-specific Metadata */}
        {report.metadata && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Details</Text>
            
            {report.type === 'lost_item' && report.metadata.lost_item && (
              <View style={styles.detailsGrid}>
                {report.metadata.lost_item.itemType && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Item Type</Text>
                    <Text style={styles.detailValue}>{report.metadata.lost_item.itemType}</Text>
                  </View>
                )}
                {report.metadata.lost_item.color && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Color</Text>
                    <Text style={styles.detailValue}>{report.metadata.lost_item.color}</Text>
                  </View>
                )}
                {report.metadata.lost_item.brand && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Brand</Text>
                    <Text style={styles.detailValue}>{report.metadata.lost_item.brand}</Text>
                  </View>
                )}
              </View>
            )}

            {report.type === 'missing_pet' && report.metadata.missing_pet && (
              <View style={styles.detailsGrid}>
                {report.metadata.missing_pet.species && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Species</Text>
                    <Text style={styles.detailValue}>{report.metadata.missing_pet.species}</Text>
                  </View>
                )}
                {report.metadata.missing_pet.breed && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Breed</Text>
                    <Text style={styles.detailValue}>{report.metadata.missing_pet.breed}</Text>
                  </View>
                )}
                {report.metadata.missing_pet.color && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Color/Markings</Text>
                    <Text style={styles.detailValue}>{report.metadata.missing_pet.color}</Text>
                  </View>
                )}
              </View>
            )}

            {report.type === 'crime' && report.metadata.crime && (
              <View style={styles.detailsGrid}>
                {report.metadata.crime.category && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <Text style={styles.detailValue}>{report.metadata.crime.category}</Text>
                  </View>
                )}
                {report.metadata.crime.severity && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Severity</Text>
                    <View style={styles.severityBadge}>
                      <View style={[
                        styles.severityDot,
                        { backgroundColor: 
                          report.metadata.crime.severity === 'high' ? '#FF3B30' :
                          report.metadata.crime.severity === 'medium' ? '#FF9500' : '#34C759'
                        }
                      ]} />
                      <Text style={[
                        styles.severityText,
                        { color: 
                          report.metadata.crime.severity === 'high' ? '#FF3B30' :
                          report.metadata.crime.severity === 'medium' ? '#FF9500' : '#34C759'
                        }
                      ]}>
                        {report.metadata.crime.severity.charAt(0).toUpperCase() + report.metadata.crime.severity.slice(1)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {report.type === 'hazard' && report.metadata.hazard && (
              <View style={styles.detailsGrid}>
                {report.metadata.hazard.type && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Hazard Type</Text>
                    <Text style={styles.detailValue}>{report.metadata.hazard.type}</Text>
                  </View>
                )}
                {report.metadata.hazard.level && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Severity Level</Text>
                    <View style={styles.severityBadge}>
                      <View style={[
                        styles.severityDot,
                        { backgroundColor: 
                          report.metadata.hazard.level === 'critical' ? '#FF3B30' :
                          report.metadata.hazard.level === 'danger' ? '#FF9500' : '#FFCC00'
                        }
                      ]} />
                      <Text style={[
                        styles.severityText,
                        { color: 
                          report.metadata.hazard.level === 'critical' ? '#FF3B30' :
                          report.metadata.hazard.level === 'danger' ? '#FF9500' : '#FFCC00'
                        }
                      ]}>
                        {report.metadata.hazard.level.charAt(0).toUpperCase() + report.metadata.hazard.level.slice(1)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Photos */}
        {report.photos && report.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              {report.photos.map((photo, index) => (
                <Image key={index} source={{ uri: photo }} style={styles.photo} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Location Map */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: report.location.latitude,
                longitude: report.location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker
                coordinate={{
                  latitude: report.location.latitude,
                  longitude: report.location.longitude,
                }}
              >
                <View style={[styles.markerContainer, { backgroundColor: getTypeColor(report.type) }]}>
                  <Ionicons name={getTypeIcon(report.type)} size={20} color="#fff" />
                </View>
              </Marker>
            </MapView>
          </View>
        </View>

        {/* Report Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Information</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color="#666" />
            <Text style={styles.infoText}>Reported by: {reporterName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color="#666" />
            <Text style={styles.infoText}>
              {report.createdAt instanceof Date
                ? report.createdAt.toLocaleString()
                : report.createdAt.toDate().toLocaleString()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="arrow-up-outline" size={20} color="#666" />
            <Text style={styles.infoText}>{localUpvotes} upvotes</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, hasUpvoted && styles.actionButtonActive]}
            onPress={handleUpvote}
            disabled={actionLoading || hasUpvoted}
          >
            <Ionicons 
              name={hasUpvoted ? "arrow-up" : "arrow-up-outline"} 
              size={20} 
              color={hasUpvoted ? "#fff" : "#007AFF"} 
            />
            <Text style={[styles.actionButtonText, hasUpvoted && styles.actionButtonTextActive]}>
              {hasUpvoted ? 'Upvoted' : 'Upvote'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, isTracking && styles.actionButtonActive]}
            onPress={handleTrack}
            disabled={actionLoading}
          >
            <Ionicons 
              name={isTracking ? "bookmark" : "bookmark-outline"} 
              size={20} 
              color={isTracking ? "#fff" : "#007AFF"} 
            />
            <Text style={[styles.actionButtonText, isTracking && styles.actionButtonTextActive]}>
              {isTracking ? 'Tracking' : 'Track'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Comments Section */}
        <View ref={commentsRef} style={styles.section}>
          <Text style={styles.sectionTitle}>
            Comments ({comments.length})
          </Text>

          {user && (
            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                style={[styles.commentSubmitButton, !commentText.trim() && styles.commentSubmitDisabled]}
                onPress={handleSubmitComment}
                disabled={submittingComment || !commentText.trim()}
              >
                {submittingComment ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          )}

          {comments.length === 0 ? (
            <Text style={styles.noComments}>No comments yet. Be the first to comment!</Text>
          ) : (
            <View style={styles.commentsList}>
              {comments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

interface CommentItemProps {
  comment: Comment;
}

function CommentItem({ comment }: CommentItemProps) {
  const [userName, setUserName] = useState("Anonymous");

  useEffect(() => {
    fetchUserName();
  }, [comment.userId]);

  const fetchUserName = async () => {
    try {
      const profile = await getUserProfile(comment.userId);
      if (profile?.name) {
        setUserName(profile.name);
      }
    } catch (error) {
      console.error("Error fetching user name:", error);
    }
  };

  return (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        <View style={styles.commentAvatar}>
          <Ionicons name="person" size={16} color="#666" />
        </View>
        <View style={styles.commentHeaderText}>
          <Text style={styles.commentUserName}>{userName}</Text>
          <Text style={styles.commentTime}>
            {comment.createdAt instanceof Date
              ? comment.createdAt.toLocaleString()
              : comment.createdAt.toDate().toLocaleString()}
          </Text>
        </View>
      </View>
      <Text style={styles.commentContent}>{comment.content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
  },
  loaderText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    flex: 1,
    textAlign: "center",
    marginRight: 32,
  },
  content: {
    flex: 1,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
    borderRadius: 12,
  },
  typeBadgeText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusOpen: {
    backgroundColor: "#E8FCEB",
  },
  statusResolved: {
    backgroundColor: "#F2F2F7",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  changeStatusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  changeStatusText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: "#000",
  },
  description: {
    fontSize: 16,
    color: "#000",
    lineHeight: 24,
  },
  detailsGrid: {
    gap: 12,
  },
  detailItem: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: "#000",
    fontWeight: "500",
  },
  severityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  severityText: {
    fontSize: 16,
    fontWeight: "600",
  },
  photosScroll: {
    marginTop: 8,
  },
  photo: {
    width: width * 0.6,
    height: 300,
    borderRadius: 12,
    marginRight: 12,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 15,
    color: "#666",
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 16,
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
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  actionButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
  actionButtonTextActive: {
    color: "#fff",
  },
  commentInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 16,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    backgroundColor: "#F9F9F9",
  },
  commentSubmitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  commentSubmitDisabled: {
    opacity: 0.5,
  },
  noComments: {
    textAlign: "center",
    color: "#8E8E93",
    fontSize: 15,
    marginTop: 16,
  },
  commentsList: {
    gap: 12,
  },
  commentItem: {
    backgroundColor: "#F9F9F9",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  commentHeaderText: {
    flex: 1,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  commentTime: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  commentContent: {
    fontSize: 15,
    color: "#000",
    lineHeight: 20,
  },
});