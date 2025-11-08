'use client';

/**
 * Debug Page
 *
 * Test page for the Agent Debug Panel.
 * Shows real-time agent communication and WebSocket status.
 */

import { WebSocketProvider } from '@/components/providers/WebSocketProvider';
import { AgentDebugPanel } from '@/components/debug';

export default function DebugPage() {
  return (
    <WebSocketProvider autoConnect={true}>
      <div className="container mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Agent Communication Debug</h1>
          <p className="text-muted-foreground mt-2">
            Monitor agent events, invocations, and WebSocket connection status
          </p>
        </div>

        <AgentDebugPanel />

        <div className="mt-8">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Start</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Ensure the backend server is running on port 4000</li>
              <li>Check the connection status indicator (should be green when connected)</li>
              <li>
                Register agents using the API:
                <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto">
{`POST http://localhost:4000/api/agents/register
Content-Type: application/json

{
  "nodeId": "researcher-1",
  "agentType": "researcher",
  "name": "Research Agent 1",
  "description": "Analyzes research papers",
  "systemPrompt": "You are a research analysis agent",
  "capabilities": []
}`}
                </pre>
              </li>
              <li>Watch the "Agents" tab to see registered agents appear</li>
              <li>Monitor the "Invocations" tab for agent-to-agent communication</li>
              <li>View all events in the "Events" tab</li>
            </ol>
          </div>
        </div>
      </div>
    </WebSocketProvider>
  );
}
