import React, { useState, useEffect } from "react";
import { useJsApiLoader, GoogleMap, HeatmapLayer, InfoWindow, Marker } from "@react-google-maps/api";
import { collection, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "./firebase";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { HeartPulse, Stethoscope, User as UserIcon, MapPin, Activity, ShieldAlert, Shield, Map as MapIcon, Users, Bell, ChevronRight, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import AshaDashboard from "./components/AshaDashboard";
import DoctorDashboard from "./components/DoctorDashboard";
import DHODashboard from "./components/DHODashboard";
import OutbreakHeatMap from "./components/OutbreakHeatMap";
import ChoroplethMap from "./components/ChoroplethMap";
import AIAssistant from "./components/AIAssistant";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./components/LanguageSwitcher";

const LIBRARIES: ("visualization" | "geometry")[] = ["visualization", "geometry"];

export default function App() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [roleSelection, setRoleSelection] = useState<"asha" | "doctor" | "dho" | null>(null);
  const [registrationData, setRegistrationData] = useState({ name: "", specialty: "", language: "", details: "" });
  const [activeTab, setActiveTab] = useState<"dashboard" | "outbreak" | "choropleth">("dashboard");
  const [authError, setAuthError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.MAPS_API_KEY || "",
    libraries: LIBRARIES,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setIsAuthReady(true);
      if (user) {
        fetchUserProfile(user.uid);
      } else {
        setLoadingProfile(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchUserProfile = async (uid: string) => {
    setLoadingProfile(true);
    setAuthError(null);
    
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await Promise.race([
        getDoc(docRef),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000))
      ]) as any;
      
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      } else {
        console.log("No profile found for user", uid);
        setUserProfile(null);
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      // On timeout or error, just proceed to profile setup with a warning
      setAuthError("Could not reach the database. You can still set up your profile — it will sync when connectivity is restored.");
      setUserProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
        processLoginError(error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const processLoginError = (error: any) => {
    console.error("Login failed", error);
    if (error.code === 'auth/operation-not-allowed') {
      setAuthError("Google Sign-In is not enabled for this project. Please contact the administrator.");
    } else if (error.code === 'auth/unauthorized-domain') {
       setAuthError("This domain is not authorized for authentication. Check your Firebase settings.");
    } else {
       setAuthError(error.message || "An unexpected error occurred during sign-in.");
    }
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !roleSelection) return;

    setLoadingProfile(true);
    setAuthError(null);
    try {
      // Get current location
      let lat = 13.0827, lng = 80.2707; // Default: Chennai
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch (geoErr) {
        console.warn("Geolocation unavailable, using default location.", geoErr);
      }

      const profile = {
        uid: user.uid,
        name: registrationData.name || user.displayName,
        role: roleSelection,
        location: { lat, lng },
        specialty: registrationData.specialty,
        language: registrationData.language,
        details: registrationData.details,
        email: user.email
      };

      await Promise.race([
        setDoc(doc(db, "users", user.uid), profile),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000))
      ]);
      setUserProfile(profile);
    } catch (error: any) {
      console.error("Registration failed", error);
      if (error.message === "timeout") {
        // If Firestore write timed out, store profile locally and proceed
        const localProfile = {
          uid: user.uid,
          name: registrationData.name || user.displayName,
          role: roleSelection,
          location: { lat: 13.0827, lng: 80.2707 },
          specialty: registrationData.specialty,
          language: registrationData.language,
          details: registrationData.details,
          email: user.email
        };
        setUserProfile(localProfile);
        setAuthError("Profile saved locally. It will sync to the database when connectivity is restored.");
      } else {
        setAuthError("Registration failed: " + (error.message || "Unknown error. Please try again."));
      }
    } finally {
      setLoadingProfile(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative">
        <div className="absolute top-6 right-6">
          <LanguageSwitcher />
        </div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-slate-100"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
            <HeartPulse className="text-white w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{t('app.title')}</h1>
          <p className="text-slate-500 mb-8">{t('app.tagline')}</p>
          
          {authError && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 text-sm text-left border border-red-100 italic">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{authError} {t('auth.errorSuffix')}</span>
            </div>
          )}

          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <UserIcon className="w-5 h-5" />
            {isLoggingIn ? t('app.signingIn') : t('app.signInGoogle')}
          </button>

          {/* Dev Mode Mock Login */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Developer Mode</p>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => {
                  const mockUser = { uid: "mock-asha", email: "asha@example.com", displayName: "Mock ASHA" };
                  setUser(mockUser as any);
                  setUserProfile({ uid: "mock-asha", name: "Mock ASHA", role: "asha", location: { lat: 13.0827, lng: 80.2707 } });
                  setLoadingProfile(false);
                }}
                className="text-[10px] font-bold p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500"
              >
                ASHA
              </button>
              <button 
                onClick={() => {
                  const mockUser = { uid: "mock-doctor", email: "doc@example.com", displayName: "Mock Doctor" };
                  setUser(mockUser as any);
                  setUserProfile({ uid: "mock-doctor", name: "Dr. Mock", role: "doctor", location: { lat: 13.05, lng: 80.25 }, verified: true });
                  setLoadingProfile(false);
                }}
                className="text-[10px] font-bold p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500"
              >
                Doctor
              </button>
              <button 
                onClick={() => {
                  const mockUser = { uid: "mock-dho", email: "dho@example.com", displayName: "Mock DHO" };
                  setUser(mockUser as any);
                  setUserProfile({ uid: "mock-dho", name: "DHO Office", role: "dho" });
                  setLoadingProfile(false);
                }}
                className="text-[10px] font-bold p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500"
              >
                DHO
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 gap-6 relative">
        <div className="absolute top-6 right-6">
          <LanguageSwitcher />
        </div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <div className="text-center">
            <p className="text-slate-600 font-medium">{t('app.connecting')}</p>
            {authError && (
                <div className="mt-4 max-w-sm">
                    <p className="text-sm text-red-500 mb-4 italic">{authError}</p>
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={() => fetchUserProfile(user.uid)}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest bg-white px-4 py-2 rounded-full border border-indigo-100 shadow-sm"
                        >
                            {t('app.retryConnection')}
                        </button>
                        <p className="text-[10px] text-slate-400 mt-2 px-4" dangerouslySetInnerHTML={{ __html: t('app.stillDisconnected') }} />
                    </div>
                </div>
            )}
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative">
        <div className="absolute top-6 right-6">
          <LanguageSwitcher />
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full bg-white rounded-3xl shadow-xl p-10 border border-slate-100"
        >
          <h2 className="text-3xl font-bold text-slate-900 mb-2">{t('profile.completeProfile')}</h2>
          <p className="text-slate-500 mb-4">{t('profile.profileSub')}</p>
          
          {authError && (
            <div className="mb-6 p-4 bg-amber-50 text-amber-800 rounded-2xl flex items-start gap-3 text-sm border border-amber-200">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Database connectivity issue</p>
                <p className="text-xs mt-1">{authError}</p>
              </div>
              <button onClick={() => setAuthError(null)} className="ml-auto text-xs font-bold hover:text-amber-900">&times;</button>
            </div>
          )}
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            <button 
              onClick={() => setRoleSelection("asha")}
              className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${roleSelection === "asha" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-100 text-slate-500 hover:border-indigo-200"}`}
            >
              <HeartPulse className="w-10 h-10" />
              <span className="font-bold">{t('profile.ashaWorker')}</span>
            </button>
            <button 
              onClick={() => setRoleSelection("doctor")}
              className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${roleSelection === "doctor" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-100 text-slate-500 hover:border-indigo-200"}`}
            >
              <Stethoscope className="w-10 h-10" />
              <span className="font-bold">{t('profile.doctor')}</span>
            </button>
            <button 
              onClick={() => setRoleSelection("dho")}
              className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${roleSelection === "dho" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-100 text-slate-500 hover:border-emerald-200"}`}
            >
              <Shield className="w-10 h-10" />
              <span className="font-bold">{t('profile.dho')}</span>
            </button>
          </div>

          {roleSelection && (
            <form onSubmit={handleRegistration} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{t('profile.fullName')}</label>
                <input 
                  required
                  value={registrationData.name}
                  onChange={(e) => setRegistrationData({...registrationData, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder={t('profile.enterName')}
                />
              </div>
              {roleSelection === "doctor" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">{t('profile.specialty')}</label>
                    <input 
                      required
                      value={registrationData.specialty}
                      onChange={(e) => setRegistrationData({...registrationData, specialty: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="e.g. Pediatrician"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">{t('profile.language')}</label>
                    <input 
                      required
                      value={registrationData.language}
                      onChange={(e) => setRegistrationData({...registrationData, language: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="e.g. Tamil, English"
                    />
                  </div>
                </div>
              )}
              <button className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                {t('profile.completeRegistration')}
              </button>
              <p className="text-center text-xs text-slate-400">We will use your current location for geo-matching.</p>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="text-slate-500 font-medium">Loading Maps...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col z-10">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-100">
              <HeartPulse className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">MediConnect</span>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <button 
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "dashboard" ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-500 hover:bg-slate-50"}`}
            >
              <Activity className="w-5 h-5" />
              {t('nav.dashboard')}
            </button>
            <button 
              onClick={() => setActiveTab("outbreak")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "outbreak" ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-500 hover:bg-slate-50"}`}
            >
              <ShieldAlert className="w-5 h-5" />
              {t('nav.outbreaks')}
            </button>
            <button 
              onClick={() => setActiveTab("choropleth")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "choropleth" ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-500 hover:bg-slate-50"}`}
            >
              <MapIcon className="w-5 h-5" />
              {t('nav.healthMap')}
            </button>
          </nav>

          <div className="p-4 border-t border-slate-100">
            <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ""} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm border-2 border-white shadow-sm">
                  {(userProfile.name || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{userProfile.name}</p>
                <p className="text-xs text-slate-500 truncate uppercase tracking-widest font-bold">{userProfile.role}</p>
              </div>
            </div>
            <button 
              onClick={() => {
                // Handle both real Firebase auth and mock users
                if (auth.currentUser) {
                  auth.signOut();
                } else {
                  setUser(null);
                  setUserProfile(null);
                  setIsAuthReady(true);
                  setLoadingProfile(false);
                }
              }}
              className="w-full mt-4 text-xs text-slate-400 hover:text-red-500 font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              {activeTab === "dashboard" && t('nav.dashboard')}
              {activeTab === "outbreak" && t('nav.outbreaks')}
              {activeTab === "choropleth" && t('nav.healthMap')}
            </h2>
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <div className="relative">
                <Bell className="w-6 h-6 text-slate-400 cursor-pointer" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold">3</span>
              </div>
            </div>
          </header>

          <div className="flex-1 p-8 overflow-y-auto">
            <AnimatePresence mode="wait">
              {activeTab === "dashboard" && (
                <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  {userProfile.role === "asha" ? (
                    <AshaDashboard userProfile={userProfile} />
                  ) : userProfile.role === "dho" ? (
                    <DHODashboard userProfile={userProfile} />
                  ) : (
                    <DoctorDashboard userProfile={userProfile} />
                  )}
                </motion.div>
              )}
              {activeTab === "outbreak" && (
                <motion.div key="outbreak" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <OutbreakHeatMap />
                </motion.div>
              )}
              {activeTab === "choropleth" && (
                <motion.div key="choropleth" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <ChoroplethMap />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
        <AIAssistant />
      </div>
  );
}

