import React from 'react';
import { 
  Camera, 
  Upload, 
  User, 
  Scan as ScanIcon, 
  ShieldCheck, 
  CheckCircle2, 
  ChevronRight, 
  Search, 
  Info, 
  AlertCircle 
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { ScanResult, AnalysisMode } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressiveImage } from '../components/ui/ProgressiveImage';

export const HomeScreen = React.memo(({ 
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
    <div className="p-6 space-y-8 content-bottom-spacing">
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
            {recentScans.map((scan, idx) => {
              return (
                <Card 
                  key={scan.id ? `${scan.id}-${idx}` : `recent-${idx}`} 
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
});
