import { ArgumentMetadata, BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, ParseIntPipe, ParseUUIDPipe, Post } from '@nestjs/common';
import { ReservationService } from './allocation/reservation.service';
import { ManifestService } from './inventory/manifest.service';
import { PackingService } from './packing/packing.service';

const DEFAULT_ACTOR = 'Demo packer (fictional)';
const LARGEST_ORDER_ID = 2147483647;

/** A ring ID in any case is the same ring. */
class RingIdPipe extends ParseUUIDPipe {
  async transform(value: string, metadata: ArgumentMetadata): Promise<string> {
    return (await super.transform(value, metadata)).toLowerCase();
  }
}

/** A number too large for the column is simply an order that does not exist. */
class OrderIdPipe extends ParseIntPipe {
  async transform(value: string, metadata: ArgumentMetadata): Promise<number> {
    const id = await super.transform(value, metadata);
    if (id > LARGEST_ORDER_ID) throw new NotFoundException('No such order');
    return id;
  }
}

const RING_ID = new RingIdPipe();
const ORDER_ID = new OrderIdPipe();

function textField(body: Record<string, unknown> | undefined, name: string): string {
  const value = body?.[name];
  if (typeof value !== 'string' || value.trim() === '') throw new BadRequestException(`Field "${name}" is required`);
  return value;
}

function actor(body: Record<string, unknown> | undefined): string {
  return typeof body?.actor === 'string' ? body.actor : DEFAULT_ACTOR;
}

@Controller()
export class ApiController {
  constructor(
    @Inject(ManifestService) private readonly manifests: ManifestService,
    @Inject(ReservationService) private readonly reservations: ReservationService,
    @Inject(PackingService) private readonly packing: PackingService,
  ) {}

  @Post('manifests')
  importManifest(@Body() body: Record<string, unknown>) {
    return this.manifests.importCsv(textField(body, 'csv'), actor(body));
  }

  @Post('units/:uuid/intake')
  async intake(@Param('uuid', RING_ID) uuid: string, @Body() body: Record<string, unknown>) {
    await this.manifests.intakeScan(uuid, actor(body));
    return { uuid, status: 'received' };
  }

  @Post('units/:uuid/qa')
  async qa(@Param('uuid', RING_ID) uuid: string, @Body() body: Record<string, unknown>) {
    const result = textField(body, 'result');
    if (result !== 'passed' && result !== 'failed') throw new BadRequestException('Result must be passed or failed');
    await this.manifests.recordQa(uuid, result, actor(body));
    return { uuid, qa: result };
  }

  @Get('units/:uuid/history')
  history(@Param('uuid', RING_ID) uuid: string) {
    return this.packing.history(uuid);
  }

  @Get('units/:uuid/pairing-eligibility')
  pairingEligibility(@Param('uuid', RING_ID) uuid: string) {
    return this.packing.pairingEligibility(uuid);
  }

  @Post('orders/:id/size')
  submitSize(@Param('id', ORDER_ID) id: number, @Body() body: Record<string, unknown>) {
    return this.reservations.submitSize(id, Number(body?.size));
  }

  @Post('orders/:id/cancel')
  cancel(@Param('id', ORDER_ID) id: number) {
    return this.reservations.cancel(id);
  }

  @Get('orders/:id/slip')
  slip(@Param('id', ORDER_ID) id: number) {
    return this.packing.slip(id);
  }

  @Get('orders/:id/why')
  why(@Param('id', ORDER_ID) id: number) {
    return this.packing.why(id);
  }

  @Post('orders/:id/scan')
  scan(@Param('id', ORDER_ID) id: number, @Body() body: Record<string, unknown>) {
    return this.packing.scan(id, textField(body, 'ringId'), actor(body));
  }

  @Post('orders/:id/label')
  async label(@Param('id', ORDER_ID) id: number, @Body() body: Record<string, unknown>) {
    return { url: await this.packing.createLabel(id, actor(body)) };
  }

  @Post('orders/:id/handoff')
  async handoff(@Param('id', ORDER_ID) id: number, @Body() body: Record<string, unknown>) {
    await this.packing.handOff(id, actor(body));
    return { status: 'handed_off' };
  }

  @Post('orders/:id/delivered')
  async delivered(@Param('id', ORDER_ID) id: number) {
    await this.packing.ringDelivered(id);
    return { status: 'delivered' };
  }

  @Post('orders/:id/sizer-delivered')
  async sizerDelivered(@Param('id', ORDER_ID) id: number) {
    await this.packing.sizerDelivered(id);
    return { status: 'sizer_delivered' };
  }
}
