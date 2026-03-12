import './style.css';
import * as THREE from 'three';
import { GameEngine } from './game/engine';
import { AIBrain } from './game/ai';
import { AgentBridge } from './game/agent';
import { SceneManager } from './graphics/scene';
import { Arena } from './graphics/arena';
import { FighterRenderer } from './graphics/fighters';
import { VFXSystem } from './graphics/effects';
import { UIController } from './ui/controller';
import { SoundEngine } from './audio/sounds';
import { ActionType, GamePhase, PlayerSide } from './types';
import { ACTIONS, GAME_CONFIG } from './constants';
import { COLORS } from './constants';

class NeuralClash {
  private engine: GameEngine;
  private ai: AIBrain;
  private scene: SceneManager;
  private arena: Arena;
  private fighters: FighterRenderer;
  private vfx: VFXSystem;
  private ui: UIController;
  private sound: SoundEngine;
  private agent: AgentBridge;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const uiLayer = document.getElementById('ui-layer') as HTMLElement;

    this.engine = new GameEngine();
    this.ai = new AIBrain();
    this.sound = new SoundEngine();

    this.scene = new SceneManager(canvas);
    this.arena = new Arena();
    this.scene.scene.add(this.arena.group);

    this.fighters = new FighterRenderer();
    this.scene.scene.add(this.fighters.humanGroup);
    this.scene.scene.add(this.fighters.aiGroup);

    this.vfx = new VFXSystem(this.scene.scene);

    this.ui = new UIController(
      uiLayer,
      (action) => this.handlePlayerAction(action),
      (event, data) => this.handleUIEvent(event, data)
    );

    this.agent = new AgentBridge(
      (connected) => {
        this.engine.setAgentConnected(connected);
        this.ui.setAgentStatus(connected);
      },
      (action) => this.handleAgentAction(action),
      (message) => this.ui.addChatMessage(message, 'AGENT')
    );

    this.setupEngineListeners();
    this.setupAnimationLoop();
    this.setupKeyboardShortcuts();

