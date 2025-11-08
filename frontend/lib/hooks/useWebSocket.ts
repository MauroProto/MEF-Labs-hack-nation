'use client';

/**
 * WebSocket Connection Hook
 *
 * Manages Socket.io connection to the backend server.
 * Provides connection state, room joining, and event handling.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * WebSocket connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * WebSocket hook options
 */
export interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionDelay?: number;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
}

/**
 * WebSocket hook return type
 */
export interface UseWebSocketReturn {
  socket: Socket | null;
  state: ConnectionState;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
  joinCanvas: (canvasId: string) => void;
  leaveCanvas: (canvasId: string) => void;
  emit: (event: string, data: any) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
}

/**
 * useWebSocket Hook
 *
 * Usage:
 * ```tsx
 * const { socket, state, joinCanvas } = useWebSocket({
 *   autoConnect: true,
 *   onConnect: () => console.log('Connected!'),
 * });
 *
 * useEffect(() => {
 *   if (canvasId) {
 *     joinCanvas(canvasId);
 *   }
 * }, [canvasId]);
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    autoConnect = true,
    reconnection = true,
    reconnectionDelay = 1000,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [state, setState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<Error | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const currentCanvasRef = useRef<string | null>(null);

  // Initialize socket connection
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.warn('[useWebSocket] Already connected');
      return;
    }

    setState('connecting');
    setError(null);

    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection,
      reconnectionDelay,
      withCredentials: true,
    });

    socket.on('connect', () => {
      console.log('[useWebSocket] Connected:', socket.id);
      setState('connected');
      setError(null);
      onConnect?.();

      // Rejoin canvas if we were in one
      if (currentCanvasRef.current) {
        socket.emit('join_canvas', currentCanvasRef.current);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[useWebSocket] Disconnected:', reason);
      setState('disconnected');
      onDisconnect?.(reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[useWebSocket] Connection error:', err);
      setState('error');
      setError(err as Error);
      onError?.(err as Error);
    });

    socket.on('error', (err) => {
      console.error('[useWebSocket] Socket error:', err);
      setError(new Error(err.message || 'Socket error'));
      onError?.(new Error(err.message || 'Socket error'));
    });

    socketRef.current = socket;
  }, [url, reconnection, reconnectionDelay, onConnect, onDisconnect, onError]);

  // Disconnect socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setState('disconnected');
      currentCanvasRef.current = null;
    }
  }, []);

  // Join a canvas room
  const joinCanvas = useCallback((canvasId: string) => {
    if (!socketRef.current?.connected) {
      console.warn('[useWebSocket] Cannot join canvas: not connected');
      return;
    }

    console.log('[useWebSocket] Joining canvas:', canvasId);
    socketRef.current.emit('join_canvas', canvasId);
    currentCanvasRef.current = canvasId;
  }, []);

  // Leave a canvas room
  const leaveCanvas = useCallback((canvasId: string) => {
    if (!socketRef.current?.connected) {
      console.warn('[useWebSocket] Cannot leave canvas: not connected');
      return;
    }

    console.log('[useWebSocket] Leaving canvas:', canvasId);
    socketRef.current.emit('leave_canvas', canvasId);

    if (currentCanvasRef.current === canvasId) {
      currentCanvasRef.current = null;
    }
  }, []);

  // Emit event
  const emit = useCallback((event: string, data: any) => {
    if (!socketRef.current?.connected) {
      console.warn('[useWebSocket] Cannot emit: not connected');
      return;
    }

    socketRef.current.emit(event, data);
  }, []);

  // Add event listener
  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (!socketRef.current) {
      console.warn('[useWebSocket] Cannot add listener: socket not initialized');
      return;
    }

    socketRef.current.on(event, handler);
  }, []);

  // Remove event listener
  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    if (!socketRef.current) {
      return;
    }

    if (handler) {
      socketRef.current.off(event, handler);
    } else {
      socketRef.current.off(event);
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    socket: socketRef.current,
    state,
    error,
    connect,
    disconnect,
    joinCanvas,
    leaveCanvas,
    emit,
    on,
    off,
  };
}
