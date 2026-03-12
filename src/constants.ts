import { ActionType, type ActionDefinition } from './types';

export const GAME_CONFIG = {
  MAX_HP: 100,
  MAX_ENERGY: 6,
  STARTING_ENERGY: 0,
  CHARGE_ENERGY_GAIN: 2,
  ACTION_TIMER_MS: 15000,
  RESOLVE_ANIMATION_MS: 2000,
  ROUND_END_DELAY_MS: 1500,
  INTRO_DURATION_MS: 4000,
  WS_PORT: 3001,
  WS_PATH: '/api/agent',
} as const;

export const ACTIONS: Record<ActionType, ActionDefinition> = {
  [ActionType.STRIKE]: {
    type: ActionType.STRIKE,
    name: 'Strike',
    icon: '⚔️',
    description: 'Quick melee attack. Punishes Charge, countered by Shield.',
    damage: 18,
    energyCost: 0,
    color: '#ff6b6b',
  },
  [ActionType.BLAST]: {
    type: ActionType.BLAST,
    name: 'Blast',
    icon: '💥',
    description: 'Ranged energy attack. Beats Shield, loses to Dodge.',
    damage: 22,
    energyCost: 0,
    color: '#ffa94d',
  },
  [ActionType.SHIELD]: {
    type: ActionType.SHIELD,
    name: 'Shield',
    icon: '🛡️',
    description: 'Block melee attacks. Beats Strike, loses to Blast.',
    damage: 0,
    energyCost: 0,
    color: '#4ecdc4',
  },
  [ActionType.DODGE]: {
    type: ActionType.DODGE,
    name: 'Dodge',
    icon: '💨',
    description: 'Evade ranged attacks. Beats Blast, loses to Strike.',
    damage: 0,
    energyCost: 0,
    color: '#a78bfa',
  },
  [ActionType.CHARGE]: {
    type: ActionType.CHARGE,
    name: 'Charge',
    icon: '⚡',
    description: `Gain ${2} energy. Vulnerable to attacks!`,
    damage: 0,
    energyCost: 0,
    color: '#ffd43b',
  },
  [ActionType.SURGE]: {
    type: ActionType.SURGE,
    name: 'Surge',
    icon: '🌀',
    description: 'Devastating attack. Costs 4 energy. Only Dodge can evade it.',
    damage: 40,
    energyCost: 4,
    color: '#e599f7',
  },
};

/**
 * Combat resolution matrix.
 * Key: attacker action. Value map: defender action → multiplier on attacker's damage.
 * Positive = attacker deals damage. The defender's multiplier is looked up separately.
 */
export const MATCHUP_TABLE: Record<ActionType, Record<ActionType, { attackerMult: number; defenderMult: number }>> = {
  [ActionType.STRIKE]: {
    [ActionType.STRIKE]: { attackerMult: 1, defenderMult: 1 },
    [ActionType.BLAST]: { attackerMult: 0.8, defenderMult: 0.8 },
    [ActionType.SHIELD]: { attackerMult: 0, defenderMult: 0 },
    [ActionType.DODGE]: { attackerMult: 1.2, defenderMult: 0 },
    [ActionType.CHARGE]: { attackerMult: 1.5, defenderMult: 0 },
    [ActionType.SURGE]: { attackerMult: 0.5, defenderMult: 1 },
  },
  [ActionType.BLAST]: {
    [ActionType.STRIKE]: { attackerMult: 0.8, defenderMult: 0.8 },
    [ActionType.BLAST]: { attackerMult: 1, defenderMult: 1 },
    [ActionType.SHIELD]: { attackerMult: 1.3, defenderMult: 0 },
    [ActionType.DODGE]: { attackerMult: 0, defenderMult: 0 },
    [ActionType.CHARGE]: { attackerMult: 1.5, defenderMult: 0 },
    [ActionType.SURGE]: { attackerMult: 0.5, defenderMult: 1 },
  },
  [ActionType.SHIELD]: {
    [ActionType.STRIKE]: { attackerMult: 0, defenderMult: 0 },
    [ActionType.BLAST]: { attackerMult: 0, defenderMult: 1.3 },
    [ActionType.SHIELD]: { attackerMult: 0, defenderMult: 0 },
    [ActionType.DODGE]: { attackerMult: 0, defenderMult: 0 },
    [ActionType.CHARGE]: { attackerMult: 0, defenderMult: 0 },
    [ActionType.SURGE]: { attackerMult: 0, defenderMult: 0.5 },
  },
  [ActionType.DODGE]: {
    [ActionType.STRIKE]: { attackerMult: 0, defenderMult: 1.2 },
    [ActionType.BLAST]: { attackerMult: 0, defenderMult: 0 },
    [ActionType.SHIELD]: { attackerMult: 0, defenderMult: 0 },
    [ActionType.DODGE]: { attackerMult: 0, defenderMult: 0 },
    [ActionType.CHARGE]: { attackerMult: 0, defenderMult: 0 },
    [ActionType.SURGE]: { attackerMult: 0, defenderMult: 0 },
  },
  [ActionType.CHARGE]: {
    [ActionType.STRIKE]: { attackerMult: 0, defenderMult: 1.5 },
    [ActionType.BLAST]: { attackerMult: 0, defenderMult: 1.5 },
    [ActionType.SHIELD]: { attackerMult: 0, defenderMult: 0 },
    [ActionType.DODGE]: { attackerMult: 0, defenderMult: 0 },
    [ActionType.CHARGE]: { attackerMult: 0, defenderMult: 0 },
    [ActionType.SURGE]: { attackerMult: 0, defenderMult: 1 },
  },
  [ActionType.SURGE]: {
    [ActionType.STRIKE]: { attackerMult: 1, defenderMult: 0.5 },
    [ActionType.BLAST]: { attackerMult: 1, defenderMult: 0.5 },
    [ActionType.SHIELD]: { attackerMult: 0.5, defenderMult: 0 },
    [ActionType.DODGE]: { attackerMult: 0, defenderMult: 0 },
    [ActionType.CHARGE]: { attackerMult: 1, defenderMult: 0 },
    [ActionType.SURGE]: { attackerMult: 1, defenderMult: 1 },
  },
};

export const COLORS = {
  background: 0x0a0a1a,
  arenaFloor: 0x1a1a3e,
  gridLine: 0x2d2d6b,
  humanPrimary: 0x00d4ff,
  humanSecondary: 0x0088cc,
  aiPrimary: 0xff3366,
  aiSecondary: 0xcc0033,
  energy: 0xffd43b,
  health: 0x51cf66,
  damage: 0xff6b6b,
  neonCyan: 0x00ffff,
  neonMagenta: 0xff00ff,
  neonPurple: 0x8b5cf6,
  white: 0xffffff,
  particle: 0xffffff,
} as const;
