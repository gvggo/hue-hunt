/* Hue Hunt core logic — pure functions, no DOM. */
(function (root) {
  const EPOCH = "2026-11-05"; // Puzzle #1
  const MAX_GUESSES = 6;
  const WIN_SCORE = 90;

  function localDateKey(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function dayNumber(key) {
    const [y, m, d] = key.split("-").map(Number);
    const [ey, em, ed] = EPOCH.split("-").map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000) + 1;
  }
  function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function colorForSeed(seedStr) {
    const r = mulberry32(hashString("huehunt:" + seedStr));
    return { h: Math.floor(r() * 360), s: 35 + Math.floor(r() * 61), l: 28 + Math.floor(r() * 45) };
  }
  function hslToRgb({ h, s, l }) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }
  function rgbToLab([r, g, b]) {
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const R = lin(r), G = lin(g), B = lin(b);
    let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    let y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
    let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  function deltaE(c1, c2) {
    const a = rgbToLab(hslToRgb(c1)), b = rgbToLab(hslToRgb(c2));
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }
  function score(target, guess) {
    return Math.max(0, Math.round(100 - deltaE(target, guess) * 1.2));
  }
  function hueDiff(target, guess) { // signed shortest distance guess->target
    let d = ((target - guess) % 360 + 540) % 360 - 180;
    return d === -180 ? 180 : d;
  }
  // Per-channel feedback: tier 2 = close, 1 = near, 0 = far; dir = which way to move
  function feedback(target, guess) {
    const dh = hueDiff(target.h, guess.h), ds = target.s - guess.s, dl = target.l - guess.l;
    const tier = (d, close, near) => (Math.abs(d) <= close ? 2 : Math.abs(d) <= near ? 1 : 0);
    const dir = (d, close) => (Math.abs(d) <= close ? 0 : d > 0 ? 1 : -1);
    return {
      h: { tier: tier(dh, 6, 20), dir: dir(dh, 6) },
      s: { tier: tier(ds, 6, 16), dir: dir(ds, 6) },
      l: { tier: tier(dl, 4, 12), dir: dir(dl, 4) },
      score: score(target, guess)
    };
  }
  const TILE = ["⬛", "🟨", "🟩"];
  function shareText(num, guesses, won, streak) {
    const rows = guesses.map((g) => TILE[g.h.tier] + TILE[g.s.tier] + TILE[g.l.tier] + " " + g.score + "%");
    const head = `Hue Hunt #${num} ${won ? guesses.length : "X"}/${MAX_GUESSES}` + (streak > 1 ? ` 🔥${streak}` : "");
    return head + "\n" + rows.join("\n");
  }
  // Streak bookkeeping. stats = {played,wins,streak,maxStreak,lastWinDay,lastPlayedDay,dist:[...]}
  function recordResult(stats, day, won, guessCount) {
    const s = Object.assign({ played: 0, wins: 0, streak: 0, maxStreak: 0, lastWinDay: null, lastPlayedDay: null, dist: [0, 0, 0, 0, 0, 0] }, stats || {});
    s.dist = (s.dist || [0, 0, 0, 0, 0, 0]).slice();
    if (s.lastPlayedDay === day) return s; // already counted
    s.played++;
    s.lastPlayedDay = day;
    if (won) {
      s.wins++;
      s.streak = s.lastWinDay === day - 1 ? s.streak + 1 : 1;
      s.lastWinDay = day;
      s.maxStreak = Math.max(s.maxStreak, s.streak);
      s.dist[guessCount - 1]++;
    } else {
      s.streak = 0;
    }
    return s;
  }
  function currentStreak(stats, today) {
    if (!stats || !stats.lastWinDay) return 0;
    return stats.lastWinDay >= today - 1 ? stats.streak : 0;
  }
  function hex(c) { return "#" + hslToRgb(c).map((v) => v.toString(16).padStart(2, "0")).join(""); }

  root.HueHunt = { EPOCH, MAX_GUESSES, WIN_SCORE, localDateKey, dayNumber, hashString, mulberry32, colorForSeed, hslToRgb, rgbToLab, deltaE, score, hueDiff, feedback, shareText, recordResult, currentStreak, hex };
})(typeof window !== "undefined" ? window : globalThis);
