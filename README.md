# MediConnect 🏥

> AI-integrated rural telemedicine platform connecting ASHA workers to qualified doctors in real-time.

**🏆 1st Prize — Hackrax'26 · Thiagarajar College of Engineering**

---

## Overview

MediConnect bridges the healthcare gap in underserved rural regions of India. ASHA workers use the platform to register patients, run AI-powered triage, and get instantly matched with the nearest available specialist — all from a single dashboard.

Built for **SDG 3: Good Health & Well-Being**.

---

## Features

- **AI Triage** — Gemini 2.0 Flash processes vitals (BP, temperature, symptoms) and returns a GREEN / YELLOW / RED severity score in under 10 seconds, with reasoning in English, Tamil, or Hindi.
- **Outbreak Tracker** — Google Maps heatmaps visualize live disease clusters; choropleth view for District Health Officers.
- **Smart Geo-Matching** — Distance Matrix API routes patients to the nearest available specialist, ranked by specialty, language, rating, and queue load.
- **Multi-Role Dashboards** — Separate views for ASHA Workers, Doctors, and District Health Officers (DHO).

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 (Vite), Tailwind CSS v4, Framer Motion, Lucide React |
| Backend | Node.js & Express |
| AI | Google Gemini 2.0 Flash |
| Maps | Google Maps JS API, Visualization Library, Distance Matrix API |
| Database & Auth | Firebase / Firestore, Google Auth |
| i18n | i18next (English, Tamil, Hindi) |

---

## Getting Started

### Prerequisites

- Node.js v18+
- Google Cloud project with Gemini & Maps APIs enabled
- Firebase project

### Installation

```bash
git clone <your-repo-url>
cd MediConnect
npm install
```

### Environment Variables

Create a `.env` file in the root:

```env
GEMINI_API_KEY="your-gemini-key"
MAPS_API_KEY="your-google-maps-key"
FIREBASE_CONFIG='{"apiKey":"...","authDomain":"...","projectId":"..."}'
```

### Run

```bash
npm run dev
```

App runs at `http://localhost:3000`.

---

## Impact

- Reduces triage time from minutes to seconds
- Provides rural health workers with specialist-level insights
- Helps DHOs monitor outbreaks and optimize resource allocation

---

*Developed with ❤️ by Team Debug Doctors @ Hackrax'26*
