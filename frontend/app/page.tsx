'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ReactFlowProvider } from '@/components/providers/ReactFlowProvider';

const EnhancedCanvas = dynamic(
  () => import('@/components/canvas/EnhancedCanvas').then((mod) => ({ default: mod.EnhancedCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Research Agent Canvas...</p>
          <p className="text-gray-400 text-sm mt-2">Phase 5: Essential Nodes</p>
        </div>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <ReactFlowProvider>
      <EnhancedCanvas />
    </ReactFlowProvider>
  );
}
