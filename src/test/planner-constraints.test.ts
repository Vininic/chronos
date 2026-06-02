import { describe, expect, it } from "vitest";
import { SNAP } from "@/lib/schedule/types";

/* ── helpers that replicate the DayPlanner logic verbatim ── */

const HOUR_PX      = 64;
const STACK_GAP_PX = 4;
const MIN_IN_DAY   = 15;  // minimum minutes that must stay in the originating day
const COMMIT_MIN   = 30;
const TEASE_MIN    = 15;

/** Replicates the constraint formulas from onGripDown (lines 807–820) */
function computeConstraints(opts: {
  isTopEdge: boolean;
  sourceSpansNextDay: boolean;
  origStartMin: number;
  origDurMin: number;
  prevDayCapacity: number;
  nextDayCapacity: number;
  wakeBoundMin: number;
  bedBoundMin: number;
}) {
  const { isTopEdge, sourceSpansNextDay, origStartMin, origDurMin,
          prevDayCapacity, nextDayCapacity, wakeBoundMin, bedBoundMin } = opts;

  const transitionEdge = isTopEdge ? "top" : "bottom";
  const maxCurrentDaySpill = Math.max(0, origDurMin - MIN_IN_DAY);

  const maxPrevSpillMin = isTopEdge
    ? Math.abs(origStartMin) + origDurMin
    : Math.max(0, Math.min(maxCurrentDaySpill, prevDayCapacity));

  const maxNextSpillMin = sourceSpansNextDay
    ? origDurMin
    : Math.min(origDurMin, nextDayCapacity);

  const prevLimitKind = prevDayCapacity < maxCurrentDaySpill ? "block" : "min-current";
  const nextLimitKind = nextDayCapacity < maxCurrentDaySpill ? "block" : "min-current";

  const minStartMin = isTopEdge || sourceSpansNextDay ? 0 : wakeBoundMin;
  const maxStartMin = sourceSpansNextDay ? 24 * 60 - SNAP : bedBoundMin - origDurMin;

  return {
    transitionEdge,
    maxPrevSpillMin,
    maxNextSpillMin,
    prevLimitKind,
    nextLimitKind,
    minStartMin,
    maxStartMin,
  };
}

/** Replicates the spill-path previewStart logic (line 637) */
function computeSpillPreviewStart(
  rawDeltaMin: number,
  origStartMin: number,
  origDurMin: number,
  maxNextSpillMin: number,
): number {
  const rawStart = origStartMin + rawDeltaMin;
  const rawEnd = rawStart + origDurMin;
  const spillMin = rawEnd - 24 * 60;
  const clampedSpill = Math.max(0, Math.min(spillMin, maxNextSpillMin));
  return Math.min(24 * 60 - SNAP, 24 * 60 - origDurMin + clampedSpill);
}

/** Replicates the cascade overflow check (lines 938–952) */
function cascadePositions(
  positions: { top: number; height: number }[],
  dragItemIdx: number,
  dragTop: number,
  dragBh: number,
  timelineContentHeight: number,
): { top: number; height: number }[] {
  const result = positions.map(p => ({ ...p }));
  result[dragItemIdx] = { ...result[dragItemIdx], top: dragTop, height: dragBh };

  let cursor = dragTop + dragBh + STACK_GAP_PX;
  for (let i = dragItemIdx + 1; i < result.length; i++) {
    const nextTop = result[i].top;
    if (nextTop < cursor) {
      const newBottom = cursor + result[i].height;
      if (newBottom > timelineContentHeight) break;
      result[i] = { ...result[i], top: cursor };
      cursor = newBottom + STACK_GAP_PX;
    } else {
      break;
    }
  }
  return result;
}

/* ── constraint computation ── */

