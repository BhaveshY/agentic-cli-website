import {
  ActionType,
  GamePhase,
  PlayerSide,
  type GameState,
  type PlayerState,
  type RoundResult,
} from '../types';
import { GAME_CONFIG, ACTIONS, MATCHUP_TABLE } from '../constants';

export type GameEventCallback = (event: string, data?: unknown) => void;

export class GameEngine {
  private state: GameState;
  private listeners: GameEventCallback[] = [];

  constructor() {
    this.state = this.createInitialState();
  }

  private createPlayerState(side: PlayerSide): PlayerState {
    return {
      side,
      hp: GAME_CONFIG.MAX_HP,
      maxHp: GAME_CONFIG.MAX_HP,
      energy: GAME_CONFIG.STARTING_ENERGY,
      maxEnergy: GAME_CONFIG.MAX_ENERGY,
      action: null,
      consecutiveCharges: 0,
      lastActions: [],
      wins: 0,
    };
  }

  private createInitialState(): GameState {
    return {
      phase: GamePhase.MENU,
      round: 0,
      human: this.createPlayerState(PlayerSide.HUMAN),
      ai: this.createPlayerState(PlayerSide.AI),
      roundHistory: [],
      matchWinner: null,
      aiMessage: '',
      isAgentConnected: false,
    };
  }

  getState(): Readonly<GameState> {
    return { ...this.state };
  }

