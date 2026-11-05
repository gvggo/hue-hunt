import fs from "fs"; import vm from "vm"; import assert from "assert/strict";
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL("../logic.js", import.meta.url), "utf8"), ctx);
const H = ctx.HueHunt; let n = 0; const t = (name, fn) => { fn(); n++; console.log("  ✓", name); };

t("day numbering starts at 1 on epoch", () => { assert.equal(H.dayNumber("2026-11-05"), 1); assert.equal(H.dayNumber("2026-11-06"), 2); assert.equal(H.dayNumber("2027-11-05"), 366); });
t("daily color is deterministic and differs by day", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(H.colorForSeed("2026-11-05"))), JSON.parse(JSON.stringify(H.colorForSeed("2026-11-05"))));
  assert.notDeepEqual(JSON.parse(JSON.stringify(H.colorForSeed("2026-11-05"))), JSON.parse(JSON.stringify(H.colorForSeed("2026-11-06"))));
});
t("daily colors stay within playable ranges", () => {
  for (let i = 0; i < 2000; i++) { const c = H.colorForSeed("d" + i); assert.ok(c.h >= 0 && c.h < 360 && c.s >= 35 && c.s <= 95 && c.l >= 28 && c.l <= 72); }
});
t("hslToRgb known values", () => {
  assert.deepEqual([...H.hslToRgb({ h: 0, s: 100, l: 50 })], [255, 0, 0]);
  assert.deepEqual([...H.hslToRgb({ h: 120, s: 100, l: 50 })], [0, 255, 0]);
  assert.deepEqual([...H.hslToRgb({ h: 0, s: 0, l: 100 })], [255, 255, 255]);
  assert.equal(H.hex({ h: 240, s: 100, l: 50 }), "#0000ff");
});
t("identical color scores 100, far color scores low", () => {
  const c = { h: 200, s: 60, l: 50 };
  assert.equal(H.score(c, c), 100);
  assert.ok(H.score(c, { h: 20, s: 60, l: 50 }) < 30);
});
t("hue difference wraps around the wheel", () => {
  assert.equal(H.hueDiff(10, 350), 20); assert.equal(H.hueDiff(350, 10), -20); assert.equal(H.hueDiff(90, 90), 0);
});
t("feedback tiers and directions", () => {
  const f = H.feedback({ h: 100, s: 50, l: 50 }, { h: 60, s: 48, l: 40 });
  assert.equal(f.h.tier, 0); assert.equal(f.h.dir, 1); assert.equal(f.s.tier, 2); assert.equal(f.s.dir, 0); assert.equal(f.l.tier, 1); assert.equal(f.l.dir, 1);
});
t("share text format", () => {
  const g = [{ h: { tier: 0 }, s: { tier: 1 }, l: { tier: 2 }, score: 61 }, { h: { tier: 2 }, s: { tier: 2 }, l: { tier: 2 }, score: 97 }];
  assert.equal(H.shareText(3, g, true, 4), "Hue Hunt #3 2/6 🔥4\n⬛🟨🟩 61%\n🟩🟩🟩 97%");
  assert.ok(H.shareText(3, g.slice(0, 1), false, 0).startsWith("Hue Hunt #3 X/6"));
});
t("streaks: consecutive wins grow, gaps and losses reset, replays ignored", () => {
  let s = H.recordResult(null, 1, true, 3); assert.equal(s.streak, 1);
  s = H.recordResult(s, 2, true, 2); assert.equal(s.streak, 2); assert.equal(s.maxStreak, 2);
  const again = H.recordResult(s, 2, true, 1); assert.equal(again.played, 2);
  s = H.recordResult(s, 4, true, 4); assert.equal(s.streak, 1);
  s = H.recordResult(s, 5, false, 6); assert.equal(s.streak, 0); assert.equal(s.played, 4); assert.equal(s.wins, 3);
  assert.deepEqual([...s.dist], [0, 1, 1, 1, 0, 0]);
});
t("current streak expires after a missed day", () => {
  const s = { streak: 5, lastWinDay: 10 }; assert.equal(H.currentStreak(s, 11), 5); assert.equal(H.currentStreak(s, 12), 0);
});
t("game is winnable: exact match within slider steps", () => {
  for (let i = 0; i < 200; i++) { const c = H.colorForSeed("w" + i); assert.ok(H.score(c, { ...c }) >= H.WIN_SCORE); }
});
console.log(`\nhue-hunt: ${n} tests passed`);