describe("drag constraints", () => {
  describe("maxNextSpillMin", () => {
    it("uses origDurMin for non-cross-day blocks (was maxCurrentDaySpill before fix)", () => {
      const c = computeConstraints({
        isTopEdge: false,
        sourceSpansNextDay: false,
        origStartMin: 1380,          // 23:00
        origDurMin: 60,              // 1h block
        prevDayCapacity: 100,
        nextDayCapacity: 200,
        wakeBoundMin: 0,
        bedBoundMin: 24 * 60,
      });
      // maxCurrentDaySpill = max(0, 60 - 15) = 45
      // old formula would give max(0, min(45, 200)) = 45
      // new formula: min(60, 200) = 60
      expect(c.maxNextSpillMin).toBe(60);
    });

    it("uses MIN_IN_DAY-based maxCurrentDaySpill for prev-day spill", () => {
      const c = computeConstraints({
        isTopEdge: false,
        sourceSpansNextDay: false,
        origStartMin: 1380,
        origDurMin: 60,
        prevDayCapacity: 100,
        nextDayCapacity: 200,
        wakeBoundMin: 0,
        bedBoundMin: 24 * 60,
      });
      expect(c.maxPrevSpillMin).toBe(Math.min(45, 100)); // max(0, 60-15) = 45
    });

    it("gives full origDurMin for sourceSpansNextDay blocks", () => {
      const c = computeConstraints({
        isTopEdge: false,
        sourceSpansNextDay: true,
        origStartMin: 1380,
        origDurMin: 240,             // 4h block
        prevDayCapacity: 100,
        nextDayCapacity: 100,
        wakeBoundMin: 0,
        bedBoundMin: 24 * 60,
      });
      expect(c.maxNextSpillMin).toBe(240);
    });

    it("is limited by nextDayCapacity when smaller than origDurMin", () => {
      const c = computeConstraints({
        isTopEdge: false,
        sourceSpansNextDay: false,
        origStartMin: 1380,
        origDurMin: 120,
        prevDayCapacity: 999,
        nextDayCapacity: 30,          // only 30 min available tomorrow
        wakeBoundMin: 0,
        bedBoundMin: 24 * 60,
      });
      expect(c.maxNextSpillMin).toBe(30);
    });
  });

  describe("maxStartMin", () => {
    it("is 24*60 - SNAP for cross-day blocks (was 24*60 - origDurMin before fix)", () => {
      const c = computeConstraints({
        isTopEdge: false,
        sourceSpansNextDay: true,
        origStartMin: 1380,
        origDurMin: 240,
        prevDayCapacity: 0,
        nextDayCapacity: 0,
        wakeBoundMin: 0,
        bedBoundMin: 24 * 60,
      });
      // old: 24*60 - 240 = 1200 (20:00, before the block's 22:00 start!)
      // new: 24*60 - 15   = 1425 (23:45)
      expect(c.maxStartMin).toBe(24 * 60 - SNAP);
    });

    it("is bedBoundMin - origDurMin for non-cross-day blocks", () => {
      const c = computeConstraints({
        isTopEdge: false,
        sourceSpansNextDay: false,
        origStartMin: 1200,
        origDurMin: 60,
        prevDayCapacity: 0,
        nextDayCapacity: 0,
        wakeBoundMin: 0,
        bedBoundMin: 22 * 60,        // bedtime at 22:00
      });
      expect(c.maxStartMin).toBe(22 * 60 - 60); // 21:00
    });
  });

  describe("minStartMin", () => {
    it("is 0 for cross-day and top-edge blocks", () => {
      const c1 = computeConstraints({
        isTopEdge: false, sourceSpansNextDay: true, origStartMin: 1320, origDurMin: 240,
        prevDayCapacity: 0, nextDayCapacity: 0, wakeBoundMin: 7 * 60, bedBoundMin: 24 * 60,
      });
      expect(c1.minStartMin).toBe(0);

      const c2 = computeConstraints({
        isTopEdge: true, sourceSpansNextDay: false, origStartMin: -60, origDurMin: 120,
        prevDayCapacity: 0, nextDayCapacity: 0, wakeBoundMin: 7 * 60, bedBoundMin: 24 * 60,
      });
      expect(c2.minStartMin).toBe(0);
    });

    it("is wakeBoundMin for normal bottom-edge blocks", () => {
      const c = computeConstraints({
        isTopEdge: false, sourceSpansNextDay: false, origStartMin: 600, origDurMin: 60,
        prevDayCapacity: 0, nextDayCapacity: 0, wakeBoundMin: 7 * 60, bedBoundMin: 24 * 60,
      });
      expect(c.minStartMin).toBe(7 * 60);
    });
  });

  describe("maxPrevSpillMin", () => {
    it("is full pre-midnight portion for top-edge cross-day blocks", () => {
      // Block at 23:00 prev-day → 01:00, origStartMin = -60
      const c = computeConstraints({
        isTopEdge: true, sourceSpansNextDay: false,
        origStartMin: -60, origDurMin: 120,
        prevDayCapacity: 0, nextDayCapacity: 0,
        wakeBoundMin: 0, bedBoundMin: 24 * 60,
      });
      expect(c.maxPrevSpillMin).toBe(Math.abs(-60) + 120); // 180
    });
  });
});

/* ── spill-path previewStart cap ── */

