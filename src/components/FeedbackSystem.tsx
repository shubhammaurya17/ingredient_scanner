import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  MessageSquare, 
  ArrowLeft, 
  AlertTriangle, 
  Search, 
  Activity, 
  Target, 
  Scale, 
  AlertCircle, 
  CheckCircle2,
  Send
} from 'lucide-react';
import { motion } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from './ui/Button';

export const FeedbackSystem = ({ 
  context, 
  onClose 
}: { 
  context: {
    screenName: string;
    productName?: string;
    productId?: string;
    comparisonProduct1?: string;
    comparisonProduct2?: string;
    feedbackType?: 'helpful' | 'not_helpful' | 'report';
  },
  onClose: () => void
}) => {
  const [step, setStep] = useState<'category' | 'form' | 'success'>('category');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { id: 'incorrect_ingredients', label: 'Incorrect ingredients', icon: AlertTriangle },
    { id: 'wrong_product', label: 'Wrong product matched', icon: Search },
    { id: 'not_found', label: 'Product not found', icon: X },
    { id: 'wrong_analysis', label: 'Analysis seems wrong', icon: Activity },
    { id: 'wrong_score', label: 'Score doesn\'t make sense', icon: Target },
    { id: 'wrong_comparison', label: 'Comparison seems wrong', icon: Scale },
    { id: 'bug', label: 'App bug / technical issue', icon: AlertCircle },
    { id: 'feature', label: 'Feature request', icon: Plus },
    { id: 'other', label: 'Other', icon: MessageSquare },
  ];

  const filteredCategories = categories.filter(cat => {
    if (context.screenName === 'ResultScreen') {
      return ['incorrect_ingredients', 'wrong_product', 'wrong_analysis', 'wrong_score', 'bug', 'other'].includes(cat.id);
    }
    if (context.screenName === 'ComparisonResultScreen') {
      return ['wrong_comparison', 'wrong_analysis', 'bug', 'other'].includes(cat.id);
    }
    if (context.screenName === 'ScanFailed') {
      return ['not_found', 'bug', 'other'].includes(cat.id);
    }
    return true;
  });

  const handleSubmit = async () => {
    if (!category || !auth.currentUser) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: auth.currentUser.uid,
        screenName: context.screenName,
        feedbackType: context.feedbackType || 'report',
        feedbackCategory: category,
        message,
        productName: context.productName || null,
        productId: context.productId || null,
        comparisonProduct1: context.comparisonProduct1 || null,
        comparisonProduct2: context.comparisonProduct2 || null,
        createdAt: serverTimestamp(),
        timestamp: Date.now(),
        appVersion: '1.0.0'
      });
      setStep('success');
    } catch (err) {
      console.error('Feedback submission failed:', err);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="w-full max-w-md bg-white rounded-t-[2.5rem] p-6 content-bottom-spacing shadow-2xl relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'category' && (
          <div className="space-y-6">
            <div className="text-center pt-2">
              <h2 className="text-xl font-bold text-gray-900">Tell us what went wrong</h2>
              <p className="text-sm text-gray-500 mt-1">Your feedback helps us improve product accuracy.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto pr-1">
              {filteredCategories.map((cat, idx) => (
                <button
                  key={`${cat.id}-${idx}`}
                  onClick={() => {
                    setCategory(cat.id);
                    setStep('form');
                  }}
                  className="flex items-center space-x-4 p-4 bg-gray-50 rounded-2xl hover:bg-brand-50 hover:text-brand-700 transition-colors text-left group"
                >
                  <div className="p-2 bg-white rounded-xl shadow-sm group-hover:bg-brand-100">
                    <cat.icon className="w-5 h-5 text-gray-400 group-hover:text-brand-600" />
                  </div>
                  <span className="font-bold text-sm">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 pt-2">
              <button onClick={() => setStep('category')} className="p-2 bg-gray-50 rounded-xl">
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-gray-900">More details</h2>
                <p className="text-xs text-gray-500">Category: {categories.find(c => c.id === category)?.label}</p>
              </div>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us more (optional)"
              className="w-full h-32 p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-500 text-sm resize-none"
            />
            <Button 
              className="w-full" 
              onClick={handleSubmit} 
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              <Send className="w-5 h-5 mr-2" />
              Submit Feedback
            </Button>
          </div>
        )}

        {step === 'success' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Thanks!</h2>
            <p className="text-gray-500 max-w-xs mx-auto">Your feedback has been submitted. We'll use it to improve Ingredia.</p>
            <Button variant="outline" className="w-full mt-6" onClick={onClose}>Close</Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
