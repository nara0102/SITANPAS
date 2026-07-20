import React from 'react';
import { Fish } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = "Memuat..." 
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="relative">
          <Fish className="h-12 w-12 text-blue-600 mx-auto animate-pulse" />
          <div className="absolute inset-0 bg-blue-200 rounded-full animate-ping opacity-25"></div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-800">{message}</h2>
          <div className="flex justify-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};