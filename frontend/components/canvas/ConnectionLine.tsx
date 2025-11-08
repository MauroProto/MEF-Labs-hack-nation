/**
 * ConnectionLine Component
 *
 * Custom connection line for React Flow with:
 * - Smooth bezier curves
 * - Animated flow
 * - Custom styling
 */

'use client';

import React from 'react';
import { ConnectionLineComponent } from '@xyflow/react';

export const ConnectionLine: ConnectionLineComponent = ({
  fromX,
  fromY,
  toX,
  toY,
  connectionLineStyle,
}) => {
  // Calculate control points for smooth bezier curve
  const offsetX = Math.abs(toX - fromX) / 2;
  const offsetY = Math.abs(toY - fromY) / 2;

  const path = `M ${fromX},${fromY} C ${fromX + offsetX},${fromY} ${
    toX - offsetX
  },${toY} ${toX},${toY}`;

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={2}
        strokeDasharray="5 5"
        style={connectionLineStyle}
        className="animated"
      />
      <circle
        cx={toX}
        cy={toY}
        r={4}
        fill="#94a3b8"
        stroke="white"
        strokeWidth={2}
      />
    </g>
  );
};
