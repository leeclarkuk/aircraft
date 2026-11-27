// Copyright (c) 2026 FlyByWire Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Airport, FlightLevel } from '@flybywiresim/fbw-sdk';

/**
 * Returns the default transition level for a destination airport.
 * Uses the nav database transition level when present, otherwise falls back to the transition altitude
 * expressed as a flight level, rounded up so the level is never below the altitude.
 * @param airport the destination airport
 * @returns the transition level; Unit: flight level; Null if neither value is available.
 */
export function getDefaultTransitionLevel(
  airport: Pick<Airport, 'transitionAltitude' | 'transitionLevel'> | undefined | null,
): FlightLevel | null {
  if (airport?.transitionLevel !== undefined && airport.transitionLevel !== null) {
    return airport.transitionLevel;
  }

  if (airport?.transitionAltitude !== undefined && airport.transitionAltitude !== null) {
    return Math.ceil(airport.transitionAltitude / 100);
  }

  return null;
}
