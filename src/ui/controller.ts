import { ActionType, GamePhase, PlayerSide, type GameState, type RoundResult } from '../types';
import { ACTIONS, GAME_CONFIG } from '../constants';

export type UIActionCallback = (action: ActionType) => void;
export type UIEventCallback = (event: string, data?: unknown) => void;

export class UIController {
  private container: HTMLElement;
  private onAction: UIActionCallback;
  private onEvent: UIEventCallback;

  private menuScreen!: HTMLElement;
  private introScreen!: HTMLElement;
  private hudScreen!: HTMLElement;
  private gameoverScreen!: HTMLElement;
  private howToPlay!: HTMLElement;
  private actionPanel!: HTMLElement;
  private timerBar!: HTMLElement;
  private timerFill!: HTMLElement;
  private resolveOverlay!: HTMLElement;
  private chatPanel!: HTMLElement;
  private soundToggle!: HTMLButtonElement;

  private humanHpFill!: HTMLElement;
  private humanHpText!: HTMLElement;
  private humanEnergyFill!: HTMLElement;
  private humanEnergyText!: HTMLElement;
  private aiHpFill!: HTMLElement;
  private aiHpText!: HTMLElement;
  private aiEnergyFill!: HTMLElement;
  private aiEnergyText!: HTMLElement;
  private roundCounter!: HTMLElement;

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private timerStart = 0;
  private isSoundMuted = false;

  constructor(container: HTMLElement, onAction: UIActionCallback, onEvent: UIEventCallback) {
    this.container = container;
    this.onAction = onAction;
    this.onEvent = onEvent;
    this.buildUI();
  }

  private buildUI(): void {
    this.container.innerHTML = '';

    this.soundToggle = this.el('button', 'sound-toggle', '🔊') as HTMLButtonElement;
    this.soundToggle.addEventListener('click', () => this.toggleSound());
    this.container.appendChild(this.soundToggle);

    this.menuScreen = this.buildMenuScreen();
    this.introScreen = this.buildIntroScreen();
    this.hudScreen = this.buildHUDScreen();
    this.gameoverScreen = this.buildGameOverScreen();
    this.howToPlay = this.buildHowToPlay();

    this.container.append(
      this.menuScreen,
      this.introScreen,
      this.hudScreen,
      this.gameoverScreen,
      this.howToPlay
    );

    this.showScreen('menu');
  }

