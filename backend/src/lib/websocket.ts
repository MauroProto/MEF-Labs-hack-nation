/**
 * WebSocket Server Setup
 *
 * Socket.io server for real-time agent communication updates.
 * Features:
 * - Room-based communication (per canvas)
 * - Event forwarding from agentBus
 * - Client authentication
 * - Automatic reconnection handling
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { agentBus } from '../services/agentEventBus';
import type {
  AgentEvent,
  AgentInvokeEvent,
  AgentResponseEvent,
  AgentStatusEvent,
  AgentErrorEvent,
  AgentRegisteredEvent,
} from '../types/agent.types';

/**
 * Client metadata stored per connection
 */
interface ClientMetadata {
  userId?: string;
  canvasId?: string;
  connectedAt: Date;
}

/**
 * WebSocket event payloads sent to clients
 */
export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: Date;
}

/**
 * WebSocket Manager
 *
 * Manages Socket.io connections and bridges agent events to WebSocket clients.
 */
export class WebSocketManager {
  private io: SocketIOServer;
  private clients: Map<string, ClientMetadata> = new Map();

  constructor(httpServer: HTTPServer) {
    // Initialize Socket.io with CORS
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupConnectionHandlers();
    this.setupAgentEventForwarding();

    console.log('[WebSocket] Socket.io server initialized');
  }

