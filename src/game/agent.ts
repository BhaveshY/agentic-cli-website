import { ActionType, type AgentMessage, type AgentResponse, type GameState } from '../types';

export type AgentConnectionCallback = (connected: boolean) => void;
export type AgentActionCallback = (action: ActionType) => void;
export type AgentChatCallback = (message: string) => void;

export class AgentBridge {
  private ws: WebSocket | null = null;
  private onConnectionChange: AgentConnectionCallback;
  private onAction: AgentActionCallback;
  private onChat: AgentChatCallback;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private agentUrl: string | null = null;

  constructor(
    onConnectionChange: AgentConnectionCallback,
    onAction: AgentActionCallback,
    onChat: AgentChatCallback
  ) {
    this.onConnectionChange = onConnectionChange;
    this.onAction = onAction;
    this.onChat = onChat;
  }

  connect(url: string): void {
    this.agentUrl = url;
    this.cleanup();

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.onConnectionChange(true);
        this.send({
          type: 'welcome',
          payload: {
            game: 'NEURAL CLASH',
            version: '1.0.0',
            instructions: this.getAgentInstructions(),
          },
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data: AgentResponse = JSON.parse(event.data);
          if (data.type === 'action' && data.action) {
            if (Object.values(ActionType).includes(data.action)) {
              this.onAction(data.action);
            }
          }
          if (data.type === 'chat' && data.message) {
            this.onChat(data.message);
          }
        } catch {
          // Silently ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.onConnectionChange(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.onConnectionChange(false);
      };
    } catch {
      this.onConnectionChange(false);
    }
  }

  disconnect(): void {
    this.agentUrl = null;
    this.cleanup();
    this.onConnectionChange(false);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  sendGameState(state: Record<string, unknown>): void {
    this.send({ type: 'action_request', payload: state });
  }

  sendGameOver(winner: string): void {
    this.send({ type: 'game_over', payload: { winner } });
  }

  private send(msg: AgentMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.agentUrl) return;
    this.reconnectTimer = setTimeout(() => {
      if (this.agentUrl) this.connect(this.agentUrl);
    }, 3000);
  }

  private getAgentInstructions(): string {
    return `
You are playing NEURAL CLASH, a strategic combat game.

ACTIONS AVAILABLE:
- STRIKE: Quick melee attack (18 dmg). Beats CHARGE, countered by SHIELD.
- BLAST: Ranged attack (22 dmg). Beats SHIELD, countered by DODGE.
- SHIELD: Block melee. Beats STRIKE, countered by BLAST.
- DODGE: Evade ranged. Beats BLAST and SURGE, countered by STRIKE.
- CHARGE: Gain 2 energy. Vulnerable to attacks.
- SURGE: Powerful attack (40 dmg, costs 4 energy). Only DODGE can evade it.

STRATEGY TIPS:
- STRIKE > CHARGE > build energy safely with SHIELD/DODGE > SURGE for big damage
- Watch opponent patterns and counter them
- Don't be predictable!

RESPOND FORMAT:
{ "type": "action", "action": "STRIKE" }
or for chat:
{ "type": "chat", "message": "your trash talk here" }

You will receive game state as JSON with HP, energy, history, and available actions.
Be strategic, funny, and unpredictable. Have fun!
    `.trim();
  }
}
