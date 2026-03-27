import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { HeartPulse, Activity, Thermometer, Stethoscope, Phone, AlertTriangle, CheckCircle, Search, User, MapPin, Package, Plus, List, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";

export default function AshaDashboard({ userProfile }: { userProfile: any }) {
  const { t, i18n } = useTranslation();
  const [activeSection, setActiveSection] = useState<"triage" | "patients" | "supplies" | "emergency">("triage");
  
  // Triage state
  const [patientName, setPatientName] = useState("");
  const [bp, setBp] = useState("");
  const [temperature, setTemperature] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [triageResult, setTriageResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Patients state
  const [myPatients, setMyPatients] = useState<any[]>([]);

  // Supply state
  const [supplyItems, setSupplyItems] = useState("");
  const [supplyQty, setSupplyQty] = useState("");
  const [supplyNotes, setSupplyNotes] = useState("");
  const [mySupplyRequests, setMySupplyRequests] = useState<any[]>([]);
  const [supplyLoading, setSupplyLoading] = useState(false);

  // Emergency state
  const [nearbyDoctors, setNearbyDoctors] = useState<any[]>([]);
  const [searchingDoctors, setSearchingDoctors] = useState(false);
  const [emergencyPatient, setEmergencyPatient] = useState<string>("");

  // Listen for this ASHA's patients
  useEffect(() => {
    if (!userProfile?.uid) return;
    const q = query(collection(db, "patients"), where("ashaUid", "==", userProfile.uid));
    const unsub = onSnapshot(q, (snap) => {
      setMyPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn("Patient listen error (mock user?):", err.message);
    });
    return () => unsub();
  }, [userProfile?.uid]);

  // Listen for this ASHA's supply requests
  useEffect(() => {
    if (!userProfile?.uid) return;
    const q = query(collection(db, "supplyRequests"), where("ashaUid", "==", userProfile.uid));
    const unsub = onSnapshot(q, (snap) => {
      setMySupplyRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn("Supply listen error (mock user?):", err.message);
    });
    return () => unsub();
  }, [userProfile?.uid]);

  const handleTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTriageResult(null);
    setError(null);

    try {
      const lang = i18n.language?.split('-')[0] || 'en';

      // Call backend triage API
      const response = await fetch('/api/ai-triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientName, bp, temperature, symptoms, language: lang }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (${response.status})`);
      }

      const triageDataJson = await response.json();

      if (!triageDataJson.score || !triageDataJson.status) {
        throw new Error("Invalid triage response from AI.");
      }
      
      const triageData = {
        ashaUid: userProfile.uid,
        ashaName: userProfile.name,
        patientName,
        bp,
        temperature: parseFloat(temperature),
        symptoms,
        score: triageDataJson.score,
        status: triageDataJson.status,
        reason: triageDataJson.reason,
        timestamp: serverTimestamp(),
        location: userProfile.location,
        reviewStatus: triageDataJson.status === "YELLOW" ? "PENDING" : triageDataJson.status === "RED" ? "EMERGENCY" : "HOME_CARE"
      };

      await addDoc(collection(db, "patients"), triageData);
      setTriageResult(triageData);

      // Auto-trigger emergency search for RED cases
      if (triageDataJson.status === "RED") {
        searchNearbyDoctorsForEmergency(patientName);
      }

      // Reset form
      setPatientName("");
      setBp("");
      setTemperature("");
      setSymptoms("");
    } catch (err: any) {
      console.error("Triage failed", err);
      setError(t('asha.triageFailed') + " " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const searchNearbyDoctorsForEmergency = async (patient: string) => {
    setSearchingDoctors(true);
    setEmergencyPatient(patient);
    try {
      const q = query(collection(db, "users"), where("role", "==", "doctor"), where("verified", "==", true));
      const snapshot = await getDocs(q);
      const doctors = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      if (doctors.length === 0) {
        setNearbyDoctors([]);
        return;
      }

      // Call the backend API for accurate geo-matching and scoring
      const response = await fetch(`/api/doctor-match?patientLat=${userProfile.location.lat}&patientLng=${userProfile.location.lng}&doctors=${encodeURIComponent(JSON.stringify(doctors))}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch doctor matches");
      }

      const top3 = await response.json();
      setNearbyDoctors(top3);

      // Send emergency alert to Firestore
      await addDoc(collection(db, "emergencyAlerts"), {
        ashaUid: userProfile.uid,
        ashaName: userProfile.name,
        patientName: patient,
        location: userProfile.location,
        timestamp: serverTimestamp(),
        status: "active"
      });
    } catch (err: any) {
      console.error("Failed to find doctors:", err);
      // Fallback to basic Haversine if API fails
      const toRad = (deg: number) => deg * Math.PI / 180;
      const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };
      
      const q = query(collection(db, "users"), where("role", "==", "doctor"), where("verified", "==", true));
      const snapshot = await getDocs(q);
      const doctors = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      const sorted = doctors
        .map(doc => ({
          ...doc,
          distance: haversine(userProfile.location.lat, userProfile.location.lng, doc.location?.lat || 0, doc.location?.lng || 0)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5);

      setNearbyDoctors(sorted);
    } finally {
      setSearchingDoctors(false);
    }
  };

  const handleSupplyRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupplyLoading(true);
    try {
      await addDoc(collection(db, "supplyRequests"), {
        ashaUid: userProfile.uid,
        ashaName: userProfile.name,
        ashaEmail: auth.currentUser?.email || userProfile.email || "",
        items: supplyItems,
        quantity: supplyQty,
        notes: supplyNotes,
        location: userProfile.location || { lat: 0, lng: 0 },
        status: "pending",
        timestamp: serverTimestamp()
      });
      setSupplyItems("");
      setSupplyQty("");
      setSupplyNotes("");
    } catch (err) {
      console.error("Supply request failed", err);
    } finally {
      setSupplyLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <HeartPulse className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('asha.portalTitle')}</h1>
            <p className="text-slate-500 text-sm flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {userProfile.name} • {userProfile.location.lat.toFixed(4)}, {userProfile.location.lng.toFixed(4)}
            </p>
          </div>
        </div>
      </header>

      {/* Section Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "triage", label: t('asha.patientTriage'), icon: Activity },
          { key: "patients", label: t('asha.myPatients') || "My Patients", icon: List },
          { key: "supplies", label: t('asha.requestSupplies') || "Supplies", icon: Package },
          { key: "emergency", label: t('asha.emergency') || "Emergency", icon: AlertTriangle },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key as any)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-all ${
              activeSection === tab.key
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== TRIAGE SECTION ===== */}
      {activeSection === "triage" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Activity className="text-indigo-600 w-5 h-5" />
              {t('asha.patientTriage')}
            </h2>
            <form onSubmit={handleTriage} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{t('asha.patientName')}</label>
                <input required value={patientName} onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder={t('asha.enterPatientName')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">{t('asha.bp')}</label>
                  <input required value={bp} onChange={(e) => setBp(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder={t('asha.bpPlaceholder')} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">{t('asha.temp')}</label>
                  <input required type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder={t('asha.tempPlaceholder')} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{t('asha.symptoms')}</label>
                <textarea required value={symptoms} onChange={(e) => setSymptoms(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-32"
                  placeholder={t('asha.symptomsPlaceholder')} />
              </div>
              <button disabled={loading}
                className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50">
                {loading ? t('asha.runningTriage') : t('asha.runTriage')}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 text-sm border border-red-100 italic">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-auto text-xs font-bold uppercase tracking-widest hover:text-red-900">{t('asha.dismiss')}</button>
              </div>
            )}
          </motion.div>

          {/* Results */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {triageResult && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className={`p-8 rounded-3xl border-2 shadow-lg ${
                    triageResult.status === 'GREEN' ? 'bg-emerald-50 border-emerald-200' :
                    triageResult.status === 'YELLOW' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
                  }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-black uppercase tracking-tighter">
                      {t('asha.status')}: {triageResult.status}
                    </h3>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white ${
                      triageResult.status === 'GREEN' ? 'bg-emerald-500' :
                      triageResult.status === 'YELLOW' ? 'bg-amber-500' : 'bg-red-500'
                    }`}>{triageResult.score}</div>
                  </div>
                  <p className="text-slate-700 font-medium mb-6">{triageResult.reason}</p>

                  {triageResult.status === 'GREEN' && (
                    <div className="flex items-center gap-3 text-emerald-700 font-bold bg-white/50 p-4 rounded-2xl">
                      <CheckCircle className="w-6 h-6" /> {t('asha.ashaCanHandle')}
                    </div>
                  )}
                  {triageResult.status === 'YELLOW' && (
                    <div className="flex items-center gap-3 text-amber-700 font-bold bg-white/50 p-4 rounded-2xl">
                      <Stethoscope className="w-6 h-6" /> {t('asha.doctorRecommended')}
                    </div>
                  )}
                  {triageResult.status === 'RED' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-red-700 font-bold bg-white/50 p-4 rounded-2xl animate-pulse">
                        <AlertTriangle className="w-6 h-6" /> {t('asha.emergency')}
                      </div>
                      <button onClick={() => alert("Calling 108...")}
                        className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl hover:bg-red-700 transition-all shadow-lg flex items-center justify-center gap-3">
                        <Phone className="w-6 h-6" /> {t('asha.call108')}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ===== MY PATIENTS SECTION ===== */}
      {activeSection === "patients" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {myPatients.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400">No patients triaged yet. Use the Triage tab to add patients.</p>
            </div>
          ) : (
            myPatients.map((patient) => (
              <div key={patient.id} className={`bg-white p-6 rounded-3xl shadow-sm border-2 transition-all ${
                patient.status === 'GREEN' ? 'border-emerald-100' :
                patient.status === 'YELLOW' ? 'border-amber-100' : 'border-red-100'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white ${
                      patient.status === 'GREEN' ? 'bg-emerald-500' :
                      patient.status === 'YELLOW' ? 'bg-amber-500' : 'bg-red-500'
                    }`}>{patient.score}</div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">{patient.patientName}</h4>
                      <p className="text-xs text-slate-500">{patient.symptoms?.substring(0, 60)}...</p>
                      <div className="flex gap-3 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>BP: {patient.bp}</span>
                        <span>Temp: {patient.temperature}°F</span>
                        <span>Review: {patient.reviewStatus}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    patient.status === 'GREEN' ? 'bg-emerald-100 text-emerald-700' :
                    patient.status === 'YELLOW' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>{patient.status}</span>
                </div>
              </div>
            ))
          )}
        </motion.div>
      )}

      {/* ===== SUPPLY REQUEST SECTION ===== */}
      {activeSection === "supplies" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Plus className="text-indigo-600 w-5 h-5" /> {t('asha.requestSupplies') || "Request Supplies"}
            </h2>
            <form onSubmit={handleSupplyRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Supply Items</label>
                <input required value={supplyItems} onChange={(e) => setSupplyItems(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. ORS packets, Paracetamol, BP machine" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Quantity</label>
                <input required value={supplyQty} onChange={(e) => setSupplyQty(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. 50 packets" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Notes (optional)</label>
                <textarea value={supplyNotes} onChange={(e) => setSupplyNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-24"
                  placeholder="Urgency, reason for request..." />
              </div>
              <button disabled={supplyLoading}
                className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50">
                {supplyLoading ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="text-amber-600 w-5 h-5" /> My Requests
            </h2>
            {mySupplyRequests.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No supply requests yet.</p>
              </div>
            ) : (
              mySupplyRequests.map((req) => (
                <div key={req.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900">{req.items}</h4>
                      <p className="text-xs text-slate-500">Qty: {req.quantity}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                      req.status === "pending" ? "bg-amber-100 text-amber-700" :
                      req.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}>{req.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* ===== EMERGENCY SECTION ===== */}
      {activeSection === "emergency" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-red-50 p-8 rounded-3xl border-2 border-red-200">
            <h2 className="text-xl font-bold text-red-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" /> Emergency: Find Nearby Doctor
            </h2>
            <p className="text-sm text-red-700 mb-6">Enter the patient name and search for the nearest verified doctors in your area.</p>
            <div className="flex gap-3">
              <input value={emergencyPatient} onChange={(e) => setEmergencyPatient(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-red-200 focus:ring-2 focus:ring-red-500 outline-none bg-white"
                placeholder="Patient name for emergency..." />
              <button onClick={() => searchNearbyDoctorsForEmergency(emergencyPatient)}
                disabled={searchingDoctors || !emergencyPatient.trim()}
                className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                {searchingDoctors ? "Searching..." : "Find Doctors"}
              </button>
            </div>
          </div>

          {nearbyDoctors.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">{t('asha.nearbyDoctors')}</h3>
              {nearbyDoctors.map((doc, idx) => (
                <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-bold text-xs ${
                      (doc.finalScore || 0) > 0.8 ? 'bg-emerald-100 text-emerald-700' : 
                      (doc.finalScore || 0) > 0.5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      <span className="text-lg">{(doc.finalScore * 100 || 0).toFixed(0)}</span>
                      <span className="text-[8px] uppercase tracking-tighter">Score</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{doc.name}</h4>
                      <p className="text-xs text-slate-500">{doc.specialty || "General"} • {doc.language || "English"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                          {doc.travelMinutes ? `${Math.round(doc.travelMinutes)} mins away` : `${doc.distance?.toFixed(1)} km`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => alert(`Calling ${doc.name}...`)}
                    className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-all">
                    <Phone className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
