import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Client } from "@googlemaps/google-maps-services-js";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const mapsClient = new Client({});
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function startServer() {
  try {
    const app = express();
    const PORT = 3000;

    app.use(express.json());

    // Health check endpoint
    app.get("/api/health", (req, res) => {
      res.json({ status: "ok", message: "MediConnect Server is running" });
    });

    // Retry helper for Gemini API (handles 429 rate limits)
    async function callGeminiWithRetry(params: any, retries = 3, delay = 2000): Promise<any> {
      for (let i = 0; i < retries; i++) {
        try {
          return await ai.models.generateContent(params);
        } catch (err: any) {
          const status = err?.status || err?.httpErrorCode || err?.code;
          const is429 = status === 429 || String(err?.message || "").includes("429") || String(err?.message || "").includes("RESOURCE_EXHAUSTED");
          
          if (is429 && i < retries - 1) {
            console.log(`Gemini rate limited. Retrying in ${delay}ms... (attempt ${i + 2}/${retries})`);
            await new Promise(r => setTimeout(r, delay));
            delay *= 2; // exponential backoff
          } else {
            throw err;
          }
        }
      }
    }

    // AI Chat endpoint — proxies Gemini API calls
    app.post("/api/ai-chat", async (req, res) => {
      const { message, language } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Missing or invalid 'message' field" });
      }

      const lang = language === "ta" ? "Tamil" : language === "hi" ? "Hindi" : "English";

      try {
        const systemPrompt = `You are MediConnect AI, a helpful medical assistant for rural healthcare workers in India. 
You help ASHA workers, Doctors, and District Health Officers with medical questions, triage guidance, drug information, and public health protocols.
Always respond in ${lang}. Be concise and practical. If a situation seems critical, always advise calling 108 (emergency).`;

        const response = await callGeminiWithRetry({
          model: "gemini-2.0-flash",
          contents: `${systemPrompt}\n\nUser: ${message}`,
        });

        res.json({ text: response?.text || "Sorry, I could not generate a response." });
      } catch (err: any) {
        console.error("Gemini API error:", err?.message || err);
        const is429 = String(err?.message || "").includes("429") || String(err?.message || "").includes("RESOURCE_EXHAUSTED");
        res.status(is429 ? 429 : 500).json({ 
          error: is429 
            ? "AI service is rate limited. Please wait a moment and try again." 
            : "AI service temporarily unavailable. Please try again." 
        });
      }
    });

    // AI Triage endpoint — for ASHA worker triage
    app.post("/api/ai-triage", async (req, res) => {
      const { patientName, bp, temperature, symptoms, language } = req.body;

      if (!patientName || !bp || !temperature || !symptoms) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const promptLang = language === "ta" ? "Tamil" : language === "hi" ? "Hindi" : "English";

      try {
        const prompt = `
          As a medical triage AI, score the following patient symptoms on a scale of 1 to 100 (1 being healthy/minor, 100 being critical emergency).
          Patient: ${patientName}
          BP: ${bp}
          Temperature: ${temperature}°F
          Symptoms: ${symptoms}
          
          Return ONLY a JSON object with:
          {
            "score": number,
            "reason": "short explanation strictly in ${promptLang}",
            "status": "GREEN" | "YELLOW" | "RED"
          }
          Logic: 1-35 GREEN, 36-70 YELLOW, 71-100 RED.
          The "reason" field MUST be written in ${promptLang}.
        `;

        const response = await callGeminiWithRetry({
          model: "gemini-2.0-flash",
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });

        const triageData = JSON.parse(response?.text || "{}");
        res.json(triageData);
      } catch (err: any) {
        console.error("Triage API error:", err?.message || err);
        const is429 = String(err?.message || "").includes("429") || String(err?.message || "").includes("RESOURCE_EXHAUSTED");
        res.status(is429 ? 429 : 500).json({ 
          error: is429 
            ? "AI triage service is rate limited. Please wait a moment and try again." 
            : "AI triage service temporarily unavailable." 
        });
      }
    });

    // Feature 3 — Doctor Geo-Matching Scoring
    app.get("/api/doctor-match", async (req, res) => {
      const { patientLat, patientLng, doctors } = req.query;

      if (!patientLat || !patientLng || !doctors) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const patientLocation = { lat: parseFloat(patientLat as string), lng: parseFloat(patientLng as string) };
      let doctorList;
      try {
        doctorList = JSON.parse(doctors as string);
      } catch (e) {
        return res.status(400).json({ error: "Invalid doctors data" });
      }

      try {
        const destinations = doctorList.map((d: any) => ({ lat: d.location.lat, lng: d.location.lng }));
        
        const response = await mapsClient.distancematrix({
          params: {
            origins: [patientLocation],
            destinations: destinations,
            key: process.env.MAPS_API_KEY || "",
          },
          timeout: 5000,
        });

        const results = response.data.rows[0].elements;

        const scoredDoctors = doctorList.map((doctor: any, index: number) => {
          const element = results[index];
          const travelMinutes = (element && element.status === 'OK') ? element.duration.value / 60 : 120;
          const proximityScore = Math.max(0, Math.min(1, 1 - (travelMinutes / 120)));
          
          const specialtyMatch = doctor.specialtyMatch || 1;
          const languageMatch = doctor.languageMatch || 1;
          const ratingScore = (doctor.rating || 4.5) / 5;
          const queueLoadInverse = 1 - ((doctor.queueLoad || 10) / 100);

          const finalScore = (specialtyMatch * 0.35) + 
                             (languageMatch * 0.25) + 
                             (ratingScore * 0.20) + 
                             (queueLoadInverse * 0.10) + 
                             (proximityScore * 0.10);

          return {
            ...doctor,
            finalScore,
            travelMinutes,
            proximityScore
          };
        });

        const top3 = scoredDoctors.sort((a: any, b: any) => b.finalScore - a.finalScore).slice(0, 3);
        res.json(top3);
      } catch (error) {
        console.error("Distance Matrix API error:", error);
        res.status(500).json({ error: "Failed to calculate doctor scores" });
      }
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      console.log("Starting Vite in development mode...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
        root: process.cwd(),
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`MediConnect Server listening on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
