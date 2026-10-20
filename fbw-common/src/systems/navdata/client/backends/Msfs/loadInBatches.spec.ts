// Copyright (c) 2026 FlyByWire Simulations
// SPDX-License-Identifier: GPL-3.0

import { describe, expect, it, vi } from 'vitest';
import { loadInBatches, MAX_FACILITY_LOAD_BATCH_SIZE } from './loadInBatches';

const icaos = (count: number) => Array.from({ length: count }, (_, i) => `W    ${i}`);

describe('loadInBatches', () => {
  it('does not call the loader for an empty list', async () => {
    const load = vi.fn();

    await expect(loadInBatches([], load)).resolves.toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });

  it('uses a single call when the list fits in one batch', async () => {
    const load = vi.fn(async (batch: string[]) => batch.map(() => true));

    const results = await loadInBatches(icaos(MAX_FACILITY_LOAD_BATCH_SIZE), load);

    expect(load).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(MAX_FACILITY_LOAD_BATCH_SIZE);
  });

  it('splits larger lists into batches of at most the batch size', async () => {
    const load = vi.fn(async (batch: string[]) => batch.map(() => true));

    const results = await loadInBatches(icaos(250), load);

    expect(load.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 50]);
    expect(results).toHaveLength(250);
  });

  it('keeps results aligned with the input order across batches', async () => {
    const input = icaos(5);
    const failing = new Set([input[1], input[3]]);
    const load = async (batch: string[]) => batch.map((icao) => !failing.has(icao));

    await expect(loadInBatches(input, load, 2)).resolves.toEqual([true, false, true, false, true]);
  });

  it('runs batches sequentially', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const load = async (batch: string[]) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight--;
      return batch.map(() => true);
    };

    await loadInBatches(icaos(30), load, 10);

    expect(maxInFlight).toBe(1);
  });

  it('treats missing results in a batch as failures', async () => {
    const load = async () => [true];

    await expect(loadInBatches(icaos(3), load)).resolves.toEqual([true, false, false]);
  });
});
