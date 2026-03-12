export enum ActionType {
  STRIKE = 'STRIKE',
  BLAST = 'BLAST',
  SHIELD = 'SHIELD',
  DODGE = 'DODGE',
  CHARGE = 'CHARGE',
  SURGE = 'SURGE',
}

export enum GamePhase {
  MENU = 'MENU',
  INTRO = 'INTRO',
  ACTION_SELECT = 'ACTION_SELECT',
  RESOLVING = 'RESOLVING',
  ROUND_END = 'ROUND_END',
  GAME_OVER = 'GAME_OVER',
}

export enum PlayerSide {
  HUMAN = 'HUMAN',
  AI = 'AI',
}

export interface ActionDefinition {
  type: ActionType;
  name: string;
  icon: string;
  description: string;
  damage: number;
  energyCost: number;
  color: string;
}

export interface PlayerState {
  side: PlayerSide;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  action: ActionType | null;
  consecutiveCharges: number;
  lastActions: ActionType[];
  wins: number;
}

export interface RoundResult {
  round: number;
  humanAction: ActionType;
  aiAction: ActionType;
  humanDamage: number;
  aiDamage: number;
  humanHpAfter: number;
  aiHpAfter: number;
  description: string;
  winner: PlayerSide | null;
}

export interface GameState {
  phase: GamePhase;
  round: number;
  human: PlayerState;
  ai: PlayerState;
  roundHistory: RoundResult[];
  matchWinner: PlayerSide | null;
  aiMessage: string;
  isAgentConnected: boolean;
}

export interface AgentMessage {
  type: 'game_state' | 'action_request' | 'game_over' | 'welcome';
  payload: Record<string, unknown>;
}

export interface AgentResponse {
  type: 'action' | 'chat';
  action?: ActionType;
  message?: string;
}
