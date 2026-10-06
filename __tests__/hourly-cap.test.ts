import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDefaultHourlyCap,
  HOURLY_CAP_CEILING,
  isValidHourlyCap,
  resolveHourlyCap,
} from "../lib/utils/hourly-cap";

afterEach(() => vi.unstubAllEnvs());

describe("hourly cap", () => {
  it("defaults to Meta's ceiling when nothing is configured", () => {
    expect(getDefaultHourlyCap()).toBe(HOURLY_CAP_CEILING);
    expect(resolveHourlyCap(null)).toBe(HOURLY_CAP_CEILING);
  });

  it("reads the instance default from DM_HOURLY_CAP", () => {
    vi.stubEnv("DM_HOURLY_CAP", "250");
    expect(getDefaultHourlyCap()).toBe(250);
    expect(resolveHourlyCap(undefined)).toBe(250);
  });

  it("lets an account override the instance default", () => {
    vi.stubEnv("DM_HOURLY_CAP", "250");
    expect(resolveHourlyCap(100)).toBe(100);
  });

  it("ignores junk in the environment instead of blocking all sends", () => {
    for (const bad of ["abc", "0", "-5", "", "250abc", "1.5"]) {
      vi.stubEnv("DM_HOURLY_CAP", bad);
      expect(getDefaultHourlyCap()).toBe(HOURLY_CAP_CEILING);
    }
  });

  it("clamps to the ceiling", () => {
    vi.stubEnv("DM_HOURLY_CAP", "99999");
    expect(getDefaultHourlyCap()).toBe(HOURLY_CAP_CEILING);
    expect(resolveHourlyCap(99999)).toBe(HOURLY_CAP_CEILING);
  });

  it("validates user input strictly", () => {
    expect(isValidHourlyCap(1)).toBe(true);
    expect(isValidHourlyCap(750)).toBe(true);
    for (const bad of [0, 751, -1, 1.5, "100", null, undefined, NaN]) {
      expect(isValidHourlyCap(bad)).toBe(false);
    }
  });
});
