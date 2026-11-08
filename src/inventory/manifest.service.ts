import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Clock } from '../clock';
import { Db } from '../db';
import { logEvent } from '../events';
import { Allocator } from '../allocation/allocator';
import { moveUnit } from './unit-states';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface ManifestResult {
  accepted: number;
  rejected: { line: number; reason: 'bad-line' | 'duplicate-in-file' | 'already-imported' }[];
}

@Injectable()
export class ManifestService {
  constructor(
    @Inject(Db) private readonly db: Db,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(Allocator) private readonly allocator: Allocator,
  ) {}

  /** CSV with the header uuid,size,lot. Replaying a file adds nothing. */
  async importCsv(csv: string, actor: string): Promise<ManifestResult> {
    const [header, ...lines] = csv.trim().split(/\r?\n/);
    if (header.replace(/\s/g, '').toLowerCase() !== 'uuid,size,lot') {
      throw new BadRequestException('The first line must be the header uuid,size,lot');
    }
    const result: ManifestResult = { accepted: 0, rejected: [] };
    const seen = new Set<string>();
    await this.db.tx(async (tx) => {
      for (const [index, raw] of lines.entries()) {
        const line = index + 1;
        const [rawUuid = '', rawSize = '', lot = ''] = raw.split(',').map((cell) => cell.trim());
        const uuid = rawUuid.toLowerCase();
        const size = Number(rawSize);
        if (!UUID.test(uuid) || !Number.isInteger(size) || size < 3 || size > 15 || lot === '') {
          result.rejected.push({ line, reason: 'bad-line' });
        } else if (seen.has(uuid)) {
          result.rejected.push({ line, reason: 'duplicate-in-file' });
        } else {
          seen.add(uuid);
          const inserted = await tx.query(
            `insert into units (uuid, size, lot, manifest_line) values ($1, $2, $3, $4)
             on conflict (uuid) do nothing returning uuid`,
            [uuid, size, lot, line],
          );
          if (inserted.rowCount === 1) {
            result.accepted += 1;
            await logEvent(tx, {
              at: this.clock.now(),
              kind: 'manifest',
              actor,
              unitUuid: uuid,
              detail: `Lot ${lot}, manifest line ${line}, size ${size}`,
            });
          } else {
            result.rejected.push({ line, reason: 'already-imported' });
          }
        }
      }
    });
    return result;
  }

  async intakeScan(uuid: string, actor: string): Promise<void> {
    const at = this.clock.now();
    await this.db.tx(async (tx) => {
      const unit = await this.mustFind(tx, uuid);
      await moveUnit(tx, uuid, 'received');
      await tx.query('update units set intake_at = $2 where uuid = $1', [uuid, at]);
      await logEvent(tx, { at, kind: 'intake', actor, unitUuid: uuid, detail: `Scanned in, lot ${unit.lot}` });
    });
  }

  async recordQa(uuid: string, result: 'passed' | 'failed', actor: string): Promise<void> {
    const at = this.clock.now();
    await this.db.tx(async (tx) => {
      const unit = await this.mustFind(tx, uuid);
      await moveUnit(tx, uuid, result === 'passed' ? 'available' : 'qa_failed');
      await tx.query('update units set qa = $2 where uuid = $1', [uuid, result]);
      await logEvent(tx, { at, kind: 'qa', actor, unitUuid: uuid, detail: `QA ${result}` });
      // A ring that just passed QA may be what the oldest waiting order needs.
      if (result === 'passed') await this.allocator.serve(tx, unit.size, at);
    });
  }

  private async mustFind(tx: Parameters<Parameters<Db['tx']>[0]>[0], uuid: string): Promise<{ lot: string; size: number }> {
    const { rows } = await tx.query<{ lot: string; size: number }>('select lot, size from units where uuid = $1', [uuid]);
    if (!rows[0]) throw new NotFoundException('No ring with that ID');
    return rows[0];
  }
}
