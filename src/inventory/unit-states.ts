import { ConflictException } from '@nestjs/common';
import { PoolClient } from 'pg';

export type UnitStatus =
  | 'manifested'
  | 'received'
  | 'available'
  | 'qa_failed'
  | 'reserved'
  | 'packed'
  | 'handed_off'
  | 'delivered';

const ALLOWED: Record<UnitStatus, UnitStatus[]> = {
  manifested: ['received'],
  received: ['available', 'qa_failed'],
  available: ['reserved'],
  qa_failed: [],
  reserved: ['available', 'packed'],
  packed: ['handed_off'],
  handed_off: ['delivered'],
  delivered: [],
};

export function canMove(from: UnitStatus, to: UnitStatus): boolean {
  return ALLOWED[from].includes(to);
}

/** Moves one unit, refusing any step the table above does not allow. Must run inside a transaction. */
export async function moveUnit(tx: PoolClient, uuid: string, to: UnitStatus): Promise<void> {
  const { rows } = await tx.query<{ status: UnitStatus }>('select status from units where uuid = $1 for update', [uuid]);
  const from = rows[0].status;
  if (!canMove(from, to)) throw new ConflictException(`Ring cannot go from ${from} to ${to}`);
  await tx.query('update units set status = $2 where uuid = $1', [uuid, to]);
}
