/**
 * A scripted {@link Prompter} for flow tests: you supply one handler per
 * primitive and switch on the prompt message. Validation functions still run, so
 * a flow that would have shown the user an error fails the test instead.
 */

import type { Prompter } from '../../src/lib/publishing/flow';

export interface FakeHandlers {
  input: (opts: { message: string; default?: string }) => string;
  select: (opts: {
    message: string;
    choices: ReadonlyArray<{ name: string; value: unknown }>;
  }) => unknown;
  confirm: (opts: { message: string; default?: boolean }) => boolean;
}

export class FakePrompter implements Prompter {
  readonly seen: string[] = [];

  constructor(private readonly handlers: FakeHandlers) {}

  async input(opts: {
    message: string;
    default?: string;
    validate?: (value: string) => boolean | string;
  }): Promise<string> {
    this.seen.push(opts.message);
    const value = this.handlers.input(opts);
    if (opts.validate) {
      const result = opts.validate(value);
      if (result !== true) throw new Error(`fake input rejected for "${opts.message}": ${result}`);
    }
    return value;
  }

  async select<T>(opts: {
    message: string;
    choices: ReadonlyArray<{ name: string; value: T }>;
    default?: T;
  }): Promise<T> {
    this.seen.push(opts.message);
    return this.handlers.select(opts) as T;
  }

  async confirm(opts: { message: string; default?: boolean }): Promise<boolean> {
    this.seen.push(opts.message);
    return this.handlers.confirm(opts);
  }
}

/** Collects everything a flow prints. */
export class RecordingIo {
  readonly lines: string[] = [];
  print(message: string): void {
    this.lines.push(message);
  }
  get text(): string {
    return this.lines.join('\n');
  }
}

export const fixedClock = (date = '2026-09-10') => ({ today: () => date });
