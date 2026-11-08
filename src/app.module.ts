import { Module } from '@nestjs/common';
import { Allocator } from './allocation/allocator';
import { ReservationService } from './allocation/reservation.service';
import { ApiController } from './api.controller';
import { CARRIER, FakeCarrier, FakePrinter, PRINTER } from './channels/fake-providers';
import { OrderIntakeService } from './channels/order-intake.service';
import { WebhookController } from './channels/webhook.controller';
import { Clock } from './clock';
import { Db } from './db';
import { ManifestService } from './inventory/manifest.service';
import { PackingService } from './packing/packing.service';

@Module({
  controllers: [ApiController, WebhookController],
  providers: [
    { provide: Db, useFactory: () => new Db() },
    Clock,
    Allocator,
    ManifestService,
    ReservationService,
    PackingService,
    OrderIntakeService,
    { provide: CARRIER, useClass: FakeCarrier },
    { provide: PRINTER, useClass: FakePrinter },
  ],
})
export class AppModule {}
