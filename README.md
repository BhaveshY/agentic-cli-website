# ⚡ Neural Clash — Strategic AI Battle Arena

A 3D strategic combat game where you duel ARIA, a sassy AI opponent with attitude. Built with Three.js, TypeScript, and procedural audio. Connect your own AI agent via WebSocket to challenge ARIA — or play yourself.

## Play

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Game Overview

**Neural Clash** is a simultaneous-action strategy game. Each turn, both you and ARIA choose an action — then watch the results unfold in a stunning 3D arena with particle effects, screen shake, and witty AI commentary.

### Actions

| Action | Key | Damage | Energy | Beats | Loses To |
|--------|-----|--------|--------|-------|----------|
| ⚔️ Strike | 1/Q | 18 | 0 | Charge, Dodge | Shield |
| 💥 Blast | 2/W | 22 | 0 | Shield, Charge | Dodge |
| 🛡️ Shield | 3/E | 0 | 0 | Strike | Blast |
| 💨 Dodge | 4/A | 0 | 0 | Blast, Surge | Strike |
| ⚡ Charge | 5/S | 0 | +2 | — | Everything |
| 🌀 Surge | 6/D | 40 | -4 | Almost all | Dodge |

### Features

- **3D Arena** — Cyberpunk arena with glowing pillars, floating gems, particle fields
- **Procedural Characters** — Robot fighters with combat animations and damage flash
- **AI Personality** — ARIA trash-talks, makes puns, and adapts to your patterns
- **Difficulty Levels** — Easy, Medium, Hard AI strategies
- **Keyboard Shortcuts** — Keys 1-6 or QWEASD for instant action selection
- **Procedural Audio** — All sound effects generated via Web Audio API
- **Screen Shake** — Camera shake proportional to damage dealt
- **Particle VFX** — Action-specific particle effects and hit sparks
- **Timer** — 15-second action timer with urgency indicator
- **Responsive** — Works on desktop and mobile

## AI Agent API

Connect your own AI agent to play against ARIA (or replace ARIA entirely).

### WebSocket Endpoint

```
ws://localhost:3001/api/agent
```

### Protocol

**Incoming Messages** (server → agent):

```json
{
  "type": "action_request",
  "payload": {
    "round": 5,
    "phase": "ACTION_SELECT",
    "human": { "hp": 72, "energy": 2, "lastActions": ["STRIKE", "BLAST"] },
    "ai": { "hp": 85, "energy": 0, "lastActions": ["SHIELD", "CHARGE"] },
    "availableActions": ["STRIKE", "BLAST", "SHIELD", "DODGE", "CHARGE"],
    "roundHistory": [...]
  }
}
```

**Outgoing Messages** (agent → server):

```json
{ "type": "action", "action": "STRIKE" }
{ "type": "chat", "message": "Nice try, human!" }
```

### API Documentation

```
GET http://localhost:3001/api/docs   — Full API reference
GET http://localhost:3001/api/health — Health check
```

## Tech Stack

- **Three.js** — 3D rendering with WebGL (WebGPU-ready)
- **TypeScript** — Type-safe game logic
- **Vite** — Fast dev server and build
- **Web Audio API** — Procedural sound synthesis
- **Express + ws** — AI agent WebSocket server

## Project Structure

```
src/
├── main.ts              # Entry point, game orchestration
├── types.ts             # Type definitions
├── constants.ts         # Game config, actions, matchup table
├── game/
│   ├── engine.ts        # Game state machine, combat resolution
│   ├── ai.ts            # AI brain, personality, humor
│   └── agent.ts         # External AI agent WebSocket bridge
├── graphics/
│   ├── scene.ts         # Three.js scene, camera, lighting
│   ├── arena.ts         # 3D arena construction
│   ├── fighters.ts      # Robot fighter models & animations
│   └── effects.ts       # Particle VFX system
├── ui/
│   └── controller.ts    # All UI screens and HUD
├── audio/
│   └── sounds.ts        # Procedural sound engine
└── style.css            # Full UI styling
server/
└── index.ts             # Express + WebSocket agent server
```

## Scripts

```bash
npm run dev       # Start Vite dev server (port 3000)
npm run server    # Start agent API server (port 3001)
npm run start     # Start both concurrently
npm run build     # Production build
npm run typecheck # TypeScript type checking
```

## License

MIT
