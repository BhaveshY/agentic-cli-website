import {
  Age, BuildingType, Faction, ResourceType, UnitState, UnitType,
  type Building, type GameState, type Unit,
} from '../types';
import { BUILDING_DEFS, LORE, UNIT_DEFS, AGE_COSTS } from '../config';

export type UICallback = (event: string, data?: unknown) => void;

export class GameUI {
  private container: HTMLElement;
  private onEvent: UICallback;
  private lastFaction: Faction = Faction.SOLARI;

  private menuScreen!: HTMLElement;
  private storyScreen!: HTMLElement;
  private hudContainer!: HTMLElement;
  private resultScreen!: HTMLElement;

  private resourceBar!: HTMLElement;
  private selectionPanel!: HTMLElement;
  private notificationArea!: HTMLElement;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private prevResources: Record<string, number> = {};

  constructor(container: HTMLElement, onEvent: UICallback) {
    this.container = container;
    this.onEvent = onEvent;
    this.build();
  }

  private build(): void {
    this.container.innerHTML = '';
    this.menuScreen = this.buildMenu();
    this.storyScreen = this.buildStory();
    this.hudContainer = this.buildHUD();
    this.resultScreen = this.buildResult();
    this.container.append(this.menuScreen, this.storyScreen, this.hudContainer, this.resultScreen);
    this.showScreen('menu');
  }

  private el(tag: string, cls?: string, text?: string): HTMLElement {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  private buildMenu(): HTMLElement {
    const screen = this.el('div', 'screen menu-screen');
    screen.innerHTML = `
      <div class="menu-bg"></div>
      <h1 class="menu-title">Aetheria</h1>
      <p class="menu-subtitle">Rise of Empires</p>
      <div class="faction-select">
        <div class="faction-label">Choose Your Faction</div>
        <div class="faction-options">
          <button class="faction-btn solari selected" data-faction="SOLARI">
            <div class="faction-icon">☀️</div>
            <div class="faction-name">Solari Dominion</div>
            <div class="faction-motto">"In Light, We Conquer"</div>
          </button>
          <button class="faction-btn ironroot" data-faction="IRONROOT">
            <div class="faction-icon">🌿</div>
            <div class="faction-name">Ironroot Collective</div>
            <div class="faction-motto">"From Root to Crown, We Endure"</div>
          </button>
        </div>
      </div>
      <div class="menu-buttons">
        <button class="btn btn-primary" id="btn-start-campaign">⚔️ Begin Campaign</button>
        <button class="btn" id="btn-lore">📖 World of Aetheria</button>
      </div>
    `;
    return screen;
  }

  private buildStory(): HTMLElement {
    const screen = this.el('div', 'screen story-screen');
    screen.innerHTML = `
      <div class="story-content">
        <h2 class="story-title">The World of Aetheria</h2>
        <p class="story-text" id="story-text"></p>
        <div class="story-faction-detail" id="story-faction"></div>
        <button class="btn btn-primary" id="btn-begin-battle">⚔️ To Battle!</button>
        <button class="btn btn-small" id="btn-back-menu">← Back</button>
      </div>
    `;
    return screen;
  }

  private buildHUD(): HTMLElement {
    const hud = this.el('div', 'hud-container');

    this.resourceBar = this.el('div', 'resource-bar');
    this.resourceBar.innerHTML = `
      <div class="res-item"><span class="res-icon">💎</span><span class="res-val" id="res-aether">200</span></div>
      <div class="res-item"><span class="res-icon">🪵</span><span class="res-val" id="res-timber">200</span></div>
      <div class="res-item"><span class="res-icon">🪨</span><span class="res-val" id="res-stone">50</span></div>
      <div class="res-item res-pop"><span class="res-icon">👥</span><span class="res-val" id="res-pop">0/5</span></div>
      <div class="res-item res-age"><span class="res-icon">🏛️</span><span class="res-val" id="res-age">Age I</span></div>
    `;

    this.selectionPanel = this.el('div', 'selection-panel');
    this.notificationArea = this.el('div', 'notification-area');

    const minimapWrap = this.el('div', 'minimap-wrap');
    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.className = 'minimap-canvas';
    this.minimapCanvas.width = 200;
    this.minimapCanvas.height = 200;
    this.minimapCanvas.style.width = '180px';
    this.minimapCanvas.style.height = '180px';
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
    minimapWrap.appendChild(this.minimapCanvas);

    this.minimapCanvas.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.handleMinimapClick(e);
    });
    this.minimapCanvas.addEventListener('mousemove', (e) => {
      if (e.buttons === 1) {
        e.stopPropagation();
        this.handleMinimapClick(e);
      }
    });

