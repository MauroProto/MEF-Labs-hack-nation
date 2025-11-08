/**
 * Capability Routes
 *
 * API routes for querying agent capabilities across the system.
 */

import { Router } from 'express';
import * as agentController from '../controllers/agentController';

const router = Router();

/**
 * Capability Discovery
 */

// Get all available tools across all agents
// Supports ?category=analysis or ?search=validate
router.get('/', agentController.getAllCapabilities);

export default router;
