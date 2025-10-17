import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import {
  signOut
} from '../../services/auth';

export default function ProfileScreen() {
  const { user, userProfile, isAuthenticated, isLoggedIn } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [showLinkAccount, setShowLinkAccount] = useState(false);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/(auth)/signIn');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

//   const handleDeleteAccount = () => {
//     Alert.alert(
//       'Delete Account',
//       'This action cannot be undone. All your data will be permanently deleted.',
//       [
//         { text: 'Cancel', style: 'cancel' },
//         {
//           text: 'Delete',
//           style: 'destructive',
//           onPress: async () => {
//             try {
//               setLoading(true);
//               await deleteAccount();
//               router.replace('/(auth)/signIn');
//             } catch (error: any) {
//               Alert.alert('Error', error.message);
//             } finally {
//               setLoading(false);
//             }
//           },
//         },
//       ]
//     );
//   };

//   const handleSendVerification = async () => {
//     try {
//       setLoading(true);
//       await sendVerificationEmail();
//       Alert.alert('Success', 'Verification email sent! Please check your inbox.');
//     } catch (error: any) {
//       Alert.alert('Error', error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const toggleNotifications = async (value: boolean) => {
//     try {
//       if (!user) return;
//       await updateUserProfile(user.uid, {
//         settings: {
//           ...userProfile?.settings,
//           notificationsEnabled: value,
//         },
//       });
//     } catch (error: any) {
//       Alert.alert('Error', error.message);
//     }
//   };

//   const toggleEmailNotifications = async (value: boolean) => {
//     try {
//       if (!user) return;
//       await updateUserProfile(user.uid, {
//         settings: {
//           ...userProfile?.settings,
//           emailNotifications: value,
//         },
//       });
//     } catch (error: any) {
//       Alert.alert('Error', error.message);
//     }
//   };

  if (!isAuthenticated || !user ) {
    return (
      <View style={styles.container}>
        <Text>Please sign in</Text>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(auth)/signIn')}>
              <Text style={styles.backButtonText}>Sign in</Text>
            </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView  contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {user.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={48} color="#fff" />
            </View>
          )}
          <TouchableOpacity
            style={styles.editAvatarButton}
            onPress={() => setShowEditProfile(true)}
          >
            <Ionicons name="camera" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={styles.name}>{userProfile?.name || 'User'}</Text>
        {user.email && <Text style={styles.email}>{user.email}</Text>}

        {user.isAnonymous && (
          <TouchableOpacity
            style={styles.linkAccountBadge}
            onPress={() => setShowLinkAccount(true)}
          >
            <Ionicons name="link" size={16} color="#FF9500" />
            <Text style={styles.linkAccountText}>Link Account</Text>
          </TouchableOpacity>
        )}

        {!user.emailVerified && !user.isAnonymous && (
          <TouchableOpacity
            style={styles.verifyBadge}
            disabled={loading}
          >
            <Ionicons name="alert-circle" size={16} color="#FF3B30" />
            <Text style={styles.verifyText}>Verify Email</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>
            {userProfile?.createdReports?.length || 0}
          </Text>
          <Text style={styles.statLabel}>Reports</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>
            {userProfile?.trackedReports?.length || 0}
          </Text>
          <Text style={styles.statLabel}>Tracking</Text>
        </View>
      </View>

      {/* Account Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setShowEditProfile(true)}
        >
          <View style={styles.menuItemLeft}>
            <Ionicons name="person-outline" size={24} color="#007AFF" />
            <Text style={styles.menuItemText}>Edit Profile</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        {!user.isAnonymous && (
          <>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowChangeEmail(true)}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="mail-outline" size={24} color="#007AFF" />
                <Text style={styles.menuItemText}>Change Email</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowChangePassword(true)}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="lock-closed-outline" size={24} color="#007AFF" />
                <Text style={styles.menuItemText}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Notification Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="notifications-outline" size={24} color="#007AFF" />
            <Text style={styles.menuItemText}>Push Notifications</Text>
          </View>
          <Switch
            value={userProfile?.settings?.notificationsEnabled ?? true}
            trackColor={{ false: '#E5E5EA', true: '#34C759' }}
            thumbColor="#fff"
          />
        </View>

        {!user.isAnonymous && (
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="mail-outline" size={24} color="#007AFF" />
              <Text style={styles.menuItemText}>Email Notifications</Text>
            </View>
            <Switch
              value={userProfile?.settings?.emailNotifications ?? true}
             
              trackColor={{ false: '#E5E5EA', true: '#34C759' }}
              thumbColor="#fff"
            />
          </View>
        )}

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="location-outline" size={24} color="#007AFF" />
            <Text style={styles.menuItemText}>Alert Radius</Text>
          </View>
          <View style={styles.menuItemRight}>
            <Text style={styles.menuItemValue}>
              {userProfile?.settings?.alertRadius || 5} km
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </View>
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="information-circle-outline" size={24} color="#007AFF" />
            <Text style={styles.menuItemText}>Privacy Policy</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="document-text-outline" size={24} color="#007AFF" />
            <Text style={styles.menuItemText}>Terms of Service</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="help-circle-outline" size={24} color="#007AFF" />
            <Text style={styles.menuItemText}>Help & Support</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.button, styles.signOutButton]}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={() => Alert.alert('Notice', 'Account deletion is currently disabled.')}
        >
          <Text style={styles.deleteButtonText}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <EditProfileModal
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        currentName={userProfile?.name || ''}
      />

      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      <ChangeEmailModal
        visible={showChangeEmail}
        onClose={() => setShowChangeEmail(false)}
        currentEmail={user.email || ''}
      />

      <LinkAccountModal
        visible={showLinkAccount}
        onClose={() => setShowLinkAccount(false)}
      />
    </ScrollView>
  );
}

// ============================================
// Edit Profile Modal
// ============================================
interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  currentName: string;
}

function EditProfileModal({ visible, onClose, currentName }: EditProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { name: currentName },
  });

  const onSubmit = async (data: { name: string }) => {
    try {
      setLoading(true);
    //   await updateUserDisplayProfile({ name: data.name });
      Alert.alert('Success', 'Profile updated successfully');
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.label}>Full Name</Text>
            <Controller
              control={control}
              rules={{
                required: 'Name is required',
                minLength: { value: 2, message: 'Name must be at least 2 characters' },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  placeholder="Enter your name"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="name"
            />
            {errors.name && (
              <Text style={styles.errorText}>{errors.name.message}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// Change Password Modal
// ============================================
interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

function ChangePasswordModal({ visible, onClose }: ChangePasswordModalProps) {
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPassword = watch('newPassword');

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);
    //   await changePassword({
    //     currentPassword: data.currentPassword,
    //     newPassword: data.newPassword,
    //   });
      Alert.alert('Success', 'Password changed successfully');
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.label}>Current Password</Text>
            <Controller
              control={control}
              rules={{ required: 'Current password is required' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.currentPassword && styles.inputError]}
                  placeholder="Enter current password"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="currentPassword"
            />
            {errors.currentPassword && (
              <Text style={styles.errorText}>{errors.currentPassword.message}</Text>
            )}

            <Text style={[styles.label, { marginTop: 16 }]}>New Password</Text>
            <Controller
              control={control}
              rules={{
                required: 'New password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.newPassword && styles.inputError]}
                  placeholder="Enter new password"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="newPassword"
            />
            {errors.newPassword && (
              <Text style={styles.errorText}>{errors.newPassword.message}</Text>
            )}

            <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password</Text>
            <Controller
              control={control}
              rules={{
                required: 'Please confirm your password',
                validate: (value) => value === newPassword || 'Passwords do not match',
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.confirmPassword && styles.inputError]}
                  placeholder="Confirm new password"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="confirmPassword"
            />
            {errors.confirmPassword && (
              <Text style={styles.errorText}>{errors.confirmPassword.message}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Change Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// Change Email Modal
// ============================================
interface ChangeEmailModalProps {
  visible: boolean;
  onClose: () => void;
  currentEmail: string;
}

function ChangeEmailModal({ visible, onClose, currentEmail }: ChangeEmailModalProps) {
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      newEmail: '',
      password: '',
    },
  });

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);
    //   await changeEmail({
    //     newEmail: data.newEmail,
    //     currentPassword: data.password,
    //   });
      Alert.alert('Success', 'Email changed successfully. Please verify your new email.');
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Email</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.label}>Current Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: '#f5f5f5' }]}
              value={currentEmail}
              editable={false}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>New Email</Text>
            <Controller
              control={control}
              rules={{
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.newEmail && styles.inputError]}
                  placeholder="Enter new email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="newEmail"
            />
            {errors.newEmail && (
              <Text style={styles.errorText}>{errors.newEmail.message}</Text>
            )}

            <Text style={[styles.label, { marginTop: 16 }]}>Current Password</Text>
            <Controller
              control={control}
              rules={{ required: 'Password is required' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  placeholder="Confirm with password"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="password"
            />
            {errors.password && (
              <Text style={styles.errorText}>{errors.password.message}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Change Email</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// Link Account Modal (for anonymous users)
// ============================================
interface LinkAccountModalProps {
  visible: boolean;
  onClose: () => void;
}

function LinkAccountModal({ visible, onClose }: LinkAccountModalProps) {
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password');

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);
    //   await linkAnonymousWithEmail({
    //     email: data.email,
    //     password: data.password,
    //     name: data.name,
    //   });
      Alert.alert('Success', 'Account linked successfully! Please verify your email.');
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Link Your Account</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.modalDescription}>
              Create a permanent account to save your data across devices
            </Text>

            <Text style={styles.label}>Full Name</Text>
            <Controller
              control={control}
              rules={{ required: 'Name is required' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  placeholder="Enter your name"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="name"
            />
            {errors.name && (
              <Text style={styles.errorText}>{errors.name.message}</Text>
            )}

            <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
            <Controller
              control={control}
              rules={{
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="your@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="email"
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email.message}</Text>
            )}

            <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
            <Controller
              control={control}
              rules={{
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  placeholder="Minimum 6 characters"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="password"
            />
            {errors.password && (
              <Text style={styles.errorText}>{errors.password.message}</Text>
            )}

            <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password</Text>
            <Controller
              control={control}
              rules={{
                required: 'Please confirm your password',
                validate: (value) => value === password || 'Passwords do not match',
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.confirmPassword && styles.inputError]}
                  placeholder="Re-enter password"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="confirmPassword"
            />
            {errors.confirmPassword && (
              <Text style={styles.errorText}>{errors.confirmPassword.message}</Text>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Link Account</Text>
            )}
          </TouchableOpacity>
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
    backgroundColor: '#f5f5f5',
    alignItems: "center",
    justifyContent: "center",
  },
    backButton: {
        margin: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    paddingBottom: 40,
    // paddingTop: 40,
  },
  header: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  verifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  verifyText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '600',
  },
  linkAccountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  linkAccountText: {
    color: '#FF9500',
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 20,
    marginTop: 1,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E5EA',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginTop: 20,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemText: {
    fontSize: 16,
    color: '#000',
  },
  menuItemValue: {
    fontSize: 16,
    color: '#666',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
    marginHorizontal: 16,
  },
  signOutButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF3B30',
    marginHorizontal: 16,
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputError: {
    borderColor: '#ff3b30',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 12,
    marginTop: 4,
  },
});