// Copyright (c) 2026 FlyByWire Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { describe, expect, it } from 'vitest';
import { getDefaultTransitionLevel } from './TransitionLevel';

describe('getDefaultTransitionLevel', () => {
  it('uses the database transition level when present', () => {
    expect(getDefaultTransitionLevel({ transitionLevel: 70, transitionAltitude: 5000 })).toBe(70);
  });

  it('falls back to the transition altitude when the level is missing', () => {
    expect(getDefaultTransitionLevel({ transitionAltitude: 5000 })).toBe(50);
    expect(getDefaultTransitionLevel({ transitionAltitude: 4500 })).toBe(45);
  });

  it('rounds a non-hundred transition altitude up', () => {
    expect(getDefaultTransitionLevel({ transitionAltitude: 4550 })).toBe(46);
  });

  it('returns null when neither value is available', () => {
    expect(getDefaultTransitionLevel({})).toBeNull();
    expect(getDefaultTransitionLevel(undefined)).toBeNull();
    expect(getDefaultTransitionLevel(null)).toBeNull();
  });
});
