// Maieutic Dialogue Service - Socratic questioning for narrative exploration
// Adapted from LPE maieutic.py for Cloudflare Workers with Durable Objects

import type { Env } from '../../shared/types';

export interface DialogueTurn {
  turn_number: number;
  depth_level: number; // 0-4
  question: string;
  answer?: string;
  insights?: string[];
  timestamp: number;
}

export interface SessionState {
  session_id: string;
  user_id: string;
  initial_narrative: string;
  goal: string;
  turns: DialogueTurn[];
  created_at: number;
  is_complete: boolean;
  final_understanding?: string;
}

/**
 * MaieuticSessionDO - Durable Object for maintaining dialogue session state
 *
 * Each session is a separate Durable Object instance that maintains state
 * across multiple question-answer turns
 */
export class MaieuticSessionDO {
  private state: DurableObjectState;
  private env: Env;
  private sessionState: SessionState | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  /**
   * Initialize a new maieutic dialogue session
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/init' && request.method === 'POST') {
      return this.handleInit(request);
    } else if (url.pathname === '/respond' && request.method === 'POST') {
      return this.handleRespond(request);
    } else if (url.pathname === '/state' && request.method === 'GET') {
      return this.handleGetState();
    } else {
      return new Response('Not found', { status: 404 });
    }
  }

  /**
   * Initialize new session
   */
  private async handleInit(request: Request): Promise<Response> {
    const { session_id, user_id, narrative, goal } = await request.json();

    this.sessionState = {
      session_id,
      user_id,
      initial_narrative: narrative,
      goal: goal || 'understand',
      turns: [],
      created_at: Date.now(),
      is_complete: false
    };

    await this.state.storage.put('session', this.sessionState);

    // Generate first question
    const firstQuestion = await this.generateQuestion(0);

    return Response.json({
      session_id,
      question: firstQuestion,
      depth_level: 0,
      turn_number: 1
    });
  }

  /**
   * Handle user response and generate next question
   */
  private async handleRespond(request: Request): Promise<Response> {
    const { answer } = await request.json();

    if (!this.sessionState) {
      this.sessionState = await this.state.storage.get('session');
    }

    if (!this.sessionState) {
      return Response.json({ error: 'Session not initialized' }, { status: 400 });
    }

    const currentTurnNumber = this.sessionState.turns.length;
    const currentDepth = Math.min(currentTurnNumber, 4); // Max depth 4

    // Get the last turn's question
    const lastTurn = this.sessionState.turns[currentTurnNumber - 1];

    if (!lastTurn) {
      return Response.json({ error: 'No question to answer' }, { status: 400 });
    }

    // Update last turn with answer
    lastTurn.answer = answer;

    // Extract insights from the answer
    const insights = await this.extractInsights(lastTurn.question, answer);
    lastTurn.insights = insights;

    // Check if dialogue should end (max 5 turns or user says "done")
    const shouldEnd =
      currentTurnNumber >= 5 ||
      answer.toLowerCase().includes('done') ||
      answer.toLowerCase().includes('complete');

    if (shouldEnd) {
      // Synthesize final understanding
      const finalUnderstanding = await this.synthesizeUnderstanding();
      this.sessionState.final_understanding = finalUnderstanding;
      this.sessionState.is_complete = true;

      await this.state.storage.put('session', this.sessionState);

      // Save to D1 database
      await this.saveToDatabase();

      return Response.json({
        turn_number: currentTurnNumber,
        depth_level: currentDepth,
        insights,
        is_complete: true,
        final_understanding: finalUnderstanding
      });
    } else {
      // Generate next question
      const nextDepth = Math.min(currentTurnNumber + 1, 4);
      const nextQuestion = await this.generateQuestion(nextDepth);

      // Add new turn
      this.sessionState.turns.push({
        turn_number: currentTurnNumber + 1,
        depth_level: nextDepth,
        question: nextQuestion,
        timestamp: Date.now()
      });

      await this.state.storage.put('session', this.sessionState);

      return Response.json({
        turn_number: currentTurnNumber + 1,
        depth_level: nextDepth,
        question: nextQuestion,
        insights,
        is_complete: false
      });
    }
  }

