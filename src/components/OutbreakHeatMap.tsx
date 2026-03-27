import React, { useState, useEffect, useMemo, useCallback } from "react";
import { GoogleMap, HeatmapLayer, InfoWindow, Marker } from "@react-google-maps/api";
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

// Demo outbreak data for Tamil Nadu — used when Firestore is empty
const DEMO_OUTBREAKS = [
  { id: "demo-1", villageName: "Madurai Rural", symptomType: "Dengue Fever", caseCount: 12, location: { lat: 9.9252, lng: 78.1198 }, timestamp: null },
  { id: "demo-2", villageName: "Coimbatore West", symptomType: "Malaria", caseCount: 8, location: { lat: 11.0168, lng: 76.9558 }, timestamp: null },
  { id: "demo-3", villageName: "Salem East", symptomType: "Typhoid", caseCount: 6, location: { lat: 11.6643, lng: 78.146 }, timestamp: null },
  { id: "demo-4", villageName: "Tirunelveli South", symptomType: "Dengue Fever", caseCount: 15, location: { lat: 8.7139, lng: 77.7567 }, timestamp: null },
  { id: "demo-5", villageName: "Thanjavur", symptomType: "Cholera", caseCount: 5, location: { lat: 10.787, lng: 79.1378 }, timestamp: null },
  { id: "demo-6", villageName: "Erode District", symptomType: "Malaria", caseCount: 9, location: { lat: 11.3410, lng: 77.7172 }, timestamp: null },
  { id: "demo-7", villageName: "Vellore", symptomType: "Typhoid", caseCount: 7, location: { lat: 12.9165, lng: 79.1325 }, timestamp: null },
  { id: "demo-8", villageName: "Trichy North", symptomType: "Dengue Fever", caseCount: 11, location: { lat: 10.7905, lng: 78.7047 }, timestamp: null },
  { id: "demo-9", villageName: "Dindigul", symptomType: "Malaria", caseCount: 4, location: { lat: 10.3624, lng: 77.9695 }, timestamp: null },
  { id: "demo-10", villageName: "Kanyakumari", symptomType: "Dengue Fever", caseCount: 3, location: { lat: 8.0883, lng: 77.5385 }, timestamp: null },
  { id: "demo-11", villageName: "Chennai North", symptomType: "Cholera", caseCount: 10, location: { lat: 13.1067, lng: 80.2906 }, timestamp: null },
  { id: "demo-12", villageName: "Tirupur", symptomType: "Gastroenteritis", caseCount: 6, location: { lat: 11.1085, lng: 77.3411 }, timestamp: null },
];

export default function OutbreakHeatMap() {
  const { t } = useTranslation();
  const [outbreaks, setOutbreaks] = useState<any[]>([]);
  const [selectedOutbreak, setSelectedOutbreak] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingDemoData, setUsingDemoData] = useState(false);

  const formatDate = (date: any) => {
    if (!date) return 'Live Demo Data';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  useEffect(() => {
    const path = "outbreaks";
    const q = query(collection(db, path));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (data.length > 0) {
        setOutbreaks(data);
        setUsingDemoData(false);
      } else {
        // Use demo data when Firestore is empty
        setOutbreaks(DEMO_OUTBREAKS);
        setUsingDemoData(true);
      }
      setLoading(false);
    }, (error) => {
      console.error('Firestore outbreak read error:', error);
      // Fallback to demo data on error
      setOutbreaks(DEMO_OUTBREAKS);
      setUsingDemoData(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const heatmapData = useMemo(() => {
    if (!window.google?.maps) return [];
    return outbreaks
      .filter(o => o.location?.lat && o.location?.lng)
      .map(o => ({
        location: new window.google.maps.LatLng(o.location.lat, o.location.lng),
        weight: o.caseCount || 1
      }));
  }, [outbreaks]);

  const gradient = [
    "rgba(0, 255, 255, 0)",
    "rgba(0, 255, 255, 1)",
    "rgba(0, 191, 255, 1)",
    "rgba(0, 127, 255, 1)",
    "rgba(0, 63, 255, 1)",
    "rgba(0, 0, 255, 1)",
    "rgba(0, 0, 223, 1)",
    "rgba(0, 0, 191, 1)",
    "rgba(0, 0, 159, 1)",
    "rgba(0, 0, 127, 1)",
    "rgba(63, 0, 91, 1)",
    "rgba(127, 0, 63, 1)",
    "rgba(191, 0, 31, 1)",
    "rgba(255, 0, 0, 1)",
  ];

  const getMarkerColor = (caseCount: number) => {
    if (caseCount >= 10) return "#ef4444";
    if (caseCount >= 5) return "#f59e0b";
    return "#22c55e";
  };

  if (loading) {
    return (
      <div className="w-full h-[500px] bg-gray-100 animate-pulse flex items-center justify-center rounded-xl border border-gray-200">
        <span className="text-gray-400 font-medium">{t('maps.loadingOutbreakData')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {usingDemoData && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-amber-600 text-lg">⚠️</span>
          <div>
            <p className="text-sm font-bold text-amber-800">Showing demo outbreak data</p>
            <p className="text-xs text-amber-600">No live outbreak data found in Firestore. Displaying simulated data for Tamil Nadu districts.</p>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <span className="text-2xl font-black text-red-600">{outbreaks.length}</span>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Active Zones</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <span className="text-2xl font-black text-amber-600">{outbreaks.reduce((sum, o) => sum + (o.caseCount || 0), 0)}</span>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Cases</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <span className="text-2xl font-black text-indigo-600">{[...new Set(outbreaks.map(o => o.symptomType))].length}</span>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Symptom Types</p>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={7}
          options={{
            styles: [
              {
                featureType: "all",
                elementType: "labels.text.fill",
                stylers: [{ color: "#7c93a3" }],
              },
            ],
          }}
        >
          <HeatmapLayer
            data={heatmapData}
            options={{
              radius: 50,
              opacity: 0.7,
              gradient: gradient,
              dissipating: true,
              maxIntensity: 15,
            }}
          />

          {outbreaks.filter(o => o.location?.lat && o.location?.lng).map((o) => (
            <Marker
              key={o.id}
              position={{ lat: o.location.lat, lng: o.location.lng }}
              onClick={() => setSelectedOutbreak(o)}
              icon={{
                path: window.google?.maps?.SymbolPath?.CIRCLE,
                scale: Math.max(8, Math.min(18, (o.caseCount || 1) * 1.5)),
                fillColor: getMarkerColor(o.caseCount || 0),
                fillOpacity: 0.9,
                strokeWeight: 2,
                strokeColor: "#ffffff",
              }}
            />
          ))}

          {selectedOutbreak && (
            <InfoWindow
              position={{ lat: selectedOutbreak.location.lat, lng: selectedOutbreak.location.lng }}
              onCloseClick={() => setSelectedOutbreak(null)}
            >
              <div className="p-2 max-w-[220px]">
                <h3 className="font-bold text-lg text-red-600">{selectedOutbreak.villageName}</h3>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-semibold">{t('maps.symptom')}</span> {selectedOutbreak.symptomType}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-semibold">{t('maps.cases')}</span> {new Intl.NumberFormat('en-IN').format(selectedOutbreak.caseCount)}
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  {formatDate(selectedOutbreak.timestamp)}
                </p>
                <button 
                  onClick={() => alert(`Alerting DHO for ${selectedOutbreak.villageName}`)}
                  className="w-full bg-red-600 text-white text-xs py-2 rounded hover:bg-red-700 transition-colors font-semibold uppercase tracking-wider"
                >
                  {t('maps.alertDHO')}
                </button>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
