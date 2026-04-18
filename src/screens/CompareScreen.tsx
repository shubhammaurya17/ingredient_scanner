import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ArrowLeftRight, 
  Scan as ScanIcon, 
  Plus 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ScanResult } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressiveImage } from '../components/ui/ProgressiveImage';

export const CompareScreen = React.memo(({ 
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
      <div className="min-h-screen bg-gray-50 content-bottom-spacing">
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
            scans.map((scan, idx) => (
              <Card 
                key={scan.id ? `${scan.id}-${idx}` : `compare-select-${idx}`} 
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
    <div className="min-h-screen bg-gray-50 content-bottom-spacing">
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
          className="w-full shadow-xl shadow-brand-100 mb-8"
          disabled={!isReady}
          onClick={() => p1 && p2 && onCompare(p1, p2)}
        >
          Compare Now
        </Button>
      </div>
    </div>
  );
});
