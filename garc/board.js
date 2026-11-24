/*
Author: Claude Sonnet 5.5
Date: 24-November-2026
PURPOSE: Draws the GARC leaderboard board from data/board.json (built by tools/leaderboard/board.py): team panel,
  standings with medal lines and movers, best-score-over-time step chart, and the turnaround table. All text is
  inserted with textContent so a team name can never inject markup. Shows plainly when a thing cannot be measured yet.
SRP/DRY check: Pass - no data logic beyond formatting; every number is computed in board.py.
*/
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);

  function el(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined && text !== null) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function cell(text, cls) { return el("td", text, cls); }
  function head(table, cols) {
    const tr = el("tr");
    cols.forEach(([t, cls]) => tr.appendChild(el("th", t, cls)));
    table.appendChild(el("thead")).appendChild(tr);
  }
  function minutes(m) {
    if (m === null || m === undefined) return "n/a";
    const h = Math.floor(m / 60);
    return h ? `${h} h ${m % 60} min` : `${m} min`;
  }
  function utc(s) { return s ? s.replace("T", " ").replace("Z", "").slice(0, 16) + " UTC" : "n/a"; }
  function sub(s) { return s ? s.slice(0, 16) + " UTC" : "n/a"; }
  function moved(s) {
    if (s.new_since_prev) return ["new", ""];
    if (s.moved === null) return ["-", ""];
    if (s.moved > 0) return ["+" + s.moved, "up"];
    if (s.moved < 0) return [String(s.moved), "down"];
    return ["=", ""];
  }

  function drawTeam(b) {
    const body = $("team-body");
    const tp = b.team_panel;
    const p = el("div", null, "panel");
    const kv = el("dl", null, "kv");
    [["Submissions used", `${tp.team_used} of ${tp.allowance} allowed so far (day ${tp.day}, cap ${tp.daily_cap} a day); planned line ${tp.planned_line}`],
     ["Merge deadline", tp.merge_deadline || "unverified (Kaggle's Timeline page shows an unfilled placeholder)"]]
      .forEach(([k, v]) => { kv.appendChild(el("dt", k)); kv.appendChild(el("dd", v)); });
    p.appendChild(kv);
    tp.warnings.filter((w) => w.startsWith("WARN")).forEach((w) => p.appendChild(el("p", w, "warn")));
    body.appendChild(p);

    const people = el("table");
    head(people, [["Person"], ["Used", "n"], ["Today", "n"], ["Fair share", "n"], ["On the board"], ["Rank", "n"], ["Score", "n"]]);
    tp.people.forEach((x) => {
      const tr = el("tr");
      tr.append(cell(x.person), cell(x.used, "n"), cell(x.today, "n"), cell(x.share, "n"),
        cell(x.on_board ? "yes" : "no entry matched"), cell(x.rank ?? "-", "n"), cell(x.score ?? "-", "n"));
      people.appendChild(tr);
    });
    body.appendChild(people);

    body.appendChild(el("h3", "Our submissions", "sub"));
    const t = el("table");
    head(t, [["Person"], ["Submitted"], ["Kaggle status"], ["Score", "n"], ["Rank", "n"], ["Turnaround"], ["Note"]]);
    tp.rows.forEach((r) => {
      const ta = r.turnaround;
      let tt;
      if (ta.kind === "measured") tt = `${minutes(ta.minutes)} (first seen ${utc(ta.first_seen)})`;
      else if (ta.kind === "not_measurable") tt = `not measurable: first looked ${minutes(ta.upper_bound_min)} after submit, already scored`;
      else tt = ta.why;
      const tr = el("tr");
      tr.append(cell(r.person), cell(sub(r.submitted_at)), cell(r.kaggle_status || "not read"), cell(r.kaggle_score ?? r.ledger_score ?? "-", "n"),
        cell(r.rank ?? "-", "n"), cell(tt, "wrap"), cell(r.note, "wrap"));
      t.appendChild(tr);
    });
    body.appendChild(el("div", null, "scroll")).appendChild(t);
  }

  function drawStandings(b) {
    const m = b.medals;
    $("medal-note").textContent = `${m.teams} teams. Medal lines (${m.verified ? "verified" : "UNVERIFIED"}): gold to rank ${m.bands.gold}, silver to ${m.bands.silver}, bronze to ${m.bands.bronze}. ${m.note}`;
    const table = $("standings-table");
    const render = () => {
      const limit = parseInt($("rows").value, 10);
      table.replaceChildren();
      head(table, [["#", "n"], ["Move", "n"], ["Team"], ["Score", "n"], ["Entries", "n"], ["Entry behind score"]]);
      const rows = b.standings.filter((s, i) => !limit || i < limit || s.ours);
      rows.forEach((s) => {
        const tr = el("tr");
        const cls = [s.band || "", s.ours ? "ours" : "",
          (s.rank === m.bands.gold || s.rank === m.bands.silver || s.rank === m.bands.bronze) ? "line" : ""].filter(Boolean);
        tr.className = cls.join(" ");
        const [mv, mcls] = moved(s);
        tr.append(cell(s.rank, "n"), cell(mv, "n " + mcls), cell(s.team + (s.ours ? "  (ours)" : "")), cell(s.score, "n"), cell(s.entries, "n"), cell(sub(s.last_entry)));
        table.appendChild(tr);
      });
    };
    $("rows").addEventListener("change", render);
    render();
  }

  function drawFrontier(b) {
    const f = b.frontier;
    const table = $("frontier-table");
    head(table, [["Submitted"], ["Best so far", "n"], ["Team"]]);
    f.forEach((x) => { const tr = el("tr"); tr.append(cell(sub(x.at)), cell(x.score, "n"), cell(x.team)); table.appendChild(tr); });
    if (f.length < 2) return;
    const W = 720, H = 220, L = 46, R = 12, T = 12, B = 28;
    const toMs = (s) => Date.parse(s.replace(" ", "T") + "Z");
    const t0 = toMs(f[0].at), t1 = Math.max(toMs(f[f.length - 1].at), t0 + 3600e3);
    const lo = Math.min(...f.map((x) => x.score)) * 0.9, hi = f[f.length - 1].score * 1.05;
    const X = (s) => L + ((toMs(s) - t0) / (t1 - t0)) * (W - L - R);
    const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const add = (tag, attrs, text) => {
      const e = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      if (text) e.textContent = text;
      svg.appendChild(e);
    };
    let d = `M ${X(f[0].at)} ${Y(f[0].score)}`;
    f.slice(1).forEach((x, i) => { d += ` H ${X(x.at)} V ${Y(x.score)}`; });
    d += ` H ${W - R}`;
    add("path", { d, fill: "none", stroke: "#1d4d3b", "stroke-width": 2 });
    f.forEach((x) => add("circle", { cx: X(x.at), cy: Y(x.score), r: 3.5, fill: "#1d4d3b" }));
    add("text", { x: 4, y: Y(hi) + 4 }, hi.toFixed(2));
    add("text", { x: 4, y: Y(lo) + 4 }, lo.toFixed(2));
    add("text", { x: L, y: H - 8 }, sub(f[0].at));
    add("text", { x: W - R, y: H - 8, "text-anchor": "end" }, sub(f[f.length - 1].at));
    $("chart").appendChild(svg);
  }

  function drawTurnaround(b) {
    const body = $("turnaround-body");
    const ta = b.turnaround;
    body.appendChild(el("p", ta.method, "note"));
    body.appendChild(el("p", `${ta.baseline_entries_excluded} entries were already on the board at the first snapshot, so their turnaround cannot be known and is not shown.`, "note"));
    if (!ta.measured.length) {
      body.appendChild(el("p", "No turnaround is measured yet. It needs at least two snapshots; the first one only sets the baseline."));
      return;
    }
    body.appendChild(el("p", `Median ${minutes(ta.median_min)} over ${ta.measured.length} measured entries.`));
    const t = el("table");
    head(t, [["Team"], ["Submitted"], ["First seen scored"], ["Turnaround", "n"], ["Score", "n"]]);
    ta.measured.forEach((x) => {
      const tr = el("tr");
      tr.append(cell(x.team), cell(sub(x.sub_at)), cell(utc(x.first_seen)), cell(minutes(x.minutes), "n"), cell(x.score, "n"));
      t.appendChild(tr);
    });
    body.appendChild(el("div", null, "scroll")).appendChild(t);
  }

  fetch("data/board.json").then((r) => { if (!r.ok) throw new Error("board.json " + r.status); return r.json(); }).then((b) => {
    const ours = new Set(b.team_panel.people.map((p) => p.person));
    b.standings.forEach((s) => { s.ours = s.members.some((m) => ours.has(m)); });
    $("stamp").textContent = `Snapshot taken ${utc(b.built_for)}. ${b.snapshots.length} snapshot${b.snapshots.length === 1 ? "" : "s"} so far.`;
    $("live-note").textContent = b.live_note;
    drawTeam(b); drawStandings(b); drawFrontier(b); drawTurnaround(b);
    $("footer").textContent = `Competition: ${b.kaggle_url}. Times are UTC. Data: public leaderboard download plus our own submission ledger.`;
  }).catch((e) => { $("stamp").textContent = "Could not load data/board.json: " + e.message; });
})();
