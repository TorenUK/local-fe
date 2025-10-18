// app/report/[id].tsx - Full Report Details Screen
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useAuth } from '../../hooks/useAuth';
import { useReport } from '../../hooks/useReport';
import {
  Comment,
  createComment,
  getReportComments,
} from '../../services/commentService';
import { navigateToLocation } from '../../services/notificationService';
import {
  deleteReport,
  trackReport,
  untrackReport,
  updateReportStatus,
  upvoteReport,
} from '../../services/reportService';

const { width } = Dimensions.get('window');

export default function ReportDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  
  const { report, loading } = useReport(id);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);


  console.log(report?.metadata);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      comment: '',
    },
  });

  // Load comments
  useEffect(() => {
    if (!id) return;

    const loadComments = async () => {
      try {
        const reportComments = await getReportComments(id);
        setComments(reportComments);
      } catch (error) {
        console.error('Error loading comments:', error);
      } finally {
        setCommentsLoading(false);
      }
    };

    loadComments();
  }, [id]);

  // Check if user is tracking this report
  useEffect(() => {
    if (userProfile && report) {
      setIsTracking(userProfile.trackedReports?.includes(report.id) || false);
    }
  }, [userProfile, report]);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'crime':
        return 'Crime Report';
      case 'lost_item':
        return 'Lost Item';
      case 'missing_pet':
        return 'Missing Pet';
      case 'hazard':
        return 'Hazard';
      default:
        return 'Report';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'crime':
        return '#FF3B30';
      case 'lost_item':
        return '#FF9500';
      case 'missing_pet':
        return '#34C759';
      case 'hazard':
        return '#FFCC00';
      default:
        return '#007AFF';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'crime':
        return 'warning';
      case 'lost_item':
        return 'help-circle';
      case 'missing_pet':
        return 'paw';
      case 'hazard':
        return 'alert-circle';
      default:
        return 'location';
    }
  };

  const handleUpvote = async () => {
    if (!user || !report) return;

    if (hasUpvoted) {
      Alert.alert('Already Upvoted', 'You have already upvoted this report.');
      return;
    }

    try {
      setActionLoading(true);
      await upvoteReport(report.id, user.uid);
      setHasUpvoted(true);
      Alert.alert('Success', 'Report upvoted!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTrack = async () => {
    if (!user || !report) return;

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

  const handleShare = async () => {
    if (!report) return;

    try {
      await Share.share({
        message: `Check out this ${getTypeLabel(report.type)}: ${report.description}`,
        title: 'Safety Alert',
      });
    } catch (error: any) {
      console.error('Error sharing:', error);
    }
  };

  const handleResolve = async () => {
    if (!user || !report) return;

    Alert.alert(
      'Mark as Resolved',
      'Are you sure you want to mark this report as resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: async () => {
            try {
              setActionLoading(true);
              await updateReportStatus(report.id, 'resolved');
              Alert.alert('Success', 'Report marked as resolved');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async () => {
    if (!user || !report) return;

    Alert.alert(
      'Delete Report',
      'Are you sure you want to delete this report? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await deleteReport(report.id, user.uid);
              Alert.alert('Success', 'Report deleted', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const onSubmitComment = async (data: { comment: string }) => {
    if (!user || !report) return;

    try {
      setActionLoading(true);
      await createComment({
        reportId: report.id,
        userId: user.uid,
        content: data.comment,
      });
      
      // Reload comments
      const updatedComments = await getReportComments(report.id);
      setComments(updatedComments);
      
      reset();
      setShowCommentInput(false);
      Alert.alert('Success', 'Comment added');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getRelativeTime = (timestamp: any): string => {
    const now = new Date();
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
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
        <Ionicons name="alert-circle" size={64} color="#666" />
        <Text style={styles.errorText}>Report not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = user?.uid === report.userId;

  return (
    <>
      <Stack.Screen
        options={{
          title: getTypeLabel(report.type),
          headerBackTitle: 'Back',
        }}
      />
      <TouchableOpacity style={styles.backFloatingButton} onPress={() => router.back()}>
  <Ionicons name="arrow-back" size={24} color="#007AFF" />
</TouchableOpacity>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header with Type Badge */}
        <View style={[styles.typeHeader, { backgroundColor: getTypeColor(report.type) }]}>
          <View style={styles.typeHeaderContent}>
            <Ionicons name={getTypeIcon(report.type) as any} size={32} color="#fff" />
            <View style={styles.typeHeaderText}>
              <Text style={styles.typeLabel}>{getTypeLabel(report.type)}</Text>
              <Text style={styles.reportDate}>
                {getRelativeTime(report.createdAt)}
              </Text>
            </View>
          </View>
          
          <View style={styles.statusBadgeContainer}>
            <View
              style={[
                styles.statusBadge,
                report.status === 'open'
                  ? styles.statusBadgeOpen
                  : styles.statusBadgeResolved,
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {report.status === 'open' ? 'Active' : 'Resolved'}
              </Text>
            </View>
          </View>
        </View>

        {/* Photos Carousel */}
        {report.photos && report.photos.length > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={true}
            style={styles.photosCarousel}
          >
            {report.photos.map((photo, index) => {


  return (
    <View key={index}>
      {photoLoading && (
        <ActivityIndicator
          size="small"
          color="#FF0000"
          style={StyleSheet.absoluteFill}
        />
      )}
      <Image
        source={{ uri: photo }}
        style={styles.photo}
        contentFit="cover"
        onLoadStart={() => setPhotoLoading(true)}
        onLoadEnd={() => setPhotoLoading(false)}
      />
    </View>
  );
})}
          </ScrollView>
        )}

        {/* Description Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{report.description}</Text>
        </View>

        {/* Metadata Section */}
        {report.metadata && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            {report.type === 'lost_item' && report.metadata.lost_item && (
              <View style={styles.metadataGrid}>
                {report.metadata.lost_item.itemType && (
                  <View style={styles.metadataItem}>
                    <Text style={styles.metadataLabel}>Item Type</Text>
                    <Text style={styles.metadataValue}>
                      {report.metadata.lost_item.itemType}
                    </Text>
                  </View>
                )}
                {report.metadata.lost_item.color && (
                  <View style={styles.metadataItem}>
                    <Text style={styles.metadataLabel}>Color</Text>
                    <Text style={styles.metadataValue}>
                      {report.metadata.lost_item.color}
                    </Text>
                  </View>
                )}
                {report.metadata.lost_item.brand && (
                  <View style={styles.metadataItem}>
                    <Text style={styles.metadataLabel}>Brand</Text>
                    <Text style={styles.metadataValue}>
                      {report.metadata.lost_item.brand}
                    </Text>
                  </View>
                )}
              </View>
            )}
            
            {report.type === 'missing_pet' && report.metadata.missing_pet && (
              <View style={styles.metadataGrid}>
                {report.metadata.missing_pet.species && (
                  <View style={styles.metadataItem}>
                    <Text style={styles.metadataLabel}>Species</Text>
                    <Text style={styles.metadataValue}>
                      {report.metadata.missing_pet.species}
                    </Text>
                  </View>
                )}
                {report.metadata.missing_pet.breed && (
                  <View style={styles.metadataItem}>
                    <Text style={styles.metadataLabel}>Breed</Text>
                    <Text style={styles.metadataValue}>
                      {report.metadata.missing_pet.breed}
                    </Text>
                  </View>
                )}
                {report.metadata.missing_pet.color && (
                  <View style={styles.metadataItem}>
                    <Text style={styles.metadataLabel}>Color</Text>
                    <Text style={styles.metadataValue}>
                      {report.metadata.missing_pet.color}
                    </Text>
                  </View>
                )}
              </View>
            )}
            
            {report.type === 'crime' && report.metadata.crime && (
              <View style={styles.metadataGrid}>
                <View style={styles.metadataItem}>
                  <Text style={styles.metadataLabel}>Category</Text>
                  <Text style={styles.metadataValue}>
                    {report.metadata.crime.category}
                  </Text>
                </View>
                {report.metadata.crime.severity && (
                  <View style={styles.metadataItem}>
                    <Text style={styles.metadataLabel}>Severity</Text>
                    <Text style={styles.metadataValue}>
                      {report.metadata.crime.severity}
                    </Text>
                  </View>
                )}
              </View>
            )}
            
            {report.type === 'hazard' && report.metadata.hazard && (
              <View style={styles.metadataGrid}>
                <View style={styles.metadataItem}>
                  <Text style={styles.metadataLabel}>Type</Text>
                  <Text style={styles.metadataValue}>
                    {report.metadata.hazard.type}
                  </Text>
                </View>
                {report.metadata.hazard.level && (
                  <View style={styles.metadataItem}>
                    <Text style={styles.metadataLabel}>Level</Text>
                    <Text style={styles.metadataValue}>
                      {report.metadata.hazard.level}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Location Map */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: report.location.latitude,
                longitude: report.location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
            >
              <Marker
                coordinate={{
                  latitude: report.location.latitude,
                  longitude: report.location.longitude,
                }}
              >
                <View
                  style={[
                    styles.markerContainer,
                    { backgroundColor: getTypeColor(report.type) },
                  ]}
                >
                  <Ionicons
                    name={getTypeIcon(report.type) as any}
                    size={20}
                    color="#fff"
                  />
                </View>
              </Marker>
            </MapView>
          </View>
          <Text style={styles.coordinates}>
            {report.location.latitude.toFixed(6)}, {report.location.longitude.toFixed(6)}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="arrow-up" size={20} color="#007AFF" />
            <Text style={styles.statValue}>{report.upvotes}</Text>
            <Text style={styles.statLabel}>Upvotes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="chatbubble" size={20} color="#007AFF" />
            <Text style={styles.statValue}>{report.commentCount || 0}</Text>
            <Text style={styles.statLabel}>Comments</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, hasUpvoted && styles.actionButtonActive]}
            onPress={handleUpvote}
            disabled={actionLoading || hasUpvoted}
          >
            <Ionicons
              name={hasUpvoted ? 'arrow-up' : 'arrow-up-outline'}
              size={24}
              color={hasUpvoted ? '#fff' : '#007AFF'}
            />
            <Text
              style={[
                styles.actionButtonText,
                hasUpvoted && styles.actionButtonTextActive,
              ]}
            >
              {hasUpvoted ? 'Upvoted' : 'Upvote'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, isTracking && styles.actionButtonActive]}
            onPress={handleTrack}
            disabled={actionLoading}
          >
            <Ionicons
              name={isTracking ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={isTracking ? '#fff' : '#007AFF'}
            />
            <Text
              style={[
                styles.actionButtonText,
                isTracking && styles.actionButtonTextActive,
              ]}
            >
              {isTracking ? 'Tracking' : 'Track'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={24} color="#007AFF" />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Navigate Button */}
        <TouchableOpacity
          style={styles.navigateButton}
          onPress={() => navigateToLocation(
            report.location.latitude,
            report.location.longitude,
            getTypeLabel(report.type)
          )}
        >
          <Ionicons name="navigate" size={24} color="#fff" />
          <Text style={styles.navigateButtonText}>Navigate to Location</Text>
        </TouchableOpacity>

        {/* Owner Actions */}
        {isOwner && (
          <View style={styles.ownerActions}>
            {report.status === 'open' && (
              <TouchableOpacity
                style={styles.resolveButton}
                onPress={handleResolve}
                disabled={actionLoading}
              >
                <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                <Text style={styles.resolveButtonText}>Mark as Resolved</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={actionLoading}
            >
              <Ionicons name="trash" size={20} color="#FF3B30" />
              <Text style={styles.deleteButtonText}>Delete Report</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Comments Section */}
        <View style={styles.section}>
          <View style={styles.commentsSectionHeader}>
            <Text style={styles.sectionTitle}>
              Comments ({comments.length})
            </Text>
            <TouchableOpacity
              style={styles.addCommentButton}
              onPress={() => setShowCommentInput(!showCommentInput)}
            >
              <Ionicons name="add" size={20} color="#007AFF" />
              <Text style={styles.addCommentButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* Comment Input */}
          {showCommentInput && (
            <View style={styles.commentInputContainer}>
              <Controller
                control={control}
                rules={{
                  required: 'Comment is required',
                  minLength: { value: 2, message: 'Comment too short' },
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Write a comment..."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={3}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
                name="comment"
              />
              {errors.comment && (
                <Text style={styles.errorText}>{errors.comment.message}</Text>
              )}
              <View style={styles.commentInputActions}>
                <TouchableOpacity
                  style={styles.cancelCommentButton}
                  onPress={() => {
                    setShowCommentInput(false);
                    reset();
                  }}
                >
                  <Text style={styles.cancelCommentButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitCommentButton}
                  onPress={handleSubmit(onSubmitComment)}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitCommentButtonText}>Post</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Comments List */}
          {commentsLoading ? (
            <View style={styles.commentsLoading}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.noComments}>
              <Ionicons name="chatbubble-outline" size={48} color="#ccc" />
              <Text style={styles.noCommentsText}>No comments yet</Text>
              <Text style={styles.noCommentsSubtext}>
                Be the first to comment
              </Text>
            </View>
          ) : (
            <View style={styles.commentsList}>
              {comments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

// Comment Item Component
function CommentItem({ comment }: { comment: Comment }) {
  const getRelativeTime = (timestamp: any): string => {
    const now = new Date();
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <View style={styles.commentItem}>
      <View style={styles.commentAvatar}>
        <Ionicons name="person" size={20} color="#666" />
      </View>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentAuthor}>User</Text>
          <Text style={styles.commentTime}>
            {getRelativeTime(comment.createdAt)}
          </Text>
        </View>
        <Text style={styles.commentText}>{comment.content}</Text>
      </View>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  photoWrapper: {
  width: 300,
  height: 200,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#111', // fallback color
},
  content: {
    paddingBottom: 40,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  typeHeader: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  typeHeaderText: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  reportDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  statusBadgeContainer: {
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeOpen: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  statusBadgeResolved: {
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  photosCarousel: {
    height: 300,
  },
  photo: {
    width: width,
    height: 300,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  metadataGrid: {
    gap: 12,
  },
  metadataItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  metadataLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  metadataValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  coordinates: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E5EA',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  actionButtonTextActive: {
    color: '#fff',
  },
  ownerActions: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
    gap: 12,
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
  },
  resolveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  commentsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addCommentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  addCommentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  commentInputContainer: {
    marginBottom: 16,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: '#F9F9F9',
  },
  commentInputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  cancelCommentButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  cancelCommentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  submitCommentButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  submitCommentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  commentsLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noComments: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noCommentsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  noCommentsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  commentsList: {
    gap: 16,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  navigateButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  marginTop: 16,
  marginHorizontal: 20,
  backgroundColor: '#007AFF',
  paddingVertical: 14,
  borderRadius: 12,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 3,
  elevation: 3,
},
navigateButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
},
backFloatingButton: {
  position: 'absolute',
  top: 60,
  left: 20,
  zIndex: 10,
  backgroundColor: 'rgba(255,255,255,0.9)',
  borderRadius: 30,
  padding: 8,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 3,
  elevation: 3,
},
});