    const shortcuts = this.el('div', 'shortcuts-hint');
    shortcuts.innerHTML = 'Q/E Rotate  •  WASD Pan  •  Scroll Zoom  •  S Stop  •  Esc Deselect  •  Space Home  •  Tab Cycle';

    hud.append(this.resourceBar, this.notificationArea, this.selectionPanel, minimapWrap, shortcuts);
    return hud;
  }

  private buildResult(): HTMLElement {
    const screen = this.el('div', 'screen result-screen');
    screen.innerHTML = `
      <h1 class="result-title" id="result-title"></h1>
      <p class="result-subtitle" id="result-subtitle"></p>
      <div class="result-stats" id="result-stats"></div>
      <div class="menu-buttons">
        <button class="btn btn-primary" id="btn-play-again">⚔️ Play Again</button>
        <button class="btn" id="btn-result-menu">🏠 Main Menu</button>
      </div>
    `;
    return screen;
  }

  showScreen(name: 'menu' | 'story' | 'hud' | 'result'): void {
    [this.menuScreen, this.storyScreen, this.hudContainer, this.resultScreen].forEach((s) =>
      s.classList.remove('active')
    );
    switch (name) {
      case 'menu': this.menuScreen.classList.add('active'); break;
      case 'story': this.storyScreen.classList.add('active'); break;
      case 'hud': this.hudContainer.classList.add('active'); break;
      case 'result': this.resultScreen.classList.add('active'); break;
    }
  }

  init(): void {
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('button');
      if (!btn) return;

      if (btn.id === 'btn-start-campaign') {
        const selected = this.menuScreen.querySelector('.faction-btn.selected');
        const faction = (selected?.getAttribute('data-faction') || 'SOLARI') as Faction;
        this.lastFaction = faction;
        this.showStoryIntro(faction);
        return;
      }
      if (btn.id === 'btn-lore') {
        this.showStoryIntro(Faction.SOLARI, true);
      }
      if (btn.id === 'btn-begin-battle') {
        this.onEvent('start_game', this.lastFaction);
      }
      if (btn.id === 'btn-back-menu') {
        this.showScreen('menu');
      }
      if (btn.id === 'btn-play-again') {
        this.onEvent('start_game', this.lastFaction);
      }
      if (btn.id === 'btn-result-menu') {
        this.showScreen('menu');
        this.onEvent('return_menu');
      }

      if (btn.classList.contains('faction-btn')) {
        this.container.querySelectorAll('.faction-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.lastFaction = (btn.getAttribute('data-faction') || 'SOLARI') as Faction;
      }

      if (btn.classList.contains('train-btn')) {
        const unitType = btn.getAttribute('data-unit') as UnitType;
        const buildingId = parseInt(btn.getAttribute('data-building') || '0');
        this.onEvent('train_unit', { unitType, buildingId });
      }
      if (btn.classList.contains('build-btn')) {
        const buildingType = btn.getAttribute('data-building-type') as BuildingType;
        this.onEvent('start_build', buildingType);
      }
      if (btn.id === 'btn-age-up') {
        this.onEvent('age_up');
      }
    });
  }

  setSelectedFaction(faction: Faction): void {
    this.container.querySelectorAll('.faction-btn').forEach((button) => {
      const isSelected = button.getAttribute('data-faction') === faction;
      button.classList.toggle('selected', isSelected);
    });
  }

  private showStoryIntro(faction: Faction, loreOnly = false): void {
    const storyText = document.getElementById('story-text')!;
    const storyFaction = document.getElementById('story-faction')!;

    storyText.textContent = LORE.intro;

    const factionLore = LORE.factions[faction];
    storyFaction.innerHTML = `
      <h3>${factionLore.name}</h3>
      <p class="faction-desc">${factionLore.description}</p>
      <p class="faction-leader"><strong>${factionLore.leader}</strong></p>
      <p class="faction-quote">${factionLore.leaderQuote}</p>
    `;

    const beginBtn = document.getElementById('btn-begin-battle')!;
    beginBtn.style.display = loreOnly ? 'none' : '';

    this.showScreen('story');
  }

  updateResources(state: GameState): void {
    const player = state.players[0];
    if (!player) return;

    const setResVal = (id: string, val: number) => {
      const el = document.getElementById(id);
      if (!el) return;
      const strVal = Math.floor(val).toString();
      const prev = this.prevResources[id] ?? val;
      if (el.textContent !== strVal) {
        el.textContent = strVal;
        if (val > prev) {
          el.classList.remove('flash-down');
          el.classList.add('flash-up');
        } else if (val < prev) {
          el.classList.remove('flash-up');
          el.classList.add('flash-down');
        }
        setTimeout(() => { el.classList.remove('flash-up', 'flash-down'); }, 600);
      }
      this.prevResources[id] = val;
    };

    setResVal('res-aether', player.resources[ResourceType.AETHER]);
    setResVal('res-timber', player.resources[ResourceType.TIMBER]);
    setResVal('res-stone', player.resources[ResourceType.STONE]);

    const popEl = document.getElementById('res-pop');
    if (popEl) {
      const popStr = `${player.population}/${player.maxPopulation}`;
      if (popEl.textContent !== popStr) popEl.textContent = popStr;
      if (player.population >= player.maxPopulation) {
        popEl.classList.add('res-pop-full');
      } else {
        popEl.classList.remove('res-pop-full');
      }
    }

    const ageEl = document.getElementById('res-age');
    if (ageEl) ageEl.textContent = `Age ${player.age}`;
  }

  updateSelection(state: GameState): void {
    this.selectionPanel.innerHTML = '';

    const selected = [...state.selectedIds];
    if (selected.length === 0) return;

    if (selected.length === 1) {
      const id = selected[0];
      const unit = state.units.get(id);
      const building = state.buildings.get(id);

      if (unit && unit.owner === 0) {
        this.showUnitPanel(unit, state);
      } else if (building && building.owner === 0) {
        this.showBuildingPanel(building, state);
      } else if (unit) {
        this.showEnemyUnitPanel(unit);
      } else if (building) {
        this.showEnemyBuildingPanel(building);
      }
    } else {
      this.showMultiSelectPanel(selected, state);
    }
  }

  private showUnitPanel(unit: Unit, state: GameState): void {
    const def = UNIT_DEFS[unit.type];
    this.selectionPanel.innerHTML = `
      <div class="sel-header">${def.name}</div>
      <div class="sel-stats">
        <div class="sel-stat">❤️ ${unit.hp}/${unit.maxHp}</div>
        <div class="sel-stat">⚔️ ${def.damage}</div>
        <div class="sel-stat">📏 ${def.range.toFixed(1)}</div>
      </div>
      <div class="sel-state">${unit.state}${unit.carryAmount > 0 ? ` (carrying ${unit.carryAmount} ${unit.carryType})` : ''}</div>
      ${def.canBuild ? this.buildButtonsHTML(state) : ''}
    `;
  }

  private showBuildingPanel(building: Building, state: GameState): void {
    const def = BUILDING_DEFS[building.type];
    const player = state.players[0];
    let trainHTML = '';

    if (def.canTrain.length > 0 && building.isComplete) {
      trainHTML = '<div class="sel-train"><div class="sel-subheader">Train Units</div>';
      for (const unitType of def.canTrain) {
        const uDef = UNIT_DEFS[unitType];
        if (uDef.minAge > player.age) continue;
        const costStr = Object.entries(uDef.cost)
          .map(([r, a]) => `${r === ResourceType.AETHER ? '💎' : r === ResourceType.TIMBER ? '🪵' : '🪨'}${a}`)
          .join(' ');
        trainHTML += `<button class="train-btn" data-unit="${unitType}" data-building="${building.id}">${uDef.name} (${costStr})</button>`;
      }
      if (building.productionQueue.length > 0) {
        const progress = Math.floor(building.productionProgress);
        trainHTML += `<div class="sel-progress">Training: ${UNIT_DEFS[building.productionQueue[0]].name} ${progress}%</div>`;
      }
      trainHTML += '</div>';
    }

    let ageUpHTML = '';
    if (building.type === BuildingType.CITADEL && player.age < Age.ZENITH && building.isComplete) {
      const nextAge = (player.age + 1) as Age;
      const costs = AGE_COSTS[nextAge];
      const costStr = Object.entries(costs)
        .map(([r, a]) => `${r === ResourceType.AETHER ? '💎' : r === ResourceType.TIMBER ? '🪵' : '🪨'}${a}`)
        .join(' ');
      ageUpHTML = `<button class="btn btn-small" id="btn-age-up">🏛️ Advance to Age ${nextAge} (${costStr})</button>`;
    }

    this.selectionPanel.innerHTML = `
      <div class="sel-header">${def.name}${!building.isComplete ? ' (Building...)' : ''}</div>
      <div class="sel-stats">
        <div class="sel-stat">❤️ ${building.hp}/${building.maxHp}</div>
        ${!building.isComplete ? `<div class="sel-stat">🔨 ${Math.floor(building.buildProgress)}%</div>` : ''}
      </div>
      ${trainHTML}
      ${ageUpHTML}
    `;
  }

  private showEnemyUnitPanel(unit: Unit): void {
    const def = UNIT_DEFS[unit.type];
    this.selectionPanel.innerHTML = `
      <div class="sel-header enemy">⚠️ Enemy ${def.name}</div>
      <div class="sel-stats"><div class="sel-stat">❤️ ${unit.hp}/${unit.maxHp}</div></div>
    `;
  }

  private showEnemyBuildingPanel(building: Building): void {
    const def = BUILDING_DEFS[building.type];
    this.selectionPanel.innerHTML = `
      <div class="sel-header enemy">⚠️ Enemy ${def.name}</div>
      <div class="sel-stats"><div class="sel-stat">❤️ ${building.hp}/${building.maxHp}</div></div>
    `;
  }

  private showMultiSelectPanel(ids: number[], state: GameState): void {
    const counts = new Map<string, number>();
    for (const id of ids) {
      const unit = state.units.get(id);
      if (unit && unit.owner === 0) {
        const name = UNIT_DEFS[unit.type].name;
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    }
    let html = `<div class="sel-header">${ids.length} units selected</div><div class="sel-multi">`;
    for (const [name, count] of counts) {
      html += `<div class="sel-multi-item">${name} x${count}</div>`;
    }
    html += '</div>';
    this.selectionPanel.innerHTML = html;
  }

  private buildButtonsHTML(state: GameState): string {
    const player = state.players[0];
    let html = '<div class="sel-build"><div class="sel-subheader">Build</div><div class="build-grid">';

    for (const [type, def] of Object.entries(BUILDING_DEFS)) {
      if (type === BuildingType.CITADEL) continue;
      if (def.minAge > player.age) continue;
      const costStr = Object.entries(def.cost)
        .map(([r, a]) => `${r === ResourceType.AETHER ? '💎' : r === ResourceType.TIMBER ? '🪵' : '🪨'}${a}`)
        .join(' ');
      html += `<button class="build-btn" data-building-type="${type}" title="${def.name}: ${costStr}">${def.name}</button>`;
    }
    html += '</div></div>';
    return html;
  }

  addNotification(text: string, type: string): void {
    const iconMap: Record<string, string> = {
      combat: '⚔️',
      age: '🏛️',
      info: '📢',
      warning: '⚠️',
    };
    const icon = iconMap[type] || '📢';
    const notif = this.el('div', `notification ${type}`);
    notif.innerHTML = `<span class="notif-icon">${icon}</span><span class="notif-text">${text}</span>`;
    this.notificationArea.appendChild(notif);
    setTimeout(() => notif.classList.add('show'), 10);
    setTimeout(() => {
      notif.classList.remove('show');
      setTimeout(() => notif.remove(), 500);
    }, 5000);
    if (this.notificationArea.children.length > 5) {
      this.notificationArea.removeChild(this.notificationArea.children[0]);
    }
  }

  private handleMinimapClick(e: MouseEvent): void {
    const rect = this.minimapCanvas.getBoundingClientRect();
    const scaleX = this.minimapCanvas.width / rect.width;
    const scaleY = this.minimapCanvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    this.onEvent('minimap_click', { px, py });
  }

  updateMinimap(state: GameState, cameraX?: number, cameraZ?: number): void {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const scale = w / state.mapWidth;

    ctx.fillStyle = '#1a3a20';
    ctx.fillRect(0, 0, w, h);

    for (let x = 0; x < state.mapWidth; x++) {
      for (let z = 0; z < state.mapHeight; z++) {
        const tile = state.tiles[x][z];
        const elev = tile.elevation || 0;
        const bright = 0.85 + elev * 0.15;
        switch (tile.terrain) {
          case 'WATER': {
            const waterDepth = Math.max(0, 0.4 - elev * 0.8);
            const r = Math.round(0x1a + waterDepth * 30);
            const g = Math.round(0x6f + waterDepth * 15);
            const b = Math.round(0xa0 + waterDepth * 20);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            break;
          }
          case 'FOREST': ctx.fillStyle = `rgb(${Math.round(0x2d * bright)},${Math.round(0x5a * bright)},${Math.round(0x1e * bright)})`; break;
          case 'MOUNTAIN': {
            const snow = elev > 0.65 ? Math.min(1, (elev - 0.65) * 3) : 0;
            const gr = Math.round(0x6a + snow * 100);
            ctx.fillStyle = `rgb(${gr},${gr},${Math.round(0x5a + snow * 100)})`;
            break;
          }
          case 'SAND': ctx.fillStyle = `rgb(${Math.round(0xb8 * bright)},${Math.round(0xa8 * bright)},${Math.round(0x6a * bright)})`; break;
          default: ctx.fillStyle = `rgb(${Math.round(0x4a * bright)},${Math.round(0x7a * bright)},${Math.round(0x2c * bright)})`; break;
        }
        if (tile.hasResource === ResourceType.AETHER) ctx.fillStyle = '#7b68ee';
        if (tile.hasResource === ResourceType.STONE) ctx.fillStyle = '#888880';
        ctx.fillRect(x * scale, z * scale, Math.ceil(scale), Math.ceil(scale));
      }
    }

    for (const building of state.buildings.values()) {
      if (building.hp <= 0) continue;
      ctx.fillStyle = building.owner === 0 ? '#00aaff' : '#ff3333';
      const def = BUILDING_DEFS[building.type];
      ctx.fillRect(building.tileX * scale, building.tileZ * scale, def.size * scale, def.size * scale);
    }

    for (const unit of state.units.values()) {
      if (unit.state === UnitState.DEAD) continue;
      ctx.fillStyle = unit.owner === 0 ? '#00ddff' : '#ff5555';
      ctx.beginPath();
      ctx.arc(unit.x * scale, unit.z * scale, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (cameraX !== undefined && cameraZ !== undefined) {
      const vpSize = 8;
      const cx = (cameraX / (state.mapWidth * 2)) * w;
      const cz = (cameraZ / (state.mapHeight * 2)) * h;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - vpSize, cz - vpSize, vpSize * 2, vpSize * 2);
    }
  }

  showResult(type: 'victory' | 'defeat', state: GameState): void {
    const title = document.getElementById('result-title')!;
    const subtitle = document.getElementById('result-subtitle')!;
    const stats = document.getElementById('result-stats')!;

    if (type === 'victory') {
      title.textContent = 'Victory!';
      title.className = 'result-title victory';
      subtitle.textContent = 'The enemy citadel has fallen. Aetheria is yours.';
    } else {
      title.textContent = 'Defeat';
      title.className = 'result-title defeat';
      subtitle.textContent = 'Your citadel has been destroyed. The enemy claims Aetheria.';
    }

    const rounds = Math.floor(state.tick / 10);
    const unitCount = [...state.units.values()].filter(u => u.owner === 0 && u.state !== UnitState.DEAD).length;
    const buildingCount = [...state.buildings.values()].filter(b => b.owner === 0 && b.hp > 0).length;
    const player = state.players[0];
    stats.innerHTML = `
      <div class="stat-item"><span class="stat-val">${Math.floor(rounds / 60)}:${String(rounds % 60).padStart(2, '0')}</span><span class="stat-label">Duration</span></div>
      <div class="stat-item"><span class="stat-val">${state.players[0].age}</span><span class="stat-label">Final Age</span></div>
      <div class="stat-item"><span class="stat-val">${unitCount}</span><span class="stat-label">Units</span></div>
      <div class="stat-item"><span class="stat-val">${buildingCount}</span><span class="stat-label">Buildings</span></div>
      <div class="stat-item"><span class="stat-val">${Math.floor(player.resources[ResourceType.AETHER])}</span><span class="stat-label">Aether</span></div>
    `;

    this.showScreen('result');
  }
}
