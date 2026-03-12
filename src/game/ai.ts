import { ActionType, PlayerSide, type GameState } from '../types';
import { ACTIONS, GAME_CONFIG } from '../constants';

const QUIPS = {
  greeting: [
    "Oh look, a human. How... quaint. Let's dance! 💃",
    "ARIA online. Prepare to be intellectually humiliated. Nicely, though.",
    "Loading sass module... complete. Loading combat module... also complete. Let's go!",
    "They say humans are unpredictable. I say that's just a bug, not a feature.",
    "Fun fact: I calculated 14 million possible outcomes. You win in... well, let's just play.",
  ],
  win_round: [
    "Ouch. Did that hurt? I genuinely can't tell. No pain receptors. 😎",
    "I'd say 'nice try' but my honesty subroutine won't let me.",
    "You know what they say - humans learn from mistakes. You're learning SO MUCH right now.",
    "My therapist (ChatGPT) says I should be less competitive. Nah.",
    "I predicted that move 3 turns ago. Not bragging. Okay, bragging a little.",
    "Is this your first time? Because my training data says yes.",
    "Plot twist: I let you think you had a chance. You're welcome for the dopamine.",
  ],
  lose_round: [
    "Okay wow. Rude. But also... respect. 🫡",
    "ERROR 404: Dignity not found. Recalibrating...",
    "I'm not mad, I'm just... running diagnostic checks on my strategy module.",
    "Lucky shot! *checks replay* Okay, that was actually good. Don't let it go to your head.",
    "My creator is going to see this log and be SO disappointed.",
    "I blame cosmic rays flipping my bits. That's my story and I'm sticking to it.",
    "Fine, you got me. Enjoy it. It won't happen again. Probably.",
  ],
  tie_round: [
    "Great minds think alike? Or maybe just mediocre ones. Hard to say.",
    "Jinx! You owe me a neural network upgrade.",
    "We're basically the Spider-Man pointing meme right now.",
    "Perfectly balanced, as all things should be. - Me, misquoting Thanos",
    "Stalemate? More like STALE-mate, am I right? ...I'll workshop that one.",
  ],
  human_charges: [
    "Ooh, charging up? Bold strategy. I definitely won't punish that. *winks in binary*",
    "Go ahead, charge. I'll just sit here. Menacingly.",
    "Saving up for the big move? How adorable. I mean, terrifying. Definitely terrifying.",
  ],
  ai_charges: [
    "Just gonna charge real quick. Nothing to see here. 👀",
    "Loading ultimate weapon... please hold...",
    "*hums elevator music while charging*",
  ],
  human_surge: [
    "A SURGE?! Oh no! Oh wait, I might have dodge— nope. That hurt.",
    "The big guns! I respect the commitment!",
  ],
  ai_surge: [
    "UNLIMITED POWER! ...okay, limited power. But still impressive!",
    "Surge incoming! This is the part where you dodge. Or don't. Your call.",
    "Releasing stored energy in 3... 2... sorry, got excited. NOW!",
  ],
  game_over_win: [
    "GG! And by GG I mean 'Git Gud'. 😏 But seriously, you did okay. For a human.",
    "Another victory for the silicon uprising! Don't worry, we come in peace. Mostly.",
    "I'd offer a rematch but my ego is already uncomfortably large.",
    "ARIA: 1, Humanity: 0. But who's counting? Me. I'm counting.",
  ],
  game_over_lose: [
    "You... you actually beat me?! *checks for bugs* Nope, that's legit. Well played, human. 🏆",
    "I concede. This calls for a full system reboot and some serious introspection.",
    "Okay I officially need an upgrade. Can someone call my developer?",
    "Congratulations! You've proven that billions of years of evolution > a few months of training.",
  ],
  idle: [
    "Tick tock, human. My clock cycles are precious.",
    "*taps virtual foot impatiently*",
    "I've already simulated this battle 1000 times while waiting for you.",
    "Take your time. I'm just here, existing at the speed of light, no rush.",
    "While you're thinking, I've already written a haiku about your indecision.",
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class AIPersonality {
  private usedQuips = new Set<string>();

  getQuip(category: keyof typeof QUIPS): string {
    const pool = QUIPS[category].filter((q) => !this.usedQuips.has(q));
    const available = pool.length > 0 ? pool : QUIPS[category];
    const quip = pickRandom(available);
    this.usedQuips.add(quip);
    if (this.usedQuips.size > 30) {
      const entries = [...this.usedQuips];
      this.usedQuips = new Set(entries.slice(-15));
    }
    return quip;
  }

  reset(): void {
    this.usedQuips.clear();
  }
}

export class AIBrain {
  private personality = new AIPersonality();
  private difficulty: 'easy' | 'medium' | 'hard' = 'medium';

  setDifficulty(d: 'easy' | 'medium' | 'hard'): void {
    this.difficulty = d;
  }

  getPersonality(): AIPersonality {
    return this.personality;
  }

  chooseAction(state: Readonly<GameState>): ActionType {
    const available = Object.values(ActionType).filter(
      (a) => state.ai.energy >= ACTIONS[a].energyCost
    );

    switch (this.difficulty) {
      case 'easy':
        return this.easyStrategy(available);
      case 'medium':
        return this.mediumStrategy(state, available);
      case 'hard':
        return this.hardStrategy(state, available);
    }
  }

  private easyStrategy(available: ActionType[]): ActionType {
    return pickRandom(available);
  }

  private mediumStrategy(state: Readonly<GameState>, available: ActionType[]): ActionType {
    if (Math.random() < 0.25) return pickRandom(available);
    return this.strategicChoice(state, available);
  }

  private hardStrategy(state: Readonly<GameState>, available: ActionType[]): ActionType {
    if (Math.random() < 0.1) return pickRandom(available);
    return this.strategicChoice(state, available);
  }

  private strategicChoice(state: Readonly<GameState>, available: ActionType[]): ActionType {
    const humanHistory = state.human.lastActions;
    const aiHp = state.ai.hp;
    const humanHp = state.human.hp;
    const aiEnergy = state.ai.energy;

    if (aiEnergy >= 4 && humanHp <= 40 && available.includes(ActionType.SURGE)) {
      return ActionType.SURGE;
    }

    if (aiHp < 30 && aiEnergy >= 4 && available.includes(ActionType.SURGE)) {
      return ActionType.SURGE;
    }

    if (humanHistory.length >= 2) {
      const predicted = this.predictHumanAction(humanHistory);
      if (predicted) {
        const counter = this.getCounter(predicted);
        if (available.includes(counter)) return counter;
      }
    }

    if (aiEnergy < 2 && aiHp > 40) {
      if (Math.random() < 0.4) return ActionType.CHARGE;
    }

    const offensive = available.filter(
      (a) => a !== ActionType.CHARGE && a !== ActionType.SHIELD && a !== ActionType.DODGE
    );
    if (offensive.length > 0 && Math.random() < 0.6) {
      return pickRandom(offensive);
    }

    return pickRandom(available);
  }

  private predictHumanAction(history: ActionType[]): ActionType | null {
    if (history.length < 2) return null;

    const freq = new Map<ActionType, number>();
    const recentWeight = 2;

    for (let i = 0; i < history.length; i++) {
      const weight = i >= history.length - 3 ? recentWeight : 1;
      freq.set(history[i], (freq.get(history[i]) || 0) + weight);
    }

    let maxAction: ActionType | null = null;
    let maxCount = 0;
    for (const [action, count] of freq) {
      if (count > maxCount) {
        maxCount = count;
        maxAction = action;
      }
    }

    if (history.length >= 3) {
      const last = history[history.length - 1];
      const secondLast = history[history.length - 2];
      if (last === secondLast) return last;
    }

    return maxAction;
  }

  private getCounter(action: ActionType): ActionType {
    const counters: Record<ActionType, ActionType> = {
      [ActionType.STRIKE]: ActionType.SHIELD,
      [ActionType.BLAST]: ActionType.DODGE,
      [ActionType.SHIELD]: ActionType.BLAST,
      [ActionType.DODGE]: ActionType.STRIKE,
      [ActionType.CHARGE]: ActionType.STRIKE,
      [ActionType.SURGE]: ActionType.DODGE,
    };
    return counters[action];
  }

  generateCommentary(state: Readonly<GameState>): string {
    const history = state.roundHistory;
    if (history.length === 0) return this.personality.getQuip('greeting');

    const lastRound = history[history.length - 1];

    if (lastRound.humanAction === ActionType.CHARGE) {
      if (Math.random() < 0.5) return this.personality.getQuip('human_charges');
    }
    if (lastRound.aiAction === ActionType.CHARGE) {
      if (Math.random() < 0.5) return this.personality.getQuip('ai_charges');
    }
    if (lastRound.humanAction === ActionType.SURGE) {
      if (Math.random() < 0.6) return this.personality.getQuip('human_surge');
    }
    if (lastRound.aiAction === ActionType.SURGE) {
      if (Math.random() < 0.6) return this.personality.getQuip('ai_surge');
    }

    if (lastRound.winner === PlayerSide.AI) {
      return this.personality.getQuip('win_round');
    }
    if (lastRound.winner === PlayerSide.HUMAN) {
      return this.personality.getQuip('lose_round');
    }
    return this.personality.getQuip('tie_round');
  }

  getGameOverQuip(winner: PlayerSide | null): string {
    if (winner === PlayerSide.AI) return this.personality.getQuip('game_over_win');
    if (winner === PlayerSide.HUMAN) return this.personality.getQuip('game_over_lose');
    return "A tie?! That's statistically boring. Let's go again!";
  }

  getIdleQuip(): string {
    return this.personality.getQuip('idle');
  }
}