  /**
   * Get current session state
   */
  private async handleGetState(): Promise<Response> {
    if (!this.sessionState) {
      this.sessionState = await this.state.storage.get('session');
    }

    if (!this.sessionState) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    return Response.json(this.sessionState);
  }

  /**
   * Generate maieutic question based on dialogue history and depth level
   */
  private async generateQuestion(depthLevel: number): Promise<string> {
    if (!this.sessionState) {
      throw new Error('Session not initialized');
    }

    const systemPrompt = `You are a Socratic questioner practicing maieutic dialogue.
Your role is to help the user discover deeper truths about their narrative through thoughtful questions.
Do not provide answers or interpretations - only ask questions that guide discovery.
Focus on one aspect at a time, building understanding gradually.
Questions should be open-ended and thought-provoking.`;

    // Build context from session
    let context = `Initial narrative: ${this.sessionState.initial_narrative}\n\n`;

    if (this.sessionState.turns.length > 0) {
      context += 'Dialogue so far:\n';
      // Last 3 turns for context
      const recentTurns = this.sessionState.turns.slice(-3);
      for (const turn of recentTurns) {
        context += `Q: ${turn.question}\n`;
        if (turn.answer) {
          context += `A: ${turn.answer}\n\n`;
        }
      }
    }

    // Depth-specific prompting (5 levels: 0-4)
    const depthPrompts: Record<number, string> = {
      0: 'Ask an initial question to understand the surface level of the narrative.',
      1: 'Ask about the underlying motivations or conflicts.',
      2: 'Probe deeper into the root causes or fundamental tensions.',
      3: 'Question the assumptions or worldview behind the narrative.',
      4: 'Explore the universal or archetypal elements present.'
    };

    const prompt = `${context}
Depth level: ${depthLevel}
Instruction: ${depthPrompts[depthLevel] || depthPrompts[2]}

Generate a single, thoughtful question to continue the maieutic dialogue:`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 256,
        temperature: 0.8
      });

      return (response.response || '').trim();
    } catch (error) {
      console.error('Question generation failed:', error);

      // Fallback questions by depth
      const fallbacks = [
        'What do you think is the core conflict in this narrative?',
        'Why do you think this situation arose?',
        'What assumptions might be underlying this story?',
        'What would happen if we looked at this from another perspective?',
        'What deeper pattern might this represent?'
      ];

      return fallbacks[depthLevel % fallbacks.length];
    }
  }

  /**
   * Extract key insights from user's answer
   */
  private async extractInsights(question: string, answer: string): Promise<string[]> {
    const systemPrompt = `You are analyzing a maieutic dialogue to extract key insights.
Identify 1-3 brief, specific insights revealed by the answer.
Focus on what was discovered or clarified, not just what was said.`;

    const prompt = `Question: ${question}
Answer: ${answer}

List 1-3 key insights revealed by this answer (one per line):`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 256,
        temperature: 0.6
      });

      const text = response.response || '';
      const insights = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'))
        .slice(0, 3); // Max 3 insights

      return insights.length > 0 ? insights : ['New perspective revealed'];
    } catch (error) {
      console.error('Insight extraction failed:', error);
      return ['New perspective revealed'];
    }
  }

  /**
   * Synthesize final understanding from dialogue
   */
  private async synthesizeUnderstanding(): Promise<string> {
    if (!this.sessionState || this.sessionState.turns.length === 0) {
      return 'No dialogue conducted yet.';
    }

    const systemPrompt = `You are synthesizing the discoveries from a maieutic dialogue.
Summarize what was collectively discovered through the questioning process.
Focus on insights that emerged, not just a retelling of the conversation.`;

    let dialogueText = 'Maieutic Dialogue Summary:\n\n';
    dialogueText += `Original narrative: ${this.sessionState.initial_narrative}\n\n`;

    for (const turn of this.sessionState.turns) {
      dialogueText += `Q${turn.turn_number}: ${turn.question}\n`;
      if (turn.answer) {
        dialogueText += `A${turn.turn_number}: ${turn.answer}\n`;
      }
      if (turn.insights && turn.insights.length > 0) {
        dialogueText += `Insights: ${turn.insights.join(', ')}\n`;
      }
      dialogueText += '\n';
    }

    const prompt = `${dialogueText}

Based on this maieutic dialogue, synthesize the key understanding that emerged:`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 512,
        temperature: 0.7
      });

      return (response.response || 'Through questioning, deeper layers of meaning were revealed.').trim();
    } catch (error) {
      console.error('Understanding synthesis failed:', error);
      return 'Through questioning, deeper layers of meaning were revealed.';
    }
  }

  /**
   * Save session to D1 database
   */
  private async saveToDatabase(): Promise<void> {
    if (!this.sessionState) return;

    try {
      // Create transformation record
      const transformationId = crypto.randomUUID();

      await this.env.DB.prepare(`
        INSERT INTO transformations (id, user_id, type, source_text, result_text, parameters, created_at)
        VALUES (?, ?, 'maieutic', ?, ?, ?, ?)
      `).bind(
        transformationId,
        this.sessionState.user_id,
        this.sessionState.initial_narrative,
        this.sessionState.final_understanding || '',
        JSON.stringify({ goal: this.sessionState.goal }),
        this.sessionState.created_at
      ).run();

      // Create maieutic session record
      await this.env.DB.prepare(`
        INSERT INTO maieutic_sessions (
          id, transformation_id, goal, final_understanding,
          extracted_elements, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        this.sessionState.session_id,
        transformationId,
        this.sessionState.goal,
        this.sessionState.final_understanding || '',
        JSON.stringify([]),
        this.sessionState.created_at
      ).run();

      // Create turn records
      for (const turn of this.sessionState.turns) {
        const turnId = crypto.randomUUID();
        await this.env.DB.prepare(`
          INSERT INTO maieutic_turns (
            id, session_id, turn_number, depth_level,
            question, answer, insights, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          turnId,
          this.sessionState.session_id,
          turn.turn_number,
          turn.depth_level,
          turn.question,
          turn.answer || '',
          JSON.stringify(turn.insights || []),
          turn.timestamp
        ).run();
      }
    } catch (error) {
      console.error('Failed to save session to database:', error);
    }
  }
}

