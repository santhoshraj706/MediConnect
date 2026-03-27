# MediConnect 🏥  
### *Connecting Rural India to Qualified Healthcare*
**🏆 Winner: 1st Prize @ Hackrax'26 (Thiagarajar College of Engineering)**

---

## 🌟 Overview
**MediConnect** is an AI-integrated rural telemedicine platform designed to bridge the healthcare gap in underserved regions. By empowering **ASHA workers** with advanced triage tools and connecting them to **qualified doctors** in real-time, we address **SDG 3: Good Health & Well-Being**.

The platform features a custom-engineered backend that handles complex geo-spatial matching, real-time disease outbreak tracking, and multi-role dashboard management.

---

## 🚀 Key Features

### 1. 🤖 AI-Integrated Triage (Gemini 2.0 Flash)
- **Real-time Severity Scoring**: Processes patient vitals (BP, Temperature, Symptoms) and classifies them into **GREEN**, **YELLOW**, or **RED** in < 10 seconds.
- **Multilingual Support**: AI reasoning provided in **English, Tamil, or Hindi** to assist local health workers accurately.

### 2. 🗺️ Outbreak & District Health Maps
- **Live Outbreak Tracker**: Visualizes disease clusters using Google Maps API Heatmaps to identify emerging health threats.
- **District Health Monitoring**: A choropleth map providing high-level analytics for District Health Officers (DHO).

### 3. 👥 Multi-Role Ecosystem
- **ASHA Worker Dashboard**: Patient registration, AI triage, and doctor matching.
- **Doctor Dashboard**: Case management, patient history, and consultation logs.
- **DHO Dashboard**: District-level analytics, outbreak monitoring, and resource optimization.

### 4. 📍 Smart Geo-Matching
- **Proximity-Based Routing**: Uses Google Maps Distance Matrix API to match patients with the nearest available specialists.
- **Intelligent Scoring**: Ranks doctors based on specialty match, language compatibility, rating, and current queue load.

---

## 🛠️ Technical Architecture

- **Frontend**: React 19 (Vite), Tailwind CSS (v4), Framer Motion, Lucide React.
- **Backend**: Node.js & Express (Custom server for API orchestration).
- **AI Integration**: Google Gemini 2.0 Flash (for triage & AI Assistant).
- **Maps Ecosystem**: Google Maps JS API, Visualization Library, Distance Matrix API.
- **Database & Auth**: Firebase / Firestore for real-time data sync and secure Google Auth.
- **Multilingual**: i18next (English, Tamil, Hindi).

---

## ⚙️ Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- A Google Cloud Project (with Gemini & Maps APIs enabled)
- A Firebase Project

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd MediConnect
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory (refer to `.env.example` if available):
   ```env
   GEMINI_API_KEY="your-gemini-key"
   MAPS_API_KEY="your-google-maps-key"
   FIREBASE_CONFIG='{"apiKey": "...", "authDomain": "...", ...}'
   ```

4. **Launch Development Server**:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`.

---

## 📈 Impact (SDG 3)
By reducing the time to triage from minutes to seconds and providing rural workers with specialist-level insights, MediConnect aims to:
- **Reduce Rural Mortality Rates** through early detection.
- **Optimize Resource Allocation** for District Health Officers.
- **Equalize Healthcare Access** across geographical barriers.

---

### 🎨 Design Philosophy
The UI is built with a **Premium, Glassmorphic Aesthetic**, utilizing a sleek dark/light theme designed for clarity and ease of use in high-pressure medical environments.

---

**Developed with ❤️ by Team [Your Team Name] @ Hackrax'26**
"# mediconnectdemo" 
