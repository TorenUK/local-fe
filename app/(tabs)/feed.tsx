import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { getUserProfile } from "../../services/auth";
import {
    createPost,
    deletePost,
    likePost,
    Post,
    subscribeToFeed,
    unlikePost
} from "../../services/feedService";
import { uploadPostPhotos } from "../../services/storageService";

export default function FeedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToFeed((feedPosts) => {
      setPosts(feedPosts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    // The subscription will automatically update the posts
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleCreatePost = () => {
    if (user?.isAnonymous) {
      Alert.alert(
        "Create Account",
        "Please create an account to post.",
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
    setShowCreateModal(true);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community Feed</Text>
        <TouchableOpacity onPress={handleCreatePost}>
          <Ionicons name="add-circle" size={32} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Anonymous Banner */}
      {user?.isAnonymous && (
        <View style={styles.anonymousBanner}>
          <Ionicons name="information-circle" size={20} color="#FF9500" />
          <Text style={styles.anonymousBannerText}>
            Viewing as guest • Create account to post
          </Text>
        </View>
      )}

      {/* Feed */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={styles.feedContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>No posts yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Be the first to share with your community!
            </Text>
          </View>
        }
      />

      {/* Create Post Modal */}
      <CreatePostModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={() => setShowCreateModal(false)}
      />
    </View>
  );
}

// Post Card Component
interface PostCardProps {
  post: Post;
}

function PostCard({ post }: PostCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [hasLiked, setHasLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(post.likes || 0);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    fetchUserProfile();
    checkIfLiked();
  }, [post.userId]);

  const fetchUserProfile = async () => {
    if (post.userId) {
      const profile = await getUserProfile(post.userId);
      setUserProfile(profile);
    }
  };

  const checkIfLiked = () => {
    if (user && post.likedBy) {
      setHasLiked(post.likedBy.includes(user.uid));
    }
  };

  const handleLike = async () => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to like posts.");
      return;
    }

    try {
      if (hasLiked) {
        await unlikePost(post.id, user.uid);
        setHasLiked(false);
        setLocalLikes(prev => prev - 1);
      } else {
        await likePost(post.id, user.uid);
        setHasLiked(true);
        setLocalLikes(prev => prev + 1);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (user) {
                await deletePost(post.id, user.uid);
                Alert.alert("Success", "Post deleted");
              }
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  const getTimeAgo = (timestamp: any) => {

    if (!timestamp) return "";
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.postCard}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <View style={styles.postHeaderLeft}>
          <View style={styles.avatar}>
            {userProfile?.photoUrl ? (
              <Image source={{ uri: userProfile.photoUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={20} color="#666" />
            )}
          </View>
          <View>
            <Text style={styles.postAuthor}>
              {userProfile?.name || "User"}
            </Text>
            <Text style={styles.postTime}>{getTimeAgo(post.createdAt)}</Text>
          </View>
        </View>
        {user && post.userId === user.uid && (
          <TouchableOpacity onPress={() => setShowMenu(!showMenu)}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Menu */}
      {showMenu && (
        <View style={styles.postMenu}>
          <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={styles.menuItemTextDelete}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Post Content */}
      <Text style={styles.postContent}>{post.content}</Text>

      {/* Post Photos */}
      {post.photos && post.photos.length > 0 && (
        <View style={styles.postPhotosContainer}>
          {post.photos.length === 1 ? (
            <Image source={{ uri: post.photos[0] }} style={styles.postPhotoSingle} />
          ) : (
            <View style={styles.postPhotosGrid}>
              {post.photos.slice(0, 4).map((photo, index) => (
                <View key={index} style={styles.postPhotoGridItem}>
                  <Image source={{ uri: photo }} style={styles.postPhotoGrid} />
                  {index === 3 && post.photos!.length > 4 && (
                    <View style={styles.photoOverlay}>
                      <Text style={styles.photoOverlayText}>
                        +{post.photos!.length - 4}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Post Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Ionicons
            name={hasLiked ? "heart" : "heart-outline"}
            size={24}
            color={hasLiked ? "#FF3B30" : "#666"}
          />
          <Text style={[styles.actionText, hasLiked && styles.actionTextActive]}>
            {localLikes}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            router.push({
              pathname: "/post/[id]",
              params: { id: post.id },
            })
          }
        >
          <Ionicons name="chatbubble-outline" size={24} color="#666" />
          <Text style={styles.actionText}>{post.commentCount || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Create Post Modal
interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

function CreatePostModal({ visible, onClose, onPostCreated }: CreatePostModalProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handlePickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 4 - photos.length,
        quality: 0.8,
      });

      if (!result.canceled) {
        const newPhotos = result.assets.map((asset) => asset.uri);
        setPhotos([...photos, ...newPhotos].slice(0, 4));
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleTakePhoto = async () => {
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
      setPhotos([...photos, result.assets[0].uri].slice(0, 4));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim() && photos.length === 0) {
      Alert.alert("Error", "Please add some content or photos");
      return;
    }

    if (!user) {
      Alert.alert("Error", "You must be signed in");
      return;
    }

    try {
      setLoading(true);
      let photoUrls: string[] = [];

      if (photos.length > 0) {
        photoUrls = await uploadPostPhotos(photos, user.uid);
      }

      await createPost(user.uid, {
        content: content.trim(),
        photos: photoUrls,
      });

      Alert.alert("Success", "Post created!");
      setContent("");
      setPhotos([]);
      onPostCreated();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
  <KeyboardAvoidingView
    behavior={Platform.OS === "ios" ? "padding" : "height"}
    style={styles.modalOverlay}
  >
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.createModalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Create Post</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color="#000" />
          </TouchableOpacity>
        </View>

        <View style={styles.modalBody}>
          <TextInput
            style={styles.postInput}
            placeholder="What's on your mind?"
            multiline
            value={content}
            onChangeText={setContent}
            maxLength={1000}
          />

          {photos.length > 0 && (
            <View style={styles.selectedPhotos}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.selectedPhotoItem}>
                  <Image source={{ uri: photo }} style={styles.selectedPhoto} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.postActions}>
            <TouchableOpacity
              style={styles.mediaButton}
              onPress={handlePickImages}
              disabled={photos.length >= 4}
            >
              <Ionicons name="images-outline" size={24} color="#007AFF" />
              <Text style={styles.mediaButtonText}>Photos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mediaButton}
              onPress={handleTakePhoto}
              disabled={photos.length >= 4}
            >
              <Ionicons name="camera-outline" size={24} color="#007AFF" />
              <Text style={styles.mediaButtonText}>Camera</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (!content.trim() && photos.length === 0) &&
                styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading || (!content.trim() && photos.length === 0)}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>
</Modal>

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
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
  },
  anonymousBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 149, 0, 0.95)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  anonymousBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
  },
  feedContent: {
    paddingVertical: 8,
  },
  scrollContent: {
  flexGrow: 1,
  justifyContent: "flex-end",
},
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
    textAlign: "center",
  },
  postCard: {
    backgroundColor: "#fff",
    marginBottom: 8,
    padding: 16,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  postHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postAuthor: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
  postTime: {
    fontSize: 13,
    color: "#666",
  },
  postMenu: {
    position: "absolute",
    top: 50,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
  },
  menuItemTextDelete: {
    fontSize: 15,
    color: "#FF3B30",
    fontWeight: "500",
  },
  postContent: {
    fontSize: 16,
    color: "#000",
    lineHeight: 22,
    marginBottom: 12,
  },
  postPhotosContainer: {
    marginBottom: 12,
  },
  postPhotoSingle: {
    width: "100%",
    height: 300,
    borderRadius: 12,
  },
  postPhotosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  postPhotoGridItem: {
    width: "49%",
    height: 150,
    position: "relative",
  },
  postPhotoGrid: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  photoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  photoOverlayText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  postActions: {
    flexDirection: "row",
    gap: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  actionTextActive: {
    color: "#FF3B30",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  createModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
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
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  modalBody: {
    padding: 24,
  },
  postInput: {
    fontSize: 16,
    color: "#000",
    minHeight: 150,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  selectedPhotos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  selectedPhotoItem: {
    position: "relative",
  },
  selectedPhoto: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: "absolute",
    top: -8,
    right: -8,
  },
  mediaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  mediaButtonText: {
    fontSize: 15,
    color: "#007AFF",
    fontWeight: "500",
  },
  submitButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    marginHorizontal: 24,
    marginBottom: 40,
    borderRadius: 12,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});