import React, { useState, useEffect, useMemo } from "react";
import { GoogleMap, InfoWindow, Marker } from "@react-google-maps/api";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";
import { useTranslation } from "react-i18next";

const containerStyle = {
  width: "100%",
  height: "500px",
};

const center = {
  lat: 10.8505,
  lng: 76.2711,
};

// Demo zone data for Tamil Nadu — used when Firestore is empty
const DEMO_ZONES = [
  { id: "z-1", villageName: "Madurai Rural", score: 75, location: { lat: 9.9252, lng: 78.1198 }, stats: { patients: 45, alerts: 8, ashaWorker: "Lakshmi K" } },
  { id: "z-2", villageName: "Coimbatore West", score: 42, location: { lat: 11.0168, lng: 76.9558 }, stats: { patients: 28, alerts: 3, ashaWorker: "Priya M" } },
  { id: "z-3", villageName: "Salem East", score: 55, location: { lat: 11.6643, lng: 78.146 }, stats: { patients: 31, alerts: 5, ashaWorker: "Meena R" } },
  { id: "z-4", villageName: "Tirunelveli South", score: 85, location: { lat: 8.7139, lng: 77.7567 }, stats: { patients: 62, alerts: 12, ashaWorker: "Anitha S" } },
  { id: "z-5", villageName: "Thanjavur", score: 30, location: { lat: 10.787, lng: 79.1378 }, stats: { patients: 15, alerts: 1, ashaWorker: "Kavitha P" } },
  { id: "z-6", villageName: "Erode District", score: 60, location: { lat: 11.3410, lng: 77.7172 }, stats: { patients: 38, alerts: 6, ashaWorker: "Devi N" } },
  { id: "z-7", villageName: "Vellore North", score: 25, location: { lat: 12.9165, lng: 79.1325 }, stats: { patients: 12, alerts: 0, ashaWorker: "Janaki V" } },
  { id: "z-8", villageName: "Trichy North", score: 68, location: { lat: 10.7905, lng: 78.7047 }, stats: { patients: 40, alerts: 7, ashaWorker: "Saroja D" } },
  { id: "z-9", villageName: "Chennai North", score: 90, location: { lat: 13.1067, lng: 80.2906 }, stats: { patients: 78, alerts: 15, ashaWorker: "Revathi G" } },
  { id: "z-10", villageName: "Kanyakumari", score: 20, location: { lat: 8.0883, lng: 77.5385 }, stats: { patients: 8, alerts: 0, ashaWorker: "Selvi T" } },
];

export default function ChoroplethMap() {
  const { t } = useTranslation();
  const [zones, setZones] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingDemoData, setUsingDemoData] = useState(false);

  useEffect(() => {
    const path = "zones";
    const q = query(collection(db, path));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (data.length > 0) {
        setZones(data);
        setUsingDemoData(false);
      } else {
        setZones(DEMO_ZONES);
        setUsingDemoData(true);
      }
      setLoading(false);
    }, (error) => {
      console.error('Firestore zone read error:', error);
      setZones(DEMO_ZONES);
      setUsingDemoData(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getMarkerColor = (score: number) => {
    if (score > 70) return "#ef4444"; // RED
    if (score > 40) return "#f59e0b"; // YELLOW
    return "#10b981"; // GREEN
  };

  const getScoreLabel = (score: number) => {
    if (score > 70) return "Critical";
    if (score > 40) return "Moderate";
    return "Healthy";
  };

  if (loading) {
    return (
      <div className="w-full h-[500px] bg-gray-100 animate-pulse flex items-center justify-center rounded-xl border border-gray-200">
        <span className="text-gray-400 font-medium">{t('maps.loadingZoneData')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {usingDemoData && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-amber-600 text-lg">⚠️</span>
          <div>
            <p className="text-sm font-bold text-amber-800">Showing demo health zone data</p>
            <p className="text-xs text-amber-600">No live zone data found in Firestore. Displaying simulated data for Tamil Nadu districts.</p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 px-4">
        <div className="flex items-center gap-2 text-xs font-bold">
          <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
          <span className="text-slate-500">Healthy (0-40)</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold">
          <div className="w-4 h-4 rounded-full bg-amber-500"></div>
          <span className="text-slate-500">Moderate (41-70)</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold">
          <div className="w-4 h-4 rounded-full bg-red-500"></div>
          <span className="text-slate-500">Critical (71-100)</span>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={7}
        >
          {zones.filter(z => z.location?.lat && z.location?.lng).map((zone) => (
            <Marker
              key={zone.id}
              position={{ lat: zone.location.lat, lng: zone.location.lng }}
              onClick={() => setSelectedZone(zone)}
              icon={{
                path: window.google?.maps?.SymbolPath?.CIRCLE,
                scale: Math.max(12, Math.min(22, (zone.score || 0) / 5)),
                fillColor: getMarkerColor(zone.score || 0),
                fillOpacity: 0.85,
                strokeWeight: 2,
                strokeColor: "#ffffff",
              }}
              label={{
                text: `${zone.score}`,
                color: "#ffffff",
                fontSize: "10px",
                fontWeight: "bold",
              }}
            />
          ))}

          {selectedZone && selectedZone.location && (
            <InfoWindow
              position={{ lat: selectedZone.location.lat, lng: selectedZone.location.lng }}
              onCloseClick={() => setSelectedZone(null)}
            >
              <div className="p-2 max-w-[250px]">
                <h3 className="font-bold text-lg text-gray-800">{selectedZone.villageName}</h3>
                <div className="mt-2 space-y-1">
                  <p className="text-sm">
                    <span className="font-semibold text-gray-600">{t('maps.healthScore')}</span> 
                    <span className={`ml-2 px-2 py-0.5 rounded text-white text-xs font-bold ${
                      (selectedZone.score || 0) > 70 ? 'bg-red-500' : 
                      (selectedZone.score || 0) > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}>
                      {selectedZone.score} — {getScoreLabel(selectedZone.score || 0)}
                    </span>
                  </p>
                  {selectedZone.stats && (
                    <>
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">{t('maps.patients')}</span> {new Intl.NumberFormat('en-IN').format(selectedZone.stats.patients || 0)}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">{t('maps.alerts')}</span> {new Intl.NumberFormat('en-IN').format(selectedZone.stats.alerts || 0)}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">{t('maps.ashaWorker')}</span> {selectedZone.stats.ashaWorker || 'Unassigned'}
                      </p>
                    </>
                  )}
                </div>
                <button 
                  onClick={() => alert(`Drilling down to ${selectedZone.villageName} patient summary`)}
                  className="w-full mt-3 bg-indigo-600 text-white text-xs py-2 rounded hover:bg-indigo-700 transition-colors font-semibold uppercase tracking-wider"
                >
                  {t('maps.viewVillageSummary')}
                </button>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
