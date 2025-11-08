'use client';

/**
 * Agent Debug Panel
 *
 * Real-time visualization of agent communication and status.
 * Shows WebSocket connection, agent invocations, and event logs.
 */

import { useState, useEffect } from 'react';
import {
  useWebSocket,
  useAgentStatus,
  useAgentInvocations,
  AgentInvokeEvent,
  AgentResponseEvent,
  AgentErrorEvent,
} from '@/lib/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Connection status indicator
 */
function ConnectionStatus() {
  const { state, error } = useWebSocket();

  const getStatusColor = () => {
    switch (state) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (state) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
      <span className="text-sm font-medium">{getStatusText()}</span>
      {error && <span className="text-xs text-red-500">({error.message})</span>}
    </div>
  );
}

/**
 * Agent status list
 */
function AgentStatusList() {
  const { getAllAgents, stats } = useAgentStatus();
  const agents = getAllAgents();

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      idle: 'secondary',
      busy: 'default',
      error: 'destructive',
    };
    return variants[status] || 'default';
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-sm">
        <Badge variant="outline">Total: {stats.total}</Badge>
        <Badge variant="secondary">Idle: {stats.idle}</Badge>
        <Badge variant="default">Busy: {stats.busy}</Badge>
        <Badge variant="destructive">Error: {stats.error}</Badge>
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents registered</p>
          ) : (
            agents.map((agent) => (
              <Card key={agent.nodeId}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.nodeId}</p>
                    </div>
                    <Badge variant={getStatusBadge(agent.status)}>{agent.status}</Badge>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground">
                      {agent.capabilities.length} capabilities
                    </p>
                  </div>
                  {agent.error && (
                    <p className="mt-1 text-xs text-red-500">Error: {agent.error}</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Invocation list with request/response correlation
 */
function InvocationList() {
  const { getAllInvocations } = useAgentInvocations();
  const invocations = getAllInvocations().slice(-20).reverse(); // Last 20, newest first

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      pending: 'default',
      completed: 'secondary',
      error: 'destructive',
    };
    return variants[status] || 'default';
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2">
        {invocations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invocations yet</p>
        ) : (
          invocations.map((inv) => (
            <Card key={inv.requestId}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadge(inv.status)}>{inv.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(inv.duration)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium">
                      {inv.from} → {inv.to}.{inv.tool}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {inv.startTime.toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                {inv.error && (
                  <div className="mt-2 rounded bg-red-50 p-2">
                    <p className="text-xs text-red-600">
                      {inv.error.code}: {inv.error.message}
                    </p>
                  </div>
                )}

                {inv.result && inv.status === 'completed' && (
                  <div className="mt-2 rounded bg-green-50 p-2">
                    <p className="text-xs text-green-600">
                      ✓ Completed successfully
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </ScrollArea>
  );
}

/**
 * Event log
 */
function EventLog() {
  const [events, setEvents] = useState<
    Array<{
      id: string;
      type: string;
      message: string;
      timestamp: Date;
      level: 'info' | 'success' | 'error';
    }>
  >([]);

  const addEvent = (
    type: string,
    message: string,
    level: 'info' | 'success' | 'error' = 'info'
  ) => {
    setEvents((prev) =>
      [
        {
          id: `${Date.now()}-${Math.random()}`,
          type,
          message,
          timestamp: new Date(),
          level,
        },
        ...prev,
      ].slice(0, 100)
    ); // Keep last 100 events
  };

  // Subscribe to all events
  useEffect(() => {
    const handleInvoke = (event: AgentInvokeEvent) => {
      addEvent(
        'invoke',
        `${event.from} → ${event.to}.${event.tool}`,
        'info'
      );
    };

    const handleResponse = (event: AgentResponseEvent) => {
      addEvent(
        'response',
        `Response for ${event.requestId}: ${event.error ? 'Error' : 'Success'}`,
        event.error ? 'error' : 'success'
      );
    };

    const handleError = (event: AgentErrorEvent) => {
      addEvent('error', `${event.nodeId}: ${event.error.message}`, 'error');
    };

    // TODO: Subscribe to events using useAgentEvents
    // For now, this is a placeholder

    return () => {
      // Cleanup subscriptions
    };
  }, []);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-1">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet</p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-2 border-b border-gray-100 py-2 text-xs"
            >
              <span className="text-muted-foreground">
                {event.timestamp.toLocaleTimeString()}
              </span>
              <span className="font-medium">[{event.type}]</span>
              <span className={getLevelColor(event.level)}>{event.message}</span>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}

/**
 * Main Agent Debug Panel
 */
export function AgentDebugPanel() {
  const [canvasId, setCanvasId] = useState<string>('');
  const { joinCanvas, leaveCanvas } = useWebSocket();

  const handleJoinCanvas = () => {
    if (canvasId) {
      joinCanvas(canvasId);
    }
  };

  const handleLeaveCanvas = () => {
    if (canvasId) {
      leaveCanvas(canvasId);
      setCanvasId('');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Agent Debug Panel</CardTitle>
            <CardDescription>Real-time agent communication monitor</CardDescription>
          </div>
          <ConnectionStatus />
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="agents" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="invocations">Invocations</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="mt-4">
            <AgentStatusList />
          </TabsContent>

          <TabsContent value="invocations" className="mt-4">
            <InvocationList />
          </TabsContent>

          <TabsContent value="events" className="mt-4">
            <EventLog />
          </TabsContent>
        </Tabs>

        {/* Canvas room controls */}
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            placeholder="Canvas ID"
            value={canvasId}
            onChange={(e) => setCanvasId(e.target.value)}
            className="flex-1 rounded border px-3 py-2 text-sm"
          />
          <button
            onClick={handleJoinCanvas}
            disabled={!canvasId}
            className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Join
          </button>
          <button
            onClick={handleLeaveCanvas}
            className="rounded bg-gray-500 px-4 py-2 text-sm text-white hover:bg-gray-600"
          >
            Leave
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
