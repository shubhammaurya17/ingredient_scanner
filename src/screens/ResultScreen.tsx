import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  ArrowLeft, 
  Share2, 
  Star, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  Loader2,
  ScanIcon
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressiveImage } from '../components/ui/ProgressiveImage';
import { FeedbackSystem } from '../components/FeedbackSystem';
import { cn } from '../lib/utils';
import { ScanResult } from '../types';
import { formatValue } from '../lib/formatUtils';
import { auth, db } from '../lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

interface ResultScreenProps {
  result: ScanResult;
  onBack: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
}

export const ResultScreen = React.memo(({ 
  result, 
  onBack, 
  onToggleFavorite, 
  isFavorite 
}: ResultScreenProps) => {
  const [showFullSuitability, setShowFullSuitability] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [voted, setVoted] = useState(false);

  const handleQuickFeedback = async (type: 'helpful' | 'not_helpful') => {
    if (voted || !auth.currentUser) return;
    setVoted(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: auth.currentUser.uid,
        screenName: 'ResultScreen',
        feedbackType: type,
        productName: result.product_name,
        productId: result.id,
        createdAt: serverTimestamp(),
        timestamp: Date.now()
      });
      if (type === 'not_helpful') setShowFeedback(true);
    } catch (err) {
      console.error('Quick feedback failed:', err);
    }
  };

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
    <div className="min-h-screen bg-gray-50 content-bottom-spacing">
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
          <div className={cn("px-8 py-3 rounded-3xl font-display flex flex-col items-center shadow-lg", actionColors[result.verdict_action as keyof typeof actionColors])}>
            <span className="font-black text-2xl tracking-widest uppercase">{result.verdict_action}</span>
            <span className="text-[12px] font-bold text-black mt-0.5">{actionExplanations[result.verdict_action as keyof typeof actionExplanations]}</span>
          </div>
          
          <div className="flex items-center space-x-6 py-2">
            <div className="text-center">
               <span className={cn("text-lg font-black block", verdictColors[result.overall_verdict as keyof typeof verdictColors])}>{result.overall_verdict}</span>
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
              [0, 1].map(i => (
                <div key={`loading-reason-${i}`} className="h-12 bg-white rounded-xl border border-gray-100 animate-pulse" />
              ))
            ) : (
              (result.top_reasons || []).map((reason, i) => (
                <div key={`reason-${i}-${reason.slice(0, 10)}`} className="flex items-start space-x-3 p-3 bg-white rounded-xl border border-gray-100">
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
            <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border", confidenceColors[result.confidence_level as keyof typeof confidenceColors])}>
              {result.confidence_level} Confidence
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(result.confidence_reasons || []).map((reason, i) => (
              <div key={`conf-reason-${i}-${reason.slice(0, 10)}`} className="flex items-center space-x-1.5 text-[10px] text-gray-500 font-medium">
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
              [0, 1].map(i => (
                <div key={`loading-breakdown-${i}`} className="flex items-center justify-between animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-4 bg-gray-100 rounded w-8" />
                </div>
              ))
            ) : (
              (result.score_breakdown || []).map((item, i) => (
                <div key={`score-factor-${item.factor}-${i}`} className="flex items-center justify-between">
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
                  <div key={`caution-${flag.group}-${i}`} className={cn(
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
                      <div key={`matrix-${flag.group}-${idx}`} className="p-2 bg-gray-50 rounded-lg border border-gray-100">
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

        {/* 6. Better Alternatives / Safer Alternatives Guidance */}
        {((result.better_alternatives_guidance && result.overall_verdict !== 'Good') || (result.recommended_products && result.recommended_products.length > 0)) && (
          <div className="space-y-3">
            <div className="px-1">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                {result.overall_verdict === 'Good' ? 'Better Options (Optional)' : 'Safer Alternatives'}
              </h2>
              {result.overall_verdict === 'Good' && (
                <p className="text-[10px] text-gray-500 font-medium mt-1">
                  This is already a good choice. If you want even better options, consider these:
                </p>
              )}
            </div>

            {result.overall_verdict !== 'Good' && result.better_alternatives_guidance && (
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
            )}

            {/* Recommended Products Block */}
            <div className="space-y-2 mt-2">
              {result.overall_verdict !== 'Good' && (
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Recommended Products</p>
              )}
              {isAnalyzing ? (
                <div className="flex items-center space-x-3 p-4 bg-white rounded-2xl border border-gray-100 animate-pulse">
                  <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-gray-500 font-medium">Finding {result.overall_verdict === 'Good' ? 'premium' : 'better'} alternatives...</span>
                </div>
              ) : result.recommended_products && result.recommended_products.length > 0 ? (
                <div className="space-y-2">
                  {result.recommended_products.map((product, idx) => (
                    <Card key={`rec-${product.product_name}-${idx}`} className="p-3 border-none shadow-sm bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-gray-900">
                            {product.product_name} <span className="text-gray-400 font-medium">({product.brand})</span>
                          </h3>
                          <div className="flex items-center mt-1 text-brand-600">
                            <ArrowRight className="w-3 h-3 mr-1" />
                            <p className="text-[11px] font-medium leading-tight">
                              {result.overall_verdict === 'Good' ? '→ ' : ''}{product.reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : !result.recommended_products && !isAnalyzing ? (
                <div className="flex items-center space-x-3 p-4 bg-white rounded-2xl border border-gray-100 animate-pulse">
                  <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-gray-500 font-medium">Finding {result.overall_verdict === 'Good' ? 'premium' : 'better'} alternatives...</span>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* 7. Nutrition Snapshot */}
        <div className="space-y-3">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Nutrition Snapshot</h2>
          <Card className="p-4 grid grid-cols-3 gap-4">
            {Object.entries(result.nutrition_summary || {}).map(([nutriKey, data], i) => {
              const isNA = data?.value === 'N/A' || data?.level === 'N/A';
              return (
                <div key={`nutri-${nutriKey}-${i}`} className="text-center space-y-1">
                  <span className="text-[10px] font-bold text-gray-900 uppercase block truncate">{nutriKey.replace('_', ' ')}</span>
                  <span className={cn("text-sm font-bold block", isNA ? "text-gray-300" : "text-gray-900")}>
                    {isNA ? 'N/A' : formatValue(data?.value, '')}
                  </span>
                  <span className={cn(
                    "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md inline-block",
                    data?.level === 'Low' ? "bg-green-50 text-green-600" : 
                    data?.level === 'Moderate' ? "bg-yellow-50 text-yellow-600" : 
                    data?.level === 'High' ? "bg-red-50 text-red-600" :
                    "bg-gray-50 text-gray-400"
                  )}>
                    {isNA ? 'Not Available' : data?.level}
                  </span>
                </div>
              );
            })}
          </Card>
        </div>

        {/* 8. Ingredient Breakdown */}
        <div className="space-y-4 pb-20">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Ingredient Intelligence</h2>
            <div className="flex items-center space-x-2 text-[10px] font-bold text-gray-400">
               <span className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-1 text-green-500" /> Label</span>
               <span className="flex items-center"><ScanIcon className="w-3 h-3 mr-1 text-yellow-500" /> AI</span>
            </div>
          </div>
          <div className="space-y-3">
            {isAnalyzing ? (
              [0, 1, 2].map(i => (
                <Card key={`ing-loading-${i}`} className="p-4 space-y-3 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-10 bg-gray-50 rounded w-full" />
                </Card>
              ))
            ) : (
              (result.ingredient_breakdown || []).map((ing, idx) => (
                <Card key={`ing-${ing.name}-${idx}`} className="overflow-hidden border-none shadow-sm">
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

        {/* Disclaimer */}
        <div className="p-6 bg-gray-100 rounded-[2rem] text-[10px] text-gray-400 text-center italic space-y-2">
          <p>AI-estimated data is clearly marked with icons. Confirmed data is extracted directly from the label.</p>
          <p>Disclaimer: This analysis is for educational purposes. Consult a medical professional for dietary advice.</p>
        </div>

        {/* Feedback Section */}
        <div className="space-y-4 pt-4 border-t border-gray-100 pb-20">
          <div className="text-center space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Was this analysis helpful?</h3>
            <div className="flex items-center justify-center space-x-3">
              <Button 
                variant="outline" 
                size="sm" 
                className={cn("bg-white", voted && "opacity-50")}
                onClick={() => handleQuickFeedback('helpful')}
                disabled={voted}
              >
                <ThumbsUp className="w-4 h-4 mr-2 text-green-600" /> Helpful
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className={cn("bg-white", voted && "opacity-50")}
                onClick={() => handleQuickFeedback('not_helpful')}
                disabled={voted}
              >
                <ThumbsDown className="w-4 h-4 mr-2 text-red-600" /> Not Helpful
              </Button>
            </div>
            <button 
              onClick={() => setShowFeedback(true)}
              className="text-[10px] font-bold text-brand-600 uppercase tracking-widest hover:underline"
            >
              Report Issue
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showFeedback && (
            <FeedbackSystem 
              context={{
                screenName: 'ResultScreen',
                productName: result.product_name,
                productId: result.id,
                feedbackType: voted ? 'not_helpful' : 'report'
              }}
              onClose={() => setShowFeedback(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
