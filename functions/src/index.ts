import { Expo, ExpoPushMessage } from "expo-server-sdk";
import * as admin from "firebase-admin";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { onSchedule } from "firebase-functions/v2/scheduler";

// ==========================================================
// INITIAL SETUP
// ==========================================================

setGlobalOptions({ maxInstances: 10, region: "europe-west2" });

admin.initializeApp();
const expo = new Expo();

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

// ==========================================================
// UTILITY FUNCTIONS
// ==========================================================

async function sendPushNotifications(
  userIds: string[],
  notification: NotificationPayload
): Promise<void> {
  try {
    const messages: ExpoPushMessage[] = [];

    const usersSnapshot = await admin
      .firestore()
      .collection("users")
      .where(admin.firestore.FieldPath.documentId(), "in", userIds)
      .get();

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      const pushTokens = userData.pushTokens || [];

      pushTokens.forEach((pushToken: string) => {
        if (!Expo.isExpoPushToken(pushToken)) {
          console.error(`Invalid Expo push token: ${pushToken}`);
          return;
        }

        messages.push({
          to: pushToken,
          sound: "default",
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          priority: "high",
        });
      });
    });

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("Error sending push notification chunk:", error);
      }
    }

    console.log(`Sent ${tickets.length} push notifications`);
  } catch (error) {
    console.error("Error in sendPushNotifications:", error);
    throw error;
  }
}

async function getUsersNearLocation(
  latitude: number,
  longitude: number,
  radiusKm: number
): Promise<string[]> {
  const usersSnapshot = await admin
    .firestore()
    .collection("users")
    .where("settings.notificationsEnabled", "==", true)
    .get();

  const nearbyUserIds: string[] = [];

  usersSnapshot.forEach((doc) => {
    const userData = doc.data();
    const userRadius = userData.settings?.alertRadius || 5;

    if (userRadius >= radiusKm) {
      nearbyUserIds.push(doc.id);
    }
  });

  return nearbyUserIds;
}