  private el(tag: string, className?: string, text?: string): HTMLElement {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text) e.textContent = text;
    return e;
  }

  private buildMenuScreen(): HTMLElement {
    const screen = this.el('div', 'screen menu-screen');

    const title = this.el('h1', 'menu-title', 'Neural Clash');
    const subtitle = this.el('p', 'menu-subtitle', 'Strategic AI Battle Arena');

    const diffPanel = this.el('div', 'difficulty-panel');
    const diffLabel = this.el('div', 'difficulty-label', 'Difficulty');
    const diffOptions = this.el('div', 'difficulty-options');

    (['easy', 'medium', 'hard'] as const).forEach((d) => {
      const btn = this.el('button', `diff-btn${d === 'medium' ? ' selected' : ''}`, d);
      btn.dataset.difficulty = d;
      btn.addEventListener('click', () => {
        diffOptions.querySelectorAll('.diff-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.onEvent('difficulty', d);
      });
      diffOptions.appendChild(btn);
    });

    diffPanel.append(diffLabel, diffOptions);

    const buttons = this.el('div', 'menu-buttons');
    const startBtn = this.el('button', 'btn btn-primary', '⚔️  Start Battle');
    startBtn.addEventListener('click', () => this.onEvent('start'));

    const howBtn = this.el('button', 'btn', '📖  How to Play');
    howBtn.addEventListener('click', () => this.howToPlay.classList.add('visible'));

    buttons.append(startBtn, howBtn);

    const agentSection = this.el('div', 'agent-section');
    const agentTitle = this.el('div', 'agent-title', '🤖 Connect AI Agent');
    const agentRow = this.el('div', 'agent-input-row');

    const agentInput = document.createElement('input');
    agentInput.className = 'agent-input';
    agentInput.type = 'text';
    agentInput.placeholder = 'ws://your-agent-url/ws';
    agentInput.id = 'agent-url-input';

    const connectBtn = this.el('button', 'btn btn-small', 'Connect');
    connectBtn.addEventListener('click', () => {
      const url = (document.getElementById('agent-url-input') as HTMLInputElement).value.trim();
      if (url) this.onEvent('agent_connect', url);
    });

    agentRow.append(agentInput, connectBtn);

    const agentStatus = this.el('div', 'agent-status', 'Not connected - using built-in AI');
    agentStatus.id = 'agent-status';

    agentSection.append(agentTitle, agentRow, agentStatus);

    screen.append(title, subtitle, diffPanel, buttons, agentSection);
    return screen;
  }

  private buildIntroScreen(): HTMLElement {
    const screen = this.el('div', 'screen intro-screen');
    const text = this.el('div', 'intro-text');
    text.innerHTML = `
      <div>⚡ ROUND START ⚡</div>
      <div class="intro-aria" id="intro-aria-text"></div>
    `;
    screen.appendChild(text);
    return screen;
  }

  private buildHUDScreen(): HTMLElement {
    const screen = this.el('div', 'screen');
    const hud = this.el('div', 'battle-hud');

    const top = this.el('div', 'hud-top');

    const humanInfo = this.el('div', 'player-info human');
    humanInfo.innerHTML = `
      <div class="player-name">You</div>
      <div class="stat-bar"><div class="stat-bar-fill hp" id="human-hp-fill" style="width:100%"></div></div>
      <div class="stat-text"><span id="human-hp-text">HP 100/100</span></div>
      <div class="stat-bar"><div class="stat-bar-fill energy" id="human-energy-fill" style="width:0%"></div></div>
      <div class="stat-text"><span id="human-energy-text">Energy 0/6</span></div>
    `;

    this.roundCounter = this.el('div', 'round-counter', 'Round 1');

    const aiInfo = this.el('div', 'player-info ai-side');
    aiInfo.innerHTML = `
      <div class="player-name">ARIA</div>
      <div class="stat-bar"><div class="stat-bar-fill hp" id="ai-hp-fill" style="width:100%"></div></div>
      <div class="stat-text"><span id="ai-hp-text">HP 100/100</span></div>
      <div class="stat-bar"><div class="stat-bar-fill energy" id="ai-energy-fill" style="width:0%"></div></div>
      <div class="stat-text"><span id="ai-energy-text">Energy 0/6</span></div>
    `;

    top.append(humanInfo, this.roundCounter, aiInfo);

    this.chatPanel = this.el('div', 'chat-panel');

    this.timerBar = this.el('div', 'timer-bar');
    this.timerFill = this.el('div', 'timer-bar-fill');
    this.timerBar.appendChild(this.timerFill);

    this.actionPanel = this.buildActionPanel();

    this.resolveOverlay = this.el('div', 'resolve-overlay');

    hud.append(top, this.chatPanel, this.resolveOverlay, this.timerBar, this.actionPanel);
    screen.appendChild(hud);
    return screen;
  }

  private buildActionPanel(): HTMLElement {
    const panel = this.el('div', 'action-panel');
    const keyHints = ['1', '2', '3', '4', '5', '6'];

    Object.values(ACTIONS).forEach((action, index) => {
      const btn = this.el('button', 'action-btn');
      btn.dataset.action = action.type;
      btn.innerHTML = `
        <span class="action-key">${keyHints[index]}</span>
        <span class="action-icon">${action.icon}</span>
        <span class="action-name">${action.name}</span>
        ${action.energyCost > 0 ? `<span class="action-cost">${action.energyCost}⚡</span>` : ''}
      `;
      btn.title = `${action.description} [Key: ${keyHints[index]}]`;
      btn.addEventListener('click', () => {
        this.onAction(action.type);
        this.onEvent('sound_confirm');
      });
      btn.addEventListener('mouseenter', () => this.onEvent('sound_select'));
      panel.appendChild(btn);
    });

    return panel;
  }

  private buildGameOverScreen(): HTMLElement {
    const screen = this.el('div', 'screen gameover-screen');
    screen.innerHTML = `
      <h1 class="gameover-title" id="gameover-title"></h1>
      <p class="gameover-subtitle" id="gameover-subtitle"></p>
      <div class="gameover-stats" id="gameover-stats"></div>
      <div class="gameover-buttons">
        <button class="btn btn-primary" id="gameover-rematch">⚔️  Rematch</button>
        <button class="btn" id="gameover-menu">🏠  Menu</button>
      </div>
    `;
    return screen;
  }

  private buildHowToPlay(): HTMLElement {
    const panel = this.el('div', 'how-to-play');
    const content = this.el('div', 'how-to-play-content');
    content.innerHTML = `
      <h2>How to Play</h2>
      <p>Neural Clash is a strategic combat game. Each turn, both you and ARIA simultaneously choose an action. Actions resolve based on a matchup system.</p>

      <h3>Actions</h3>
      <ul>
        <li><strong>⚔️ Strike</strong> (18 dmg) — Quick melee attack</li>
        <li><strong>💥 Blast</strong> (22 dmg) — Ranged energy attack</li>
        <li><strong>🛡️ Shield</strong> — Block melee attacks completely</li>
        <li><strong>💨 Dodge</strong> — Evade ranged attacks and Surge</li>
        <li><strong>⚡ Charge</strong> — Gain 2 energy (vulnerable!)</li>
        <li><strong>🌀 Surge</strong> (40 dmg, 4⚡) — Devastating attack, only dodgeable</li>
      </ul>

      <h3>Matchups</h3>
      <div class="matchup-grid">
        <div class="matchup-item">⚔️ Strike <span class="wins">beats</span> ⚡💨</div>
        <div class="matchup-item">⚔️ Strike <span class="loses">loses to</span> 🛡️</div>
        <div class="matchup-item">💥 Blast <span class="wins">beats</span> 🛡️⚡</div>
        <div class="matchup-item">💥 Blast <span class="loses">loses to</span> 💨</div>
        <div class="matchup-item">🛡️ Shield <span class="wins">blocks</span> ⚔️</div>
        <div class="matchup-item">🛡️ Shield <span class="loses">loses to</span> 💥</div>
        <div class="matchup-item">💨 Dodge <span class="wins">evades</span> 💥🌀</div>
        <div class="matchup-item">💨 Dodge <span class="loses">loses to</span> ⚔️</div>
        <div class="matchup-item">🌀 Surge <span class="wins">hits</span> ⚔️💥🛡️⚡</div>
        <div class="matchup-item">🌀 Surge <span class="loses">dodged by</span> 💨</div>
      </div>

      <h3>Strategy Tips</h3>
      <ul>
        <li>Charge safely when your opponent is defensive</li>
        <li>Watch for patterns in ARIA's behavior</li>
        <li>Surge is powerful but predictable — save it for the right moment</li>
        <li>Mix up your actions to stay unpredictable</li>
      </ul>

      <h3>AI Agent Mode</h3>
      <p>Connect your own AI agent via WebSocket! The agent receives game state and responds with actions. Build your own bot to challenge ARIA!</p>

      <div style="margin-top:1.5rem;text-align:center">
        <button class="btn btn-small" id="close-how-to-play">Close</button>
      </div>
    `;
    panel.appendChild(content);

    setTimeout(() => {
      const closeBtn = panel.querySelector('#close-how-to-play');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => panel.classList.remove('visible'));
      }
    }, 0);

    return panel;
  }

  private showScreen(name: 'menu' | 'intro' | 'hud' | 'gameover'): void {
    [this.menuScreen, this.introScreen, this.hudScreen, this.gameoverScreen].forEach((s) =>
      s.classList.remove('active')
    );
    switch (name) {
      case 'menu': this.menuScreen.classList.add('active'); break;
      case 'intro': this.introScreen.classList.add('active'); break;
      case 'hud': this.hudScreen.classList.add('active'); break;
      case 'gameover': this.gameoverScreen.classList.add('active'); break;
    }
  }

  updateForPhase(phase: GamePhase, state: GameState): void {
    switch (phase) {
      case GamePhase.MENU:
        this.showScreen('menu');
        break;
      case GamePhase.INTRO:
        this.showScreen('intro');
        break;
      case GamePhase.ACTION_SELECT:
        this.showScreen('hud');
        this.actionPanel.classList.add('visible');
        this.resolveOverlay.classList.remove('visible');
        this.updateStats(state);
        this.updateActionButtons(state);
        this.startTimer();
        break;
      case GamePhase.RESOLVING:
        this.actionPanel.classList.remove('visible');
        this.stopTimer();
        break;
      case GamePhase.ROUND_END:
        break;
      case GamePhase.GAME_OVER:
        break;
    }
  }

  updateStats(state: GameState): void {
    const hpPercent = (s: { hp: number; maxHp: number }) =>
      Math.max(0, (s.hp / s.maxHp) * 100);
    const energyPercent = (s: { energy: number; maxEnergy: number }) =>
      (s.energy / s.maxEnergy) * 100;

    this.humanHpFill = document.getElementById('human-hp-fill')!;
    this.humanHpText = document.getElementById('human-hp-text')!;
    this.humanEnergyFill = document.getElementById('human-energy-fill')!;
    this.humanEnergyText = document.getElementById('human-energy-text')!;
    this.aiHpFill = document.getElementById('ai-hp-fill')!;
    this.aiHpText = document.getElementById('ai-hp-text')!;
    this.aiEnergyFill = document.getElementById('ai-energy-fill')!;
    this.aiEnergyText = document.getElementById('ai-energy-text')!;

    if (!this.humanHpFill) return;

    const humanHpPct = hpPercent(state.human);
    this.humanHpFill.style.width = `${humanHpPct}%`;
    this.humanHpFill.className = `stat-bar-fill hp${humanHpPct < 30 ? ' low' : ''}`;
    this.humanHpText.textContent = `HP ${state.human.hp}/${state.human.maxHp}`;

    this.humanEnergyFill.style.width = `${energyPercent(state.human)}%`;
    this.humanEnergyText.textContent = `Energy ${state.human.energy}/${state.human.maxEnergy}`;

    const aiHpPct = hpPercent(state.ai);
    this.aiHpFill.style.width = `${aiHpPct}%`;
    this.aiHpFill.className = `stat-bar-fill hp${aiHpPct < 30 ? ' low' : ''}`;
    this.aiHpText.textContent = `HP ${state.ai.hp}/${state.ai.maxHp}`;

    this.aiEnergyFill.style.width = `${energyPercent(state.ai)}%`;
    this.aiEnergyText.textContent = `Energy ${state.ai.energy}/${state.ai.maxEnergy}`;

    this.roundCounter.textContent = `Round ${state.round}`;
  }

  updateActionButtons(state: GameState): void {
    const buttons = this.actionPanel.querySelectorAll('.action-btn');
    buttons.forEach((btn) => {
      const el = btn as HTMLButtonElement;
      const action = el.dataset.action as ActionType;
      const def = ACTIONS[action];
      el.disabled = state.human.energy < def.energyCost;
    });
  }

  showIntroMessage(message: string): void {
    const el = document.getElementById('intro-aria-text');
    if (el) el.textContent = `"${message}" — ARIA`;
  }

  showResolveResult(result: RoundResult): void {
    const humanDef = ACTIONS[result.humanAction];
    const aiDef = ACTIONS[result.aiAction];

    this.resolveOverlay.innerHTML = `
      <div class="resolve-actions">
        <div class="resolve-action-display">
          <div class="resolve-action-icon">${humanDef.icon}</div>
          <div class="resolve-action-label">You: ${humanDef.name}</div>
        </div>
        <div class="resolve-vs">VS</div>
        <div class="resolve-action-display">
          <div class="resolve-action-icon">${aiDef.icon}</div>
          <div class="resolve-action-label">ARIA: ${aiDef.name}</div>
        </div>
      </div>
      <div class="resolve-result">${result.description}</div>
    `;
    this.resolveOverlay.classList.add('visible');
  }

  showGameOver(winner: PlayerSide | null, state: GameState, quip: string): void {
    this.showScreen('gameover');
    this.actionPanel.classList.remove('visible');
    this.stopTimer();

    const title = document.getElementById('gameover-title')!;
    const subtitle = document.getElementById('gameover-subtitle')!;
    const stats = document.getElementById('gameover-stats')!;

    if (winner === PlayerSide.HUMAN) {
      title.textContent = 'Victory!';
      title.className = 'gameover-title victory';
    } else if (winner === PlayerSide.AI) {
      title.textContent = 'Defeated';
      title.className = 'gameover-title defeat';
    } else {
      title.textContent = 'Draw';
      title.className = 'gameover-title';
    }

    subtitle.textContent = quip;

    stats.innerHTML = `
      <div class="gameover-stat">
        <div class="gameover-stat-value">${state.round}</div>
        <div class="gameover-stat-label">Rounds</div>
      </div>
      <div class="gameover-stat">
        <div class="gameover-stat-value">${state.human.hp}</div>
        <div class="gameover-stat-label">Your HP</div>
      </div>
      <div class="gameover-stat">
        <div class="gameover-stat-value">${state.ai.hp}</div>
        <div class="gameover-stat-label">ARIA HP</div>
      </div>
    `;

    const rematchBtn = document.getElementById('gameover-rematch')!;
    const menuBtn = document.getElementById('gameover-menu')!;
    const self = this;
    rematchBtn.replaceWith(rematchBtn.cloneNode(true));
    menuBtn.replaceWith(menuBtn.cloneNode(true));
    document.getElementById('gameover-rematch')!.addEventListener('click', () => self.onEvent('start'));
    document.getElementById('gameover-menu')!.addEventListener('click', () => self.onEvent('menu'));
  }

  addChatMessage(message: string, sender = 'ARIA'): void {
    const bubble = this.el('div', 'chat-bubble');
    bubble.innerHTML = `<div class="chat-name">${sender}</div><div>${message}</div>`;
    this.chatPanel.appendChild(bubble);
    this.chatPanel.scrollTop = this.chatPanel.scrollHeight;

    while (this.chatPanel.children.length > 5) {
      this.chatPanel.removeChild(this.chatPanel.firstChild!);
    }
  }

  clearChat(): void {
    this.chatPanel.innerHTML = '';
  }

  setAgentStatus(connected: boolean): void {
    const status = document.getElementById('agent-status');
    if (status) {
      status.textContent = connected ? '✓ Agent connected' : 'Not connected - using built-in AI';
      status.className = `agent-status${connected ? ' connected' : ''}`;
    }
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerBar.classList.add('visible');
    this.timerStart = Date.now();
    this.timerFill.style.width = '100%';
    this.timerFill.classList.remove('urgent');

    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.timerStart;
      const remaining = Math.max(0, 1 - elapsed / GAME_CONFIG.ACTION_TIMER_MS);
      this.timerFill.style.width = `${remaining * 100}%`;

      if (remaining < 0.25) {
        this.timerFill.classList.add('urgent');
      }

      if (remaining <= 0) {
        this.stopTimer();
        this.onEvent('timer_expired');
      }
    }, 50);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.timerBar.classList.remove('visible');
  }

  private toggleSound(): void {
    this.isSoundMuted = !this.isSoundMuted;
    this.soundToggle.textContent = this.isSoundMuted ? '🔇' : '🔊';
    this.onEvent('sound_toggle', this.isSoundMuted);
  }
}
