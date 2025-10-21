import * as ImageManipulator from 'expo-image-manipulator';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase/config';

const compressImage = async (uri: string): Promise<Blob> => {
  // Resize and compress
  const manipulatedImage = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1080 } }], 
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG } 
  );

  // Convert to blob
  const response = await fetch(manipulatedImage.uri);
  const blob = await response.blob();
  return blob;
};

export const uploadProfilePhoto = async (
  photoUri: string,
  userId: string
): Promise<string> => {
  try {
    const filename = `profiles/${userId}.jpg`;
    const storageRef = ref(storage, filename);

    const blob = await compressImage(photoUri);

    await uploadBytes(storageRef, blob);

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log('Profile photo uploaded successfully');
    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    throw new Error('Failed to upload profile photo');
  }
};

export const uploadReportPhotos = async (photoUris: string[]): Promise<string[]> => {
  try {
    const uploadPromises = photoUris.map(async (uri, index) => {
      // Create unique filename
      const timestamp = Date.now();
      const filename = `reports/${timestamp}_${index}.jpg`;
      const storageRef = ref(storage, filename);

      const blob = await compressImage(uri);

      await uploadBytes(storageRef, blob);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    });

    const downloadURLs = await Promise.all(uploadPromises);
    console.log('Report photos uploaded successfully');
    return downloadURLs;
  } catch (error) {
    console.error('Error uploading report photos:', error);
    throw new Error('Failed to upload photos');
  }
};

export const deletePhoto = async (photoUrl: string): Promise<void> => {
  try {
    const photoRef = ref(storage, photoUrl);
    await deleteObject(photoRef);
    console.log('Photo deleted successfully');
  } catch (error) {
    console.error('Error deleting photo:', error);
    throw new Error('Failed to delete photo');
  }
};

export const deletePhotos = async (photoUrls: string[]): Promise<void> => {
  try {
    const deletePromises = photoUrls.map((url) => deletePhoto(url));
    await Promise.all(deletePromises);
    console.log('Photos deleted successfully');
  } catch (error) {
    console.error('Error deleting photos:', error);
    throw new Error('Failed to delete photos');
  }
};