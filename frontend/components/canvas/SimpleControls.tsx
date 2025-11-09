'use client';

import React from 'react';

export function SimpleControls() {
  return (
    <div className="bg-white/90 backdrop-blur rounded-md px-2 py-1.5 text-xs text-gray-600">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        <span>Ready</span>
      </div>
    </div>
  );
}
