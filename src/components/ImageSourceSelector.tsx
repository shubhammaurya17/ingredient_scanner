import React from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { motion } from 'motion/react';

export const ImageSourceSelector = ({ 
  onCamera, 
  onGallery, 
  onClose 
}: { 
  onCamera: () => void, 
  onGallery: () => void, 
  onClose: () => void 
}) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="w-full max-w-md bg-white rounded-t-[2.5rem] p-6 pb-12 shadow-2xl relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-6">
          <div className="text-center pt-2">
            <h2 className="text-xl font-bold text-gray-900">Choose Image Source</h2>
            <p className="text-sm text-gray-500 mt-1">Select how you want to add the product label.</p>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={onCamera}
              className="flex items-center space-x-4 p-4 bg-brand-50 rounded-2xl hover:bg-brand-100 transition-colors text-left group"
            >
              <div className="p-3 bg-white rounded-xl shadow-sm group-hover:bg-brand-50">
                <Camera className="w-6 h-6 text-brand-600" />
              </div>
              <div>
                <span className="font-bold text-base block">Use Camera</span>
                <span className="text-xs text-gray-500">Take a fresh photo of the label</span>
              </div>
            </button>

            <button
              onClick={onGallery}
              className="flex items-center space-x-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors text-left group"
            >
              <div className="p-3 bg-white rounded-xl shadow-sm group-hover:bg-brand-50">
                <Upload className="w-6 h-6 text-gray-400 group-hover:text-brand-600" />
              </div>
              <div>
                <span className="font-bold text-base block">Upload from Gallery</span>
                <span className="text-xs text-gray-500">Choose an existing photo</span>
              </div>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
