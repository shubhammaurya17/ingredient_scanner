import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Trophy, 
  Scale, 
  ThumbsUp, 
  ThumbsDown,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  ArrowRight
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

interface ComparisonResultScreenProps {
  products: ScanResult[];
  onBack: () => void;
  isAnalyzing?: boolean;
}

const getMetricWinner = (v1: number, v2: number, better: 'lower' | 'higher') => {
  if (v1 === v2) return null;
  if (better === 'lower') return v1 < v2 ? 1 : 2;
  return v1 > v2 ? 1 : 2;
};

const MetricRow = ({ label, v1, v2, unit = '', better = 'lower' }: { label: string, v1: string | number, v2: string | number, unit?: string, better?: 'lower' | 'higher' }) => {
  const isV1NA = v1 === 'n' || v1 === 'N/A' || v1 === undefined || v1 === null || (typeof v1 === 'string' && !/[0-9]/.test(v1));
  const isV2NA = v2 === 'n' || v2 === 'N/A' || v2 === undefined || v2 === null || (typeof v2 === 'string' && !/[0-9]/.test(v2));

  const val1 = isV1NA ? (better === 'lower' ? Infinity : -Infinity) : (typeof v1 === 'string' ? parseFloat(v1.replace(/[^0-9.]/g, '')) || 0 : v1);
  const val2 = isV2NA ? (better === 'lower' ? Infinity : -Infinity) : (typeof v2 === 'string' ? parseFloat(v2.replace(/[^0-9.]/g, '')) || 0 : v2);
  
  const winner = (isV1NA && isV2NA) ? null : getMetricWinner(val1, val2, better);
  
  return (
    <div className="py-3 border-b border-gray-50 last:border-0">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-center space-x-4">
        <div className={cn(
          "flex-1 p-2 rounded-xl text-center transition-all flex flex-col items-center",
          winner === 1 ? "bg-green-50 ring-1 ring-green-100" : (winner === 2 ? "bg-red-50/30" : "bg-gray-50/50")
        )}>
          <span className={cn("text-sm font-bold", winner === 1 ? "text-green-700" : (winner === 2 ? "text-red-700" : "text-gray-600"))}>
            {isV1NA ? 'N/A' : formatValue(v1, unit)}
          </span>
          {winner === 1 && <CheckCircle2 className="w-3 h-3 text-green-500 mt-1" />}
          {winner === 2 && <XCircle className="w-3 h-3 text-red-400 mt-1" />}
        </div>
        <div className="w-px h-4 bg-gray-100" />
        <div className={cn(
          "flex-1 p-2 rounded-xl text-center transition-all flex flex-col items-center",
          winner === 2 ? "bg-green-50 ring-1 ring-green-100" : (winner === 1 ? "bg-red-50/30" : "bg-gray-50/50")
        )}>
          <span className={cn("text-sm font-bold", winner === 2 ? "text-green-700" : (winner === 1 ? "text-red-700" : "text-gray-600"))}>
            {isV2NA ? 'N/A' : formatValue(v2, unit)}
          </span>
          {winner === 2 && <CheckCircle2 className="w-3 h-3 text-green-500 mt-1" />}
          {winner === 1 && <XCircle className="w-3 h-3 text-red-400 mt-1" />}
        </div>
      </div>
    </div>
  );
};

