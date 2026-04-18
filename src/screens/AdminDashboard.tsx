import React, { useState, useEffect } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { db } from '../lib/firebase';
import { query, collection, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export const AdminDashboard = React.memo(() => {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFeedbacks(data);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-24">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-black text-gray-900 leading-tight">Admin Dashboard</h1>
        <p className="text-gray-500 font-medium">Monitoring user feedback & app quality</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Feedback...</p>
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-gray-200">
          <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No feedback entries found in database.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((f, idx) => (
            <Card key={f.id ? `${f.id}-${idx}` : `feedback-${idx}`} className="p-5 space-y-3 shadow-sm border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant={f.feedbackType === 'report' ? 'red' : 'blue'}>
                    {f.feedbackType?.toUpperCase() || 'INFO'}
                  </Badge>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {f.feedbackCategory?.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 font-bold">
                  {f.createdAt?.toDate ? f.createdAt.toDate().toLocaleString() : 'Recently'}
                </span>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900 leading-relaxed italic">
                  "{f.message || 'No message provided'}"
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-xl p-2">
                    <span className="text-[8px] font-bold text-gray-400 uppercase block">Screen</span>
                    <span className="text-[10px] font-bold text-gray-700">{f.screenName}</span>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-2">
                    <span className="text-[8px] font-bold text-gray-400 uppercase block">User ID</span>
                    <span className="text-[10px] font-bold text-gray-700 truncate block">{f.userId?.slice(0, 8)}...</span>
                  </div>
                </div>
                {f.productName && (
                  <div className="bg-brand-50/50 rounded-xl p-2 border border-brand-50">
                    <span className="text-[8px] font-bold text-brand-600 uppercase block">Product</span>
                    <span className="text-[10px] font-bold text-brand-700">{f.productName}</span>
                  </div>
                )}
                {f.comparisonProduct1 && (
                  <div className="bg-blue-50/50 rounded-xl p-2 border border-blue-50">
                    <span className="text-[8px] font-bold text-blue-600 uppercase block">Comparison</span>
                    <span className="text-[10px] font-bold text-blue-700">{f.comparisonProduct1} vs {f.comparisonProduct2}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
});
