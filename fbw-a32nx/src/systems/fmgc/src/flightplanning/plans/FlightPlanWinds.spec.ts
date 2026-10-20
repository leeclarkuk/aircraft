// Copyright (c) 2026 FlyByWire Simulations
// SPDX-License-Identifier: GPL-3.0

import { beforeAll, describe, expect, it } from 'vitest';
import { EventBus } from '@microsoft/msfs-sdk';
import { FlightPlan } from '@fmgc/flightplanning/plans/FlightPlan';
import { A320FlightPlanPerformanceData } from '@fmgc/flightplanning/plans/performance/A320FlightPlanPerformanceData';
import { NavigationDatabaseService } from '@fmgc/flightplanning/NavigationDatabaseService';
import { setupTestDatabase } from '../test/Database';
import { createVectorFromMagnitudeAndDirection, FlightPlanWindEntry } from '../data/wind';

const MAX_CLIMB_WIND_LEVELS = 5;
const MAX_CRUISE_WIND_LEVELS = 4;
const MAX_DESCENT_WIND_LEVELS = 5;

const bus = new EventBus();

function windFlightPlan(draftOnWindEdit: boolean, sortClimbWindsByDescendingAltitude = true) {
  return FlightPlan.empty(
    { syncClientID: 1, batchStack: [] },
    0,
    bus,
    new A320FlightPlanPerformanceData(),
    MAX_CLIMB_WIND_LEVELS,
    MAX_CRUISE_WIND_LEVELS,
    MAX_DESCENT_WIND_LEVELS,
    undefined,
    draftOnWindEdit,
    sortClimbWindsByDescendingAltitude,
  );
}

const windEntry = (altitude: number, magnitude = 20, directionDegrees = 270): FlightPlanWindEntry => ({
  altitude,
  vector: createVectorFromMagnitudeAndDirection(magnitude, directionDegrees),
  flags: 0,
});

describe('flight plan winds', () => {
  describe('inserting draft winds', () => {
    beforeAll(() => {
      setupTestDatabase();
    });

    it('does nothing when there are no draft winds', async () => {
      const fp = windFlightPlan(true);
      await fp.setClimbWindEntry(10_000, windEntry(10_000), false);

      fp.insertDraftWindEntries();

      expect(fp.hasDraftWindEntries()).toBe(false);
      expect(fp.performanceData.climbWindEntries.get().map((e) => e.altitude)).toEqual([10_000]);
    });

    it('inserts and clears a single draft wind', async () => {
      const fp = windFlightPlan(true);
      await fp.setClimbWindEntry(10_000, windEntry(10_000));
      expect(fp.hasDraftWindEntries()).toBe(true);
      expect(fp.performanceData.climbWindEntries.get()).toHaveLength(0);

      fp.insertDraftWindEntries();

      expect(fp.hasDraftWindEntries()).toBe(false);
      expect(fp.performanceData.climbWindEntries.get().map((e) => e.altitude)).toEqual([10_000]);
    });

    it('keeps an alternate wind as a draft until it is inserted', async () => {
      const fp = windFlightPlan(true);

      await fp.setAlternateWind(createVectorFromMagnitudeAndDirection(30, 90));

      expect(fp.hasDraftWindEntries()).toBe(true);
      expect(fp.getAlternateWind()?.magnitude).toBe(30);
      expect(fp.performanceData.alternateWind.get().magnitude).toBeUndefined();

      fp.insertDraftWindEntries();

      expect(fp.hasDraftWindEntries()).toBe(false);
      expect(fp.performanceData.alternateWind.get().magnitude).toBe(30);
    });

    it('discards an alternate draft wind', async () => {
      const fp = windFlightPlan(true);
      await fp.setAlternateWind(createVectorFromMagnitudeAndDirection(30, 90));

      fp.deleteDraftWindEntries();

      expect(fp.hasDraftWindEntries()).toBe(false);
      expect(fp.performanceData.alternateWind.get().magnitude).toBeUndefined();
    });

    it('inserts and clears draft winds when all of the kinds have been edited', async () => {
      const fp = windFlightPlan(true);
      await fp.setOriginAirport('CYVR');
      await fp.setDestinationAirport('CYYZ');
      const waypoint = await NavigationDatabaseService.activeDatabase.searchWaypoint('NOSUS');
      await fp.insertWaypointBefore(1, waypoint[0]);

      await fp.setClimbWindEntry(10_000, windEntry(10_000));
      await fp.addCruiseWindEntry(1, windEntry(35_000));
      await fp.setDescentWindEntry(15_000, windEntry(15_000));
      await fp.setAlternateWind(createVectorFromMagnitudeAndDirection(30, 90));
      expect(fp.hasDraftWindEntries()).toBe(true);

      fp.insertDraftWindEntries();

      expect(fp.hasDraftWindEntries()).toBe(false);
      expect(fp.performanceData.climbWindEntries.get().map((e) => e.altitude)).toEqual([10_000]);
      expect(fp.performanceData.descentWindEntries.get().map((e) => e.altitude)).toEqual([15_000]);
      expect(fp.performanceData.alternateWind.get().magnitude).toBe(30);
    });
  });
});
