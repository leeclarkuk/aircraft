// Copyright (c) 2026 FlyByWire Simulations
// SPDX-License-Identifier: GPL-3.0

import { describe, expect, it } from 'vitest';
import { MathUtils } from '@flybywiresim/fbw-sdk';
import {
  createVectorFromMagnitudeAndDirection,
  scaleWindVector,
  WindEntry,
  WindVector,
} from '../../../flightplanning/data/wind';
import { WindUtils } from './WindUtils';

const vector = (magnitude: number | undefined, directionDegrees: number | undefined) =>
  createVectorFromMagnitudeAndDirection(magnitude, directionDegrees);

const entry = (altitude: number | undefined, magnitude: number | undefined, directionDegrees: number | undefined) =>
  ({ altitude, vector: vector(magnitude, directionDegrees) }) as WindEntry;

/** Smallest absolute difference between the direction of a vector and the expected direction, in degrees. */
const directionError = (actual: WindVector, expectedDegrees: number) =>
  Math.abs(MathUtils.normalise180(actual.direction! * MathUtils.RADIANS_TO_DEGREES - expectedDegrees));

const result = (): WindVector => ({ direction: 0, magnitude: 0 });

describe('WindUtils', () => {
  describe('interpolateWindVector', () => {
    it('returns the vectors at either end of the range', () => {
      const v0 = vector(30, 90);
      const v1 = vector(50, 180);

      const atStart = WindUtils.interpolateWindVector(0, 0, 10, v0, v1, result());
      const atEnd = WindUtils.interpolateWindVector(10, 0, 10, v0, v1, result());

      expect(atStart.magnitude).toBeCloseTo(30);
      expect(directionError(atStart, 90)).toBeLessThan(1e-6);
      expect(atEnd.magnitude).toBeCloseTo(50);
      expect(directionError(atEnd, 180)).toBeLessThan(1e-6);
    });

    it('keeps the direction when both vectors have the same direction', () => {
      const out = WindUtils.interpolateWindVector(5, 0, 10, vector(20, 270), vector(60, 270), result());

      expect(out.magnitude).toBeCloseTo(40);
      expect(directionError(out, 270)).toBeLessThan(1e-6);
    });

    it('goes the short way round when the directions are either side of north', () => {
      const out = WindUtils.interpolateWindVector(5, 0, 10, vector(40, 350), vector(40, 10), result());

      expect(directionError(out, 0)).toBeLessThan(1e-6);
      // Components are interpolated, so the magnitude dips slightly between the two.
      expect(out.magnitude).toBeCloseTo(40 * Math.cos(10 * MathUtils.DEGREES_TO_RADIANS));
    });

    it('does not rotate the wrong way for a quarter of the way across north', () => {
      const out = WindUtils.interpolateWindVector(2.5, 0, 10, vector(40, 350), vector(40, 10), result());

      expect(directionError(out, 355)).toBeLessThan(0.5);
    });

    it('has no direction when either vector has no direction', () => {
      const out = WindUtils.interpolateWindVector(5, 0, 10, vector(20, undefined), vector(40, 90), result());

      expect(out.direction).toBeUndefined();
      expect(out.magnitude).toBeCloseTo(30);
    });

    it('has no magnitude when either vector has no magnitude', () => {
      const out = WindUtils.interpolateWindVector(5, 0, 10, vector(undefined, 90), vector(40, 180), result());

      expect(out.magnitude).toBeUndefined();
      expect(directionError(out, 135)).toBeLessThan(1e-6);
    });
  });

  describe('interpolateWindEntries', () => {
    it('interpolates across north for entries in ascending altitude order', () => {
      const out = WindUtils.interpolateWindEntries([entry(10_000, 40, 350), entry(20_000, 40, 10)], 15_000, result());

      expect(directionError(out, 0)).toBeLessThan(1e-6);
    });

    it('interpolates across north for entries in descending altitude order', () => {
      const out = WindUtils.interpolateWindEntries([entry(20_000, 40, 10), entry(10_000, 40, 350)], 15_000, result());

      expect(directionError(out, 0)).toBeLessThan(1e-6);
    });
  });

  describe('scaleWindVector', () => {
    it('scales the magnitude but not the direction', () => {
      const out = scaleWindVector(vector(40, 270), 0.5, result());

      expect(out.magnitude).toBeCloseTo(20);
      expect(directionError(out, 270)).toBeLessThan(1e-6);
    });

    it('keeps the direction when scaling down to nearly zero', () => {
      const out = scaleWindVector(vector(40, 270), Number.EPSILON, result());

      expect(out.magnitude).toBeCloseTo(0);
      expect(directionError(out, 270)).toBeLessThan(1e-6);
    });

    it('leaves undefined components undefined', () => {
      const out = scaleWindVector(vector(undefined, undefined), 0.5, result());

      expect(out.magnitude).toBeUndefined();
      expect(out.direction).toBeUndefined();
    });
  });

  describe('getLowestEntry', () => {
    it('finds the lowest entry when sorted by ascending altitude', () => {
      const entries = [entry(5_000, 10, 90), entry(15_000, 20, 90), entry(25_000, 30, 90)];

      expect(WindUtils.getLowestEntry(entries)).toBe(entries[0]);
    });

    it('finds the lowest entry when sorted by descending altitude', () => {
      const entries = [entry(25_000, 30, 90), entry(15_000, 20, 90), entry(5_000, 10, 90)];

      expect(WindUtils.getLowestEntry(entries)).toBe(entries[2]);
    });

    it('ignores entries without an altitude', () => {
      const entries = [entry(undefined, 10, 90), entry(15_000, 20, 90)];

      expect(WindUtils.getLowestEntry(entries)).toBe(entries[1]);
    });

    it('returns undefined when there is no entry with an altitude', () => {
      expect(WindUtils.getLowestEntry([])).toBeUndefined();
      expect(WindUtils.getLowestEntry([entry(undefined, 10, 90)])).toBeUndefined();
    });
  });
});
