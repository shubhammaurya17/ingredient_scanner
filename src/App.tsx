import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  History, 
  User, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Info, 
  ArrowLeft,
  ArrowLeftRight,
  Loader2,
  X,
  Plus,
  Trash2,
  LogOut,
  Scan as ScanIcon,
  Search,
  Star,
  Heart,
  Trophy,
  Zap,
  Target,
  AlertTriangle,
  Scale,
  ThumbsUp,
  ThumbsDown,
  Activity,
  Share2,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signOut,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  limit
} from 'firebase/firestore';
import { cn } from './lib/utils';
import { ScanResult, UserProfile, Verdict, SuitabilityStatus, AnalysisMode, Collection } from './types';
import { analyzeIngredientLabel, extractIngredientsText, analyzeIngredientsFromText } from './services/geminiService';
import { resizeImage, generatePlaceholder } from './lib/imageUtils';
import Markdown from 'react-markdown';

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md', 
  isLoading,
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}) => {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm active:scale-95',
    secondary: 'bg-brand-100 text-brand-700 hover:bg-brand-200 active:scale-95',
    outline: 'border-2 border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95',
    ghost: 'text-gray-600 hover:bg-gray-100 active:scale-95',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 active:scale-95',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2.5 rounded-xl font-medium',
    lg: 'px-6 py-4 rounded-2xl font-semibold text-lg',
    icon: 'p-3 rounded-xl',
  };

  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center transition-all disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
      {children}
    </button>
  );
};

const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden', className)} {...props}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'gray', className }: { children: React.ReactNode, variant?: 'green' | 'yellow' | 'red' | 'blue' | 'gray', className?: string }) => {
  const variants = {
    green: 'bg-green-50 text-green-700 border-green-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    gray: 'bg-gray-50 text-gray-700 border-gray-100',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-flex items-center', variants[variant], className)}>
      {children}
    </span>
  );
};

