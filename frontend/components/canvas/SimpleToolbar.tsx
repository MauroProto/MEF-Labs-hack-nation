'use client';

import React from 'react';
import { Plus } from 'lucide-react';

export function SimpleToolbar() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 w-64 p-4">
      <h3 className="font-semibold text-sm text-gray-900 mb-3">Backend Status</h3>
      <p className="text-xs text-gray-500 mb-2">Phase 4 Complete! ✅</p>
      <div className="space-y-2 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <Plus className="h-3 w-3 text-green-500" />
          <span>Canvas API</span>
        </div>
        <div className="flex items-center gap-2">
          <Plus className="h-3 w-3 text-green-500" />
          <span>Paper Upload API</span>
        </div>
        <div className="flex items-center gap-2">
          <Plus className="h-3 w-3 text-green-500" />
          <span>Agent Registry API</span>
        </div>
        <div className="flex items-center gap-2">
          <Plus className="h-3 w-3 text-green-500" />
          <span>Capabilities API</span>
        </div>
      </div>
      <div className="mt-4 p-2 rounded text-xs bg-green-50 text-green-700 border border-green-200">
        Backend: http://localhost:4000
      </div>
    </div>
  );
}
