// Copyright (c) 2026 FlyByWire Simulations
// SPDX-License-Identifier: GPL-3.0

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EventBus } from '@microsoft/msfs-sdk';
import { FlightPlan } from '@fmgc/flightplanning/plans/FlightPlan';
import { A320FlightPlanPerformanceData } from '@fmgc/flightplanning/plans/performance/A320FlightPlanPerformanceData';
import { NavigationDatabaseService } from '@fmgc/flightplanning/NavigationDatabaseService';
import { FlightPlanEvents } from '@fmgc/flightplanning/sync/FlightPlanEvents';
import { setupTestDatabase } from '../test/Database';
import { createVectorFromMagnitudeAndDirection, WindEntry } from '../data/wind';

const bus = new EventBus();

const windEntry = (altitude: number, magnitude = 20, directionDegrees = 270): WindEntry => ({
  altitude,
  vector: createVectorFromMagnitudeAndDirection(magnitude, directionDegrees),
});

/** Creates a plan with legs at index 0 (origin), 1 (NOSUS) and 3 (destination), and cruise winds without drafts. */
async function planWithLegs(draftOnWindEdit = false) {
  const fp = FlightPlan.empty(
    { syncClientID: 1, batchStack: [] },
    0,
    bus,
    new A320FlightPlanPerformanceData(),
    5,
    4,
    5,
    undefined,
    draftOnWindEdit,
    false,
  );
  await fp.setOriginAirport('CYVR');
  await fp.setDestinationAirport('CYYZ');
  const waypoint = await NavigationDatabaseService.activeDatabase.searchWaypoint('NOSUS');
  await fp.insertWaypointBefore(1, waypoint[0]);
  return fp;
}

const cruiseWinds = (fp: FlightPlan<A320FlightPlanPerformanceData>, legIndex: number) =>
  fp.legElementAt(legIndex).cruiseWindEntries.map((e) => ({
    altitude: e.altitude,
    magnitude: e.vector.magnitude,
  }));

describe('cruise winds', () => {
  beforeAll(() => {
    setupTestDatabase();
  });

  describe('deleting an entry', () => {
    it('removes the entry and syncs the change when there are no draft winds', async () => {
      const fp = await planWithLegs();
      await fp.addCruiseWindEntry(1, windEntry(35_000));
      const handler = vi.fn();
      const sub = bus.getSubscriber<FlightPlanEvents>().on('flightPlan.setCruiseWinds').handle(handler);
      const versionBefore = fp.version;

      await fp.deleteCruiseWindEntry(1, 35_000);
      sub.destroy();

      expect(cruiseWinds(fp, 1)).toEqual([]);
      expect(fp.version).toBeGreaterThan(versionBefore);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toMatchObject({ atIndex: 1, newCruiseWinds: [] });
    });
  });

  describe('deleting an entry in a draft', () => {
    it('leaves the plan and its synced clients unchanged until the draft is inserted', async () => {
      const fp = await planWithLegs(true);
      await fp.addCruiseWindEntry(1, windEntry(35_000));
      fp.insertDraftWindEntries();
      expect(cruiseWinds(fp, 1)).toEqual([{ altitude: 35_000, magnitude: 20 }]);
      const handler = vi.fn();
      const sub = bus.getSubscriber<FlightPlanEvents>().on('flightPlan.setCruiseWinds').handle(handler);
      const versionBefore = fp.version;

      await fp.deleteCruiseWindEntry(1, 35_000);

      expect(fp.version).toBeGreaterThan(versionBefore);
      expect(fp.hasDraftWindEntries()).toBe(true);
      expect(cruiseWinds(fp, 1)).toEqual([{ altitude: 35_000, magnitude: 20 }]);
      expect(handler).not.toHaveBeenCalled();

      fp.insertDraftWindEntries();
      sub.destroy();

      expect(cruiseWinds(fp, 1)).toEqual([]);
    });
  });

  describe('editing an entry', () => {
    it('edits the entry that was selected from the propagated winds', async () => {
      const fp = await planWithLegs();
      // Entries are stored in the order they were added, but the propagated winds are sorted by altitude.
      await fp.addCruiseWindEntry(1, windEntry(31_000, 10));
      await fp.addCruiseWindEntry(1, windEntry(35_000, 20));

      // The propagated winds are FL350 (index 0) and FL310 (index 1).
      await fp.editCruiseWindEntry(1, 0, windEntry(35_000, 50));

      expect(cruiseWinds(fp, 1)).toEqual([
        { altitude: 31_000, magnitude: 10 },
        { altitude: 35_000, magnitude: 50 },
      ]);
    });

    it('edits an entry which has propagated entries from earlier legs above it', async () => {
      const fp = await planWithLegs();
      await fp.addCruiseWindEntry(0, windEntry(39_000, 5));
      await fp.addCruiseWindEntry(1, windEntry(35_000, 20));

      // The propagated winds at leg 1 are FL390 (index 0, from leg 0) and FL350 (index 1).
      await fp.editCruiseWindEntry(1, 1, windEntry(35_000, 50));

      expect(cruiseWinds(fp, 1)).toEqual([{ altitude: 35_000, magnitude: 50 }]);
      expect(cruiseWinds(fp, 0)).toEqual([{ altitude: 39_000, magnitude: 5 }]);
    });

    it('replaces the vector when an entry is added at an altitude that already has an entry', async () => {
      const fp = await planWithLegs();
      await fp.addCruiseWindEntry(1, windEntry(31_000, 10));
      await fp.addCruiseWindEntry(1, windEntry(35_000, 20));

      await fp.addCruiseWindEntry(1, windEntry(35_000, 50));

      expect(cruiseWinds(fp, 1)).toEqual([
        { altitude: 31_000, magnitude: 10 },
        { altitude: 35_000, magnitude: 50 },
      ]);
    });
  });
});
