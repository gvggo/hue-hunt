(function () {
  const H = window.HueHunt;
  const $ = (id) => document.getElementById(id);
  const STORE = "huehunt:v1";
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } };
  const save = (d) => localStorage.setItem(STORE, JSON.stringify(d));

  let data = load();
  data.stats = data.stats || null;
  let mode = "daily";
  let todayKey, dayNum, target, guesses, done, won;

  function css(c) { return `hsl(${c.h} ${c.s}% ${c.l}%)`; }
  function current() { return { h: +$("h").value, s: +$("s").value, l: +$("l").value }; }

  function paintSliders() {
    const c = current();
    $("s").style.background = `linear-gradient(90deg,hsl(${c.h} 0% ${c.l}%),hsl(${c.h} 100% ${c.l}%))`;
    $("l").style.background = `linear-gradient(90deg,#000,hsl(${c.h} ${c.s}% 50%),#fff)`;
    $("mine").style.background = css(c);
  }

  function startDaily() {
    mode = "daily";
    todayKey = H.localDateKey(new Date());
    dayNum = H.dayNumber(todayKey);
    target = H.colorForSeed(todayKey);
    const saved = data.daily && data.daily.key === todayKey ? data.daily : null;
    guesses = saved ? saved.guesses : [];
    $("subtitle").textContent = `Daily #${dayNum} · ${todayKey}`;
    resetSliders(saved && saved.guesses.length ? saved.guesses[saved.guesses.length - 1].c : null);
    evaluateState();
    render();
  }
  function startPractice() {
    mode = "practice";
    target = H.colorForSeed("practice:" + Date.now() + ":" + Math.random());
    guesses = [];
    $("subtitle").textContent = "Practice — unlimited, doesn't affect your streak";
    resetSliders(null);
    evaluateState();
    render();
  }
  function resetSliders(c) {
    const s = c || { h: 180, s: 50, l: 50 };
    $("h").value = s.h; $("s").value = s.s; $("l").value = s.l;
    paintSliders();
  }
  function evaluateState() {
    won = guesses.some((g) => g.score >= H.WIN_SCORE);
    done = won || guesses.length >= H.MAX_GUESSES;
  }

  function arrow(ch, dir) {
    if (dir === 0) return "✓";
    if (ch === "h") return dir > 0 ? "↻" : "↺";
    return dir > 0 ? "↑" : "↓";
  }

  function render() {
    $("target").style.background = css(target);
    const left = H.MAX_GUESSES - guesses.length;
    $("left").textContent = done ? (won ? "Solved!" : "Out of guesses") : `${left} guess${left === 1 ? "" : "es"} left`;
    $("guessBtn").disabled = done;
    ["h", "s", "l"].forEach((id) => ($(id).disabled = done));
    const hist = $("history");
    if (!guesses.length) {
      hist.innerHTML = '<p class="hint">Drag the sliders until your mix matches the target, then hit Guess. Arrows tell you which way to move.</p>';
    } else {
      hist.innerHTML = "";
      guesses.forEach((g, i) => {
        const row = document.createElement("div");
        row.className = "guess";
        row.innerHTML = `<div class="chip" style="background:${css(g.c)}"></div>
          <div class="tiles">
            <span class="tile t${g.h.tier}">Hue ${arrow("h", g.h.dir)}</span>
            <span class="tile t${g.s.tier}">Sat ${arrow("s", g.s.dir)}</span>
            <span class="tile t${g.l.tier}">Light ${arrow("l", g.l.dir)}</span>
          </div><span class="pct">${g.score}%</span>`;
        row.title = `Guess ${i + 1}`;
        hist.appendChild(row);
      });
    }
    const res = $("result");
    res.hidden = !done;
    if (done) {
      const best = Math.max(...guesses.map((g) => g.score));
      $("resultTitle").textContent = won ? (guesses.length <= 2 ? "Color genius! 🤯" : "Nailed it! 🎉") : "So close… 🫠";
      $("resultText").textContent = `The color was ${H.hex(target).toUpperCase()}. Best match: ${best}%.` + (mode === "daily" ? "" : " (practice)");
      const streak = mode === "daily" ? H.currentStreak(data.stats, dayNum) : 0;
      $("sharePreview").textContent = shareText(streak);
      $("againBtn").hidden = mode !== "practice";
      tickCountdown();
    }
  }
  function shareText(streak) {
    if (mode === "daily") return H.shareText(dayNum, guesses, won, streak);
    return H.shareText(0, guesses, won, 0).replace("Hue Hunt #0", "Hue Hunt (practice)");
  }

  function guess() {
    if (done) return;
    const c = current();
    const fb = H.feedback(target, c);
    guesses.push({ c, h: fb.h, s: fb.s, l: fb.l, score: fb.score });
    evaluateState();
    if (mode === "daily") {
      data.daily = { key: todayKey, guesses };
      if (done) data.stats = H.recordResult(data.stats, dayNum, won, guesses.length);
      save(data);
    }
    render();
  }

  async function share() {
    const text = $("sharePreview").textContent + "\nhttps://gvggo.github.io/hue-hunt/";
    try {
      if (navigator.share) { await navigator.share({ title: "Hue Hunt", text }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); toast("Result copied — paste it anywhere!"); }
    catch { toast("Couldn't copy automatically — select the text above."); }
  }
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2200); }

  function tickCountdown() {
    if (mode !== "daily") { $("countdown").textContent = ""; return; }
    const now = new Date(), next = new Date(now); next.setHours(24, 0, 0, 0);
    const ms = next - now, h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4);
    $("countdown").textContent = `Next color in ${h}h ${m}m`;
  }

  function renderStats() {
    const s = data.stats || { played: 0, wins: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0] };
    const cur = H.currentStreak(s, H.dayNumber(H.localDateKey(new Date())));
    const pct = s.played ? Math.round((s.wins / s.played) * 100) : 0;
    const max = Math.max(1, ...s.dist);
    $("statsBody").innerHTML = `<div class="statgrid"><div><b>${s.played}</b><span>Played</span></div><div><b>${pct}</b><span>Win %</span></div><div><b>${cur}</b><span>Streak</span></div><div><b>${s.maxStreak || 0}</b><span>Best</span></div></div>` +
      s.dist.map((n, i) => `<div class="bar">${i + 1}<i style="width:${(n / max) * 85}%"></i>${n}</div>`).join("");
  }

  ["h", "s", "l"].forEach((id) => $(id).addEventListener("input", paintSliders));
  $("guessBtn").addEventListener("click", guess);
  $("shareBtn").addEventListener("click", share);
  $("againBtn").addEventListener("click", startPractice);
  $("helpBtn").addEventListener("click", () => $("help").showModal());
  $("statsBtn").addEventListener("click", () => { renderStats(); $("stats").showModal(); });
  document.querySelectorAll(".mode").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".mode").forEach((x) => x.classList.toggle("active", x === b));
    b.dataset.mode === "daily" ? startDaily() : startPractice();
  }));
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" && !done && !document.querySelector("dialog[open]")) guess(); });
  setInterval(tickCountdown, 30000);

  startDaily();
  if (!data.seenHelp) { data.seenHelp = true; save(data); $("help").showModal(); }
})();