export const ComparisonResultScreen = React.memo(({ products, onBack, isAnalyzing }: ComparisonResultScreenProps) => {
  if (products.length < 2) return null;
  const [p1, p2] = products;

  const calculateComparison = (prod1: ScanResult, prod2: ScanResult) => {
    // If either is still analyzing (health_score 0), return a loading state
    if (prod1.health_score === 0 || prod2.health_score === 0) {
      return { 
        winner: prod1, 
        loser: prod2, 
        status: 'close' as const, 
        outcomeType: 'mixed' as const, 
        reason: "Analyzing both products to determine the winner...", 
        diff: 0 
      };
    }
    const getPoints = (p: ScanResult) => {
      let points = (p.health_score / 100) * 20; // 20% weight for base score

      // Ingredient Risks (30% weight)
      const risks = (p.ingredient_breakdown || []).filter(i => i.risk_level !== 'Low');
      const hR = risks.filter(i => i.risk_level === 'High').length;
      const mR = risks.filter(i => i.risk_level === 'Medium').length;
      points -= (hR * 5);
      points -= (mR * 2);

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

    // Scenario detection thresholds
    const isP1Bad = prod1.overall_verdict === 'Bad' || prod1.health_score < 50;
    const isP2Bad = prod2.overall_verdict === 'Bad' || prod2.health_score < 50;
    const isP1Good = prod1.overall_verdict === 'Good' && prod1.health_score >= 70;
    const isP2Good = prod2.overall_verdict === 'Good' && prod2.health_score >= 70;

    let outcomeType: 'both_good' | 'one_good_one_bad' | 'both_bad' | 'mixed' = 'mixed';
    if (isP1Bad && isP2Bad) outcomeType = 'both_bad';
    else if ((isP1Good && isP2Bad) || (isP2Good && isP1Bad)) outcomeType = 'one_good_one_bad';
    else if (isP1Good && isP2Good) outcomeType = 'both_good';

    let status: 'clear' | 'slight' | 'close' = 'close';
    if (diff > 12) status = 'clear';
    else if (diff > 4) status = 'slight';

    const winner = points1 >= points2 ? prod1 : prod2;
    const loser = points1 >= points2 ? prod2 : prod1;

    // Generate Reason based on scenarios
    let reason = "";
    let insights: string[] = [];
    let humanSummary = "";

    if (outcomeType === 'both_bad') {
      const commonRisks = [];
      if (prod1.nutrition_summary?.sugar?.level === 'High' && prod2.nutrition_summary?.sugar?.level === 'High') commonRisks.push("high sugar burden");
      if (prod1.nutrition_summary?.sodium?.level === 'High' && prod2.nutrition_summary?.sodium?.level === 'High') commonRisks.push("sodium concerns");
      
      reason = `Both products have significant red flags ${commonRisks.length > 0 ? `including ${commonRisks.join(' and ')}` : ''}.`;
      insights = [
        "Health scores for both are critically low",
        "Multiple high-risk ingredients identified in both",
        "Both products are ultra-processed"
      ];
      humanSummary = "Frequent consumption of highly processed foods like these may increase long-term health risks. Consider fresh alternatives.";
    } else if (outcomeType === 'both_good') {
      reason = `${winner.product_name} is the slightly better pick due to optimized ingredients, but both are high-quality options.`;
      insights = [
        "Balanced nutritional profiles across both",
        "Minimal use of additives or harmful preservatives",
        "Reliable source of required nutrients"
      ];
      humanSummary = "You can feel confident choosing either product based on your taste preference or price.";
    } else if (outcomeType === 'one_good_one_bad') {
      reason = `${winner.product_name} is the clearly recommended choice over the non-ideal alternative.`;
      insights = [
        `${winner.product_name} has a far superior nutrient density`,
        `${loser.product_name} contains high-risk elements found in typical junk food`,
        "Significant health score gap between these items"
      ];
      humanSummary = `Switching to ${winner.product_name} is a smart health move that reduces exposure to additives.`;
    } else if (status === 'close') {
      reason = "These products are very similar in quality. Both fall into a similar health category.";
      insights = [
        "Very small difference in critical nutrients",
        "Similar processing levels and additive count",
        "Nearly identical health impact"
      ];
      humanSummary = "The choice between these two won't significantly impact your dietary goals. Pick your favorite.";
    } else {
      const reasonsList = [];
      const wRisks = (winner.ingredient_breakdown || []).filter(i => i.risk_level !== 'Low').length;
      const lRisks = (loser.ingredient_breakdown || []).filter(i => i.risk_level !== 'Low').length;
      
      if (wRisks < lRisks) reasonsList.push("cleaner ingredient profile");
      if (winner.nutrition_summary?.sugar?.level !== 'High' && loser.nutrition_summary?.sugar?.level === 'High') reasonsList.push("lower sugar impact");
      if (winner.nutrition_summary?.sodium?.level !== 'High' && loser.nutrition_summary?.sodium?.level === 'High') reasonsList.push("better sodium control");
      
      if (reasonsList.length > 0) {
        reason = `${winner.product_name} is the ${status === 'clear' ? 'clear' : 'slightly'} better choice due to its ${reasonsList.join(' and ')}.`;
      } else {
        reason = `${winner.product_name} offers a more balanced nutritional profile overall.`;
      }

      insights = [
        `${winner.product_name} leads in fundamental health metrics`,
        `${loser.product_name} has higher ${loser.health_score < 60 ? 'risk factors' : 'limitations'}`,
        "Processing quality favors the winner"
      ];
      humanSummary = "Choosing the winner consistently helps in maintaining better blood sugar and heart health over time.";
    }

    return { winner, loser, status, outcomeType, reason, diff, insights, humanSummary };
  };

  const comparison = useMemo(() => calculateComparison(p1, p2), [p1, p2]);
  const betterProduct = comparison.winner;
  const otherProduct = comparison.loser;
  const [showFeedback, setShowFeedback] = useState(false);
  const [voted, setVoted] = useState(false);

  const handleQuickFeedback = async (type: 'helpful' | 'not_helpful') => {
    if (voted || !auth.currentUser) return;
    setVoted(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: auth.currentUser.uid,
        screenName: 'ComparisonResultScreen',
        feedbackType: type,
        comparisonProduct1: p1.product_name,
        comparisonProduct2: p2.product_name,
        createdAt: serverTimestamp(),
        timestamp: Date.now()
      });
      if (type === 'not_helpful') setShowFeedback(true);
    } catch (err) {
      console.error('Quick feedback failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-white content-bottom-spacing">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 flex items-center">
        <Button variant="ghost" size="icon" onClick={onBack} className="mr-2">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Comparison Result</h1>
      </div>

      <div className="p-6 space-y-8">
        {/* Live Analysis Banner */}
        {isAnalyzing && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-brand-50 p-4 rounded-2xl flex items-center space-x-3 overflow-hidden"
          >
            <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
            <p className="text-xs font-bold text-brand-700">Analyzing products. This will update live.</p>
          </motion.div>
        )}

        {/* Dynamic Header Section */}
        <motion.div
           initial={{ y: 20, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           className={cn(
             "p-6 rounded-[2.5rem] text-center space-y-3",
             comparison.outcomeType === 'both_bad' ? "bg-red-50 border border-red-100" :
             comparison.outcomeType === 'both_good' ? "bg-green-50 border border-green-100" :
             comparison.status === 'clear' ? "bg-brand-50 border border-brand-100" : "bg-gray-50 border border-gray-100"
           )}
        >
          {comparison.outcomeType === 'both_bad' ? (
            <>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-display font-black text-red-900">Avoid Both Products</h2>
              <p className="text-sm font-medium text-red-700 leading-snug">Both products have significant health concerns and red flags.</p>
            </>
          ) : (comparison.status === 'close' && p1.health_score < 40) ? (
            <>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6 text-gray-600" />
              </div>
              <h2 className="text-xl font-display font-black text-gray-900">No Recommended Option</h2>
              <p className="text-sm font-medium text-gray-600 leading-snug">Neither choice aligns with basic health standards. Both are tied but poor.</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center mx-auto">
                <Trophy className="w-6 h-6 text-brand-600" />
              </div>
              <h2 className="text-xl font-display font-black text-gray-900">
                {comparison.outcomeType === 'both_good' ? 'Both Are Good Choices' : `Better Choice: ${comparison.winner.product_name}`}
              </h2>
              <p className="text-sm font-medium text-gray-600 leading-snug">{comparison.reason}</p>
            </>
          )}
        </motion.div>

        {/* Final Verdict Block */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 px-1">
            <CheckCircle2 className="w-4 h-4 text-brand-600" />
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Final Verdict</h2>
          </div>
          <Card className="p-5 bg-gray-900 text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <TrendingUp className="w-20 h-20" />
             </div>
             <div className="relative z-10 space-y-1">
               <span className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em]">Summary Output</span>
               <h3 className="text-lg font-bold">
                 {comparison.outcomeType === 'both_bad' ? 'Decision: Skip both products' :
                  comparison.outcomeType === 'both_good' ? 'Decision: Buy either product' :
                  `Decision: Choose ${comparison.winner.product_name}`}
               </h3>
               <p className="text-xs text-gray-400 leading-relaxed font-medium">
                 {comparison.humanSummary}
               </p>
             </div>
          </Card>
        </div>

        {/* Product Comparison Cards */}
        <div className="grid grid-cols-2 gap-4">
          {[p1, p2].map((prod, idx) => (
            <Card key={`verdict-card-${idx}`} className={cn(
              "p-4 space-y-3 relative transition-all",
              comparison.winner === prod && comparison.outcomeType !== 'both_bad' ? "ring-2 ring-brand-500 bg-brand-50/20" : "border-gray-100"
            )}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-gray-400 uppercase">Product {idx + 1}</span>
                {comparison.winner === prod && comparison.outcomeType !== 'both_bad' && (
                  <Badge variant="green" className="animate-pulse">TOP</Badge>
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-900 truncate mb-1">{prod.product_name}</h4>
                <div className="flex items-center space-x-1.5">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    prod.overall_verdict === 'Good' ? "bg-green-500" : 
                    prod.overall_verdict === 'Moderate' ? "bg-yellow-500" : "bg-red-500"
                  )} />
                  <span className="text-xs font-black text-gray-700">{prod.overall_verdict}</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 font-medium line-clamp-none italic">
                {prod.why_summary || `Standard profile classification: ${prod.overall_verdict}.`}
              </p>
              <div className="pt-1 flex items-baseline space-x-0.5">
                <span className="text-lg font-black text-gray-900">{prod.health_score}</span>
                <span className="text-[10px] font-bold text-gray-400">/100</span>
              </div>
            </Card>
          ))}
        </div>

        {/* Key Differences */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 px-1">
            <Lightbulb className="w-4 h-4 text-brand-600" />
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Key Insights</h2>
          </div>
          <Card className="p-5 border-brand-100 bg-brand-50/30">
            <ul className="space-y-3">
              {comparison.insights.map((insight, idx) => (
                <li key={`insight-${idx}`} className="flex items-start space-x-3">
                  <div className="w-5 h-5 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-brand-600">{idx + 1}</span>
                  </div>
                  <p className="text-xs font-bold text-gray-700 leading-snug">{insight}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Nutritional Clash */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 px-1">
            <Scale className="w-4 h-4 text-brand-600" />
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Nutritional Clash</h2>
          </div>

          <Card className="p-6 space-y-6">
            <div className="flex items-center space-x-4 mb-2">
              <div className="flex-1 text-center truncate">
                <span className="text-[10px] font-black text-gray-900 uppercase truncate block">P1: {p1.product_name}</span>
              </div>
              <div className="w-px h-8 bg-gray-100" />
              <div className="flex-1 text-center truncate">
                <span className="text-[10px] font-black text-gray-900 uppercase truncate block">P2: {p2.product_name}</span>
              </div>
            </div>

            <MetricRow label="Calories" v1={p1.nutrition_summary?.calories?.value ?? 0} v2={p2.nutrition_summary?.calories?.value ?? 0} unit="kcal" />
            <MetricRow label="Total Sugar" v1={p1.nutrition_summary?.sugar?.value ?? 0} v2={p2.nutrition_summary?.sugar?.value ?? 0} unit="g" />
            <MetricRow label="Sodium" v1={p1.nutrition_summary?.sodium?.value ?? 0} v2={p2.nutrition_summary?.sodium?.value ?? 0} unit="mg" />
            <MetricRow label="Protein" v1={p1.nutrition_summary?.protein?.value ?? 0} v2={p2.nutrition_summary?.protein?.value ?? 0} unit="g" better="higher" />
          </Card>
        </div>

        {/* What this means for you (Human Insight) */}
        {comparison.humanSummary && (
          <div className="bg-brand-50 p-6 rounded-[2.5rem] border border-brand-100 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-100/50 rounded-full group-hover:scale-110 transition-transform duration-500" />
            <div className="relative z-10 space-y-2">
              <h3 className="text-sm font-black text-brand-900 uppercase tracking-widest">Direct Impact</h3>
              <p className="text-sm font-bold text-brand-800 leading-relaxed italic">
                "{comparison.humanSummary}"
              </p>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="p-6 bg-gray-100 rounded-[2rem] text-[10px] text-gray-400 text-center italic space-y-2">
          <p>Scan to choose better is powered by proprietary AI analysis. Always verify with actual physical packaging.</p>
          <p>This is for informational purposes and not a substitute for professional medical advice.</p>
        </div>

        {/* Feedback Section */}
        <div className="space-y-4 pt-4 border-t border-gray-100 pb-20">
          <div className="text-center space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Was this comparison helpful?</h3>
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
                screenName: 'ComparisonResultScreen',
                comparisonProduct1: p1.product_name,
                comparisonProduct2: p2.product_name,
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
