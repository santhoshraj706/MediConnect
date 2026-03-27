import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Stethoscope, Users, MapPin, Activity, Clock, CheckCircle, User, Phone, Thermometer, AlertTriangle, X, Shield } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";

export default function DoctorDashboard({ userProfile }: { userProfile: any }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"consultations" | "completed">("consultations");
  const [pendingPatients, setPendingPatients] = useState<any[]>([]);
  const [inReviewPatients, setInReviewPatients] = useState<any[]>([]);
  const [emergencyAlerts, setEmergencyAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Verification check
  const isVerified = userProfile.verified === true;

  // Listen for YELLOW/EMERGENCY patients (PENDING review)
  useEffect(() => {
    const q = query(collection(db, "patients"), where("reviewStatus", "in", ["PENDING", "EMERGENCY"]));
    const unsub = onSnapshot(q, (snap) => {
      setPendingPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Firestore sync error", err);
      setError("Failed to sync patient data.");
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Listen for IN_REVIEW patients (accepted by this doctor)
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "patients"), where("reviewStatus", "==", "IN_REVIEW"), where("doctorUid", "==", auth.currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      setInReviewPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Listen for emergency alerts
  useEffect(() => {
    const q = query(collection(db, "emergencyAlerts"), where("status", "==", "active"));
    const unsub = onSnapshot(q, (snap) => {
      setEmergencyAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const acceptPatient = async (patientId: string) => {
    setActionLoading(patientId);
    try {
      await updateDoc(doc(db, "patients", patientId), {
        reviewStatus: "IN_REVIEW",
        doctorUid: auth.currentUser?.uid,
        doctorName: userProfile.name
      });
    } catch (err) {
      console.error("Accept failed", err);
    } finally {
      setActionLoading(null);
    }
  };

  const completePatient = async (patientId: string) => {
    setActionLoading(patientId);
    try {
      await updateDoc(doc(db, "patients", patientId), {
        reviewStatus: "COMPLETED"
      });
    } catch (err) {
      console.error("Complete failed", err);
    } finally {
      setActionLoading(null);
    }
  };

  const rejectPatient = async (patientId: string) => {
    setActionLoading(patientId);
    try {
      await updateDoc(doc(db, "patients", patientId), {
        reviewStatus: "REJECTED"
      });
    } catch (err) {
      console.error("Reject failed", err);
    } finally {
      setActionLoading(null);
    }
  };

  const acceptEmergency = async (alertId: string) => {
    setActionLoading(alertId);
    try {
      await updateDoc(doc(db, "emergencyAlerts", alertId), {
        status: "accepted",
        doctorUid: auth.currentUser?.uid,
        doctorName: userProfile.name
      });
    } catch (err) {
      console.error("Accept emergency failed", err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Stethoscope className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('doctor.portalTitle')}</h1>
            <p className="text-slate-500 text-sm flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {userProfile.name} • {userProfile.specialty}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isVerified ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">{t('doctor.available')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-full border border-amber-100">
              <Shield className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Pending Verification</span>
            </div>
          )}
        </div>
      </header>

      {/* Verification Banner */}
      {!isVerified && (
        <div className="bg-amber-50 p-6 rounded-3xl border-2 border-amber-200 flex items-start gap-4">
          <Shield className="w-8 h-8 text-amber-600 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-amber-800 text-lg">Awaiting DHO Verification</h3>
            <p className="text-sm text-amber-700 mt-1">Your account is pending verification by the District Health Officer. You can view patients but some actions may be limited.</p>
          </div>
        </div>
      )}

      {/* Emergency Alerts Banner */}
      <AnimatePresence>
        {emergencyAlerts.map(alert => (
          <motion.div key={alert.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="bg-red-50 p-6 rounded-3xl border-2 border-red-300 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="text-white w-8 h-8" />
              </div>
              <div>
                <h3 className="font-black text-red-800 text-lg uppercase tracking-tight">🚨 Emergency Alert</h3>
                <p className="text-sm text-red-700">Patient: <strong>{alert.patientName}</strong> • ASHA: {alert.ashaName}</p>
                <p className="text-xs text-red-500 mt-1">Location: {alert.location?.lat?.toFixed(4)}, {alert.location?.lng?.toFixed(4)}</p>
              </div>
            </div>
            <button onClick={() => acceptEmergency(alert.id)}
              disabled={actionLoading === alert.id}
              className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center gap-2">
              <Phone className="w-5 h-5" /> Accept Emergency
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <User className="text-indigo-600 w-5 h-5" /> {t('doctor.profileDetails')}
          </h2>
          <div className="space-y-4">
            {[
              { label: t('doctor.name'), value: userProfile.name },
              { label: t('profile.specialty'), value: userProfile.specialty },
              { label: t('profile.language'), value: userProfile.language },
              { label: t('doctor.location'), value: userProfile.location ? `${userProfile.location.lat.toFixed(4)}, ${userProfile.location.lng.toFixed(4)}` : 'Not set' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500">{item.label}</span>
                <span className="text-sm font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Patients Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="flex gap-2">
            <button onClick={() => setActiveTab("consultations")}
              className={`px-5 py-2 rounded-xl font-semibold text-sm transition-all ${activeTab === "consultations" ? "bg-indigo-600 text-white" : "bg-white text-slate-500 border border-slate-100"}`}>
              Pending ({pendingPatients.length})
            </button>
            <button onClick={() => setActiveTab("completed")}
              className={`px-5 py-2 rounded-xl font-semibold text-sm transition-all ${activeTab === "completed" ? "bg-indigo-600 text-white" : "bg-white text-slate-500 border border-slate-100"}`}>
              In Review ({inReviewPatients.length})
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-center gap-3 text-sm">
              <AlertTriangle className="w-5 h-5" /> {error}
            </div>
          )}

          {/* Pending Patients */}
          {activeTab === "consultations" && (
            loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-32 bg-white rounded-3xl"></div>
                <div className="h-32 bg-white rounded-3xl"></div>
              </div>
            ) : pendingPatients.length > 0 ? (
              <div className="space-y-4">
                {pendingPatients.map((patient, idx) => (
                  <motion.div key={patient.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                    className={`bg-white p-6 rounded-3xl shadow-sm border-2 transition-all ${
                      patient.reviewStatus === "EMERGENCY" ? "border-red-200 bg-red-50/30" : "border-slate-100"
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white ${
                          patient.status === 'YELLOW' ? 'bg-amber-500' : 'bg-red-500'
                        }`}>{patient.score}</div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-lg">{patient.patientName}</h4>
                          <p className="text-xs text-slate-500">{patient.symptoms?.substring(0, 60)}...</p>
                          <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <span>BP: {patient.bp}</span>
                            <span>Temp: {patient.temperature}°F</span>
                            <span>ASHA: {patient.ashaName}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => acceptPatient(patient.id)}
                          disabled={actionLoading === patient.id}
                          className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 text-sm font-bold disabled:opacity-50 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" /> Accept
                        </button>
                        <button onClick={() => rejectPatient(patient.id)}
                          disabled={actionLoading === patient.id}
                          className="bg-slate-100 text-slate-500 px-4 py-2 rounded-xl hover:bg-red-50 hover:text-red-600 text-sm font-bold disabled:opacity-50">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-white">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">{t('doctor.noConsultations')}</p>
              </div>
            )
          )}

          {/* In Review Patients */}
          {activeTab === "completed" && (
            inReviewPatients.length > 0 ? (
              <div className="space-y-4">
                {inReviewPatients.map((patient) => (
                  <div key={patient.id} className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-bold">
                        {patient.score}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{patient.patientName}</h4>
                        <p className="text-xs text-slate-500">{patient.symptoms?.substring(0, 50)}...</p>
                      </div>
                    </div>
                    <button onClick={() => completePatient(patient.id)}
                      disabled={actionLoading === patient.id}
                      className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Mark Complete
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-white">
                <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No patients currently in review.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
