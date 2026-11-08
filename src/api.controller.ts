import { BadRequestException, Body, Controller, Get, Inject, Param, ParseIntPipe, ParseUUIDPipe, Post } from '@nestjs/common';
import { ReservationService } from './allocation/reservation.service';
import { ManifestService } from './inventory/manifest.service';
import { PackingService } from './packing/packing.service';

const DEFAULT_ACTOR = 'Demo packer (fictional)';

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
  async intake(@Param('uuid', ParseUUIDPipe) uuid: string, @Body() body: Record<string, unknown>) {
    await this.manifests.intakeScan(uuid, actor(body));
    return { uuid, status: 'received' };
  }

  @Post('units/:uuid/qa')
  async qa(@Param('uuid', ParseUUIDPipe) uuid: string, @Body() body: Record<string, unknown>) {
    const result = textField(body, 'result');
    if (result !== 'passed' && result !== 'failed') throw new BadRequestException('Result must be passed or failed');
    await this.manifests.recordQa(uuid, result, actor(body));
    return { uuid, qa: result };
  }

  @Get('units/:uuid/history')
  history(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.packing.history(uuid);
  }

  @Get('units/:uuid/pair-check')
  pairCheck(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.packing.pairCheck(uuid);
  }

  @Post('orders/:id/size')
  submitSize(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    return this.reservations.submitSize(id, Number(body?.size));
  }

  @Post('orders/:id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.reservations.cancel(id);
  }

  @Get('orders/:id/slip')
  slip(@Param('id', ParseIntPipe) id: number) {
    return this.packing.slip(id);
  }

  @Get('orders/:id/why')
  why(@Param('id', ParseIntPipe) id: number) {
    return this.packing.why(id);
  }

  @Post('orders/:id/scan')
  scan(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    return this.packing.scan(id, textField(body, 'ringId'), actor(body));
  }

  @Post('orders/:id/label')
  async label(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    return { url: await this.packing.createLabel(id, actor(body)) };
  }

  @Post('orders/:id/handoff')
  async handoff(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    await this.packing.handOff(id, actor(body));
    return { status: 'handed_off' };
  }

  @Post('orders/:id/delivered')
  async delivered(@Param('id', ParseIntPipe) id: number) {
    await this.packing.ringDelivered(id);
    return { status: 'delivered' };
  }

  @Post('orders/:id/sizer-delivered')
  async sizerDelivered(@Param('id', ParseIntPipe) id: number) {
    await this.packing.sizerDelivered(id);
    return { status: 'sizer_delivered' };
  }
}
