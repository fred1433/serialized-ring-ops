import { PoolClient } from 'pg';

export interface PackingEvent {
  at: Date;
  kind: string;
  actor: string;
  orderId?: number | null;
  unitUuid?: string | null;
  reason?: string | null;
  detail: string;
}

/** Packing history is written here and nowhere else. The application never updates or deletes a line. */
export async function logEvent(tx: PoolClient, e: PackingEvent): Promise<void> {
  await tx.query(
    `insert into packing_events (at, kind, actor, order_id, unit_uuid, reason, detail)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [e.at, e.kind, e.actor, e.orderId ?? null, e.unitUuid ?? null, e.reason ?? null, e.detail],
  );
}
