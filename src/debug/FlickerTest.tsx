import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Minimal test component to isolate flickering issues
 * This component focuses only on auth state changes without complex UI
 */
const FlickerTest = () => {
  const { user, loading } = useAuth();
  const [renderCount, setRenderCount] = useState(0);
  const [stateHistory, setStateHistory] = useState<Array<{
    timestamp: number;
    loading: boolean;
    user: string | null;
    renderCount: number;
  }>>([]);

  // Track every render
  useEffect(() => {
    const newCount = renderCount + 1;
    setRenderCount(newCount);
    
    const newState = {
      timestamp: Date.now(),
      loading,
      user: user?.email || null,
      renderCount: newCount
    };
    
    setStateHistory(prev => [...prev.slice(-9), newState]); // Keep last 10 states
  });

  // Track auth state changes specifically
  useEffect(() => {
    // Auth state change tracking for debugging
  }, [loading, user, renderCount]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🧪 Flicker Debug Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current State */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Current State</h2>
          <div className="space-y-2">
            <div className={`p-2 rounded ${loading ? 'bg-yellow-100' : 'bg-green-100'}`}>
              <strong>Loading:</strong> {loading ? '⏳ True' : '✅ False'}
            </div>
            <div className={`p-2 rounded ${user ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <strong>User:</strong> {user?.email || '❌ None'}
            </div>
            <div className="p-2 rounded bg-purple-100">
              <strong>Render Count:</strong> {renderCount}
            </div>
          </div>
        </div>

        {/* State History */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">State History (Last 10)</h2>
          <div className="space-y-1 text-sm max-h-64 overflow-y-auto">
            {stateHistory.map((state, index) => (
              <div 
                key={index} 
                className={`p-2 rounded text-xs ${
                  index === stateHistory.length - 1 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                }`}
              >
                <div className="font-mono">
                  #{state.renderCount} - {new Date(state.timestamp).toLocaleTimeString()}
                </div>
                <div>
                  Loading: {state.loading ? '⏳' : '✅'} | 
                  User: {state.user || '❌'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Visual Flicker Indicator */}
      <div className="mt-6 bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-3">Visual State Indicator</h2>
        <div className="flex items-center space-x-4">
          <div className={`w-4 h-4 rounded-full ${loading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
          <span>{loading ? 'Loading...' : 'Ready'}</span>
          
          <div className={`w-4 h-4 rounded-full ${user ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
          <span>{user ? 'Authenticated' : 'Not Authenticated'}</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <h3 className="font-semibold text-yellow-800 mb-2">🔍 Debug Instructions:</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Watch the render count - rapid increases indicate excessive re-renders</li>
          <li>• Monitor state history for rapid loading/user state changes</li>
          <li>• Check browser console for detailed auth flow logs</li>
          <li>• Look for patterns in the visual indicators</li>
          <li>• Navigate between pages to test auth state persistence</li>
        </ul>
      </div>
    </div>
  );
};

export default FlickerTest;