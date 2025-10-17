import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase/config';

/**
 * Upload photos for a report
 */
export const uploadReportPhotos = async (photoUris: string[]): Promise<string[]> => {
  try {
    const uploadPromises = photoUris.map(async (uri, index) => {
      // Create unique filename
      const timestamp = Date.now();
      const filename = `reports/${timestamp}_${index}.jpg`;
      const storageRef = ref(storage, filename);

      // Convert URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to Firebase Storage
      await uploadBytes(storageRef, blob);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    });

    const downloadURLs = await Promise.all(uploadPromises);
    console.log('Photos uploaded successfully');
    return downloadURLs;
  } catch (error) {
    console.error('Error uploading photos:', error);
    throw error;
  }
};

/**
 * Upload profile photo
 */
export const uploadProfilePhoto = async (photoUri: string, userId: string): Promise<string> => {
  try {
    const filename = `profiles/${userId}.jpg`;
    const storageRef = ref(storage, filename);

    const response = await fetch(photoUri);
    const blob = await response.blob();

    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);

    console.log('Profile photo uploaded successfully');
    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    throw error;
  }
};
