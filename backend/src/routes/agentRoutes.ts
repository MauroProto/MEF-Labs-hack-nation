/**
 * Agent Routes
 *
 * API routes for agent registration, discovery, and management.
 */

import { Router } from 'express';
import * as agentController from '../controllers/agentController';

const router = Router();

/**
 * Agent Registration & Management
 */

// Register a new agent
router.post('/register', agentController.registerAgent);

// Deregister an agent
router.delete('/:nodeId', agentController.deregisterAgent);

// Get all agents (optionally filter by type via query param ?type=researcher)
router.get('/', agentController.getAllAgents);

// Get registry statistics
router.get('/stats', agentController.getStats);

// Search agents by capability
router.get('/search/capability', agentController.searchByCapability);

// Get specific agent
router.get('/:nodeId', agentController.getAgent);

// Get agent capabilities
router.get('/:nodeId/capabilities', agentController.getAgentCapabilities);

// Update agent status
router.patch('/:nodeId/status', agentController.updateAgentStatus);

export default router;