const ProgressiveImage = ({ 
  src, 
  placeholder, 
  alt, 
  className 
}: { 
  src: string; 
  placeholder?: string; 
  alt: string; 
  className?: string 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={cn("relative overflow-hidden bg-gray-100", className)}>
      {placeholder && !isLoaded && (
        <img
          src={placeholder}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 transition-opacity duration-500"
          aria-hidden="true"
        />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-500",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

// --- Screens ---

const LoginScreen = ({ externalError }: { externalError?: string | null }) => {
  const [error, setError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  const displayError = externalError || error;

  const handleGoogleLogin = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google login failed", err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError("Google login failed. Please try again.");
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError(null);
    setIsGuestLoading(true);
    try {
      await signInAnonymously(auth);
    } catch (err: any) {
      console.error("Guest login failed", err);
      setError("Guest login failed. Please try again.");
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-brand-50 to-white">
      <div className="w-20 h-20 bg-brand-600 rounded-3xl flex items-center justify-center shadow-xl shadow-brand-200 mb-8">
        <ScanIcon className="w-10 h-10 text-white" />
      </div>
      
      <h1 className="text-4xl font-display font-bold text-gray-900 mb-2">Ingredia</h1>
      <p className="text-gray-500 text-center mb-12 max-w-xs">
        Understand what's inside your food with AI-powered label scanning.
      </p>
      
      <div className="w-full max-w-xs space-y-4">
        {displayError && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-700 leading-relaxed">
              <p className="font-bold mb-1">Authentication Error</p>
              <p>{displayError}</p>
            </div>
          </div>
        )}

        <Button 
          size="lg" 
          className="w-full bg-white text-gray-700 border-2 border-gray-100 hover:bg-gray-50 shadow-none"
          onClick={handleGoogleLogin}
          isLoading={isGoogleLoading}
        >
          {!isGoogleLoading && (
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          Continue with Google
        </Button>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-400 font-bold tracking-widest">Or</span>
          </div>
        </div>

        <Button 
          variant="outline"
          size="lg"
          className="w-full"
          onClick={handleGuestLogin}
          isLoading={isGuestLoading}
        >
          Continue as Guest
        </Button>
      </div>

      <p className="mt-12 text-xs text-gray-400 text-center max-w-[240px]">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
};

const GuestNameSetup = ({ uid }: { uid: string }) => {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Update Firebase Auth profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name.trim() });
      }

      // Update/Create Firestore profile
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        uid,
        displayName: name.trim(),
        createdAt: serverTimestamp(),
      }, { merge: true });
      
      // The onSnapshot in App will pick up the change
    } catch (err: any) {
      console.error("Failed to save name", err);
      setError("Failed to save name. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-brand-50 to-white">
      <div className="w-20 h-20 bg-brand-100 rounded-3xl flex items-center justify-center mb-8">
        <User className="w-10 h-10 text-brand-600" />
      </div>
      
      <h1 className="text-3xl font-display font-bold text-gray-900 mb-2">Welcome!</h1>
      <p className="text-gray-500 text-center mb-12 max-w-xs">
        What should we call you?
      </p>
      
      <form onSubmit={handleSaveName} className="w-full max-w-xs space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
            Your Name
          </label>
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-4 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-100 focus:border-brand-600 outline-none transition-all font-medium"
            required
            autoFocus
          />
        </div>
        
        <Button 
          type="submit"
          size="lg" 
          className="w-full"
          isLoading={isLoading}
          disabled={!name.trim()}
        >
          Continue to App
        </Button>
      </form>
    </div>
  );
};

const HomeScreen = ({ 
  onScan, 
  onUpload, 
  recentScans, 
  onSelectScan, 
  totalScans,
  currentMode,
  onModeChange,
  onViewHistory,
  onProfileClick
}: { 
  onScan: () => void, 
  onUpload: () => void, 
  recentScans: ScanResult[], 
  onSelectScan: (scan: ScanResult) => void, 
  totalScans: number,
  currentMode: AnalysisMode,
  onModeChange: (mode: AnalysisMode) => void,
  onViewHistory: () => void,
  onProfileClick: () => void
}) => {
  const modes: { id: AnalysisMode; label: string; icon: any; color: string }[] = [
    { id: 'General', label: 'General', icon: ScanIcon, color: 'bg-blue-50 text-blue-600' },
    { id: 'Diabetic', label: 'Diabetic', icon: AlertCircle, color: 'bg-red-50 text-red-600' },
    { id: 'Kids', label: 'Kids', icon: User, color: 'bg-purple-50 text-purple-600' },
    { id: 'Gym', label: 'Gym', icon: ShieldCheck, color: 'bg-green-50 text-green-600' },
  ];

  return (
    <div className="p-6 space-y-8 pb-24 safe-area-bottom">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">
            Hello, {auth.currentUser?.displayName?.split(' ')[0] || auth.currentUser?.phoneNumber?.slice(-10) || 'User'}
          </h1>
          <p className="text-gray-500">Scan. Compare. Choose Better</p>
        </div>
        <button 
          onClick={onProfileClick}
          className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden active:scale-90 transition-transform"
        >
          {auth.currentUser?.photoURL ? (
            <img src={auth.currentUser.photoURL} alt="Profile" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-brand-600" />
          )}
        </button>
      </header>

      {/* Mode Selector */}
      <div className="space-y-3">
        <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Analysis Mode</h2>
        <div className="grid grid-cols-4 gap-2">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95",
                currentMode === mode.id 
                  ? "border-brand-600 bg-brand-50 ring-2 ring-brand-100" 
                  : "border-gray-100 bg-white hover:border-gray-200"
              )}
            >
              <mode.icon className={cn("w-5 h-5 mb-1", currentMode === mode.id ? "text-brand-600" : "text-gray-400")} />
              <span className={cn("text-[10px] font-bold", currentMode === mode.id ? "text-brand-700" : "text-gray-500")}>{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Button 
          onClick={onScan}
          className="w-full h-48 flex-col space-y-4 bg-brand-600 hover:bg-brand-700 text-white rounded-[2rem] shadow-xl shadow-brand-100"
          variant="primary"
        >
          <div className="p-4 bg-white/20 rounded-2xl">
            <Camera className="w-10 h-10" />
          </div>
          <div className="text-center">
            <span className="text-xl font-bold block">Capture Ingredients</span>
            <span className="text-sm text-white/70">Instant AI analysis & health score</span>
          </div>
        </Button>
        
        {/* Capture Guidance */}
        <div className="bg-blue-50/50 rounded-2xl p-4 flex items-start space-x-3 border border-blue-100/50">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-blue-900">For faster results:</p>
            <ul className="text-[10px] text-blue-700 space-y-1 list-disc pl-3">
              <li>Capture only the ingredients section</li>
              <li>Ensure good lighting and steady hands</li>
              <li>Keep the text clear and close</li>
            </ul>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Button 
            onClick={onUpload}
            className="h-20 space-x-2 rounded-2xl"
            variant="secondary"
          >
            <Upload className="w-5 h-5" />
            <span>Upload</span>
          </Button>
          <Card className="flex items-center justify-center h-20 bg-gray-50 border-dashed">
             <div className="text-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Total Scans</span>
                <span className="text-lg font-bold text-gray-700">{totalScans}</span>
             </div>
          </Card>
        </div>
      </div>

      <div className="flex items-center justify-between px-2 py-3 bg-brand-50 rounded-2xl border border-brand-100">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-brand-600" />
          <span className="text-[10px] font-bold text-brand-700 uppercase tracking-tight">Trust-First AI Analysis</span>
        </div>
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-brand-600" />
          <span className="text-[10px] font-bold text-brand-700 uppercase tracking-tight">Science-Backed</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Recent Activity</h2>
          <Button variant="ghost" size="sm" onClick={onViewHistory}>View History</Button>
        </div>
        
        {recentScans.length === 0 ? (
          <Card className="p-8 flex flex-col items-center justify-center text-center space-y-3 border-dashed bg-transparent">
            <div className="p-3 bg-gray-100 rounded-full">
              <Search className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-400 text-sm">No scans yet. Start by scanning a food label!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentScans.map((scan) => {
              return (
                <Card 
                  key={scan.id} 
                  className="p-3 flex items-center space-x-4 active:bg-gray-50 transition-colors cursor-pointer relative overflow-hidden"
                  onClick={() => onSelectScan(scan)}
                >
                  <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {scan.imageUrl ? (
                      <ProgressiveImage 
                        src={scan.imageUrl} 
                        placeholder={scan.placeholderUrl}
                        alt={scan.product_name} 
                        className="w-full h-full"
                      />
                    ) : (
                      <ScanIcon className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{scan.product_name}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant={scan.overall_verdict === 'Good' ? 'green' : scan.overall_verdict === 'Moderate' ? 'yellow' : 'red'}>
                        {scan.overall_verdict}
                      </Badge>
                      <span className="text-[10px] font-bold text-brand-600">{scan.health_score}/100</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const CompareScreen = ({ 
  scans, 
  p1,
  p2,
  setP1,
  setP2,
  onCompare, 
  onScan 
}: { 
  scans: ScanResult[], 
  p1: ScanResult | null,
  p2: ScanResult | null,
  setP1: (s: ScanResult | null) => void,
  setP2: (s: ScanResult | null) => void,
  onCompare: (p1: ScanResult, p2: ScanResult) => void,
  onScan: (slot: 1 | 2) => void
}) => {
  const [method, setMethod] = useState<'scan' | 'mixed' | 'history'>('scan');
  const [selectingFor, setSelectingFor] = useState<1 | 2 | null>(null);

  const handleSelectFromHistory = (scan: ScanResult) => {
    if (selectingFor === 1) setP1(scan);
    if (selectingFor === 2) setP2(scan);
    setSelectingFor(null);
  };

  const isReady = p1 && p2;

  if (selectingFor) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24 safe-area-bottom">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => setSelectingFor(null)} className="mr-2">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-lg font-bold">Select from History</h1>
        </div>
        <div className="p-6 space-y-3">
          {scans.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No scans found in history.</div>
          ) : (
            scans.map(scan => (
              <Card 
                key={scan.id} 
                className="p-3 flex items-center space-x-4 active:bg-gray-50 cursor-pointer"
                onClick={() => handleSelectFromHistory(scan)}
              >
                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {scan.imageUrl ? (
                    <ProgressiveImage 
                      src={scan.imageUrl} 
                      placeholder={scan.placeholderUrl}
                      alt={scan.product_name} 
                      className="w-full h-full"
                    />
                  ) : (
                    <ScanIcon className="w-6 h-6 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm truncate">{scan.product_name || 'Unnamed Product'}</h3>
                  <Badge variant={scan.overall_verdict === 'Good' ? 'green' : scan.overall_verdict === 'Moderate' ? 'yellow' : 'red'}>
                    {scan.overall_verdict || 'Unknown'}
                  </Badge>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 safe-area-bottom">
      <div className="p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Compare</h1>
          <p className="text-gray-500 text-sm">Compare two similar food products to see which is the better choice.</p>
        </div>

        {/* Method Selector */}
        <div className="flex p-1 bg-gray-100 rounded-2xl">
          {(['scan', 'mixed', 'history'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMethod(m);
                setP1(null);
                setP2(null);
              }}
              className={cn(
                "flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all",
                method === m ? "bg-white text-brand-600 shadow-sm" : "text-gray-400"
              )}
            >
              {m === 'scan' ? 'Scan 2' : m === 'mixed' ? 'Scan + History' : '2 History'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Slot 1 */}
          <div className="space-y-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Product 1</span>
            <Card className={cn(
              "h-48 flex flex-col items-center justify-center border-dashed relative group overflow-hidden",
              p1 ? "border-solid border-brand-200 bg-brand-50/30" : "bg-white"
            )}>
              {p1 ? (
                <>
                {p1.imageUrl && (
                  <ProgressiveImage 
                    src={p1.imageUrl} 
                    placeholder={p1.placeholderUrl}
                    alt={p1.product_name} 
                    className="absolute inset-0 w-full h-full opacity-20"
                  />
                )}
                  <div className="relative z-10 text-center p-4">
                    <h3 className="font-bold text-brand-900 mb-1">{p1.product_name}</h3>
                    <Badge variant="blue">{p1.health_score} Score</Badge>
                    <div className="mt-4 flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setP1(null)} className="bg-white">Replace</Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center space-y-3">
                  <button 
                    onClick={() => method === 'history' ? setSelectingFor(1) : onScan(1)}
                    className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors active:scale-95"
                  >
                    <Plus className="w-6 h-6 text-gray-400" />
                  </button>
                  {method === 'history' ? (
                    <Button variant="ghost" size="sm" onClick={() => setSelectingFor(1)}>Select from History</Button>
                  ) : (
                    <div className="flex flex-col items-center space-y-2">
                      <Button variant="secondary" size="sm" onClick={() => onScan(1)}>Scan / Upload</Button>
                      {method === 'mixed' && <span className="text-[10px] text-gray-400 font-bold">New Scan</span>}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          <div className="flex justify-center -my-3 relative z-10">
            <div className="bg-white p-2 rounded-full shadow-md border border-gray-100">
              <ArrowLeftRight className="w-5 h-5 text-brand-600" />
            </div>
          </div>

          {/* Slot 2 */}
          <div className="space-y-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Product 2</span>
            <Card className={cn(
              "h-48 flex flex-col items-center justify-center border-dashed relative group overflow-hidden",
              p2 ? "border-solid border-brand-200 bg-brand-50/30" : "bg-white"
            )}>
              {p2 ? (
                <>
                {p2.imageUrl && (
                  <ProgressiveImage 
                    src={p2.imageUrl} 
                    placeholder={p2.placeholderUrl}
                    alt={p2.product_name} 
                    className="absolute inset-0 w-full h-full opacity-20"
                  />
                )}
                  <div className="relative z-10 text-center p-4">
                    <h3 className="font-bold text-brand-900 mb-1">{p2.product_name}</h3>
                    <Badge variant="blue">{p2.health_score} Score</Badge>
                    <div className="mt-4 flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setP2(null)} className="bg-white">Replace</Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center space-y-3">
                  <button 
                    onClick={() => method === 'scan' ? onScan(2) : setSelectingFor(2)}
                    className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors active:scale-95"
                  >
                    <Plus className="w-6 h-6 text-gray-400" />
                  </button>
                  {method === 'scan' ? (
                    <Button variant="secondary" size="sm" onClick={() => onScan(2)}>Scan / Upload</Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setSelectingFor(2)}>Select from History</Button>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>

        <Button 
          variant="primary" 
          size="lg" 
          className="w-full shadow-xl shadow-brand-100"
          disabled={!isReady}
          onClick={() => p1 && p2 && onCompare(p1, p2)}
        >
          Compare Now
        </Button>
      </div>
    </div>
  );
};

const formatValue = (v: string | number | undefined | null, defaultUnit: string) => {
  if (v === undefined || v === null) return `0 ${defaultUnit}`;
  if (typeof v === 'number') return `${v} ${defaultUnit}`;
  
  const str = String(v);
  
  // Extract the first number found
  const numMatch = str.match(/[0-9.]+/);
  const numPart = numMatch ? numMatch[0] : '';
  
  // Extract the unit part (everything after the first number)
  const unitMatch = str.match(/[a-zA-Z% /]+/);
  let unitPart = (unitMatch && unitMatch[0]) ? unitMatch[0].trim().toLowerCase() : '';
  
  // Normalize units
  if (unitPart.includes('mlg') || unitPart.includes('milligram')) unitPart = 'mg';
  else if (unitPart.includes('gg') || unitPart.includes('gram')) unitPart = 'g';
  else if (unitPart.includes('kcal') || unitPart.includes('calorie')) unitPart = 'kcal';
  else if (unitPart.includes('ml') || unitPart.includes('milliliter')) unitPart = 'ml';
  
  // Simplify complex units (e.g., "g per ml" -> "g", "mg/100ml" -> "mg")
  if (unitPart.includes('per')) {
    unitPart = unitPart.split('per')[0].trim();
  }
  if (unitPart.includes('/')) {
    unitPart = unitPart.split('/')[0].trim();
  }

  // Final cleanup of unitPart to keep only the first word or standard unit
  const simpleUnits = ['g', 'mg', 'kcal', 'ml', '%'];
  const foundSimple = simpleUnits.find(u => unitPart.startsWith(u));
  if (foundSimple) unitPart = foundSimple;

  if (!unitPart) unitPart = defaultUnit;
  
  return `${numPart} ${unitPart}`;
};

const ComparisonResultScreen = ({ products, onBack }: { products: ScanResult[], onBack: () => void }) => {
  if (products.length < 2) return null;
  const [p1, p2] = products;

  const calculateComparison = (prod1: ScanResult, prod2: ScanResult) => {
    const getPoints = (p: ScanResult) => {
      let points = (p.health_score / 100) * 20; // 20% weight for base score

      // Ingredient Risks (30% weight)
      const risks = (p.ingredient_breakdown || []).filter(i => i.risk_level !== 'Low');
      const highRisks = risks.filter(i => i.risk_level === 'High').length;
      const medRisks = risks.filter(i => i.risk_level === 'Medium').length;
      points -= (highRisks * 5);
      points -= (medRisks * 2);

      // Sugar (15% weight)
      if (p.nutrition_summary?.sugar?.level === 'High') points -= 15;
      else if (p.nutrition_summary?.sugar?.level === 'Moderate') points -= 7;

      // Sodium (15% weight)
      if (p.nutrition_summary?.sodium?.level === 'High') points -= 15;
      else if (p.nutrition_summary?.sodium?.level === 'Moderate') points -= 7;

      // Positives (10% weight)
      if (p.nutrition_summary?.protein?.level === 'High') points += 5;
      if (p.nutrition_summary?.fiber?.level === 'High') points += 5;

      // Processing (10% weight)
      if (p.processing_level?.toLowerCase().includes('ultra')) points -= 10;

      return points;
    };

    const points1 = getPoints(prod1);
    const points2 = getPoints(prod2);
    const diff = Math.abs(points1 - points2);

    const isP1Bad = prod1.overall_verdict === 'Bad' || prod1.health_score < 45;
    const isP2Bad = prod2.overall_verdict === 'Bad' || prod2.health_score < 45;
    const isP1Good = prod1.overall_verdict === 'Good' && prod1.health_score > 70;
    const isP2Good = prod2.overall_verdict === 'Good' && prod2.health_score > 70;

    let outcomeType: 'both_good' | 'one_good_one_bad' | 'both_bad' | 'mixed' = 'mixed';
    if (isP1Bad && isP2Bad) outcomeType = 'both_bad';
    else if ((isP1Good && isP2Bad) || (isP2Good && isP1Bad)) outcomeType = 'one_good_one_bad';
    else if (isP1Good && isP2Good) outcomeType = 'both_good';

    let status: 'clear' | 'slight' | 'close' = 'close';
    if (diff > 12) status = 'clear';
    else if (diff > 4) status = 'slight';

    const winner = points1 >= points2 ? prod1 : prod2;
    const loser = points1 >= points2 ? prod2 : prod1;

    // Generate Reason
    let reason = "";
    if (outcomeType === 'both_bad') {
      reason = "Both products have significant health concerns. Neither is a strong recommendation for regular use.";
    } else if (outcomeType === 'both_good') {
      reason = `${winner.product_name} is the slightly better pick, but both are generally acceptable options.`;
    } else if (status === 'close') {
      reason = "This is a very close comparison with minor trade-offs between both products.";
    } else {
      const reasons = [];
      const wRisks = (winner.ingredient_breakdown || []).filter(i => i.risk_level !== 'Low').length;
      const lRisks = (loser.ingredient_breakdown || []).filter(i => i.risk_level !== 'Low').length;
      
      if (wRisks < lRisks) reasons.push("cleaner ingredient profile");
      if (winner.nutrition_summary?.sugar?.level !== 'High' && loser.nutrition_summary?.sugar?.level === 'High') reasons.push("lower sugar impact");
      if (winner.nutrition_summary?.sodium?.level !== 'High' && loser.nutrition_summary?.sodium?.level === 'High') reasons.push("better sodium control");
      if (winner.health_score > loser.health_score + 10) reasons.push("higher overall quality");
      
      if (reasons.length > 0) {
        reason = `${winner.product_name} is the ${status === 'clear' ? 'clear' : 'slightly'} better choice due to its ${reasons.join(' and ')}.`;
      } else {
        reason = `${winner.product_name} offers a more balanced nutritional profile for daily consumption.`;
      }
    }

    return { winner, loser, status, outcomeType, reason, diff };
  };

  const comparison = calculateComparison(p1, p2);
  const betterProduct = comparison.winner;
  const otherProduct = comparison.loser;

  const getMetricWinner = (v1: number, v2: number, better: 'lower' | 'higher') => {
    if (v1 === v2) return null;
    if (better === 'lower') return v1 < v2 ? 1 : 2;
    return v1 > v2 ? 1 : 2;
  };

  const MetricRow = ({ label, v1, v2, unit = '', better = 'lower' }: { label: string, v1: string | number, v2: string | number, unit?: string, better?: 'lower' | 'higher' }) => {
    const val1 = typeof v1 === 'string' ? parseFloat(v1.replace(/[^0-9.]/g, '')) || 0 : v1;
    const val2 = typeof v2 === 'string' ? parseFloat(v2.replace(/[^0-9.]/g, '')) || 0 : v2;
    const winner = getMetricWinner(val1, val2, better);
    
    return (
      <div className="py-3 border-b border-gray-50 last:border-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className={cn(
            "flex-1 p-2 rounded-xl text-center transition-all",
            winner === 1 ? "bg-green-50 ring-1 ring-green-100" : "bg-gray-50/50"
          )}>
            <span className={cn("text-sm font-bold", winner === 1 ? "text-green-700" : "text-gray-600")}>
              {formatValue(v1, unit)}
            </span>
          </div>
          <div className="w-px h-4 bg-gray-100" />
          <div className={cn(
            "flex-1 p-2 rounded-xl text-center transition-all",
            winner === 2 ? "bg-green-50 ring-1 ring-green-100" : "bg-gray-50/50"
          )}>
            <span className={cn("text-sm font-bold", winner === 2 ? "text-green-700" : "text-gray-600")}>
              {formatValue(v2, unit)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const getRisks = (p: ScanResult) => (p.ingredient_breakdown || []).filter(i => i.risk_level === 'High' || i.risk_level === 'Medium');
  const p1Risks = getRisks(p1);
  const p2Risks = getRisks(p2);
  const betterRisks = getRisks(betterProduct);
  const otherRisks = getRisks(otherProduct);

  const handleShare = async () => {
    const text = `I compared ${p1.product_name} and ${p2.product_name} using AI Ingredient Scanner. The winner is ${betterProduct.product_name}!`;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Product Comparison',
          text: text,
          url: url,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        alert('Comparison summary copied to clipboard!');
      } catch (err) {
        console.error('Error copying to clipboard:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 safe-area-bottom">
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 flex items-center">
        <Button variant="ghost" size="icon" onClick={onBack} className="mr-2">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Comparison</h1>
        <Button variant="ghost" size="icon" onClick={handleShare}>
          <Share2 className="w-5 h-5 text-gray-600" />
        </Button>
      </div>

      <div className="p-6 space-y-8">
        {/* 1. Top Winner Summary */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-6 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden",
            comparison.outcomeType === 'both_bad' ? "bg-red-600 shadow-red-200" :
            comparison.outcomeType === 'both_good' ? "bg-green-600 shadow-green-200" :
            comparison.status === 'clear' ? "bg-brand-600 shadow-brand-200" : 
            comparison.status === 'slight' ? "bg-blue-600 shadow-blue-200" : 
            "bg-gray-800 shadow-gray-200"
          )}
        >
          <div className="absolute -top-6 -right-6 opacity-10 rotate-12">
            {comparison.outcomeType === 'both_bad' ? <AlertTriangle className="w-40 h-40" /> : <Trophy className="w-40 h-40" />}
          </div>
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-4">
              <div className="p-1.5 bg-white/20 rounded-lg">
                {comparison.outcomeType === 'both_bad' ? <AlertTriangle className="w-4 h-4 text-white" /> :
                 comparison.status === 'close' ? <Scale className="w-4 h-4 text-white" /> : <Trophy className="w-4 h-4 text-white" />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">
                {comparison.outcomeType === 'both_bad' ? 'Neither Recommended' :
                 comparison.outcomeType === 'both_good' ? 'Both are Good Choices' :
                 comparison.status === 'clear' ? 'Clear Better Pick' : 
                 comparison.status === 'slight' ? 'Slightly Better Pick' : 
                 'Very Close Call'}
              </span>
            </div>
            <h3 className="text-3xl font-display font-black mb-3 leading-tight">
              {comparison.outcomeType === 'both_bad' ? 'Both Have Significant Concerns' :
               comparison.status === 'close' ? 'Both are similar' : betterProduct.product_name}
            </h3>
            <div className="flex items-center space-x-3 p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
              <Zap className="w-5 h-5 text-yellow-300 fill-yellow-300" />
              <p className="text-sm font-medium text-white/90">
                {comparison.reason}
              </p>
            </div>
          </div>
        </motion.div>

        {/* 2. Product Header Comparison */}
        <div className="grid grid-cols-2 gap-4">
          {[p1, p2].map((p, i) => (
            <Card key={i} className={cn(
              "p-4 flex flex-col items-center space-y-3 relative overflow-hidden",
              betterProduct.id === p.id ? "ring-2 ring-brand-500 border-transparent" : "border-gray-100"
            )}>
              {betterProduct.id === p.id && (
                <div className="absolute top-0 right-0 p-1.5 bg-brand-500 rounded-bl-xl">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              )}
              <div className="w-20 h-20 rounded-2xl bg-gray-50 overflow-hidden shadow-inner flex items-center justify-center">
                {p.imageUrl ? (
                  <ProgressiveImage 
                    src={p.imageUrl} 
                    placeholder={p.placeholderUrl}
                    alt={p.product_name} 
                    className="w-full h-full"
                  />
                ) : (
                  <ScanIcon className="w-8 h-8 text-gray-200" />
                )}
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-wider truncate w-32">{p.product_name}</h3>
                <div className="flex items-center justify-center space-x-1">
                  <span className="text-2xl font-display font-black text-gray-900">{p.health_score}</span>
                  <span className="text-[10px] font-bold text-gray-400">/100</span>
                </div>
                <Badge variant={p.overall_verdict === 'Good' ? 'green' : p.overall_verdict === 'Moderate' ? 'yellow' : 'red'} className="text-[8px] px-1.5 py-0">
                  {p.overall_verdict}
                </Badge>
              </div>
            </Card>
          ))}
        </div>

        {/* 3. Key Differences / Concerns */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 px-1">
            <Zap className="w-4 h-4 text-brand-600" />
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
              {comparison.outcomeType === 'both_bad' ? 'Core Concerns' : 'Key Differences'}
            </h2>
          </div>
          <Card className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-50">
              <div className="space-y-2">
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider flex items-center",
                  comparison.outcomeType === 'both_bad' ? "text-red-600" : "text-green-600"
                )}>
                  {comparison.outcomeType === 'both_bad' ? <AlertCircle className="w-3 h-3 mr-1" /> : <ThumbsUp className="w-3 h-3 mr-1" />}
                  {comparison.outcomeType === 'both_bad' ? `Risks (${p1.product_name})` : 'Pros'}
                </span>
                <ul className="space-y-1.5">
                  {comparison.outcomeType === 'both_bad' ? (
                    (p1.warnings || []).slice(0, 3).map((r, i) => (
                      <li key={i} className="text-[11px] font-medium text-gray-600 leading-tight">• {r}</li>
                    ))
                  ) : (
                    (betterProduct.confirmed_facts || [])
                      .filter(f => {
                        const low = f.toLowerCase();
                        return !low.includes('sugar') && 
                               !low.includes('additive') && 
                               !low.includes('ins') && 
                               !low.includes('preservative') &&
                               !low.includes('artificial') &&
                               !low.includes('syrup') &&
                               !low.includes('carbonated');
                      })
                      .concat((betterProduct.top_reasons || []).filter(r => {
                        const low = r.toLowerCase();
                        return !low.includes('high') && !low.includes('bad') && !low.includes('avoid');
                      }))
                      .slice(0, 3).map((r, i) => (
                        <li key={i} className="text-[11px] font-medium text-gray-600 leading-tight">• {r}</li>
                      ))
                  )}
                  {comparison.outcomeType !== 'both_bad' && betterProduct.health_score > 70 && (betterProduct.confirmed_facts || []).length === 0 && (
                    <li className="text-[11px] font-medium text-green-600 leading-tight">• High quality ingredients</li>
                  )}
                  {comparison.outcomeType !== 'both_bad' && betterProduct.health_score <= 70 && (betterProduct.confirmed_facts || []).length === 0 && (
                    <li className="text-[11px] font-medium text-gray-400 italic leading-tight">• No specific pros identified</li>
                  )}
                </ul>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider flex items-center">
                  <ThumbsDown className="w-3 h-3 mr-1" /> {comparison.outcomeType === 'both_bad' ? `Risks (${p2.product_name})` : 'Cons'}
                </span>
                <ul className="space-y-1.5">
                  {(comparison.outcomeType === 'both_bad' ? (p2.warnings || []) : (otherProduct.warnings || [])).slice(0, 3).map((r, i) => (
                    <li key={i} className="text-[11px] font-medium text-gray-600 leading-tight">• {r}</li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="space-y-1">
              <MetricRow label="Sugar" v1={p1.nutrition_summary?.sugar?.value || 0} v2={p2.nutrition_summary?.sugar?.value || 0} unit="g" better="lower" />
              <MetricRow label="Sodium" v1={p1.nutrition_summary?.sodium?.value || 0} v2={p2.nutrition_summary?.sodium?.value || 0} unit="mg" better="lower" />
              <MetricRow label="Protein" v1={p1.nutrition_summary?.protein?.value || 0} v2={p2.nutrition_summary?.protein?.value || 0} unit="g" better="higher" />
              <MetricRow label="Fiber" v1={p1.nutrition_summary?.fiber?.value || 0} v2={p2.nutrition_summary?.fiber?.value || 0} unit="g" better="higher" />
            </div>
          </Card>
        </div>

        {/* 4. Better For / Caution For Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 px-1">
            <Target className="w-4 h-4 text-brand-600" />
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Suitability Comparison</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Card className={cn(
              "p-4 border-l-4",
              comparison.outcomeType === 'both_bad' ? "border-l-red-500 bg-red-50/30" : "border-l-green-500"
            )}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-gray-900 truncate w-48">{betterProduct.product_name}</h4>
                <Badge variant={comparison.outcomeType === 'both_bad' ? "red" : "green"} className="text-[8px]">
                  {comparison.outcomeType === 'both_bad' ? 'Avoid' : 'Better Choice'}
                </Badge>
              </div>
              <div className="space-y-3">
                {comparison.outcomeType !== 'both_bad' && (
                  <div>
                    <span className="text-[9px] font-black text-green-600 uppercase tracking-tighter block mb-1">Best For:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(betterProduct.suitability_flags || []).filter(f => f.status === 'Suitable').slice(0, 3).map((f, i) => (
                        <Badge key={i} variant="green" className="text-[9px]">{f.group}</Badge>
                      ))}
                      {betterProduct.health_score > 70 && <Badge variant="blue" className="text-[9px]">Daily Use</Badge>}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-[9px] font-black text-red-600 uppercase tracking-tighter block mb-1">Caution For:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(betterProduct.suitability_flags || []).filter(f => f.status === 'Avoid').slice(0, 3).map((f, i) => (
                      <Badge key={i} variant="red" className="text-[9px]">{f.group}</Badge>
                    ))}
                    {betterProduct.health_score < 40 && <Badge variant="red" className="text-[9px]">Daily Use</Badge>}
                    {betterProduct.health_score < 40 && <Badge variant="red" className="text-[9px]">Regular Consumption</Badge>}
                  </div>
                </div>
              </div>
            </Card>

            <Card className={cn(
              "p-4 border-l-4",
              comparison.outcomeType === 'both_bad' ? "border-l-red-500 bg-red-50/30" : "border-l-yellow-500"
            )}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-gray-900 truncate w-48">{otherProduct.product_name}</h4>
                <Badge variant={comparison.outcomeType === 'both_bad' ? "red" : "yellow"} className="text-[8px]">
                  {comparison.outcomeType === 'both_bad' ? 'Avoid' : 'Occasional'}
                </Badge>
              </div>
              <div className="space-y-3">
                {comparison.outcomeType !== 'both_bad' && (
                  <div>
                    <span className="text-[9px] font-black text-yellow-600 uppercase tracking-tighter block mb-1">Best For:</span>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="yellow" className="text-[9px]">Occasional Treat</Badge>
                      {(otherProduct.suitability_flags || []).filter(f => f.status === 'Suitable').slice(0, 2).map((f, i) => (
                        <Badge key={i} variant="gray" className="text-[9px]">{f.group}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-[9px] font-black text-red-600 uppercase tracking-tighter block mb-1">Caution For:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(otherProduct.suitability_flags || []).filter(f => f.status === 'Avoid').slice(0, 3).map((f, i) => (
                      <Badge key={i} variant="red" className="text-[9px]">{f.group}</Badge>
                    ))}
                    {otherProduct.health_score < 40 && <Badge variant="red" className="text-[9px]">Daily Use</Badge>}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* 5. Ingredient Comparison */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 px-1">
            <Activity className="w-4 h-4 text-brand-600" />
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Ingredient Breakdown</h2>
          </div>
          <Card className="p-5 space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black text-gray-400 uppercase">Additives & Risks</span>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-500 truncate w-20">{p1.product_name}</span>
                    <span className={cn("text-xs font-bold", p1Risks.length > 3 ? "text-red-600" : "text-green-600")}>{p1Risks.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p1Risks.slice(0, 3).map((a, i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-red-400" title={a.name} />
                    ))}
                    {p1Risks.length === 0 && <span className="text-[9px] text-green-600 font-bold">None</span>}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-500 truncate w-20">{p2.product_name}</span>
                    <span className={cn("text-xs font-bold", p2Risks.length > 3 ? "text-red-600" : "text-green-600")}>{p2Risks.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p2Risks.slice(0, 3).map((a, i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-red-400" title={a.name} />
                    ))}
                    {p2Risks.length === 0 && <span className="text-[9px] text-green-600 font-bold">None</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl flex items-start space-x-3">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <Info className="w-3 h-3 text-blue-600" />
              </div>
              <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                {betterProduct.product_name} has a {betterRisks.length < otherRisks.length ? 'cleaner' : 'similar'} ingredient profile with {betterRisks.length} identified risks.
              </p>
            </div>
          </Card>
        </div>

        {/* 6. Confidence & Trust */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 px-1">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Analysis Trust</h2>
          </div>
          <Card className="p-4 bg-white border-gray-100">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter block truncate">{p1.product_name}</span>
                <div className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-black uppercase text-center border",
                  p1.confidence_level === 'High' ? "text-green-600 bg-green-50 border-green-100" : p1.confidence_level === 'Moderate' ? "text-yellow-600 bg-yellow-50 border-yellow-100" : "text-red-600 bg-red-50 border-red-100"
                )}>
                  {p1.confidence_level} Confidence
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter block truncate">{p2.product_name}</span>
                <div className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-black uppercase text-center border",
                  p2.confidence_level === 'High' ? "text-green-600 bg-green-50 border-green-100" : p2.confidence_level === 'Moderate' ? "text-yellow-600 bg-yellow-50 border-yellow-100" : "text-red-600 bg-red-50 border-red-100"
                )}>
                  {p2.confidence_level} Confidence
                </div>
              </div>
            </div>
            {p1.confidence_level !== p2.confidence_level && (
              <div className="mt-4 p-2 bg-blue-50 rounded-lg flex items-center space-x-2">
                <Info className="w-3 h-3 text-blue-600" />
                <p className="text-[9px] text-blue-700 font-medium">
                  {p1.confidence_level === 'High' ? p1.product_name : p2.product_name} has a clearer label scan.
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* 7. Final Recommendation */}
        <Card className={cn(
          "p-6 border-2 shadow-xl rounded-[2rem]",
          comparison.outcomeType === 'both_bad' ? "bg-red-50 border-red-100 shadow-red-50" : "bg-white border-brand-100 shadow-brand-50"
        )}>
          <div className="flex items-center space-x-3 mb-4">
            <div className={cn("p-2 rounded-xl", comparison.outcomeType === 'both_bad' ? "bg-red-100" : "bg-brand-50")}>
              {comparison.outcomeType === 'both_bad' ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <CheckCircle2 className="w-5 h-5 text-brand-600" />}
            </div>
            <h3 className="font-bold text-gray-900">
              {comparison.outcomeType === 'both_bad' ? 'Responsible Guidance' : 'Final Recommendation'}
            </h3>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              {comparison.outcomeType === 'both_bad' 
                ? `While ${betterProduct.product_name} is marginally better than the other option, both products contain significant red flags. We do not recommend either for regular consumption.`
                : comparison.outcomeType === 'both_good'
                ? `Both products are high-quality choices. ${betterProduct.product_name} is the slightly better pick, but you can feel confident choosing either based on your preference.`
                : comparison.status === 'close' 
                ? `Both products are very similar in quality. Choose based on your taste preference or specific dietary needs like ${(betterProduct.suitability_flags || [])[0]?.group || 'general health'}.`
                : `Based on the smart comparison, ${betterProduct.product_name} is the recommended choice for a healthier lifestyle.`}
            </p>
            <ul className="space-y-2">
              <li className="flex items-center space-x-2 text-xs text-gray-700">
                <div className={cn("w-1.5 h-1.5 rounded-full", comparison.outcomeType === 'both_bad' ? "bg-red-500" : "bg-brand-500")} />
                <span>Smart Decision Logic: {comparison.outcomeType === 'both_bad' ? 'NEITHER RECOMMENDED' : comparison.status.toUpperCase() + ' WINNER'}</span>
              </li>
              <li className="flex items-center space-x-2 text-xs text-gray-700">
                <div className={cn("w-1.5 h-1.5 rounded-full", comparison.outcomeType === 'both_bad' ? "bg-red-500" : "bg-brand-500")} />
                <span>{comparison.outcomeType === 'both_bad' ? 'Multiple red flags identified in both' : betterRisks.length < otherRisks.length ? 'Significantly cleaner ingredients' : 'Better overall nutritional balance'}</span>
              </li>
              <li className="flex items-center space-x-2 text-xs text-gray-700">
                <div className={cn("w-1.5 h-1.5 rounded-full", comparison.outcomeType === 'both_bad' ? "bg-red-500" : "bg-brand-500")} />
                <span>{comparison.outcomeType === 'both_bad' ? 'Occasional use only, not for daily diet' : `Optimized for ${(betterProduct.suitability_flags || []).filter(f => f.status === 'Suitable')[0]?.group || 'Daily Use'}`}</span>
              </li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

const ResultScreen = ({ 
  result, 
  onBack, 
  onToggleFavorite, 
  isFavorite 
}: { 
  result: ScanResult, 
  onBack: () => void, 
  onToggleFavorite: () => void, 
  isFavorite: boolean 
}) => {
  const [showFullSuitability, setShowFullSuitability] = useState(false);

  const actionColors = {
    'Good Choice': 'bg-green-600 text-white shadow-green-100',
    'Not Ideal': 'bg-yellow-500 text-white shadow-yellow-100',
    'Avoid': 'bg-red-600 text-white shadow-red-100',
  };

  const actionExplanations = {
    'Good Choice': 'Suitable for regular use',
    'Not Ideal': 'Better consumed occasionally',
    'Avoid': 'Avoid for regular consumption',
  };

  const verdictColors = {
    Good: 'text-green-600',
    Moderate: 'text-yellow-600',
    Bad: 'text-red-600',
  };

  const confidenceColors = {
    High: 'text-green-600 bg-green-50 border-green-100',
    Moderate: 'text-yellow-600 bg-yellow-50 border-yellow-100',
    Low: 'text-red-600 bg-red-50 border-red-100',
  };

  const cautionGroups = (result.suitability_flags || []).filter(f => f.status !== 'Suitable');

  const handleShare = async () => {
    const text = `I scanned ${result.product_name} with AI Ingredient Scanner. Verdict: ${result.overall_verdict} (${result.health_score}/100). ${result.why_summary}`;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Scan Result',
          text: text,
          url: url,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        alert('Scan summary copied to clipboard!');
      } catch (err) {
        console.error('Error copying to clipboard:', err);
      }
    }
  };

  const isAnalyzing = result.health_score === 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 safe-area-bottom">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 flex items-center">
        <Button variant="ghost" size="icon" onClick={onBack} className="mr-2">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{result.product_name}</h1>
          <div className="flex items-center space-x-2">
             <span className="text-[10px] text-gray-400 font-bold uppercase">
               {result.createdAt ? (typeof result.createdAt.toDate === 'function' ? result.createdAt.toDate().toLocaleDateString() : new Date(result.createdAt).toLocaleDateString()) : new Date().toLocaleDateString()}
             </span>
             <Badge variant="gray" className="text-[8px] h-4">Scan ID: {result.id?.slice(-4) || '...'}</Badge>
             {isAnalyzing && (
               <Badge variant="blue" className="text-[8px] h-4 animate-pulse">Analyzing...</Badge>
             )}
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleShare}
            className="text-gray-400"
          >
            <Share2 className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggleFavorite}
            className={cn(isFavorite ? "text-yellow-500" : "text-gray-300")}
          >
            <Star className={cn("w-6 h-6", isFavorite && "fill-current")} />
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* 0. Product Image */}
        {result.imageUrl && (
          <div className="relative h-64 bg-gray-100 rounded-3xl overflow-hidden shadow-lg border border-gray-100">
            <ProgressiveImage 
              src={result.imageUrl} 
              placeholder={result.placeholderUrl}
              alt={result.product_name} 
              className="w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>
        )}

        {/* 1. Primary Verdict Card */}
        <Card className="p-6 flex flex-col items-center text-center space-y-4 border-none shadow-xl shadow-gray-200/50">
          <div className={cn("px-8 py-3 rounded-3xl font-display flex flex-col items-center shadow-lg", actionColors[result.verdict_action])}>
            <span className="font-black text-2xl tracking-widest uppercase">{result.verdict_action}</span>
            <span className="text-[12px] font-bold text-black mt-0.5">{actionExplanations[result.verdict_action]}</span>
          </div>
          
          <div className="flex items-center space-x-6 py-2">
            <div className="text-center">
               <span className={cn("text-lg font-black block", verdictColors[result.overall_verdict])}>{result.overall_verdict}</span>
               <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Verdict</span>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="text-center">
               <span className="text-2xl font-display font-black block text-gray-900">
                 {isAnalyzing ? (
                   <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
                 ) : result.health_score}
               </span>
               <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Health Score</span>
            </div>
          </div>
          
          <p className="text-gray-600 text-sm font-medium leading-relaxed">
            "{result.why_summary}"
          </p>
        </Card>

        {/* 2. Top 3 Reasons */}
        <div className="space-y-3">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Why this result?</h2>
          <div className="space-y-2">
            {isAnalyzing ? (
              [1, 2].map(i => (
                <div key={i} className="h-12 bg-white rounded-xl border border-gray-100 animate-pulse" />
              ))
            ) : (
              (result.top_reasons || []).map((reason, i) => (
                <div key={i} className="flex items-start space-x-3 p-3 bg-white rounded-xl border border-gray-100">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700">{reason}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Trust / Reliability Section */}
        <Card className="p-4 bg-white border-brand-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-brand-600" />
              <h2 className="text-sm font-bold">Analysis Reliability</h2>
            </div>
            <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border", confidenceColors[result.confidence_level])}>
              {result.confidence_level} Confidence
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(result.confidence_reasons || []).map((reason, i) => (
              <div key={i} className="flex items-center space-x-1.5 text-[10px] text-gray-500 font-medium">
                <CheckCircle2 className="w-3 h-3 text-brand-500" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* 4. Why This Score Section */}
        <div className="space-y-3">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Score Breakdown</h2>
          <Card className="p-4 space-y-3">
            {isAnalyzing ? (
              [1, 2].map(i => (
                <div key={i} className="flex items-center justify-between animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-4 bg-gray-100 rounded w-8" />
                </div>
              ))
            ) : (
              (result.score_breakdown || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-medium">{item.factor}</span>
                  <span className={cn("text-sm font-bold", item.impact < 0 ? "text-red-500" : "text-green-500")}>
                    {item.impact > 0 ? '+' : ''}{item.impact}
                  </span>
                </div>
              ))
            )}
            <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
               <span className="text-xs font-bold text-gray-400 uppercase">Processing Level</span>
               <Badge variant="gray" className="bg-gray-100 border-none">{result.processing_level || 'Unknown'}</Badge>
            </div>
          </Card>
        </div>

        {/* 5. Suitability Summary */}
        <div className="space-y-3">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Who should avoid?</h2>
          <Card className="p-4 space-y-4">
            {cautionGroups.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {cautionGroups.map((flag, i) => (
                  <div key={i} className={cn(
                    "px-3 py-1.5 rounded-xl border flex items-center space-x-2",
                    flag.status === 'Avoid' ? "bg-red-50 border-red-100 text-red-700" : "bg-yellow-50 border-yellow-100 text-yellow-700"
                  )}>
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">{flag.group}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-green-600 font-medium">Generally suitable for all major groups.</p>
            )}
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-brand-600 font-bold text-[10px] uppercase tracking-widest"
              onClick={() => setShowFullSuitability(!showFullSuitability)}
            >
              {showFullSuitability ? 'Hide Full Matrix' : 'View Full Suitability Matrix'}
            </Button>

            <AnimatePresence>
              {showFullSuitability && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden pt-2"
                >
                  <div className="grid grid-cols-2 gap-2">
                    {(result.suitability_flags || []).map((flag, idx) => (
                      <div key={idx} className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-gray-500 truncate">{flag.group}</span>
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            flag.status === 'Suitable' ? 'bg-green-500' : flag.status === 'Caution' ? 'bg-yellow-500' : 'bg-red-500'
                          )} />
                        </div>
                        <p className="text-[9px] font-bold uppercase" style={{ color: flag.status === 'Suitable' ? '#16a34a' : flag.status === 'Caution' ? '#ca8a04' : '#dc2626' }}>
                          {flag.status}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>

        {/* 6. Better Alternatives Guidance */}
        {result.better_alternatives_guidance && (
          <div className="space-y-3">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Safer Alternatives</h2>
            <Card className="p-4 bg-brand-50 border-brand-100">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-brand-100 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <p className="text-sm text-brand-900 font-bold mb-1">What to look for instead:</p>
                  <p className="text-xs text-brand-700 leading-relaxed">{result.better_alternatives_guidance}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* 7. Nutrition Snapshot */}
        <div className="space-y-3">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Nutrition Snapshot</h2>
          <Card className="p-4 grid grid-cols-3 gap-4">
            {Object.entries(result.nutrition_summary || {}).map(([key, data], i) => (
              <div key={i} className="text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase block truncate">{key.replace('_', ' ')}</span>
                <span className="text-sm font-bold text-gray-900 block">{formatValue(data?.value, '')}</span>
                <span className={cn(
                  "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md inline-block",
                  data?.level === 'Low' ? "bg-green-50 text-green-600" : data?.level === 'Moderate' ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600"
                )}>
                  {data?.level || 'N/A'}
                </span>
              </div>
            ))}
          </Card>
        </div>

        {/* 7. Ingredient Breakdown */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Ingredient Intelligence</h2>
            <div className="flex items-center space-x-2 text-[10px] font-bold text-gray-400">
               <span className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-1 text-green-500" /> Label</span>
               <span className="flex items-center"><ScanIcon className="w-3 h-3 mr-1 text-yellow-500" /> AI</span>
            </div>
          </div>
          <div className="space-y-3">
            {isAnalyzing ? (
              [1, 2, 3].map(i => (
                <Card key={i} className="p-4 space-y-3 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-10 bg-gray-50 rounded w-full" />
                </Card>
              ))
            ) : (
              (result.ingredient_breakdown || []).map((ing, idx) => (
                <Card key={idx} className="overflow-hidden border-none shadow-sm">
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-gray-900 truncate">{ing.name}</h3>
                          {ing.source_type === 'confirmed' ? (
                            <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                          ) : (
                            <ScanIcon className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">{ing.simple_name} • {ing.category}</p>
                      </div>
                      <Badge 
                        variant={ing.risk_level === 'Low' ? 'green' : ing.risk_level === 'Medium' ? 'yellow' : 'red'}
                        className="text-[8px] h-5"
                      >
                        {ing.risk_level} Risk
                      </Badge>
                    </div>
                    
                    <div className="text-xs text-gray-600 leading-relaxed">
                      <p className="font-bold text-gray-900 mb-1">What it is:</p>
                      {ing.what_it_is}
                    </div>
  
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="p-2 bg-gray-50 rounded-lg">
                         <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Why used</span>
                         <span className="text-[10px] text-gray-700 font-medium leading-tight">{ing.why_used}</span>
                      </div>
                      <div className="p-2 bg-gray-50 rounded-lg">
                         <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Quantity Note</span>
                         <span className="text-[10px] text-gray-700 font-medium leading-tight italic">{ing.estimated_quantity_note}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        <div className="p-6 bg-gray-100 rounded-[2rem] text-[10px] text-gray-400 text-center italic space-y-2">
          <p>AI-estimated data is clearly marked with icons. Confirmed data is extracted directly from the label.</p>
          <p>Disclaimer: This analysis is for educational purposes. Consult a medical professional for dietary advice.</p>
        </div>
      </div>
    </div>
  );
};


// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'compare' | 'history' | 'profile'>('home');
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [currentResult, setCurrentResult] = useState<ScanResult | null>(null);
  const [partialResult, setPartialResult] = useState<Partial<ScanResult> | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ScanResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('General');
  const [compareP1, setCompareP1] = useState<ScanResult | null>(null);
  const [compareP2, setCompareP2] = useState<ScanResult | null>(null);
  const [scanningForSlot, setScanningForSlot] = useState<1 | 2 | null>(null);
  const [showCollections, setShowCollections] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  
  const sortedScans = React.useMemo(() => {
    return [...scans].sort((a, b) => {
      if (sortBy === 'date') {
        const getTime = (date: any) => {
          if (!date) return 0;
          if (typeof date.toDate === 'function') return date.toDate().getTime();
          if (date.seconds) return date.seconds * 1000;
          return new Date(date).getTime();
        };
        const timeA = getTime(a.createdAt);
        const timeB = getTime(b.createdAt);
        return sortDirection === 'desc' ? timeB - timeA : timeA - timeB;
      } else {
        return sortDirection === 'desc' ? (b.health_score || 0) - (a.health_score || 0) : (a.health_score || 0) - (b.health_score || 0);
      }
    });
  }, [scans, sortBy, sortDirection]);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          setProfile(null);
        }
      });
      return unsubscribe;
    } else {
      setProfile(null);
    }
  }, [user]);

  useEffect(() => {
    const syncUserProfile = async () => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          // Create new profile
          const newProfile: any = {
            uid: user.uid,
            createdAt: serverTimestamp(),
          };
          
          if (user.phoneNumber) newProfile.phoneNumber = user.phoneNumber;
          if (user.email) newProfile.email = user.email;
          if (user.displayName) newProfile.displayName = user.displayName;
          if (user.photoURL) newProfile.photoURL = user.photoURL;

          await setDoc(userRef, newProfile);
        } else {
          // Update existing profile if needed (e.g. if phone was added)
          const existingData = userSnap.data() as UserProfile;
          if (!existingData.phoneNumber && user.phoneNumber) {
            await setDoc(userRef, { phoneNumber: user.phoneNumber }, { merge: true });
          }
        }
      }
    };

    syncUserProfile();
  }, [user]);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, 'scans'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const scanData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScanResult));
        setScans(scanData);
      }, (err) => {
        console.error("Firestore error:", err);
      });
      return unsubscribe;
    }
  }, [user]);

  const [lastFile, setLastFile] = useState<File | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement> | File) => {
    let file: File | undefined;
    if (e instanceof File) {
      file = e;
    } else {
      file = e.target.files?.[0];
    }
    
    if (!file || !user) return;
    setLastFile(file);

    setIsProcessing(true);
    setProcessingStep('Reading image...');
    setPartialResult(null);
    setError(null);
    
    try {
      setProcessingStep('Optimizing image...');
      // 1. Generate placeholder and analysis image concurrently for speed
      // Reduced size to 800 for faster upload while maintaining enough OCR accuracy
      const [base64, placeholder] = await Promise.all([
        resizeImage(file, 800, 800, 0.4),
        generatePlaceholder(file)
      ]);
      
      setProcessingStep('Extracting ingredients...');
      const thumbnailPromise = resizeImage(base64, 300, 300, 0.4);

      // 2. Step 1: Extract text first
      const extraction = await extractIngredientsText(base64, 'image/jpeg');
      
      // Show partial result immediately
      const tempPartial: ScanResult = {
        product_name: extraction.product_name,
        ingredients_text: extraction.ingredients_text,
        nutrition_text: extraction.nutrition_text,
        imageUrl: base64,
        placeholderUrl: placeholder,
        // Mock required fields for ResultScreen
        overall_verdict: 'Moderate',
        verdict_action: 'Not Ideal',
        health_score: 0, // 0 will trigger loading state in UI
        confidence_level: 'Moderate',
        top_reasons: ['Analyzing ingredients...'],
        score_breakdown: [],
        nutrition_summary: {
          sugar: { value: '...', level: 'Moderate' },
          sodium: { value: '...', level: 'Moderate' },
          protein: { value: '...', level: 'Moderate' },
          fiber: { value: '...', level: 'Moderate' },
          saturated_fat: { value: '...', level: 'Moderate' },
        },
        suitability_flags: [],
        better_alternatives_guidance: 'Analyzing...',
        ingredient_breakdown: [],
        why_summary: 'Extracting deep insights from ingredients...',
        userId: user.uid,
        createdAt: { seconds: Date.now() / 1000 },
        processing_level: 'Analyzing...',
        raw_ocr_text: extraction.ingredients_text,
        confidence_reasons: [],
        confirmed_facts: [],
        ai_estimates: [],
        ingredient_risk_score: 0,
        ocr_confidence: 0,
        analysis_confidence: 0,
        allergen_flags: [],
        warnings: []
      };
      
      if (scanningForSlot === null) {
        setCurrentResult(tempPartial);
        setIsProcessing(false);
      }
      
      setProcessingStep('Analyzing ingredients...');
      // 3. Step 2: Analyze from text
      const analysis = await analyzeIngredientsFromText(
        extraction.product_name,
        extraction.ingredients_text,
        extraction.nutrition_text,
        analysisMode
      );
      
      // 4. Show results IMMEDIATELY to user with a temporary ID
      const tempId = `temp-${Date.now()}`;
      const initialResult = { 
        ...analysis, 
        ingredients_text: extraction.ingredients_text,
        nutrition_text: extraction.nutrition_text,
        imageUrl: base64, 
        placeholderUrl: placeholder,
        id: tempId, 
        createdAt: { seconds: Date.now() / 1000 } 
      } as ScanResult;

      if (scanningForSlot === 1) {
        setCompareP1(initialResult);
        setScanningForSlot(null);
        setIsProcessing(false);
      } else if (scanningForSlot === 2) {
        setCompareP2(initialResult);
        setScanningForSlot(null);
        setIsProcessing(false);
      } else {
        setCurrentResult(initialResult);
      }
      
      // Stop processing state
      setIsProcessing(false);
      setPartialResult(null);

      // 5. Background: Save to Firestore without blocking the UI
      (async () => {
        try {
          const thumbnail = await thumbnailPromise;
          const { imageUrl, ...analysisWithoutImage } = analysis;
          const scanDoc = {
            ...analysisWithoutImage,
            userId: user.uid,
            imageUrl: thumbnail, // Store resized thumbnail
            placeholderUrl: placeholder,
            createdAt: serverTimestamp()
          };
          
          const docRef = await addDoc(collection(db, 'scans'), scanDoc);
          const finalResult = { ...scanDoc, imageUrl: base64, placeholderUrl: placeholder, id: docRef.id, createdAt: { seconds: Date.now() / 1000 } } as ScanResult;

          // Silently update the state with the real Firestore ID
          if (scanningForSlot === 1) setCompareP1(finalResult);
          else if (scanningForSlot === 2) setCompareP2(finalResult);
          else setCurrentResult(prev => prev?.id === tempId ? finalResult : prev);
          
        } catch (fsErr) {
          console.error("Background Firestore save failed:", fsErr);
        }
      })();

    } catch (err: any) {
      console.error("Analysis failed", err);
      setError(`Analysis failed: ${err.message || "Please try a clearer photo."}`);
      setIsProcessing(false);
    }
  };

  const handleToggleFavorite = async (scan: ScanResult) => {
    if (!user || !scan.id) return;
    // For now, let's just toggle in local state for the current session
    setCurrentResult(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null);
    setScans(prev => prev.map(s => s.id === scan.id ? { ...s, isFavorite: !s.isFavorite } : s));
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50">
        <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen externalError={error} />;
  }

  if (!profile || !profile.displayName) {
    return <GuestNameSetup uid={user.uid} />;
  }

  if (comparisonResult) {
    return (
      <ComparisonResultScreen 
        products={comparisonResult} 
        onBack={() => {
          setComparisonResult(null);
          setCompareP1(null);
          setCompareP2(null);
        }} 
      />
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white shadow-2xl relative">
      <AnimatePresence mode="wait">
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative w-32 h-32 mb-8">
              <div className="absolute inset-0 border-4 border-brand-100 rounded-full" />
              <div className="absolute inset-0 border-4 border-brand-600 rounded-full border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <ScanIcon className="w-12 h-12 text-brand-600" />
              </div>
              
              {/* Step Indicators */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex space-x-1">
                {['Reading', 'Optimizing', 'Extracting', 'Analyzing'].map((step, i) => (
                  <div 
                    key={step} 
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors duration-500",
                      processingStep.includes(step) ? "bg-brand-600 scale-125" : "bg-brand-100"
                    )} 
                  />
                ))}
              </div>
            </div>

            <h2 className="text-2xl font-display font-bold text-gray-900 mb-2">
              {partialResult?.product_name || "Analyzing Label"}
            </h2>
            
            <div className="space-y-4 w-full max-w-xs">
              <div className="bg-brand-50 rounded-2xl p-4 border border-brand-100">
                <p className="text-brand-600 font-bold text-sm animate-pulse uppercase tracking-widest">
                  {processingStep}
                </p>
              </div>

              {partialResult?.ingredients_text && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-left bg-gray-50 rounded-xl p-3 border border-gray-100"
                >
                  <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Extracted Ingredients:</span>
                  <p className="text-[10px] text-gray-600 line-clamp-3 italic">
                    {partialResult.ingredients_text}
                  </p>
                </motion.div>
              )}
            </div>

            <p className="text-gray-400 text-xs mt-8 max-w-[200px]">
              Our AI is decoding the label and calculating health scores.
            </p>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            className="fixed top-4 left-4 right-4 z-50 bg-red-50 border border-red-100 p-4 rounded-2xl flex flex-col shadow-lg"
          >
            <div className="flex items-center mb-3">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
              <p className="text-sm text-red-700 flex-1">{error}</p>
              <Button variant="ghost" size="icon" onClick={() => setError(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            {lastFile && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full bg-white text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => {
                  setError(null);
                  handleImageUpload(lastFile);
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Analysis
              </Button>
            )}
          </motion.div>
        )}

        {currentResult ? (
          <motion.div 
            key="result"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <ResultScreen 
              result={currentResult} 
              onBack={() => setCurrentResult(null)} 
              onToggleFavorite={() => handleToggleFavorite(currentResult)}
              isFavorite={!!currentResult.isFavorite}
            />
          </motion.div>
        ) : (
          <motion.div 
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {activeTab === 'home' && (
              <HomeScreen 
                onScan={() => cameraInputRef.current?.click()} 
                onUpload={() => galleryInputRef.current?.click()} 
                recentScans={scans.slice(0, 3)} 
                onSelectScan={(scan) => setCurrentResult(scan)}
                totalScans={scans.length}
                currentMode={analysisMode}
                onModeChange={setAnalysisMode}
                onViewHistory={() => setActiveTab('history')}
                onProfileClick={() => setActiveTab('profile')}
              />
            )}

            {activeTab === 'compare' && (
              <CompareScreen 
                scans={scans}
                p1={compareP1}
                p2={compareP2}
                setP1={setCompareP1}
                setP2={setCompareP2}
                onCompare={(p1, p2) => setComparisonResult([p1, p2])}
                onScan={(slot) => {
                  setScanningForSlot(slot);
                  cameraInputRef.current?.click();
                }}
              />
            )}
            
            {activeTab === 'history' && (
              <div className="p-6 space-y-6 pb-24 safe-area-bottom">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-display font-bold">Scan History</h1>
                  <div className="flex items-center space-x-2">
                    <select 
                      className="text-xs bg-gray-100 border-none rounded-lg px-2 py-1 focus:ring-brand-500"
                      value={`${sortBy}-${sortDirection}`}
                      onChange={(e) => {
                        const [newSortBy, newSortDir] = e.target.value.split('-') as [any, any];
                        setSortBy(newSortBy);
                        setSortDirection(newSortDir);
                      }}
                    >
                      <option value="date-desc">Newest First</option>
                      <option value="date-asc">Oldest First</option>
                      <option value="score-desc">Highest Score</option>
                      <option value="score-asc">Lowest Score</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-3">
                  {sortedScans.map((scan) => {
                    return (
                      <Card 
                        key={scan.id} 
                        className="p-3 flex items-center space-x-4 active:bg-gray-50 transition-colors cursor-pointer relative overflow-hidden"
                        onClick={() => setCurrentResult(scan)}
                      >
                        <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {scan.imageUrl ? (
                            <ProgressiveImage 
                              src={scan.imageUrl} 
                              placeholder={scan.placeholderUrl}
                              alt={scan.product_name} 
                              className="w-full h-full"
                            />
                          ) : (
                            <ScanIcon className="w-6 h-6 text-gray-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 truncate">{scan.product_name || 'Unnamed Product'}</h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant={scan.overall_verdict === 'Good' ? 'green' : scan.overall_verdict === 'Moderate' ? 'yellow' : 'red'}>
                              {scan.overall_verdict || 'Unknown'}
                            </Badge>
                            <span className="text-xs text-gray-400">
                              {scan.createdAt ? (typeof scan.createdAt.toDate === 'function' ? scan.createdAt.toDate().toLocaleDateString() : new Date(scan.createdAt.seconds ? scan.createdAt.seconds * 1000 : scan.createdAt).toLocaleDateString()) : new Date().toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300" />
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="p-6 space-y-8 pb-24 safe-area-bottom">
                <h1 className="text-2xl font-display font-bold">Profile</h1>
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-24 h-24 rounded-full bg-brand-50 flex items-center justify-center border-4 border-white shadow-lg overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="w-10 h-10 text-brand-600" />
                    )}
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-bold">{user.displayName || user.phoneNumber || 'User'}</h2>
                    <p className="text-gray-500 text-sm">{user.email || 'Phone Verified'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4 text-center space-y-1">
                    <span className="text-2xl font-black text-brand-600">{scans.length}</span>
                    <span className="text-xs font-bold text-gray-400 uppercase block">Total Scans</span>
                  </Card>
                  <Card className="p-4 text-center space-y-1">
                    <span className="text-2xl font-black text-brand-600">{scans.filter(s => s.isFavorite).length}</span>
                    <span className="text-xs font-bold text-gray-400 uppercase block">Favorites</span>
                  </Card>
                </div>

                <div className="space-y-3">
                  <Card className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setShowCollections(!showCollections)}>
                    <div className="flex items-center space-x-3">
                      <Plus className="w-5 h-5 text-brand-600" />
                      <span className="font-medium">My Collections</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </Card>
                  <Card className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <ShieldCheck className="w-5 h-5 text-brand-600" />
                      <span className="font-medium">Privacy Settings</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </Card>
                  <Button 
                    variant="danger" 
                    className="w-full justify-start" 
                    onClick={() => signOut(auth)}
                  >
                    <LogOut className="w-5 h-5 mr-3" />
                    Sign Out
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <input 
        type="file" 
        accept="image/*" 
        capture="environment"
        className="hidden" 
        ref={cameraInputRef} 
        onChange={handleImageUpload}
        id="camera-input"
      />
      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={galleryInputRef} 
        onChange={handleImageUpload}
        id="gallery-input"
      />

      {!currentResult && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-lg border-t border-gray-100 p-4 flex items-center justify-around safe-area-bottom z-40">
          <button 
            onClick={() => setActiveTab('home')}
            className={cn("flex flex-col items-center space-y-1 transition-colors", activeTab === 'home' ? "text-brand-600" : "text-gray-400")}
          >
            <ScanIcon className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
          </button>
          <button 
            onClick={() => setActiveTab('compare')}
            className={cn("flex flex-col items-center space-y-1 transition-colors", activeTab === 'compare' ? "text-brand-600" : "text-gray-400")}
          >
            <ArrowLeftRight className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Compare</span>
          </button>

          {/* Central Plus Button - Forces Camera */}
          <button 
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center -mt-8"
          >
            <div className="w-14 h-14 bg-brand-600 rounded-full flex items-center justify-center shadow-lg shadow-brand-200 border-4 border-white active:scale-95 transition-transform">
              <Plus className="w-7 h-7 text-white" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 mt-1">Scan</span>
          </button>

          <button 
            onClick={() => setActiveTab('history')}
            className={cn("flex flex-col items-center space-y-1 transition-colors", activeTab === 'history' ? "text-brand-600" : "text-gray-400")}
          >
            <History className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">History</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn("flex flex-col items-center space-y-1 transition-colors", activeTab === 'profile' ? "text-brand-600" : "text-gray-400")}
          >
            <User className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Profile</span>
          </button>
        </nav>
      )}
    </div>
  );
}