/**
 * MaieuticDialogueService - Entry point for starting maieutic dialogues
 */
export class MaieuticDialogueService {
  constructor(private env: Env) {}

  /**
   * Start a new maieutic dialogue session
   */
  async startSession(narrative: string, goal: string, userId: string): Promise<{
    session_id: string;
    question: string;
    depth_level: number;
  }> {
    const sessionId = crypto.randomUUID();

    // Get Durable Object stub
    const id = this.env.MAIEUTIC_SESSION.idFromName(sessionId);
    const stub = this.env.MAIEUTIC_SESSION.get(id);

    // Initialize session
    const response = await stub.fetch('http://internal/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        user_id: userId,
        narrative,
        goal
      })
    });

    const data = await response.json();

    return {
      session_id: sessionId,
      question: data.question,
      depth_level: data.depth_level
    };
  }

  /**
   * Continue dialogue with user's answer
   */
  async respondToQuestion(sessionId: string, answer: string): Promise<{
    turn_number: number;
    depth_level: number;
    question?: string;
    insights: string[];
    is_complete: boolean;
    final_understanding?: string;
  }> {
    // Get Durable Object stub
    const id = this.env.MAIEUTIC_SESSION.idFromName(sessionId);
    const stub = this.env.MAIEUTIC_SESSION.get(id);

    // Send answer
    const response = await stub.fetch('http://internal/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer })
    });

    const data = await response.json();

    return data;
  }

  /**
   * Get session state
   */
  async getSessionState(sessionId: string): Promise<SessionState> {
    const id = this.env.MAIEUTIC_SESSION.idFromName(sessionId);
    const stub = this.env.MAIEUTIC_SESSION.get(id);

    const response = await stub.fetch('http://internal/state', {
      method: 'GET'
    });

    return await response.json();
  }
}
