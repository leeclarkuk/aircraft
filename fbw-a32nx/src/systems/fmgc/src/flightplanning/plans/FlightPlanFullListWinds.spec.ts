// Copyright (c) 2026 FlyByWire Simulations
// SPDX-License-Identifier: GPL-3.0

import { describe, expect, it } from 'vitest';
import { EventBus } from '@microsoft/msfs-sdk';
import { FlightPlan } from '@fmgc/flightplanning/plans/FlightPlan';
import { A320FlightPlanPerformanceData } from '@fmgc/flightplanning/plans/performance/A320FlightPlanPerformanceData';
import { createVectorFromMagnitudeAndDirection, FlightPlanWindEntry } from '../data/wind';

const MAX_CLIMB_WIND_LEVELS = 5;
const MAX_CRUISE_WIND_LEVELS = 4;
const MAX_DESCENT_WIND_LEVELS = 5;

const bus = new EventBus();

function windFlightPlan() {
  return FlightPlan.empty(
    { syncClientID: 1, batchStack: [] },
    0,
    bus,
    new A320FlightPlanPerformanceData(),
    MAX_CLIMB_WIND_LEVELS,
    MAX_CRUISE_WIND_LEVELS,
    MAX_DESCENT_WIND_LEVELS,
  );
}

const windEntry = (altitude: number, magnitude = 20, directionDegrees = 270): FlightPlanWindEntry => ({
  altitude,
  vector: createVectorFromMagnitudeAndDirection(magnitude, directionDegrees),
  flags: 0,
});

describe('adding a wind to a full list', () => {
  const fullDescentAltitudes = [30_000, 25_000, 20_000, 15_000, 10_000];

  async function fullDescentPlan() {
    const fp = windFlightPlan();
    for (const altitude of fullDescentAltitudes) {
      await fp.setDescentWindEntry(altitude, windEntry(altitude), false, false);
    }
    expect(fp.performanceData.descentWindEntries.get().map((e) => e.altitude)).toEqual(fullDescentAltitudes);
    return fp;
  }

  it('replaces the lowest descent wind with a ground wind', async () => {
    const fp = await fullDescentPlan();

    await fp.setDescentWindEntry(0, windEntry(0), false, false);

    expect(fp.performanceData.descentWindEntries.get().map((e) => e.altitude)).toEqual([
      30_000, 25_000, 20_000, 15_000, 0,
    ]);
  });

  it('does not replace a descent wind with one at a higher altitude', async () => {
    const fp = await fullDescentPlan();

    await fp.setDescentWindEntry(35_000, windEntry(35_000), false, false);

    expect(fp.performanceData.descentWindEntries.get().map((e) => e.altitude)).toEqual(fullDescentAltitudes);
  });

  it('does not replace a climb wind', async () => {
    const fp = windFlightPlan();
    const climbAltitudes = [25_000, 20_000, 15_000, 10_000, 5_000];
    for (const altitude of climbAltitudes) {
      await fp.setClimbWindEntry(altitude, windEntry(altitude), false);
    }
    expect(fp.performanceData.climbWindEntries.get().map((e) => e.altitude)).toEqual(climbAltitudes);

    await fp.setClimbWindEntry(30_000, windEntry(30_000), false);
    await fp.setClimbWindEntry(2_000, windEntry(2_000), false);

    expect(fp.performanceData.climbWindEntries.get().map((e) => e.altitude)).toEqual(climbAltitudes);
  });
});