describe("spill-path previewStart cap", () => {
  it("never exceeds dayEndMin - SNAP (block can't vanish)", () => {
    const origStartMin = 1320;           // 22:00
    const origDurMin   = 240;            // 4h block → 22:00–02:00
    const maxNextSpillMin = 240;
    for (const rawDelta of [0, 30, 60, 120, 240, 480]) {
      const ps = computeSpillPreviewStart(rawDelta, origStartMin, origDurMin, maxNextSpillMin);
      expect(ps).toBeLessThanOrEqual(24 * 60 - SNAP);
    }
  });

  it("keeps at least SNAP minutes visible in the current day", () => {
    const origStartMin = 1380;           // 23:00
    const origDurMin   = 60;             // 1h block
    const maxNextSpillMin = 60;
    // Drag far past midnight
    const ps = computeSpillPreviewStart(120, origStartMin, origDurMin, maxNextSpillMin);
    const visibleStart = Math.max(0, ps);
    const visibleEnd   = Math.min(24 * 60, ps + origDurMin);
    expect(visibleEnd - visibleStart).toBeGreaterThanOrEqual(SNAP);
  });

  it("equals dayEndMin - origDurMin + clampedSpill when clampedSpill is small", () => {
    // Block at 23:00-00:00 → need rawDeltaMin > 60 for spillMin > 0
    const origStartMin = 1380;           // 23:00
    const origDurMin   = 60;             // → ends at 00:00
    const maxNextSpillMin = 60;
    // rawDeltaMin=70: rawEnd = 1380+70+60 = 1510, spillMin = 1510-1440 = 70
    // clampedSpill = min(70, 60) = 60
    // previewStart = min(1425, 1380+60 = 1440) = 1425
    const ps = computeSpillPreviewStart(70, origStartMin, origDurMin, maxNextSpillMin);
    expect(ps).toBe(1425);               // 23:45 (capped at SNAP)
    expect(ps).toBeLessThanOrEqual(24 * 60 - SNAP);
  });

  it("no cap interference when clampedSpill keeps previewStart well before SNAP limit", () => {
    const origStartMin = 1380;
    const origDurMin   = 60;
    const maxNextSpillMin = 60;
    // rawDeltaMin=20 → spillMin = 20, clampedSpill = 20
    // previewStart = 1380 + 20 = 1400, which is < 1425
    const ps = computeSpillPreviewStart(20, origStartMin, origDurMin, maxNextSpillMin);
    expect(ps).toBe(1400);
  });
});

/* ── cascade overflow stop ── */

describe("cascade overflow stop", () => {
  function makePositions(tops: number[], height = 64) {
    return tops.map(t => ({ top: t, height }));
  }

  it("stops cascade when next block would overflow past timelineContentHeight", () => {
    const positions = makePositions([100, 168, 236]); // 3 blocks, each 64px
    const tch = 236 + 64; // 300 → last block ends exactly at boundary
    // dragTop=160 → cursor = 160+64+4 = 228
    const result = cascadePositions(positions, 0, 160, 64, tch);
    // Block 1 (168): 168 < 228 → push to 228 → bottom = 228+64 = 292 ≤ 300 ✓
    // cursor = 292+4 = 296
    // Block 2 (236): 236 < 296? Yes → newBottom = 296+64 = 360 > 300 → STOP
    expect(result[1].top).toBe(228);
    expect(result[2].top).toBe(236); // untouched
  });

  it("does not push blocks past timelineContentHeight even for large drags", () => {
    const positions = makePositions([100, 168, 236]);
    const tch = 236 + 64; // 300
    const result = cascadePositions(positions, 0, 300, 64, tch);
    // Dragged block at 300, cursor = 300+64+4 = 368
    // Block 1: 168 < 368, newBottom = 368+64 = 432 > 300 → STOP immediately
    expect(result[1].top).toBe(168); // untouched
    expect(result[2].top).toBe(236);
  });

  it("preserves heights of pushed blocks (no re-inflation)", () => {
    const positions = makePositions([100, 168, 236]);
    const tch = 236 + 64;
    const result = cascadePositions(positions, 0, 160, 64, tch);
    // Block 1 pushed: height should stay 64
    expect(result[1].height).toBe(64);
    // Block 2 not pushed: height stays 64
    expect(result[2].height).toBe(64);
  });

  it("handles blocks with varying heights correctly", () => {
    const positions = [
      { top: 100, height: 60 },
      { top: 164, height: 80 },
      { top: 248, height: 50 },
    ];
    const tch = 248 + 50; // 298
    const result = cascadePositions(positions, 0, 150, 60, tch);
    // Cursor = 150+60+4 = 214
    // Block 1: 164 < 214, newBottom = 214+80 = 294 ≤ 298 ✓
    // Cursor = 294+4 = 298
    // Block 2: 248 < 298, newBottom = 298+50 = 348 > 298 → STOP
    expect(result[1].top).toBe(214);
    expect(result[2].top).toBe(248); // untouched
  });

  it("returns original positions when no overlap (cascade does not trigger)", () => {
    const positions = makePositions([100, 200, 300]);
    const tch = 400;
    // Dragged block at 120 (only 20px down), cursor = 120+64+4 = 188
    // Block 1: 200 > 188, no overlap → break
    const result = cascadePositions(positions, 0, 120, 64, tch);
    expect(result[1].top).toBe(200);
    expect(result[2].top).toBe(300);
  });
});
