import { createUuidV7 } from "@/domain/id";
import { getRepository } from "@/repositories/server";

// Every moderation action, void and removal is recorded here with who and why.
export async function writeAuditLog(entry: { actorId: string; hubId?: string; action: string; entity: string; entityId: string; reason?: string; snapshot?: unknown }, now = new Date()): Promise<void> {
  const timestamp = now.toISOString();
  await getRepository().put("AuditLog", { id: createUuidV7(), hubId: entry.hubId, action: entry.action, entity: entry.entity, entityId: entry.entityId, reason: entry.reason, snapshot: entry.snapshot === undefined ? undefined : JSON.stringify(entry.snapshot), createdById: entry.actorId, createdAt: timestamp, updatedAt: timestamp });
}