  /**
   * Setup client connection/disconnection handlers
   */
  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`[WebSocket] Client connected: ${socket.id}`);

      // Store client metadata
      this.clients.set(socket.id, {
        connectedAt: new Date(),
      });

      // Handle canvas room join
      socket.on('join_canvas', (canvasId: string) => {
        this.handleJoinCanvas(socket, canvasId);
      });

      // Handle canvas room leave
      socket.on('leave_canvas', (canvasId: string) => {
        this.handleLeaveCanvas(socket, canvasId);
      });

      // Handle authentication
      socket.on('authenticate', (data: { userId: string; token?: string }) => {
        this.handleAuthenticate(socket, data);
      });

      // Handle ping for connection health check
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date() });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`[WebSocket] Client disconnected: ${socket.id} (${reason})`);
        this.clients.delete(socket.id);
      });

      // Send welcome message
      socket.emit('connected', {
        socketId: socket.id,
        timestamp: new Date(),
        message: 'Connected to Research Agent Canvas',
      });
    });
  }

  /**
   * Setup forwarding of agent events to WebSocket clients
   */
  private setupAgentEventForwarding(): void {
    // Forward agent invocation events
    agentBus.onInvoke((event: AgentInvokeEvent) => {
      const canvasId = event.payload.context?.canvasId;
      if (canvasId) {
        this.emitToCanvas(canvasId, 'agent:invoke', {
          requestId: event.payload.id,
          from: event.payload.params.from,
          to: event.payload.params.to,
          tool: event.payload.params.tool,
          args: event.payload.params.args,
          timestamp: event.timestamp,
        });
      }
    });

    // Forward agent response events
    agentBus.onResponse((event: AgentResponseEvent) => {
      const canvasId = event.payload.context?.canvasId;
      if (canvasId) {
        this.emitToCanvas(canvasId, 'agent:response', {
          requestId: event.payload.id,
          result: event.payload.result,
          error: event.payload.error,
          timestamp: event.timestamp,
        });
      }
    });

    // Forward agent registered events
    agentBus.onRegistered((event: AgentRegisteredEvent) => {
      // Broadcast to all clients (registration is global)
      this.io.emit('agent:registered', {
        nodeId: event.payload.nodeId,
        agentType: event.payload.agentType,
        name: event.payload.name,
        capabilities: event.payload.capabilities,
        timestamp: event.timestamp,
      });
    });

    // Forward agent status changes
    agentBus.onStatus((event: AgentStatusEvent) => {
      // Broadcast to all clients
      this.io.emit('agent:status', {
        nodeId: event.payload.nodeId,
        status: event.payload.status,
        error: event.payload.error,
        timestamp: event.timestamp,
      });
    });

    // Forward agent errors
    agentBus.onError((event: AgentErrorEvent) => {
      const canvasId = event.payload.context?.canvasId;
      if (canvasId) {
        this.emitToCanvas(canvasId, 'agent:error', {
          nodeId: event.payload.nodeId,
          error: {
            message: event.payload.error.message,
            stack: event.payload.error.stack,
          },
          context: event.payload.context,
          timestamp: event.timestamp,
        });
      } else {
        // Broadcast errors without canvas context to all clients
        this.io.emit('agent:error', {
          nodeId: event.payload.nodeId,
          error: {
            message: event.payload.error.message,
          },
          timestamp: event.timestamp,
        });
      }
    });

    console.log('[WebSocket] Agent event forwarding configured');
  }

  /**
   * Handle client joining a canvas room
   */
  private handleJoinCanvas(socket: Socket, canvasId: string): void {
    if (!canvasId) {
      socket.emit('error', { message: 'Canvas ID is required' });
      return;
    }

    const roomName = `canvas:${canvasId}`;
    socket.join(roomName);

    // Update client metadata
    const metadata = this.clients.get(socket.id);
    if (metadata) {
      metadata.canvasId = canvasId;
    }

    console.log(`[WebSocket] Client ${socket.id} joined canvas: ${canvasId}`);

    socket.emit('canvas:joined', {
      canvasId,
      timestamp: new Date(),
    });

    // Broadcast to other clients in the room
    socket.to(roomName).emit('canvas:client_joined', {
      socketId: socket.id,
      canvasId,
      timestamp: new Date(),
    });
  }

  /**
   * Handle client leaving a canvas room
   */
  private handleLeaveCanvas(socket: Socket, canvasId: string): void {
    if (!canvasId) {
      return;
    }

    const roomName = `canvas:${canvasId}`;
    socket.leave(roomName);

    // Update client metadata
    const metadata = this.clients.get(socket.id);
    if (metadata) {
      metadata.canvasId = undefined;
    }

    console.log(`[WebSocket] Client ${socket.id} left canvas: ${canvasId}`);

    socket.emit('canvas:left', {
      canvasId,
      timestamp: new Date(),
    });

    // Broadcast to other clients in the room
    socket.to(roomName).emit('canvas:client_left', {
      socketId: socket.id,
      canvasId,
      timestamp: new Date(),
    });
  }

  /**
   * Handle client authentication
   */
  private handleAuthenticate(socket: Socket, data: { userId: string; token?: string }): void {
    // TODO: Implement JWT token validation when authentication is added
    // For now, just store userId
    const metadata = this.clients.get(socket.id);
    if (metadata) {
      metadata.userId = data.userId;
    }

    console.log(`[WebSocket] Client ${socket.id} authenticated as user: ${data.userId}`);

    socket.emit('authenticated', {
      userId: data.userId,
      timestamp: new Date(),
    });
  }

  /**
   * Emit event to all clients in a canvas room
   */
  public emitToCanvas(canvasId: string, event: string, data: any): void {
    const roomName = `canvas:${canvasId}`;
    this.io.to(roomName).emit(event, {
      ...data,
      canvasId,
      timestamp: data.timestamp || new Date(),
    });
  }

  /**
   * Emit event to a specific client
   */
  public emitToClient(socketId: string, event: string, data: any): void {
    this.io.to(socketId).emit(event, {
      ...data,
      timestamp: data.timestamp || new Date(),
    });
  }

  /**
   * Broadcast event to all connected clients
   */
  public broadcast(event: string, data: any): void {
    this.io.emit(event, {
      ...data,
      timestamp: data.timestamp || new Date(),
    });
  }

  /**
   * Get connected clients count
   */
  public getConnectedCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients in a canvas room
   */
  public getCanvasClients(canvasId: string): string[] {
    const roomName = `canvas:${canvasId}`;
    const room = this.io.sockets.adapter.rooms.get(roomName);
    return room ? Array.from(room) : [];
  }

  /**
   * Get statistics
   */
  public getStats(): {
    connectedClients: number;
    clientsByCanvas: Record<string, number>;
  } {
    const clientsByCanvas: Record<string, number> = {};

    this.clients.forEach((metadata) => {
      if (metadata.canvasId) {
        clientsByCanvas[metadata.canvasId] =
          (clientsByCanvas[metadata.canvasId] || 0) + 1;
      }
    });

    return {
      connectedClients: this.clients.size,
      clientsByCanvas,
    };
  }

  /**
   * Get Socket.io instance
   */
  public getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * Shutdown WebSocket server
   */
  public async shutdown(): Promise<void> {
    console.log('[WebSocket] Shutting down...');
    await this.io.close();
    this.clients.clear();
    console.log('[WebSocket] Shutdown complete');
  }
}

// Export singleton instance (initialized in index.ts)
let wsManager: WebSocketManager | null = null;

export function initializeWebSocket(httpServer: HTTPServer): WebSocketManager {
  if (wsManager) {
    console.warn('[WebSocket] Already initialized, returning existing instance');
    return wsManager;
  }

  wsManager = new WebSocketManager(httpServer);
  return wsManager;
}

export function getWebSocketManager(): WebSocketManager {
  if (!wsManager) {
    throw new Error('[WebSocket] WebSocketManager not initialized. Call initializeWebSocket first.');
  }
  return wsManager;
}
