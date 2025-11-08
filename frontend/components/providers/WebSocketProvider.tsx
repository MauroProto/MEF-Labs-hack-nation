'use client';

/**
 * WebSocket Provider
 *
 * Provides WebSocket connection context to the entire application.
 * Initializes connection and makes it available to all child components.
 */

import { createContext, useContext, ReactNode } from 'react';
import { useWebSocket, UseWebSocketReturn } from '@/lib/hooks';

const WebSocketContext = createContext<UseWebSocketReturn | null>(null);

export interface WebSocketProviderProps {
  children: ReactNode;
  url?: string;
  autoConnect?: boolean;
}

export function WebSocketProvider({
  children,
  url,
  autoConnect = true,
}: WebSocketProviderProps) {
  const websocket = useWebSocket({
    url,
    autoConnect,
    onConnect: () => {
      console.log('[WebSocketProvider] Connected to server');
    },
    onDisconnect: (reason) => {
      console.log('[WebSocketProvider] Disconnected:', reason);
    },
    onError: (error) => {
      console.error('[WebSocketProvider] Error:', error);
    },
  });

  return <WebSocketContext.Provider value={websocket}>{children}</WebSocketContext.Provider>;
}

export function useWebSocketContext(): UseWebSocketReturn {
  const context = useContext(WebSocketContext);

  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }

  return context;
}