  on(callback: GameEventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private emit(event: string, data?: unknown): void {
    for (const listener of this.listeners) {
      listener(event, data);
    }
  }

  startGame(): void {
    this.state = this.createInitialState();
    this.state.phase = GamePhase.INTRO;
    this.emit('phase_change', GamePhase.INTRO);
    this.emit('game_start');
  }

  beginActionPhase(): void {
    this.state.round++;
    this.state.human.action = null;
    this.state.ai.action = null;
    this.state.phase = GamePhase.ACTION_SELECT;
    this.emit('phase_change', GamePhase.ACTION_SELECT);
    this.emit('round_start', this.state.round);
  }

  getAvailableActions(side: PlayerSide): ActionType[] {
    const player = side === PlayerSide.HUMAN ? this.state.human : this.state.ai;
    return Object.values(ActionType).filter((action) => {
      const def = ACTIONS[action];
      return player.energy >= def.energyCost;
    });
  }

  submitAction(side: PlayerSide, action: ActionType): boolean {
    const player = side === PlayerSide.HUMAN ? this.state.human : this.state.ai;
    const def = ACTIONS[action];

    if (this.state.phase !== GamePhase.ACTION_SELECT) return false;
    if (player.energy < def.energyCost) return false;

    player.action = action;
    this.emit('action_submitted', { side, action });

    if (this.state.human.action && this.state.ai.action) {
      this.resolveRound();
    }

    return true;
  }

  private resolveRound(): void {
    this.state.phase = GamePhase.RESOLVING;
    this.emit('phase_change', GamePhase.RESOLVING);

    const humanAction = this.state.human.action!;
    const aiAction = this.state.ai.action!;
    const humanDef = ACTIONS[humanAction];
    const aiDef = ACTIONS[aiAction];

    const humanMatchup = MATCHUP_TABLE[humanAction][aiAction];
    const aiMatchup = MATCHUP_TABLE[aiAction][humanAction];

    const humanDealtDamage = Math.round(humanDef.damage * humanMatchup.attackerMult);
    const aiDealtDamage = Math.round(aiDef.damage * aiMatchup.attackerMult);

    if (humanAction === ActionType.CHARGE) {
      this.state.human.energy = Math.min(
        this.state.human.maxEnergy,
        this.state.human.energy + GAME_CONFIG.CHARGE_ENERGY_GAIN
      );
      this.state.human.consecutiveCharges++;
    } else {
      this.state.human.consecutiveCharges = 0;
    }

    if (aiAction === ActionType.CHARGE) {
      this.state.ai.energy = Math.min(
        this.state.ai.maxEnergy,
        this.state.ai.energy + GAME_CONFIG.CHARGE_ENERGY_GAIN
      );
      this.state.ai.consecutiveCharges++;
    } else {
      this.state.ai.consecutiveCharges = 0;
    }

    if (humanDef.energyCost > 0) {
      this.state.human.energy -= humanDef.energyCost;
    }
    if (aiDef.energyCost > 0) {
      this.state.ai.energy -= aiDef.energyCost;
    }

    this.state.ai.hp = Math.max(0, this.state.ai.hp - humanDealtDamage);
    this.state.human.hp = Math.max(0, this.state.human.hp - aiDealtDamage);

    this.state.human.lastActions.push(humanAction);
    this.state.ai.lastActions.push(aiAction);
    if (this.state.human.lastActions.length > 10) this.state.human.lastActions.shift();
    if (this.state.ai.lastActions.length > 10) this.state.ai.lastActions.shift();

    const description = this.buildRoundDescription(
      humanAction,
      aiAction,
      humanDealtDamage,
      aiDealtDamage
    );

    const result: RoundResult = {
      round: this.state.round,
      humanAction,
      aiAction,
      humanDamage: aiDealtDamage,
      aiDamage: humanDealtDamage,
      humanHpAfter: this.state.human.hp,
      aiHpAfter: this.state.ai.hp,
      description,
      winner:
        humanDealtDamage > aiDealtDamage
          ? PlayerSide.HUMAN
          : aiDealtDamage > humanDealtDamage
            ? PlayerSide.AI
            : null,
    };

    this.state.roundHistory.push(result);
    this.emit('round_resolved', result);

    if (this.state.human.hp <= 0 || this.state.ai.hp <= 0) {
      this.state.matchWinner =
        this.state.human.hp > this.state.ai.hp
          ? PlayerSide.HUMAN
          : this.state.ai.hp > this.state.human.hp
            ? PlayerSide.AI
            : null;
      this.state.phase = GamePhase.GAME_OVER;
      this.emit('phase_change', GamePhase.GAME_OVER);
      this.emit('game_over', this.state.matchWinner);
    } else {
      this.state.phase = GamePhase.ROUND_END;
      this.emit('phase_change', GamePhase.ROUND_END);
    }
  }

  private buildRoundDescription(
    humanAction: ActionType,
    aiAction: ActionType,
    humanDealt: number,
    aiDealt: number
  ): string {
    const humanName = ACTIONS[humanAction].name;
    const aiName = ACTIONS[aiAction].name;

    if (humanDealt > 0 && aiDealt > 0) {
      return `Both clash! You ${humanName} for ${humanDealt} dmg, ARIA ${aiName}s for ${aiDealt} dmg!`;
    }
    if (humanDealt > 0) {
      return `Your ${humanName} lands for ${humanDealt} damage! ARIA's ${aiName} whiffs!`;
    }
    if (aiDealt > 0) {
      return `ARIA's ${aiName} connects for ${aiDealt} damage! Your ${humanName} is countered!`;
    }
    return `Stalemate! Both ${humanName} and ${aiName} cancel out!`;
  }

  setAiMessage(msg: string): void {
    this.state.aiMessage = msg;
    this.emit('ai_message', msg);
  }

  setAgentConnected(connected: boolean): void {
    this.state.isAgentConnected = connected;
    this.emit('agent_connection', connected);
  }

  returnToMenu(): void {
    this.state = this.createInitialState();
    this.emit('phase_change', GamePhase.MENU);
  }

  getSerializableState(): Record<string, unknown> {
    return {
      round: this.state.round,
      phase: this.state.phase,
      human: {
        hp: this.state.human.hp,
        energy: this.state.human.energy,
        lastActions: this.state.human.lastActions,
      },
      ai: {
        hp: this.state.ai.hp,
        energy: this.state.ai.energy,
        lastActions: this.state.ai.lastActions,
      },
      availableActions: this.getAvailableActions(PlayerSide.AI),
      roundHistory: this.state.roundHistory,
    };
  }
}
