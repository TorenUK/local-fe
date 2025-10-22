# SPEC-001 — Local Safety & Community Alert App

## 📍 Background

The **Local Safety & Community Alert App** enhances community awareness and safety by allowing users to share and view real-time, location-based reports.

Inspired by **Waze**, but focused on **public safety** and **lost property**, it enables users to report and track local incidents such as crimes, lost items, or missing pets.

Reports are **geotagged** and displayed on an **interactive map**, updating live as new reports come in.  
Users can refine their alert radius, receive push notifications for nearby incidents, and track reports they care about.

The initial release targets the **general public**, with potential future expansion to include **law enforcement or local agencies**.

---

## ✅ Requirements

### Must Have

- User registration/login (Email, Google, Apple, Anonymous)
- Report creation (crime, lost item, missing pet, hazard) with:
  - Category, description, location, optional photos, and anonymity option
- Real-time interactive map with report markers
- Filtering by category, radius, and time
- Push notifications for:
  - Nearby incidents
  - Comments or updates on tracked/created reports
- Live updates via Firestore snapshot listeners
- Basic moderation (flagging inappropriate reports)

---

### ⚙️ Should Have

- Comments and upvotes on reports  
- User profiles with tracked and created reports  
- Offline caching of recent reports and map data  
- Radius-based proximity alerts  

---

### 💡 Could Have

- Integration with city safety feeds or police data  
- Gamification (badges for community contribution)  
- Local zone chat  

--- 

### 🚫 Won’t Have (Initially)

- Law enforcement integrations  
- AI-driven content moderation or recognition  
- Local advertisements  
---

## Method

### Architecture Overview

**Frontend:** React Native (Expo, TypeScript)  
**Backend:** Firebase (Firestore, Auth, Cloud Functions, Cloud Storage, FCM)

#### Key Components

- **Auth Module:** Handles login, anonymous access, and profile data  
- **Map UI:** Displays nearby reports with real-time Firestore updates  
- **Report Manager:** Handles creation, uploads, and tracking  
- **Notification Manager:** Subscribes to Firebase Cloud Messaging  
- **Cloud Functions:** Automate push notifications and moderation  

---

## 📘 Firestore Schema

```plaintext
/users
  └── {userId}
       ├── name, email, photoUrl
       ├── isAnonymous: boolean
       ├── trackedReports: [reportId]
       ├── createdAt, lastActive

/reports
  └── {reportId}
       ├── type: enum("crime", "lost_item", "missing_pet", "hazard")
       ├── userId: string | null
       ├── description: string
       ├── location:
       │     ├── geohash: string
       │     └── geopoint: GeoPoint(lat, lng)
       ├── radius: number
       ├── photos: [url]
       ├── createdAt, updatedAt
       ├── status: enum("open", "resolved")
       ├── upvotes, commentCount
       └── metadata:
             ├── lost_item?: { itemType, color, brand? }
             ├── missing_pet?: { species, breed, color }
             ├── crime?: { category, severity }
             ├── hazard?: { type, level }

/comments
  └── {commentId}
       ├── reportId, userId, content
       ├── createdAt, flagged
