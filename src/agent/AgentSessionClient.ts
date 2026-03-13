import type {
  AgentCommand,
  AgentHeartbeatResponse,
  AgentQueuedCommand,
  AgentSessionStateEnvelope,
} from './AgentProtocol';
import type { AgentController } from './AgentRuntime';

const SYNC_INTERVAL_MS = 500;

export class AgentSessionClient {
  private timer: number | null = null;
  private syncing = false;

  constructor(
    private readonly sessionId: string,
    private readonly controller: AgentController
  ) {}

  start(): void {
    if (this.timer !== null) return;

    this.timer = window.setInterval(() => {
      void this.sync();
    }, SYNC_INTERVAL_MS);

    void this.sync();
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async sync(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const envelope: AgentSessionStateEnvelope = {
        sessionId: this.sessionId,
        clientVersion: '1.0',
        state: this.controller.getSnapshot(),
      };

      const response = await fetch(`/api/agent/sessions/${this.sessionId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope),
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as AgentHeartbeatResponse;
      for (const queuedCommand of payload.commands) {
        await this.executeCommand(queuedCommand);
      }
    } catch {
      // Intentionally swallow transient sync errors; the next interval will retry.
    } finally {
      this.syncing = false;
    }
  }

  private async executeCommand(queuedCommand: AgentQueuedCommand): Promise<void> {
    try {
      const result = this.runCommand(queuedCommand.command);
      await fetch(`/api/agent/sessions/${this.sessionId}/commands/${queuedCommand.id}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, result }),
      });
    } catch (error) {
      await fetch(`/api/agent/sessions/${this.sessionId}/commands/${queuedCommand.id}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown agent command failure',
        }),
      });
    }
  }

  private runCommand(command: AgentCommand): unknown {
    switch (command.type) {
      case 'START_GAME':
        this.controller.startGame(command.faction ?? this.controller.getAgentConfig().faction);
        return { started: true };
      case 'RETURN_TO_MENU':
        this.controller.returnToMenu();
        return { returned: true };
      case 'SET_SELECTION':
        return this.controller.setSelection(command.ids);
      case 'PLACE_BUILDING':
        return this.controller.placeBuilding(command.buildingType, command.tileX, command.tileZ);
      case 'TRAIN_UNIT':
        return this.controller.trainUnit(command.unitType, command.buildingId);
      case 'ADVANCE_AGE':
        return this.controller.advanceAge(command.playerId);
      case 'MOVE_UNITS':
        return this.controller.moveUnits(command.x, command.z, command.unitIds);
      case 'GATHER_UNITS':
        return this.controller.gatherUnits(command.tileX, command.tileZ, command.unitIds);
      case 'ATTACK_UNITS':
        return this.controller.attackUnits(command.targetId, command.unitIds);
      case 'STOP_UNITS':
        return this.controller.stopUnits(command.unitIds);
      default:
        return assertNever(command);
    }
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported agent command: ${JSON.stringify(value)}`);
}

