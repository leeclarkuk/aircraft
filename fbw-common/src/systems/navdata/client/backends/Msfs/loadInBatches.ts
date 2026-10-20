// Copyright (c) 2026 FlyByWire Simulations
// SPDX-License-Identifier: GPL-3.0

/** The maximum number of ICAOs the simulator will accept in a single facility load call. */
export const MAX_FACILITY_LOAD_BATCH_SIZE = 100;

/**
 * Loads a list of ICAOs by splitting them into batches and calling the load function for each batch in turn.
 * @param icaos The ICAOs to load.
 * @param load Loads one batch, and returns whether each ICAO in the batch was successfully requested, in order.
 * @param batchSize The maximum number of ICAOs per batch.
 * @returns Whether each ICAO was successfully requested, in the same order as the input.
 */
export async function loadInBatches(
  icaos: readonly string[],
  load: (batch: string[]) => Promise<boolean[]>,
  batchSize = MAX_FACILITY_LOAD_BATCH_SIZE,
): Promise<boolean[]> {
  const results: boolean[] = [];

  for (let i = 0; i < icaos.length; i += batchSize) {
    const batch = icaos.slice(i, i + batchSize);
    const batchResults = await load(batch);

    // pad missing results as failures so the output always lines up with the input
    for (let j = 0; j < batch.length; j++) {
      results.push(batchResults[j] === true);
    }
  }

  return results;
}
