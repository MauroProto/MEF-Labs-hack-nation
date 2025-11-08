/**
 * ReactFlowProvider
 *
 * Client-side provider wrapper for React Flow.
 */

'use client';

import { ReactFlowProvider as RFProvider } from '@xyflow/react';

export function ReactFlowProvider({ children }: { children: React.ReactNode }) {
  return <RFProvider>{children}</RFProvider>;
}