    this.scene.setCameraForMenu();
    this.scene.start();
  }

  private setupEngineListeners(): void {
    this.engine.on((event, data) => {
      const state = this.engine.getState();

      switch (event) {
        case 'phase_change':
          this.ui.updateForPhase(data as GamePhase, state);
          this.handlePhaseChange(data as GamePhase);
          break;
        case 'round_resolved':
          this.handleRoundResolved(data as import('./types').RoundResult);
          break;
        case 'game_over':
          this.handleGameOver(data as PlayerSide | null);
          break;
      }
    });
  }

  private setupAnimationLoop(): void {
    this.scene.onAnimate((dt, elapsed) => {
      this.arena.update(elapsed);
      this.fighters.update(elapsed, dt);
      this.vfx.update(dt);
    });
  }

  private handlePhaseChange(phase: GamePhase): void {
    switch (phase) {
      case GamePhase.INTRO:
        this.handleIntro();
        break;
      case GamePhase.ACTION_SELECT:
        this.handleActionSelect();
        break;
      case GamePhase.RESOLVING:
        break;
      case GamePhase.GAME_OVER:
        break;
    }
  }

  private handleIntro(): void {
    this.ui.clearChat();
    this.scene.setCameraForBattle();
    this.sound.playRoundStart();

    const greeting = this.ai.getPersonality().getQuip('greeting');
    this.ui.showIntroMessage(greeting);

    setTimeout(() => {
      this.engine.beginActionPhase();
    }, GAME_CONFIG.INTRO_DURATION_MS);
  }

  private handleActionSelect(): void {
    this.scene.setCameraForBattle();
    this.sound.playRoundStart();
    this.fighters.resetPose();

    this.scheduleIdleQuip();

    if (!this.agent.isConnected()) {
      this.scheduleAIAction();
    } else {
      this.agent.sendGameState(this.engine.getSerializableState());
    }
  }

  private scheduleAIAction(): void {
    const thinkTime = 800 + Math.random() * 2000;
    setTimeout(() => {
      const state = this.engine.getState();
      if (state.phase !== GamePhase.ACTION_SELECT) return;
      const action = this.ai.chooseAction(state);
      this.engine.submitAction(PlayerSide.AI, action);
    }, thinkTime);
  }

  private scheduleIdleQuip(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      const state = this.engine.getState();
      if (state.phase === GamePhase.ACTION_SELECT) {
        this.ui.addChatMessage(this.ai.getIdleQuip());
      }
    }, 8000);
  }

  private handlePlayerAction(action: ActionType): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);

    const success = this.engine.submitAction(PlayerSide.HUMAN, action);
    if (!success) return;

    this.playActionSound(action);
  }

  private handleAgentAction(action: ActionType): void {
    this.engine.submitAction(PlayerSide.AI, action);
  }

  private handleRoundResolved(result: import('./types').RoundResult): void {
    this.scene.setCameraForClash();

    this.fighters.playActionAnimation(PlayerSide.HUMAN, result.humanAction);
    this.fighters.playActionAnimation(PlayerSide.AI, result.aiAction);

    this.vfx.spawnActionEffect(result.humanAction, PlayerSide.HUMAN);
    this.vfx.spawnActionEffect(result.aiAction, PlayerSide.AI);

    this.playActionSound(result.humanAction);
    setTimeout(() => this.playActionSound(result.aiAction), 150);

    if (result.aiDamage > 0) {
      setTimeout(() => {
        this.vfx.spawnHitEffect(new THREE.Vector3(-4, 2.5, 0));
        this.fighters.flashDamage(PlayerSide.HUMAN);
        this.scene.triggerScreenShake(result.aiDamage / 30);
        this.sound.playHit();
      }, 400);
    }

    if (result.humanDamage > 0) {
      setTimeout(() => {
        this.vfx.spawnHitEffect(new THREE.Vector3(4, 2.5, 0));
        this.fighters.flashDamage(PlayerSide.AI);
        this.scene.triggerScreenShake(result.humanDamage / 30);
        this.sound.playHit();
      }, 500);
    }

    setTimeout(() => {
      const state = this.engine.getState();
      this.ui.showResolveResult(result);
      this.ui.updateStats(state);

      const commentary = this.ai.generateCommentary(state);
      this.ui.addChatMessage(commentary);

      setTimeout(() => {
        if (state.phase === GamePhase.GAME_OVER) {
          this.handleGameOver(state.matchWinner);
        } else {
          this.engine.beginActionPhase();
        }
      }, GAME_CONFIG.ROUND_END_DELAY_MS);
    }, GAME_CONFIG.RESOLVE_ANIMATION_MS);
  }

  private handleGameOver(winner: PlayerSide | null): void {
    const state = this.engine.getState();
    const quip = this.ai.getGameOverQuip(winner);

    this.ui.addChatMessage(quip);
    this.ui.showGameOver(winner, state, quip);

    if (winner === PlayerSide.HUMAN) {
      this.sound.playVictory();
      this.vfx.spawnVictoryEffect(new THREE.Vector3(-4, 2.5, 0), COLORS.humanPrimary);
    } else if (winner === PlayerSide.AI) {
      this.sound.playDefeat();
      this.vfx.spawnVictoryEffect(new THREE.Vector3(4, 2.5, 0), COLORS.aiPrimary);
    }

    if (this.agent.isConnected()) {
      this.agent.sendGameOver(winner || 'draw');
    }
  }

  private handleUIEvent(event: string, data?: unknown): void {
    switch (event) {
      case 'start':
        this.engine.startGame();
        break;
      case 'menu':
        this.engine.returnToMenu();
        this.scene.setCameraForMenu();
        break;
      case 'difficulty':
        this.ai.setDifficulty(data as 'easy' | 'medium' | 'hard');
        break;
      case 'agent_connect':
        this.agent.connect(data as string);
        break;
      case 'sound_toggle':
        this.sound.setMuted(data as boolean);
        break;
      case 'sound_select':
        this.sound.playSelect();
        break;
      case 'sound_confirm':
        this.sound.playConfirm();
        break;
      case 'timer_expired': {
        const available = this.engine.getAvailableActions(PlayerSide.HUMAN);
        if (available.length > 0) {
          const randomAction = available[Math.floor(Math.random() * available.length)];
          this.engine.submitAction(PlayerSide.HUMAN, randomAction);
        }
        break;
      }
    }
  }

  private setupKeyboardShortcuts(): void {
    const keyMap: Record<string, ActionType> = {
      '1': ActionType.STRIKE,
      '2': ActionType.BLAST,
      '3': ActionType.SHIELD,
      '4': ActionType.DODGE,
      '5': ActionType.CHARGE,
      '6': ActionType.SURGE,
      'q': ActionType.STRIKE,
      'w': ActionType.BLAST,
      'e': ActionType.SHIELD,
      'a': ActionType.DODGE,
      's': ActionType.CHARGE,
      'd': ActionType.SURGE,
    };

    window.addEventListener('keydown', (e) => {
      const state = this.engine.getState();

      if (state.phase === GamePhase.MENU && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        this.engine.startGame();
        return;
      }

      if (state.phase === GamePhase.ACTION_SELECT) {
        const action = keyMap[e.key.toLowerCase()];
        if (action) {
          e.preventDefault();
          this.handlePlayerAction(action);
        }
      }

      if (state.phase === GamePhase.GAME_OVER) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.engine.startGame();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          this.engine.returnToMenu();
          this.scene.setCameraForMenu();
        }
      }
    });
  }

  private playActionSound(action: ActionType): void {
    switch (action) {
      case ActionType.STRIKE: this.sound.playStrike(); break;
      case ActionType.BLAST: this.sound.playBlast(); break;
      case ActionType.SHIELD: this.sound.playShield(); break;
      case ActionType.DODGE: this.sound.playDodge(); break;
      case ActionType.CHARGE: this.sound.playCharge(); break;
      case ActionType.SURGE: this.sound.playSurge(); break;
    }
  }
}

// Initialize immediately if DOM is ready, otherwise wait for DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new NeuralClash();
  });
} else {
  new NeuralClash();
}
