import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { getUserProfile } from "../../services/auth";
import {
  createPostComment,
  deletePost,
  deletePostComment,
  likePost,
  Post,
  PostComment,
  subscribeToPost,
  subscribeToPostComments,
  unlikePost,
} from "../../services/feedService";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(0);

  useEffect(() => {
    const unsubscribePost = subscribeToPost(id as string, (postData) => {
      setPost(postData);
      if (postData) {
        setLocalLikes(postData.likes);
        checkIfLiked(postData);
      }
      setLoading(false);
    });

    const unsubscribeComments = subscribeToPostComments(
      id as string,
      setComments
    );

    return () => {
      unsubscribePost();
      unsubscribeComments();
    };
  }, [id]);

  const checkIfLiked = (postData: Post) => {
    if (user && postData.likedBy) {
      setHasLiked(postData.likedBy.includes(user.uid));
    }
  };

  const handleLike = async () => {
    if (!user || !post) {
      Alert.alert("Sign In Required", "Please sign in to like posts.");
      return;
    }

    try {
      if (hasLiked) {
        await unlikePost(post.id, user.uid);
        setHasLiked(false);
        setLocalLikes((prev) => prev - 1);
      } else {
        await likePost(post.id, user.uid);
        setHasLiked(true);
        setLocalLikes((prev) => prev + 1);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
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
      await createPostComment({
        postId: id as string,
        userId: user.uid,
        content: commentText.trim(),
      });
      setCommentText("");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeletePost = async () => {
    if (!user || !post) return;

    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePost(post.id, user.uid);
            Alert.alert("Success", "Post deleted", [
              { text: "OK", onPress: () => router.back() },
            ]);
          } catch (error: any) {
            Alert.alert("Error", error.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorText}>Post not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/feed")} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        {user && post.userId === user.uid && (
          <TouchableOpacity onPress={handleDeletePost}>
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <PostDetailCard
            post={post}
            hasLiked={hasLiked}
            localLikes={localLikes}
            onLike={handleLike}
          />
        }
        renderItem={({ item }) => <CommentCard comment={item} postId={post.id} />}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <View style={styles.emptyComments}>
            <Text style={styles.emptyCommentsText}>No comments yet</Text>
            <Text style={styles.emptyCommentsSubtext}>
              Be the first to comment!
            </Text>
          </View>
        }
      />

      {/* Comment Input */}
      <View style={styles.commentInputContainer}>
        <TextInput
          style={styles.commentInput}
          placeholder="Write a comment..."
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !commentText.trim() && styles.sendButtonDisabled,
          ]}
          onPress={handleSubmitComment}
          disabled={submittingComment || !commentText.trim()}
        >
          {submittingComment ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// Post Detail Card Component
interface PostDetailCardProps {
  post: Post;
  hasLiked: boolean;
  localLikes: number;
  onLike: () => void;
}
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

function PostDetailCard({
  post,
  hasLiked,
  localLikes,
  onLike,
}: PostDetailCardProps) {
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    fetchUserProfile();
  }, [post.userId]);

  const fetchUserProfile = async () => {
    if (post.userId) {
      const profile = await getUserProfile(post.userId);
      setUserProfile(profile);
    }
  };



  return (
    <View style={styles.postCard}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <View style={styles.avatar}>
          {userProfile?.photoUrl ? (
            <Image
              source={{ uri: userProfile.photoUrl }}
              style={styles.avatarImage}
            />
          ) : (
            <Ionicons name="person" size={24} color="#666" />
          )}
        </View>
        <View>
          <Text style={styles.postAuthor}>{userProfile?.name || "User"}</Text>
          <Text style={styles.postTime}>{getTimeAgo(post.createdAt)}</Text>
        </View>
      </View>

      {/* Post Content */}
      <Text style={styles.postContent}>{post.content}</Text>

      {/* Post Photos */}
      {post.photos && post.photos.length > 0 && (
        <View style={styles.postPhotosContainer}>
          {post.photos.map((photo, index) => (
            <Image
              key={index}
              source={{ uri: photo }}
              style={styles.postPhoto}
            />
          ))}
        </View>
      )}

      {/* Post Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionButton} onPress={onLike}>
          <Ionicons
            name={hasLiked ? "heart" : "heart-outline"}
            size={28}
            color={hasLiked ? "#FF3B30" : "#666"}
          />
          <Text
            style={[styles.actionText, hasLiked && styles.actionTextActive]}
          >
            {localLikes}
          </Text>
        </TouchableOpacity>

        <View style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={28} color="#666" />
          <Text style={styles.actionText}>{post.commentCount || 0}</Text>
        </View>
      </View>

      <View style={styles.commentsDivider}>
        <Text style={styles.commentsTitle}>Comments</Text>
      </View>
    </View>
  );
}

// Comment Card Component
interface CommentCardProps {
  comment: PostComment;
  postId: string;
}

function CommentCard({ comment, postId }: CommentCardProps) {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    fetchUserProfile();
  }, [comment.userId]);

  const fetchUserProfile = async () => {
    if (comment.userId) {
      const profile = await getUserProfile(comment.userId);
      setUserProfile(profile);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (user) {
                await deletePostComment(comment.id, postId, user.uid);
              }
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.commentCard}>
      <View style={styles.commentHeader}>
        <View style={styles.commentHeaderLeft}>
          <View style={styles.commentAvatar}>
            {userProfile?.photoUrl ? (
              <Image
                source={{ uri: userProfile.photoUrl }}
                style={styles.commentAvatarImage}
              />
            ) : (
              <Ionicons name="person" size={16} color="#666" />
            )}
          </View>
          <View>
            <Text style={styles.commentAuthor}>
              {userProfile?.name || "User"}
            </Text>
            <Text style={styles.commentTime}>{getTimeAgo(comment.createdAt)}</Text>
          </View>
        </View>
        {user && comment.userId === user.uid && (
          <TouchableOpacity onPress={() => setShowMenu(!showMenu)}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {showMenu && (
        <View style={styles.commentMenu}>
          <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            <Text style={styles.menuItemTextDelete}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

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
  errorText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
  },
  backButton: {
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
    paddingBottom: 20,
  },
  postCard: {
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 8,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  postAuthor: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  postTime: {
    fontSize: 13,
    color: "#666",
  },
  postContent: {
    fontSize: 16,
    color: "#000",
    lineHeight: 22,
    marginBottom: 16,
  },
  postPhotosContainer: {
    marginBottom: 16,
    gap: 8,
  },
  postPhoto: {
    width: "100%",
    height: 300,
    borderRadius: 12,
  },
  postActions: {
    flexDirection: "row",
    gap: 32,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  actionTextActive: {
    color: "#FF3B30",
  },
  commentsDivider: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },
  emptyComments: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: "#fff",
  },
  emptyCommentsText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
  },
  commentCard: {
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 1,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  commentHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center",
  },
  commentAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  commentTime: {
    fontSize: 12,
    color: "#666",
  },
  commentMenu: {
    position: "absolute",
    top: 40,
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
    fontSize: 14,
    color: "#FF3B30",
    fontWeight: "500",
  },
  commentContent: {
    fontSize: 15,
    color: "#000",
    lineHeight: 20,
  },
  commentInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
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
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});