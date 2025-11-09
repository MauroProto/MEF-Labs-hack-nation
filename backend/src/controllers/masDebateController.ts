import { Request, Response } from "express";
import { DebateCoordinator } from "../services/debate/DebateCoordinator";
import { Paper } from "../types/debate.types";
import { prisma } from "../lib/prisma";
import fs from "fs/promises";
import path from "path";

/**
 * Generate questions from a paper
 */
export async function generateQuestions(req: Request, res: Response) {
  try {
    const { paperId } = req.body;

    if (!paperId) {
      return res.status(400).json({ error: "paperId is required" });
    }

    // Fetch paper from database
    const paperRecord = await prisma.paper.findUnique({
      where: { id: paperId },
    });

    if (!paperRecord) {
      return res.status(404).json({ error: "Paper not found" });
    }

    // Read paper content
    const paperPath = path.join(process.cwd(), paperRecord.filePath);
    const paperText = await fs.readFile(paperPath, "utf-8");

    const paper: Paper = {
      id: paperRecord.id,
      title: paperRecord.title,
      text: paperText,
    };

    const coordinator = new DebateCoordinator();
    const questions = await coordinator.generateQuestions(paper);

    res.json({ questions });
  } catch (error) {
    console.error("Error generating questions:", error);
    res.status(500).json({
      error: "Failed to generate questions",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Generate postures and topics for a question
 */
export async function generatePosturesAndTopics(req: Request, res: Response) {
  try {
    const { paperId, question, numPostures = 3 } = req.body;

    if (!paperId || !question) {
      return res.status(400).json({ error: "paperId and question are required" });
    }

    // Fetch paper from database
    const paperRecord = await prisma.paper.findUnique({
      where: { id: paperId },
    });

    if (!paperRecord) {
      return res.status(404).json({ error: "Paper not found" });
    }

    // Read paper content
    const paperPath = path.join(process.cwd(), paperRecord.filePath);
    const paperText = await fs.readFile(paperPath, "utf-8");

    const paper: Paper = {
      id: paperRecord.id,
      title: paperRecord.title,
      text: paperText,
    };

    const coordinator = new DebateCoordinator();
    const result = await coordinator.generatePosturesAndTopics(
      paper,
      question,
      numPostures
    );

    res.json(result);
  } catch (error) {
    console.error("Error generating postures and topics:", error);
    res.status(500).json({
      error: "Failed to generate postures and topics",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Run a complete debate
 */
export async function runDebate(req: Request, res: Response) {
  try {
    const { paperId, question, numPostures = 3 } = req.body;

    if (!paperId || !question) {
      return res.status(400).json({ error: "paperId and question are required" });
    }

    // Fetch paper from database
    const paperRecord = await prisma.paper.findUnique({
      where: { id: paperId },
    });

    if (!paperRecord) {
      return res.status(404).json({ error: "Paper not found" });
    }

    // Read paper content
    const paperPath = path.join(process.cwd(), paperRecord.filePath);
    const paperText = await fs.readFile(paperPath, "utf-8");

    const paper: Paper = {
      id: paperRecord.id,
      title: paperRecord.title,
      text: paperText,
    };

    const coordinator = new DebateCoordinator();

    // Set up SSE if client accepts it
    const acceptsSSE = req.headers.accept?.includes("text/event-stream");

    if (acceptsSSE) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const onProgress = (stage: string, data?: any) => {
        res.write(`event: progress\n`);
        res.write(`data: ${JSON.stringify({ stage, data })}\n\n`);
      };

      try {
        const report = await coordinator.runCompleteDebate(
          paper,
          question,
          numPostures,
          onProgress
        );

        res.write(`event: complete\n`);
        res.write(`data: ${JSON.stringify(report)}\n\n`);
        res.end();
      } catch (error) {
        res.write(`event: error\n`);
        res.write(
          `data: ${JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          })}\n\n`
        );
        res.end();
      }
    } else {
      // Regular JSON response
      const report = await coordinator.runCompleteDebate(
        paper,
        question,
        numPostures
      );

      res.json(report);
    }
  } catch (error) {
    console.error("Error running debate:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Failed to run debate",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Run complete debate flow with question generation
 */
export async function runCompleteDebateFlow(req: Request, res: Response) {
  try {
    const { paperId, questionIndex = 0, numPostures = 3 } = req.body;

    if (!paperId) {
      return res.status(400).json({ error: "paperId is required" });
    }

    // Fetch paper from database
    const paperRecord = await prisma.paper.findUnique({
      where: { id: paperId },
    });

    if (!paperRecord) {
      return res.status(404).json({ error: "Paper not found" });
    }

    // Read paper content
    const paperPath = path.join(process.cwd(), paperRecord.filePath);
    const paperText = await fs.readFile(paperPath, "utf-8");

    const paper: Paper = {
      id: paperRecord.id,
      title: paperRecord.title,
      text: paperText,
    };

    const coordinator = new DebateCoordinator();

    // Set up SSE if client accepts it
    const acceptsSSE = req.headers.accept?.includes("text/event-stream");

    if (acceptsSSE) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const onProgress = (stage: string, data?: any) => {
        res.write(`event: progress\n`);
        res.write(`data: ${JSON.stringify({ stage, data })}\n\n`);
      };

      try {
        const report = await coordinator.runCompleteDebateWithQuestionGeneration(
          paper,
          questionIndex,
          numPostures,
          onProgress
        );

        res.write(`event: complete\n`);
        res.write(`data: ${JSON.stringify(report)}\n\n`);
        res.end();
      } catch (error) {
        res.write(`event: error\n`);
        res.write(
          `data: ${JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          })}\n\n`
        );
        res.end();
      }
    } else {
      // Regular JSON response
      const report = await coordinator.runCompleteDebateWithQuestionGeneration(
        paper,
        questionIndex,
        numPostures
      );

      res.json(report);
    }
  } catch (error) {
    console.error("Error running complete debate flow:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Failed to run complete debate flow",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

