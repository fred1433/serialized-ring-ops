export class Clock {
  now(): Date {
    return new Date();
  }
}

/** Used by the seed and the tests, so fictional dates stay fixed. */
export class ManualClock extends Clock {
  constructor(private current: Date) {
    super();
  }
  set(iso: string): void {
    this.current = new Date(iso);
  }
  now(): Date {
    return this.current;
  }
}