async function createNotificationDocument(
  userId: string,
  type: string,
  title: string,
  message: string,
  reportId?: string
): Promise<void> {
  await admin
    .firestore()
    .collection("notifications")
    .add({
      userId,
      type,
      title,
      message,
      reportId: reportId || null,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

// ==========================================================
// CLOUD FUNCTIONS
// ==========================================================

/**
 * Trigger: When a new report is created
 * Action: Notify nearby users
 */
export const onReportCreated = onDocumentCreated(
  "reports/{reportId}",
  async (event) => {
    try {
      const snapshot = event.data;
      if (!snapshot) return;

      const reportData = snapshot.data();
      const reportId = event.params.reportId;

      const nearbyUsers = await getUsersNearLocation(
        reportData.location.latitude,
        reportData.location.longitude,
        5
      );

      const usersToNotify = nearbyUsers.filter(
        (userId) => userId !== reportData.userId
      );

      if (usersToNotify.length === 0) {
        console.log("No users to notify");
        return;
      }

      // Define allowed report types
      type ReportType = "crime" | "lost_item" | "missing_pet" | "hazard";

      // Create a type-safe label map
      const typeLabels: Record<ReportType, string> = {
        crime: "Crime Report",
        lost_item: "Lost Item",
        missing_pet: "Missing Pet",
        hazard: "Hazard Alert",
      };

      // Safely access label, fallback to "New Report"
      const reportType = (reportData.type as ReportType) || "crime";
      const typeLabel = typeLabels[reportType] || "New Report";

      const notification: NotificationPayload = {
        title: `${typeLabel} Nearby`,
        body: reportData.description.substring(0, 100),
        data: {
          type: "nearby_alert",
          reportId,
          reportType: reportData.type,
        },
      };

      await sendPushNotifications(usersToNotify, notification);

      const notificationPromises = usersToNotify.map((userId) =>
        createNotificationDocument(
          userId,
          "nearby_alert",
          notification.title,
          notification.body,
          reportId
        )
      );

      await Promise.all(notificationPromises);

      console.log(`Notified ${usersToNotify.length} users about new report`);
    } catch (error) {
      console.error("Error in onReportCreated:", error);
    }
  }
);

/**
 * Trigger: When a comment is created
 * Action: Notify report creator & tracking users
 */
export const onCommentCreated = onDocumentCreated(
  "comments/{commentId}",
  async (event) => {
    try {
      const snapshot = event.data;
      if (!snapshot) return;

      const commentData = snapshot.data();
      const reportId = commentData.reportId;

      const reportDoc = await admin
        .firestore()
        .collection("reports")
        .doc(reportId)
        .get();
      if (!reportDoc.exists) {
        console.log("Report not found");
        return;
      }

      const reportData = reportDoc.data()!;
      const usersToNotify: string[] = [];

    //   if (reportData.userId && reportData.userId !== commentData.userId) {
    //     usersToNotify.push(reportData.userId);
    //   }

      // allow self notifications for testing
      if (reportData.userId) {
        usersToNotify.push(reportData.userId);
      }

      const trackingUsersSnapshot = await admin
        .firestore()
        .collection("users")
        .where("trackedReports", "array-contains", reportId)
        .get();

      trackingUsersSnapshot.forEach((doc) => {
        const userId = doc.id;
        if (userId !== commentData.userId && !usersToNotify.includes(userId)) {
          usersToNotify.push(userId);
        }
      });

      if (usersToNotify.length === 0) {
        console.log("No users to notify");
        return;
      }

      const notification: NotificationPayload = {
        title: "New Comment",
        body: `Someone commented on a report you're tracking: "${commentData.content.substring(
          0,
          80
        )}"`,
        data: {
          type: "comment",
          reportId,
          commentId: event.params.commentId,
        },
      };

      await sendPushNotifications(usersToNotify, notification);

      const notificationPromises = usersToNotify.map((userId) =>
        createNotificationDocument(
          userId,
          "comment",
          notification.title,
          notification.body,
          reportId
        )
      );

      await Promise.all(notificationPromises);

      console.log(`Notified ${usersToNotify.length} users about new comment`);
    } catch (error) {
      console.error("Error in onCommentCreated:", error);
    }
  }
);

/**
 * Trigger: When a report’s status changes
 * Action: Notify tracking users & creator
 */
export const onReportStatusChanged = onDocumentUpdated(
  "reports/{reportId}",
  async (event) => {
    try {
      const beforeData = event.data?.before?.data();
      const afterData = event.data?.after?.data();
      const reportId = event.params.reportId;

      if (!beforeData || !afterData || beforeData.status === afterData.status) {
        return;
      }

      const trackingUsersSnapshot = await admin
        .firestore()
        .collection("users")
        .where("trackedReports", "array-contains", reportId)
        .get();

      const usersToNotify: string[] = [];
      trackingUsersSnapshot.forEach((doc) => usersToNotify.push(doc.id));

      if (afterData.userId && !usersToNotify.includes(afterData.userId)) {
        usersToNotify.push(afterData.userId);
      }

      if (usersToNotify.length === 0) {
        console.log("No users to notify");
        return;
      }

      const notification: NotificationPayload = {
        title: "Report Updated",
        body: `A report you're tracking has been marked as ${afterData.status}`,
        data: {
          type: "status_change",
          reportId,
          newStatus: afterData.status,
        },
      };

      await sendPushNotifications(usersToNotify, notification);

      const notificationPromises = usersToNotify.map((userId) =>
        createNotificationDocument(
          userId,
          "status_change",
          notification.title,
          notification.body,
          reportId
        )
      );

      await Promise.all(notificationPromises);

      console.log(`Notified ${usersToNotify.length} users about status change`);
    } catch (error) {
      console.error("Error in onReportStatusChanged:", error);
    }
  }
);

/**
 * Trigger: Scheduled cleanup of old notifications (daily)
 */
export const cleanupOldNotifications = onSchedule(
  "every 24 hours",
  async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldNotificationsSnapshot = await admin
        .firestore()
        .collection("notifications")
        .where("createdAt", "<", thirtyDaysAgo)
        .get();

      const batch = admin.firestore().batch();
      oldNotificationsSnapshot.forEach((doc) => batch.delete(doc.ref));

      await batch.commit();
      console.log(`Deleted ${oldNotificationsSnapshot.size} old notifications`);
    } catch (error) {
      console.error("Error in cleanupOldNotifications:", error);
    }
  }
);
