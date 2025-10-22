import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import {
  deleteAccount as authDeleteAccount,
  signOut as authSignOut,
  changeEmail,
  changePassword,
  getUserProfile,
  linkAnonymousWithEmail,
  sendVerificationEmail,
  updateUserDisplayProfile,
  updateUserProfile,
} from '../../services/auth';
import { uploadProfilePhoto } from '../../services/storageService';

export default function ProfileScreen() {
  const { user, userProfile: contextUserProfile, isAuthenticated } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [localUserProfile, setLocalUserProfile] = useState(contextUserProfile);

  const colorScheme = useColorScheme(); 
  const backgroundColor = colorScheme === 'dark' ? '#000' : '#fff';

  // Modal states
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [showLinkAccount, setShowLinkAccount] = useState(false);

  // Fetch fresh user profile data
  const fetchUserProfile = async () => {
    if (!user) return;
    
    try {
      const freshProfile = await getUserProfile(user.uid);
      setLocalUserProfile(freshProfile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  // Update local profile when context changes
  useEffect(() => {
    setLocalUserProfile(contextUserProfile);
  }, [contextUserProfile]);

  // Refresh profile on screen focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchUserProfile();
      }
    }, [user])
  );

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserProfile();
    setRefreshing(false);
  };

  const signOutHandler = async () => {
    try {
      await authSignOut();
      router.replace('/(auth)/signIn');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            void signOutHandler();
          },
        },
      ]
    );
  };

  const deleteAccountHandler = async () => {
    try {
      setLoading(true);
      await authDeleteAccount(undefined);
      router.replace('/(auth)/signIn');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteAccountHandler();
          },
        },
      ]
    );
  };

  const handleSendVerification = async () => {
    try {
      setLoading(true);
      await sendVerificationEmail();
      Alert.alert('Success', 'Verification email sent! Please check your inbox.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeProfilePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera roll permission is required.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets?.[0]?.uri && user) {
        setLoading(true);
        const photoUrl = await uploadProfilePhoto(result.assets[0].uri, user.uid);
        await updateUserDisplayProfile({ photoUrl });
        Alert.alert('Success', 'Profile photo updated!');
        await fetchUserProfile();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleNotifications = async (value: boolean) => {
    try {
      if (!user) return;
      await updateUserProfile(user.uid, {
        settings: {
          ...localUserProfile?.settings,
          notificationsEnabled: value,
          emailNotifications: localUserProfile?.settings?.emailNotifications ?? true,
          alertRadius: localUserProfile?.settings?.alertRadius ?? 5,
        },
      });
      await fetchUserProfile();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const toggleEmailNotifications = async (value: boolean) => {
    try {
      if (!user) return;
      await updateUserProfile(user.uid, {
        settings: {
          ...localUserProfile?.settings,
          emailNotifications: value,
          alertRadius: localUserProfile?.settings?.alertRadius ?? 5,
          notificationsEnabled: localUserProfile?.settings?.notificationsEnabled ?? true,
        },
      });
      await fetchUserProfile();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleSaveRadius = async (value?: string) => {
    if (!user || !localUserProfile) return;
    const radius = parseInt(value ?? String(localUserProfile?.settings?.alertRadius ?? 5), 10);
    if (isNaN(radius) || radius < 1 || radius > 50) {
      Alert.alert('Error', 'Please enter a number between 1 and 50');
      return;
    }
    try {
      await updateUserProfile(user.uid, {
        settings: {
          ...localUserProfile?.settings,
          notificationsEnabled: localUserProfile?.settings?.notificationsEnabled ?? true,
          emailNotifications: localUserProfile?.settings?.emailNotifications ?? true,
          alertRadius: radius,
        },
      });
      Alert.alert('Success', `Alert radius set to ${radius}km`);
      await fetchUserProfile();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleAlertRadiusChange = () => {
    if (!user || !localUserProfile) return;

    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Alert Radius',
        'Enter your preferred alert radius in kilometers (1-50)',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: (value?: string) => {
              void handleSaveRadius(value);
            },
          },
        ],
        'plain-text',
        String(localUserProfile?.settings?.alertRadius ?? 5)
      );
    } else {
      Alert.alert(
        'Change Alert Radius',
        'Changing alert radius is currently supported on iOS via a prompt. On Android please use the settings screen (or implement a custom modal).',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <View style={styles.container}>
        <Ionicons name="person-circle-outline" size={80} color="#ccc" />
        <Text style={styles.signInPromptText}>Please sign in to view your profile</Text>
        <TouchableOpacity
          style={styles.signInButton}
          onPress={() => router.push('/(auth)/signIn')}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
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
            onPress={handleChangeProfilePhoto}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.name}>{localUserProfile?.name || user.displayName || 'User'}</Text>
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
            onPress={handleSendVerification}
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
            {localUserProfile?.createdReports?.length || 0}
          </Text>
          <Text style={styles.statLabel}>Reports</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>
            {localUserProfile?.trackedReports?.length || 0}
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
            value={localUserProfile?.settings?.notificationsEnabled ?? true}
            onValueChange={toggleNotifications}
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
              value={localUserProfile?.settings?.emailNotifications ?? true}
              onValueChange={toggleEmailNotifications}
              trackColor={{ false: '#E5E5EA', true: '#34C759' }}
              thumbColor="#fff"
            />
          </View>
        )}

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleAlertRadiusChange}
        >
          <View style={styles.menuItemLeft}>
            <Ionicons name="location-outline" size={24} color="#007AFF" />
            <Text style={styles.menuItemText}>Alert Radius</Text>
          </View>
          <View style={styles.menuItemRight}>
            <Text style={styles.menuItemValue}>
              {localUserProfile?.settings?.alertRadius ?? 5} km
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
          onPress={handleDeleteAccount}
        >
          <Text style={styles.deleteButtonText}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <EditProfileModal
        visible={showEditProfile}
        onClose={() => {
          setShowEditProfile(false);
          fetchUserProfile();
        }}
        currentName={localUserProfile?.name ?? ''}
      />

      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      <ChangeEmailModal
        visible={showChangeEmail}
        onClose={() => {
          setShowChangeEmail(false);
          fetchUserProfile();
        }}
        currentEmail={user.email ?? ''}
      />

      <LinkAccountModal
        visible={showLinkAccount}
        onClose={() => {
          setShowLinkAccount(false);
          fetchUserProfile();
        }}
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
  const { control, handleSubmit, formState: { errors }, reset } = useForm({
    defaultValues: { name: currentName },
  });

  useEffect(() => {
    if (visible) {
      reset({ name: currentName });
    }
  }, [visible, currentName]);

  const onSubmit = async (data: { name: string }) => {
    try {
      setLoading(true);
      await updateUserDisplayProfile({ name: data.name });
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
                  style={[styles.input, (errors as any).name && styles.inputError]}
                  placeholder="Enter your name"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="name"
            />
            {(errors as any).name && (
              <Text style={styles.errorText}>{(errors as any).name.message}</Text>
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
  const { control, handleSubmit, watch, formState: { errors }, reset } = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (visible) {
      reset({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }, [visible]);

  const newPassword = watch('newPassword');

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);
      await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
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

          <ScrollView style={styles.modalBody}>
            <Text style={styles.label}>Current Password</Text>
            <Controller
              control={control}
              rules={{ required: 'Current password is required' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, (errors as any).currentPassword && styles.inputError]}
                  placeholder="Enter current password"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="currentPassword"
            />
            {(errors as any).currentPassword && (
              <Text style={styles.errorText}>{(errors as any).currentPassword.message}</Text>
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
                  style={[styles.input, (errors as any).newPassword && styles.inputError]}
                  placeholder="Enter new password"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="newPassword"
            />
            {(errors as any).newPassword && (
              <Text style={styles.errorText}>{(errors as any).newPassword.message}</Text>
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
                  style={[styles.input, (errors as any).confirmPassword && styles.inputError]}
                  placeholder="Confirm new password"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="confirmPassword"
            />
            {(errors as any).confirmPassword && (
              <Text style={styles.errorText}>{(errors as any).confirmPassword.message}</Text>
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
  const { control, handleSubmit, formState: { errors }, reset } = useForm({
    defaultValues: {
      newEmail: '',
      password: '',
    },
  });

  useEffect(() => {
    if (visible) {
      reset({
        newEmail: '',
        password: '',
      });
    }
  }, [visible]);

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);
      await changeEmail({
        newEmail: data.newEmail,
        currentPassword: data.password,
      });
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
                  style={[styles.input, (errors as any).newEmail && styles.inputError]}
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
            {(errors as any).newEmail && (
              <Text style={styles.errorText}>{(errors as any).newEmail.message}</Text>
            )}

            <Text style={[styles.label, { marginTop: 16 }]}>Current Password</Text>
            <Controller
              control={control}
              rules={{ required: 'Password is required' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, (errors as any).password && styles.inputError]}
                  placeholder="Confirm with password"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="password"
            />
            {(errors as any).password && (
              <Text style={styles.errorText}>{(errors as any).password.message}</Text>
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
// Link Account Modal
// ============================================
interface LinkAccountModalProps {
  visible: boolean;
  onClose: () => void;
}

function LinkAccountModal({ visible, onClose }: LinkAccountModalProps) {
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, watch, formState: { errors }, reset } = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (visible) {
      reset({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
    }
  }, [visible]);

  const password = watch('password');

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);
      await linkAnonymousWithEmail({
        email: data.email,
        password: data.password,
        name: data.name,
      });
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
                  style={[styles.input, (errors as any).name && styles.inputError]}
                  placeholder="Enter your name"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="name"
            />
            {(errors as any).name && (
              <Text style={styles.errorText}>{(errors as any).name.message}</Text>
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
                  style={[styles.input, (errors as any).email && styles.inputError]}
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
            {(errors as any).email && (
              <Text style={styles.errorText}>{(errors as any).email.message}</Text>
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
                  style={[styles.input, (errors as any).password && styles.inputError]}
                  placeholder="Minimum 6 characters"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="password"
            />
            {(errors as any).password && (
              <Text style={styles.errorText}>{(errors as any).password.message}</Text>
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
                  style={[styles.input, (errors as any).confirmPassword && styles.inputError]}
                  placeholder="Re-enter password"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
              name="confirmPassword"
            />
            {(errors as any).confirmPassword && (
              <Text style={styles.errorText}>{(errors as any).confirmPassword.message}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  signInPromptText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  signInButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingBottom: 22,
    paddingTop: 60,
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
    paddingBottom: 16,
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
    marginHorizontal: 16,
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