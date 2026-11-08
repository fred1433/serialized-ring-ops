// Fakes, and they say so. No carrier and no printer is connected to this repository.

export const CARRIER = Symbol('CARRIER');
export const PRINTER = Symbol('PRINTER');

export interface CarrierPort {
  createLabel(orderId: number): Promise<{ provider: string; url: string }>;
}

export interface PrinterPort {
  print(url: string): Promise<void>;
}

export class FakeCarrier implements CarrierPort {
  async createLabel(orderId: number): Promise<{ provider: string; url: string }> {
    return { provider: 'fake carrier', url: `fake://labels/${orderId}.pdf` };
  }
}

export class FakePrinter implements PrinterPort {
  readonly printed: string[] = [];
  async print(url: string): Promise<void> {
    this.printed.push(url);
  }
}
