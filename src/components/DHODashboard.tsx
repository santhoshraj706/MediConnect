import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Shield, UserCheck, UserX, Package, CheckCircle, Clock, Users, Activity, AlertTriangle, Trash2, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";

export default function DHODashboard({ userProfile }: { userProfile: any }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"doctors" | "supplies" | "overview">("overview");
  const [doctors, setDoctors] = useState<any[]>([]);
  const [supplyRequests, setSupplyRequests] = useState<any[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalDoctors: 0, verified: 0, pendingSupplies: 0, activePatients: 0 });

  // Listen for all doctors
  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "doctor"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDoctors(data);
      setStats(prev => ({
        ...prev,
        totalDoctors: data.length,
        verified: data.filter((d: any) => d.verified).length
      }));
    });
    return () => unsub();
  }, []);

  // Listen for supply requests
  useEffect(() => {
    const q = query(collection(db, "supplyRequests"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSupplyRequests(data);
      setStats(prev => ({
        ...prev,
        pendingSupplies: data.filter((s: any) => s.status === "pending").length
      }));
    });
    return () => unsub();
  }, []);

  // Listen for active patients
  useEffect(() => {
    const q = query(collection(db, "patients"));
    const unsub = onSnapshot(q, (snap) => {
      setStats(prev => ({ ...prev, activePatients: snap.size }));
    });
    return () => unsub();
  }, []);

  const toggleDoctorVerification = async (doctorId: string, currentStatus: boolean) => {
    setLoadingAction(doctorId);
    try {
      await updateDoc(doc(db, "users", doctorId), { verified: !currentStatus });
    } catch (err) {
      console.error("Failed to update doctor verification:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  const approveSupply = async (requestId: string) => {
    setLoadingAction(requestId);
    try {
      await updateDoc(doc(db, "supplyRequests", requestId), { status: "approved" });
    } catch (err) {
      console.error("Failed to approve supply:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  const completeSupply = async (requestId: string) => {
    setLoadingAction(requestId);
    try {
      await deleteDoc(doc(db, "supplyRequests", requestId));
    } catch (err) {
      console.error("Failed to complete supply:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
            <Shield className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('dho.portalTitle')}</h1>
            <p className="text-slate-500 text-sm">{userProfile.name} • District Health Officer</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: "overview", label: t('dho.overview'), icon: Activity },
          { key: "doctors", label: t('dho.doctorVerification'), icon: UserCheck },
          { key: "supplies", label: t('dho.supplyRequests'), icon: Package },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-all ${
              activeTab === tab.key
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t('dho.totalDoctors'), value: stats.totalDoctors, color: "bg-blue-50 text-blue-700 border-blue-100", icon: Users },
            { label: t('dho.verifiedDoctors'), value: stats.verified, color: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: UserCheck },
            { label: t('dho.pendingSupplies'), value: stats.pendingSupplies, color: "bg-amber-50 text-amber-700 border-amber-100", icon: Package },
            { label: t('dho.activePatients'), value: stats.activePatients, color: "bg-rose-50 text-rose-700 border-rose-100", icon: Activity },
          ].map((stat, idx) => (
            <div key={idx} className={`p-6 rounded-3xl border ${stat.color} flex flex-col items-center gap-2`}>
              <stat.icon className="w-8 h-8" />
              <span className="text-3xl font-black">{new Intl.NumberFormat('en-IN').format(stat.value)}</span>
              <span className="text-xs font-bold uppercase tracking-widest">{stat.label}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Doctor Verification Tab */}
      {activeTab === "doctors" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {doctors.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400">{t('dho.noDoctors')}</p>
            </div>
          ) : (
            doctors.map((doctor) => (
              <div key={doctor.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${doctor.verified ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {doctor.verified ? <UserCheck className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{doctor.name}</h4>
                    <p className="text-xs text-slate-500">{doctor.specialty || "General"} • {doctor.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleDoctorVerification(doctor.id, !!doctor.verified)}
                  disabled={loadingAction === doctor.id}
                  className={`px-5 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-50 ${
                    doctor.verified
                      ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
                      : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100"
                  }`}
                >
                  {doctor.verified ? t('dho.revoke') : t('dho.verify')}
                </button>
              </div>
            ))
          )}
        </motion.div>
      )}

      {/* Supply Requests Tab */}
      {activeTab === "supplies" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {supplyRequests.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400">{t('dho.noSupplyRequests')}</p>
            </div>
          ) : (
            supplyRequests.map((req) => (
              <div key={req.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">{req.items}</h4>
                    <p className="text-xs text-slate-500">{t('dho.requestedBy')}: <span className="font-semibold">{req.ashaName}</span> • {t('dho.qty')}: {req.quantity}</p>
                    {req.ashaEmail && <p className="text-xs text-slate-400">✉ {req.ashaEmail}</p>}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                    req.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {req.status}
                  </span>
                </div>
                
                {/* ASHA Location */}
                {req.location && req.location.lat ? (
                  <div className="bg-slate-50 rounded-xl p-3 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                      <span>ASHA Location: <strong>{req.location.lat.toFixed(4)}, {req.location.lng.toFixed(4)}</strong></span>
                    </div>
                    <a 
                      href={`https://www.google.com/maps?q=${req.location.lat},${req.location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100"
                    >
                      View on Map ↗
                    </a>
                  </div>
                ) : null}

                {req.notes && (
                  <p className="text-xs text-slate-400 italic mb-3 bg-slate-50 rounded-xl p-3">💬 {req.notes}</p>
                )}
                
                <div className="flex gap-2">
                  {req.status === "pending" && (
                    <button
                      onClick={() => approveSupply(req.id)}
                      disabled={loadingAction === req.id}
                      className="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all disabled:opacity-50"
                    >
                      {t('dho.approve')}
                    </button>
                  )}
                  {req.status === "approved" && (
                    <button
                      onClick={() => completeSupply(req.id)}
                      disabled={loadingAction === req.id}
                      className="flex-1 bg-indigo-600 text-white py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {t('dho.markCompleted')}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </motion.div>
      )}
    </div>
  );
}
