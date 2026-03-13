# 🏰 Aetheria: Rise of Empires

A 3D real-time strategy game set in the shattered realm of Aetheria, where floating islands drift through an endless sky. Build your empire, command armies, and conquer your AI opponent.

## Play

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and press **Enter** to start a game.

### Agent mode

This repository still does **not** include true multiplayer rooms or a remote join server. Instead, it now includes a lightweight **local session server + CLI** so an external agent can:

1. create a control session from CLI,
2. open the returned URL once in a browser,
3. read compact game state through CLI,
4. queue commands through CLI.

Start the app stack:

```bash
npm run dev
npm run server
```

Create a session:

```bash
npm run agent:cli -- create-session --faction IRONROOT --host http://localhost:3000
```

That returns JSON including a `joinUrl` like:

`http://localhost:3000/?agent=1&autostart=1&faction=IRONROOT&session=...`

Open that URL once in the browser. After that, drive the game from terminal commands:

```bash
npm run agent:cli -- state <sessionId>
npm run agent:cli -- command <sessionId> place-building --building FARM
npm run agent:cli -- command <sessionId> train-unit --unit WORKER
npm run agent:cli -- command <sessionId> advance-age
```

Available CLI state views:

- `summary` (default)
- `units`
- `buildings`
- `notifications`
- `full`

The browser still exposes `window.__AETHERIA_AGENT__` for local debugging, but the recommended automation path is the session server + CLI so agents can fetch compact JSON instead of large browser snapshots.

## The World of Aetheria

In the shattered realm of Aetheria, floating islands drift through an endless sky, bound together by veins of raw magical energy called Aether. Two great civilizations have risen from the ancient ruins:

### Factions

**The Solari Dominion** ☀️ *"In Light, We Conquer"*
An empire of radiant crystal and golden steel. Led by Empress Aurelia the Radiant, their cities gleam with reflected sunlight and their warriors carry the fire of stars into battle.

**The Ironroot Collective** 🌿 *"From Root to Crown, We Endure"*
A civilization grown from the living heart of the ancient forests. Led by Elder Thorn of the Deep Grove, they shape trees into towers, weave roots into walls, and commune with the deep magic of the earth.

## Gameplay

### Resources
| Resource | Icon | Source |
|----------|------|--------|
| Aether | 💎 | Aether Wells |
| Timber | 🪵 | Forests |
| Stone | 🪨 | Quarries near mountains |

### Buildings
| Building | Cost | Function |
|----------|------|----------|
| Citadel | — | Train workers, advance ages |
| Aether Well | 🪵75 | Gather aether from nodes |
| Lumber Camp | 💎50 | Gather timber faster |
| Quarry | 💎75 🪵50 | Gather stone from nodes |
| Barracks | 💎100 🪵80 | Train swordsmen, archers |
| Armory | 💎200 🪵100 🪨100 | Train knights (Age II+) |
| Watch Tower | 🪵50 🪨30 | Defensive ranged attack |
| Farm | 🪵60 | +5 population capacity |

### Units
| Unit | Cost | HP | Damage | Range | Age |
|------|------|----|--------|-------|-----|
| Worker | 💎50 | 30 | 3 | 1.2 | I |
| Swordsman | 💎60 🪵20 | 60 | 8 | 1.5 | I |
| Archer | 💎40 🪵40 | 35 | 7 | 6.0 | II |
| Knight | 💎100 🪨50 | 120 | 14 | 1.5 | III |

### Ages
- **Age I: Dawn** — Workers, basic buildings, swordsmen
- **Age II: Rise** — Archers, towers, armory
- **Age III: Zenith** — Knights, full military power

## Controls

| Action | Control |
|--------|---------|
| Pan camera | WASD / Arrow keys / Edge scroll |
| Zoom | Mouse wheel |
| Rotate | Q / E |
| Select | Left-click |
| Multi-select | Shift+click or drag |
| Move/Gather/Attack | Right-click |
| Stop units | S key (with units selected) |
| Cancel build | Escape |

## AI Opponent

The AI builds bases, gathers resources, trains armies, and attacks. It taunts you along the way.

## Tech Stack

- **Three.js** — 3D rendering with WebGL
- **TypeScript** — Type-safe game logic
- **Vite** — Dev server and build
- **Web Audio API** — Procedural sound effects
- **A\* Pathfinding** — Grid-based unit navigation

## Project Structure

```
src/
├── main.ts              # Entry point
├── types.ts             # Type definitions
├── config.ts            # Game config, factions, lore
├── core/
│   ├── GameMap.ts       # Terrain generation, pathfinding
│   └── GameState.ts     # Game state, units, buildings, combat
├── render/
│   ├── SceneSetup.ts    # Three.js scene, camera, lighting
│   ├── Terrain.ts       # Terrain mesh, trees, resources
│   └── EntityModels.ts  # Building/unit 3D models
├── input/
│   └── Controls.ts      # Mouse/keyboard, selection, commands
├── ui/
│   └── GameUI.ts        # HUD, menus, selection panels
├── ai/
│   └── AIPlayer.ts      # AI economy, military, taunts
├── audio/
│   └── Sounds.ts        # Procedural audio
└── style.css            # UI styling
```

## License

MIT
