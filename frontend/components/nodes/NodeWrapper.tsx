/**
 * NodeWrapper Component
 *
 * Wrapper component that handles common node logic:
 * - Error boundaries
 * - Context propagation
 * - Loading states
 * - Error handling
 */

'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { BaseNode, type BaseNodeProps } from './BaseNode';

interface NodeWrapperProps extends BaseNodeProps {
  isLoading?: boolean;
  error?: string | null;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class NodeErrorBoundary extends React.Component<
  { children: React.ReactNode; nodeId: string },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; nodeId: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Node error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertCircle className="h-5 w-5" />
            <span className="font-semibold">Node Error</span>
          </div>
          <p className="text-sm text-red-600">
            {this.state.error?.message || 'An error occurred in this node'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 text-sm text-red-700 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function NodeWrapper({
  id,
  data,
  selected,
  isLoading = false,
  error = null,
  children,
}: NodeWrapperProps) {
  return (
    <NodeErrorBoundary nodeId={id}>
      <BaseNode id={id} data={data} selected={selected}>
        {error ? (
          <div className="flex items-start gap-2 text-red-600">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          children
        )}
      </BaseNode>
    </NodeErrorBoundary>
  );
}
