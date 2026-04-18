import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  RefreshCw,
  ArrowRight,
  MessageSquare,
  Send
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
  updateDoc,
  limit
} from 'firebase/firestore';
import { cn } from './lib/utils';
import { ScanResult, UserProfile, Verdict, SuitabilityStatus, AnalysisMode, Collection } from './types';
import { analyzeIngredientLabel, extractIngredientsText, analyzeIngredientsFromText, getProductRecommendations, streamAnalysisSummary } from './services/geminiService';
import heic2any from 'heic2any';
import { resizeImage } from './lib/imageUtils';
import Markdown from 'react-markdown';

// Screens - Lazy loaded for performance
const HomeScreen = React.lazy(() => import('./screens/HomeScreen').then(m => ({ default: m.HomeScreen })));
const CompareScreen = React.lazy(() => import('./screens/CompareScreen').then(m => ({ default: m.CompareScreen })));
const ResultScreen = React.lazy(() => import('./screens/ResultScreen').then(m => ({ default: m.ResultScreen })));
const ComparisonResultScreen = React.lazy(() => import('./screens/ComparisonResultScreen').then(m => ({ default: m.ComparisonResultScreen })));
const LoginScreen = React.lazy(() => import('./screens/LoginScreen').then(m => ({ default: m.LoginScreen })));
const GuestNameSetup = React.lazy(() => import('./screens/GuestNameSetup').then(m => ({ default: m.GuestNameSetup })));
const AdminDashboard = React.lazy(() => import('./screens/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

// Components
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Badge } from './components/ui/Badge';
import { ProgressiveImage } from './components/ui/ProgressiveImage';
import { FeedbackSystem } from './components/FeedbackSystem';
import { ImageSourceSelector } from './components/ImageSourceSelector';
import { formatValue } from './lib/formatUtils';

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'compare' | 'history' | 'profile' | 'admin'>('home');
  const isAdmin = user?.email === 'shubhammaurya17@gmail.com';
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [liveInsight, setLiveInsight] = useState<string>('');
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
  const scanningForSlotRef = useRef<1 | 2 | null>(null);

  // Sync ref with state
  useEffect(() => {
    scanningForSlotRef.current = scanningForSlot;
  }, [scanningForSlot]);
  const [showCollections, setShowCollections] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showImageSourceSelector, setShowImageSourceSelector] = useState(false);
  
  const handleSelectScan = useCallback((scan: ScanResult) => {
    setCurrentResult(scan);
  }, []);

  const handleBackFromAnalysis = useCallback(() => {
    setCurrentResult(null);
  }, []);

  const handleProfileClick = useCallback(() => {
    setActiveTab('profile');
  }, []);

  const handleViewHistory = useCallback(() => {
    setActiveTab('history');
  }, []);

  const handleModeChange = useCallback((mode: AnalysisMode) => {
    setAnalysisMode(mode);
  }, []);

  const handleScanSlot = useCallback((slot: 1 | 2) => {
    setScanningForSlot(slot);
    setShowImageSourceSelector(true);
  }, []);

  const handleCompareResult = useCallback((p1: ScanResult, p2: ScanResult) => {
    setComparisonResult([p1, p2]);
  }, []);

  const recentScansForHome = useMemo(() => scans.slice(0, 3), [scans]);

  const sortedScans = useMemo(() => {
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

  // Fetch missing recommendations for history items
  useEffect(() => {
    if (currentResult && currentResult.id && !currentResult.recommended_products && !isProcessing && !currentResult.id.startsWith('temp-')) {
      const fetchMissingRecs = async () => {
        try {
          const recommendations = await getProductRecommendations(
            currentResult.product_name,
            currentResult.ingredients_text || '',
            analysisMode,
            currentResult.overall_verdict === 'Good'
          );
          
          if (recommendations && recommendations.length > 0) {
            // Update local state
            setCurrentResult(prev => prev?.id === currentResult.id ? { ...prev, recommended_products: recommendations } : prev);
            
            // Persist to Firestore
            await updateDoc(doc(db, 'scans', currentResult.id), {
              recommended_products: recommendations
            });
          }
        } catch (err) {
          console.error("Failed to fetch missing recommendations:", err);
        }
      };
      fetchMissingRecs();
    }
  }, [currentResult?.id]);

  const [lastFile, setLastFile] = useState<File | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement> | File) => {
    // Use ref to get the absolute latest value, avoiding closure staleness
    let currentSlot = scanningForSlotRef.current; 
    
    // If we are on compare tab but no slot was selected (e.g. central scan button),
    // try to find the first empty slot.
    if (activeTab === 'compare' && currentSlot === null) {
      if (!compareP1) currentSlot = 1;
      else if (!compareP2) currentSlot = 2;
    }

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
    setLiveInsight('');
    setPartialResult(null);
    setError(null);
    
    try {
      setProcessingStep('Optimizing image...');
      
      // Adaptive optimization based on device and connection
      const isMobile = window.innerWidth < 768;
      const isSlowConn = (navigator as any).connection?.effectiveType?.includes('2g') || (navigator as any).connection?.saveData;
      
      // Even more aggressive downsizing for maximum speed
      const targetSize = isSlowConn ? 384 : (isMobile ? 480 : 512);
      const targetQuality = 0.15; // Ultra-low quality is usually fine for OCR and maps data

      // 1. Move HEIC/HEIF conversion out of parallel to avoid double hit
      let processedBlob: File | Blob = file;
      const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic');
      
      if (isHeic) {
        setProcessingStep('Converting image...');
        try {
          const converted = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.2
          });
          processedBlob = Array.isArray(converted) ? converted[0] : converted;
        } catch (err) {
          console.error('HEIC conversion failed:', err);
        }
      }

      // 2. Optimized resizing: Generates both main image and placeholder in one pass
      setProcessingStep('Preparing scan...');
      const { main: base64, placeholder } = await resizeImage(processedBlob, targetSize, targetSize, targetQuality);
      
      setProcessingStep('Analyzing label...');

      const statusHandler = (status: string, detail?: string) => {
        if (detail) setProcessingStep(detail);
      };

      // 1. Extraction step
      const { product_name, ingredients_text, nutrition_text } = await extractIngredientsText(base64, 'image/jpeg', statusHandler);
      
      setProcessingStep('Deep Analysis...');
      
      // 2. Parallel: Start Streaming Insight and Deep Analysis
      const analysisPromise = analyzeIngredientsFromText(product_name, ingredients_text, nutrition_text, analysisMode, statusHandler);
      
      // Start streaming insight if in active result view
      if (activeTab !== 'compare') {
        (async () => {
          try {
            const stream = streamAnalysisSummary(product_name, ingredients_text, analysisMode);
            for await (const chunk of stream) {
              setLiveInsight(prev => prev + chunk);
              // If we have some insight, update the processing step
              if (liveInsight.length > 50) setProcessingStep('Generating Final Result...');
            }
          } catch (err) {
            console.error("Insight stream failed:", err);
          }
        })();
      }

      const analysis = await analysisPromise;
      
      // 3. Show results IMMEDIATELY to user with a temporary ID
      const tempId = `temp-${Date.now()}`;
      const initialResult = { 
        ...analysis, 
        imageUrl: base64, 
        placeholderUrl: placeholder,
        id: tempId, 
        createdAt: { seconds: Date.now() / 1000 } 
      } as ScanResult;

      if (currentSlot === 1) {
        setCompareP1(initialResult);
        setComparisonResult(prev => {
          if (prev && prev[0].health_score === 0) {
            return [initialResult, prev[1]];
          }
          return prev;
        });
        setScanningForSlot(null);
      } else if (currentSlot === 2) {
        setCompareP2(initialResult);
        setComparisonResult(prev => {
          if (prev && prev[1].health_score === 0) {
            return [prev[0], initialResult];
          }
          return prev;
        });
        setScanningForSlot(null);
      } else if (activeTab !== 'compare') {
        setCurrentResult(initialResult);
      }
      
      // Stop processing state
      setIsProcessing(false);
      setPartialResult(null);

      // 5. Background: Save to Firestore and Fetch Recommendations
      (async () => {
        const slot = currentSlot; 
        let savedDocId: string | null = null;
        
        try {
          // A. Save initial analysis to Firestore
          const { imageUrl, ...analysisWithoutImage } = analysis;
          const scanDoc = {
            ...analysisWithoutImage,
            userId: user.uid,
            imageUrl: base64,
            placeholderUrl: placeholder,
            createdAt: serverTimestamp(),
            ingredients_text: analysis.ingredients_text || '',
            nutrition_text: analysis.nutrition_text || '',
          };
          
          const docRef = await addDoc(collection(db, 'scans'), scanDoc);
          savedDocId = docRef.id;
          const finalResult = { ...scanDoc, imageUrl: base64, placeholderUrl: placeholder, id: docRef.id, createdAt: { seconds: Date.now() / 1000 } } as ScanResult;

          // Silently update the state with the real Firestore ID
          if (slot === 1) setCompareP1(finalResult);
          else if (slot === 2) setCompareP2(finalResult);
          else setCurrentResult(prev => prev?.id === tempId ? finalResult : prev);

          // B. Fetch Recommendations
          const recommendations = await getProductRecommendations(
            analysis.product_name,
            analysis.ingredients_text || '',
            analysisMode,
            analysis.overall_verdict === 'Good'
          );

          if (recommendations && recommendations.length > 0) {
            // Update state with recommendations
            const updateWithRecs = (prev: ScanResult | null) => 
              prev && (prev.id === savedDocId || prev.id === tempId) 
                ? { ...prev, recommended_products: recommendations } 
                : prev;

            if (slot === 1) setCompareP1(updateWithRecs);
            else if (slot === 2) setCompareP2(updateWithRecs);
            else setCurrentResult(updateWithRecs);

            // Persist recommendations to Firestore
            if (savedDocId) {
              await updateDoc(doc(db, 'scans', savedDocId), {
                recommended_products: recommendations
              });
            }
          }
        } catch (err) {
          console.error("Background processing failed:", err);
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
    return (
      <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-brand-50"><Loader2 className="w-10 h-10 text-brand-600 animate-spin" /></div>}>
        <LoginScreen externalError={error} />
      </React.Suspense>
    );
  }

  if (!profile || !profile.displayName) {
    return (
      <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-brand-50"><Loader2 className="w-10 h-10 text-brand-600 animate-spin" /></div>}>
        <GuestNameSetup uid={user.uid} />
      </React.Suspense>
    );
  }

  if (comparisonResult) {
    return (
      <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-brand-50"><Loader2 className="w-10 h-10 text-brand-600 animate-spin" /></div>}>
        <ComparisonResultScreen 
          products={comparisonResult} 
          onBack={() => {
            setComparisonResult(null);
            setCompareP1(null);
            setCompareP2(null);
          }} 
          isAnalyzing={comparisonResult.some(p => p.health_score === 0)}
        />
      </React.Suspense>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white shadow-2xl relative">
      <AnimatePresence mode="wait">
        {isProcessing && (
          <motion.div 
            key="processing-overlay"
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
            </div>

            <div className="space-y-4 max-w-xs">
              <h3 className="text-xl font-display font-bold text-gray-900">{processingStep}</h3>
              <div className="flex justify-center space-x-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={`dot-${i}`}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    className="w-1.5 h-1.5 rounded-full bg-brand-600"
                  />
                ))}
              </div>
              
              <AnimatePresence>
                {liveInsight && (
                  <motion.div
                    key="live-insight"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 bg-brand-50 rounded-2xl border border-brand-100 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-brand-500" />
                    <p className="text-sm text-brand-900 font-medium leading-relaxed italic">
                      "{liveInsight}"
                    </p>
                    <div className="mt-2 flex items-center justify-end space-x-1">
                      <span className="text-[8px] font-black text-brand-300 uppercase tracking-widest">Live AI Insight</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="fixed bottom-12 left-0 right-0 px-8">
              <p className="text-xs text-gray-400">
                AI processing may take a few seconds during high traffic.
              </p>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div 
            key="error-notification"
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
            <div className="flex items-center mt-2 space-x-2">
              {lastFile && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 bg-white text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => {
                    setError(null);
                    handleImageUpload(lastFile);
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Retry
                </Button>
              )}
              <Button 
                variant="secondary" 
                size="sm" 
                className="flex-1"
                onClick={() => setShowFeedback(true)}
              >
                <MessageSquare className="w-4 h-4 mr-2" /> Report
              </Button>
            </div>
          </motion.div>
        )}

        <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-brand-50"><Loader2 className="w-10 h-10 text-brand-600 animate-spin" /></div>}>
          {currentResult && activeTab !== 'compare' ? (
            <motion.div 
              key="result"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ResultScreen 
                result={currentResult} 
                onBack={handleBackFromAnalysis} 
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
                  recentScans={recentScansForHome} 
                  onSelectScan={handleSelectScan}
                  totalScans={scans.length}
                  currentMode={analysisMode}
                  onModeChange={handleModeChange}
                  onViewHistory={handleViewHistory}
                  onProfileClick={handleProfileClick}
                />
              )}

              {activeTab === 'compare' && (
                <CompareScreen 
                  scans={scans}
                  p1={compareP1}
                  p2={compareP2}
                  setP1={setCompareP1}
                  setP2={setCompareP2}
                  onCompare={handleCompareResult}
                  onScan={handleScanSlot}
                />
              )}
              
              {activeTab === 'history' && (
                <div className="p-6 space-y-6 content-bottom-spacing">
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
                    {sortedScans.map((scan, idx) => {
                      return (
                        <Card 
                          key={scan.id ? `${scan.id}-${idx}` : `history-${idx}`} 
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
                <div className="p-6 space-y-8 content-bottom-spacing">
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
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Help & Feedback</h2>
                    <Card className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setShowFeedback(true)}>
                      <div className="flex items-center space-x-3">
                        <MessageSquare className="w-5 h-5 text-brand-600" />
                        <span className="font-medium">Send Feedback</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300" />
                    </Card>
                    <Card className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setShowFeedback(true)}>
                      <div className="flex items-center space-x-3">
                        <AlertCircle className="w-5 h-5 text-brand-600" />
                        <span className="font-medium">Report a Bug</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300" />
                    </Card>
                    <Card className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setShowFeedback(true)}>
                      <div className="flex items-center space-x-3">
                        <Zap className="w-5 h-5 text-brand-600" />
                        <span className="font-medium">Suggest a Feature</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300" />
                    </Card>
                    <Card className="p-4 flex items-center justify-between opacity-50">
                      <div className="flex items-center space-x-3">
                        <Info className="w-5 h-5 text-brand-600" />
                        <span className="font-medium">Contact Support</span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Coming Soon</span>
                    </Card>
                  </div>

                  <div className="space-y-3">
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Account</h2>
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

              {activeTab === 'admin' && isAdmin && (
                <AdminDashboard />
              )}
            </motion.div>
          )}
        </React.Suspense>
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

          {/* Central Plus Button - Now with Source Selector */}
          <button 
            onClick={() => {
              setScanningForSlot(null);
              setShowImageSourceSelector(true);
            }}
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
          
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('admin')}
              className={cn("flex flex-col items-center space-y-1 transition-colors", activeTab === 'admin' ? "text-red-600" : "text-gray-400")}
            >
              <ShieldCheck className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Feedback</span>
            </button>
          )}
        </nav>
      )}

      <AnimatePresence>
        {showFeedback && (
          <FeedbackSystem 
            context={{ screenName: 'Profile' }}
            onClose={() => setShowFeedback(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showImageSourceSelector && (
          <ImageSourceSelector 
            onCamera={() => {
              setShowImageSourceSelector(false);
              cameraInputRef.current?.click();
            }}
            onGallery={() => {
              setShowImageSourceSelector(false);
              galleryInputRef.current?.click();
            }}
            onClose={() => {
              setShowImageSourceSelector(false);
              setScanningForSlot(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
