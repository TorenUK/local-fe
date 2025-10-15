## 📘 Project Documentation

This project is guided by a detailed technical specification that outlines the architecture, data structure, and milestones for development.

- **Specification:** [SPEC-001 — Local Safety & Community Alert App](./SPEC-001-Local-Safety-App.md)
- **Architecture Diagram:** [Architecture](./architecture.puml)
- **Tech Stack:** React Native (Expo, TypeScript) + Firebase (Firestore, Auth, Storage, Functions, FCM)

---

### 🧩 Overview

The **Local Safety & Community Alert App** helps users report and track nearby incidents such as:
- Crimes  
- Lost or found items  
- Missing pets  
- Local hazards  

Reports appear on a live, interactive map — updating in real time via Firestore listeners.  
Users can adjust their alert radius and receive push notifications for nearby incidents or updates on tracked reports.

---

### 🏗️ Tech Highlights

| Layer | Technology | Description |
|-------|-------------|-------------|
| Frontend | **React Native (Expo, TypeScript)** | Cross-platform mobile app |
| Backend | **Firebase** | Real-time data, auth, storage, notifications |
| Realtime | **Firestore snapshot listeners** | Instant updates for reports and map markers |
| Notifications | **Firebase Cloud Messaging (FCM)** | Push alerts for new reports and comments |
| Security | **Firebase Rules** | Enforces permissions and report ownership |

---

### 🚀 Development Phases

| Phase | Goal | Duration |
|-------|------|-----------|
| **1 — MVP** | Auth, report creation, live map, notifications | 4–6 weeks |
| **2 — Beta** | Comments, upvotes, user profiles, caching | 6–8 weeks |
| **3 — Launch** | Store release, monitoring, analytics | 8–10 weeks |

---

📍 *See the full [SPEC-001](./SPEC-001-Local-Safety-App.md) document for Firestore schema, implementation steps, and milestones.*
