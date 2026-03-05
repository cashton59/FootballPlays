import { useState, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const CW = 630, CH = 470, PR = 13;
let _uid = 200;
const uid = () => ++_uid;

const STORAGE_KEY = "fpc-plays";

const PALETTE = [
  { hex: "#ef4444", name: "Red" },
  { hex: "#60a5fa", name: "Blue" },
  { hex: "#4ade80", name: "Green" },
  { hex: "#fbbf24", name: "Amber" },
  { hex: "#c084fc", name: "Purple" },
  { hex: "#fb923c", name: "Orange" },
  { hex: "#f472b6", name: "Pink" },
  { hex: "#1e293b", name: "Black" },
];

const FINISHERS = [
  { id: "arrow", label: "Arrow →", desc: "Continue running" },
  { id: "tbar",  label: "Stop ⊣",  desc: "Break / stop" },
  { id: "dot",   label: "Dot ●",   desc: "Settle / option" },
  { id: "none",  label: "None —",  desc: "No marker" },
];

const TOOLS = [
  { id: "select",   icon: "↖", label: "Select / Move" },
  { id: "place",    icon: "⊕", label: "Place Player" },
  { id: "straight", icon: "━", label: "Straight Route" },
  { id: "dashed",   icon: "╌", label: "Dashed Route" },
  { id: "curved",   icon: "⌒", label: "Curved Route" },
  { id: "erase",    icon: "✕", label: "Erase" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Canvas drawing helpers
// ─────────────────────────────────────────────────────────────────────────────
function catmullRomPath(ctx, pts) {
  if (pts.length < 2) return 0;
  const p = [pts[0], ...pts, pts[pts.length - 1]];
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = p[i], p1 = p[i + 1], p2 = p[i + 2], p3 = p[i + 3];
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
  const n = pts.length;
  const pp0 = p[n - 1], pp1 = p[n], pp2 = p[n + 1];
  const cp2x = pp1.x - (pp2.x - pp0.x) / 6, cp2y = pp1.y - (pp2.y - pp0.y) / 6;
  return Math.atan2(pp1.y - cp2y, pp1.x - cp2x);
}

function drawFinisher(ctx, x, y, angle, type) {
  if (type === "none") return;
  ctx.save();
  ctx.setLineDash([]);
  if (type === "arrow") {
    const L = 11, sp = Math.PI / 7;
    ctx.beginPath();
    ctx.moveTo(x - L * Math.cos(angle - sp), y - L * Math.sin(angle - sp));
    ctx.lineTo(x, y);
    ctx.lineTo(x - L * Math.cos(angle + sp), y - L * Math.sin(angle + sp));
    ctx.stroke();
  } else if (type === "tbar") {
    const len = 10, perp = angle + Math.PI / 2;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x + len * Math.cos(perp), y + len * Math.sin(perp));
    ctx.lineTo(x - len * Math.cos(perp), y - len * Math.sin(perp));
    ctx.stroke();
  } else if (type === "dot") {
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function paintField(ctx) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CW, CH);
  const YARD = 36, fs = 52;
  for (let i = 0; ; i++) {
    const y = fs + i * YARD;
    if (y > CH) break;
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(0,0,0,0.04)";
      ctx.fillRect(0, y, CW, Math.min(YARD, CH - y));
    }
  }
  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(0, 0, CW, fs);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(0, fs); ctx.lineTo(CW, fs); ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  for (let y = fs; y <= CH; y += YARD) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(4, CH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CW - 4, 0); ctx.lineTo(CW - 4, CH); ctx.stroke();
  const lH = CW * 0.32, rH = CW * 0.68;
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 1;
  for (let y = fs; y <= CH; y += YARD) {
    ctx.beginPath(); ctx.moveTo(lH - 6, y); ctx.lineTo(lH + 6, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rH - 6, y); ctx.lineTo(rH + 6, y); ctx.stroke();
  }
  const losY = CH - 130;
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(4, losY); ctx.lineTo(CW - 4, losY); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.font = "bold 9px 'Courier New',monospace";
  ctx.fillText("L·O·S", 8, losY - 4);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.font = "bold 12px 'Courier New',monospace";
  ctx.textAlign = "center";
  ctx.fillText("END ZONE", CW / 2, 31);
  ctx.textAlign = "left";
}

function paintLine(ctx, line, alpha = 1) {
  const { type, points, color, finisher = "arrow" } = line;
  if (!points || points.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color || "#000";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash(type === "dashed" ? [8, 5] : []);
  const last = points[points.length - 1];
  let endAngle = 0;
  if (type === "curved") {
    ctx.beginPath();
    endAngle = catmullRomPath(ctx, points);
    ctx.stroke();
  } else {
    const [a, b] = points;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    endAngle = Math.atan2(b.y - a.y, b.x - a.x);
  }
  ctx.setLineDash([]);
  drawFinisher(ctx, last.x, last.y, endAngle, finisher);
  ctx.restore();
}

function paintPlayer(ctx, p, highlighted = false) {
  ctx.save();
  if (highlighted) { ctx.shadowColor = "#333"; ctx.shadowBlur = 14; }
  ctx.fillStyle = p.color;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 2;
  if (p.shape === "circle") {
    ctx.beginPath(); ctx.arc(p.x, p.y, PR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    const s = PR * 1.15, r = 3;
    ctx.beginPath();
    ctx.moveTo(p.x - s + r, p.y - s); ctx.lineTo(p.x + s - r, p.y - s);
    ctx.arcTo(p.x + s, p.y - s, p.x + s, p.y - s + r, r); ctx.lineTo(p.x + s, p.y + s - r);
    ctx.arcTo(p.x + s, p.y + s, p.x + s - r, p.y + s, r); ctx.lineTo(p.x - s + r, p.y + s);
    ctx.arcTo(p.x - s, p.y + s, p.x - s, p.y + s - r, r); ctx.lineTo(p.x - s, p.y - s + r);
    ctx.arcTo(p.x - s, p.y - s, p.x - s + r, p.y - s, r);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function FootballPlayCreator() {
  const canvasRef = useRef(null);

  const [tool,         setTool]         = useState("select");
  const [shape,        setShape]        = useState("circle");
  const [playerColor,  setPlayerColor]  = useState(PALETTE[0].hex);
  const [lineColor,    setLineColor]    = useState("#1e293b");
  const [finisher,     setFinisher]     = useState("arrow");
  const [players,      setPlayers]      = useState([]);
  const [lines,        setLines]        = useState([]);
  const [playName,     setPlayName]     = useState("Play 1");
  const [plays,        setPlays]        = useState([]);
  const [storageReady, setStorageReady] = useState(false);
  const [printLayout,  setPrintLayout]  = useState("4");
  const [editingId,    setEditingId]    = useState(null);
  const [editingName,  setEditingName]  = useState("");
  const [statusMsg,    setStatusMsg]    = useState("");
  const [curvePts,     setCurvePts]     = useState(0);
  const [showPrint,    setShowPrint]    = useState(false);

  const is = useRef({
    tool: "select", shape: "circle",
    playerColor: PALETTE[0].hex, lineColor: "#1e293b", finisher: "arrow",
    players: [], lines: [],
    dragId: null, dragOx: 0, dragOy: 0,
    highlightId: null, eraseHoverId: null,
    tempLine: null, mouseDown: false, drawStart: null,
    curvePoints: [], curveActive: false,
  });
  const history = useRef([]);

  // ── localStorage: load on mount ──────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length > 0) {
          setPlays(saved);
          const last = saved[saved.length - 1];
          const n = parseInt(last.name.match(/(\d+)/)?.[1] || "1") + 1;
          setPlayName("Play " + n);
        }
      }
    } catch (_) {}
    setStorageReady(true);
  }, []);

  // ── localStorage: save whenever plays change ─────────────────────────────
  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plays));
    } catch (_) {}
  }, [plays, storageReady]);

  // ── Sync refs ─────────────────────────────────────────────────────────────
  useEffect(() => { is.current.tool = tool; }, [tool]);
  useEffect(() => { is.current.shape = shape; }, [shape]);
  useEffect(() => { is.current.playerColor = playerColor; }, [playerColor]);
  useEffect(() => { is.current.lineColor = lineColor; }, [lineColor]);
  useEffect(() => { is.current.finisher = finisher; }, [finisher]);
  useEffect(() => { is.current.players = players; }, [players]);
  useEffect(() => { is.current.lines = lines; }, [lines]);

  // ── Redraw ────────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const { players: ps, lines: ls, tempLine, highlightId } = is.current;
    paintField(ctx);
    ls.forEach(l => {
      const er = is.current.tool === "erase" && l.id === is.current.eraseHoverId;
      paintLine(ctx, er ? { ...l, color: "#ef4444" } : l, er ? 0.45 : 1);
    });
    if (tempLine) paintLine(ctx, tempLine, 0.5);
    if (is.current.curveActive) {
      const cp = is.current.curvePoints;
      cp.forEach((pt, i) => {
        ctx.save();
        ctx.fillStyle = i === 0 ? "#238636" : "#fbbf24";
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
      });
    }
    ps.forEach(p => {
      const er = is.current.tool === "erase" && p.id === is.current.eraseHoverId;
      paintPlayer(ctx, er ? { ...p, color: "#ef4444" } : p, p.id === highlightId);
    });
  }, []);

  useEffect(() => { redraw(); }, [players, lines, redraw]);

  // ── Print CSS injection ───────────────────────────────────────────────────
  useEffect(() => {
    const s = document.createElement("style");
    s.id = "fpc-print-css";
    s.textContent = `
      @page { size: landscape; margin: 0.3in; }
      @media print {
        body > * { display: none !important; }
        #fpc-print-overlay {
          display: flex !important; position: static !important;
          background: white !important; flex-direction: column;
        }
        .fpc-print-toolbar { display: none !important; }
        .fpc-print-scroller { overflow: visible !important; padding: 0 !important; gap: 0 !important; }
        .fpc-print-page {
          box-shadow: none !important; margin: 0 !important;
          width: 100% !important; min-height: unset !important;
          page-break-after: always; break-after: page;
        }
      }
    `;
    document.head.appendChild(s);
    return () => document.getElementById("fpc-print-css")?.remove();
  }, []);

  // ── Curve helpers ─────────────────────────────────────────────────────────
  const cancelCurve = useCallback(() => {
    is.current.curvePoints = [];
    is.current.curveActive = false;
    is.current.tempLine = null;
    setCurvePts(0);
    setStatusMsg("");
    redraw();
  }, [redraw]);

  const commitCurve = useCallback(() => {
    const cp = is.current.curvePoints;
    if (cp.length < 2) { cancelCurve(); return; }
    const nl = {
      id: uid(), type: "curved", points: [...cp],
      color: is.current.lineColor, finisher: is.current.finisher,
    };
    const ls2 = [...is.current.lines, nl];
    is.current.lines = ls2;
    is.current.curvePoints = [];
    is.current.curveActive = false;
    is.current.tempLine = null;
    setCurvePts(0);
    setLines(ls2);
    setStatusMsg("");
    redraw();
  }, [cancelCurve, redraw]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const h = e => {
      if (e.key === "Escape") { if (showPrint) setShowPrint(false); else cancelCurve(); }
      if (e.key === "Enter" && is.current.curveActive) { e.preventDefault(); commitCurve(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); doUndo(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelCurve, commitCurve, showPrint]);

  const pushHistory = () => {
    history.current = [
      ...history.current.slice(-24),
      { players: [...is.current.players], lines: [...is.current.lines] },
    ];
  };

  const doUndo = () => {
    if (!history.current.length) return;
    const prev = history.current.pop();
    is.current.players = prev.players;
    is.current.lines = prev.lines;
    setPlayers(prev.players);
    setLines(prev.lines);
  };

  // ── Canvas interaction ────────────────────────────────────────────────────
  const getPos = e => {
    const r = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (CW / r.width),
      y: (e.clientY - r.top)  * (CH / r.height),
    };
  };

  const playerAt = (x, y) => {
    const ps = is.current.players;
    for (let i = ps.length - 1; i >= 0; i--)
      if (Math.hypot(ps[i].x - x, ps[i].y - y) <= PR + 5) return ps[i];
  };

  const lineAt = (x, y) => {
    const THRESH = 8; let best = null, bestD = Infinity;
    for (const line of is.current.lines) {
      const pts = line.points; let d = Infinity;
      if (line.type === "curved" && pts.length >= 2) {
        const p = [pts[0], ...pts, pts[pts.length - 1]];
        for (let seg = 0; seg < pts.length - 1; seg++) {
          const p0 = p[seg], p1 = p[seg + 1], p2 = p[seg + 2], p3 = p[seg + 3];
          const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6;
          const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
          for (let t = 0; t <= 1; t += 0.04) {
            const u = 1 - t;
            const bx = u*u*u*p1.x + 3*u*u*t*cp1x + 3*u*t*t*cp2x + t*t*t*p2.x;
            const by = u*u*u*p1.y + 3*u*u*t*cp1y + 3*u*t*t*cp2y + t*t*t*p2.y;
            d = Math.min(d, Math.hypot(bx - x, by - y));
          }
        }
      } else if (pts.length >= 2) {
        const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
        const lenSq = dx * dx + dy * dy;
        const t2 = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - pts[0].x) * dx + (y - pts[0].y) * dy) / lenSq));
        d = Math.hypot(x - (pts[0].x + t2 * dx), y - (pts[0].y + t2 * dy));
      }
      if (d < THRESH && d < bestD) { bestD = d; best = line; }
    }
    return best;
  };

  const onDown = e => {
    const pos = getPos(e), s = is.current;
    if (s.tool === "erase") {
      const p = playerAt(pos.x, pos.y);
      if (p) { pushHistory(); const ps2 = s.players.filter(pp => pp.id !== p.id); s.players = ps2; setPlayers(ps2); redraw(); return; }
      const l = lineAt(pos.x, pos.y);
      if (l) { pushHistory(); const ls2 = s.lines.filter(ll => ll.id !== l.id); s.lines = ls2; setLines(ls2); redraw(); return; }
    } else if (s.tool === "select") {
      const p = playerAt(pos.x, pos.y);
      if (p) { s.dragId = p.id; s.dragOx = pos.x - p.x; s.dragOy = pos.y - p.y; s.highlightId = p.id; redraw(); }
    } else if (s.tool === "place") {
      pushHistory();
      const np = { id: uid(), x: pos.x, y: pos.y, shape: s.shape, color: s.playerColor };
      const ps2 = [...s.players, np]; s.players = ps2; setPlayers(ps2);
    } else if (s.tool === "straight" || s.tool === "dashed") {
      s.mouseDown = true; s.drawStart = pos;
    } else if (s.tool === "curved") {
      if (!s.curveActive) {
        s.curveActive = true; s.curvePoints = [pos]; setCurvePts(1);
        setStatusMsg("Click to add bends  •  Dbl-click or Enter to finish  •  ESC cancel");
        redraw();
      } else if (e.detail >= 2) {
        pushHistory(); commitCurve();
      } else {
        s.curvePoints = [...s.curvePoints, pos];
        const cnt = s.curvePoints.length; setCurvePts(cnt);
        if (cnt >= 7) { pushHistory(); commitCurve(); } else redraw();
      }
    }
  };

  const onMove = e => {
    const pos = getPos(e), s = is.current;
    if (s.tool === "erase") {
      const p = playerAt(pos.x, pos.y);
      s.eraseHoverId = p ? p.id : (lineAt(pos.x, pos.y)?.id ?? null);
      redraw(); return;
    }
    if (s.dragId) {
      s.players = s.players.map(p => p.id === s.dragId ? { ...p, x: pos.x - s.dragOx, y: pos.y - s.dragOy } : p);
      redraw();
    } else if ((s.tool === "straight" || s.tool === "dashed") && s.mouseDown && s.drawStart) {
      s.tempLine = { type: s.tool, points: [s.drawStart, pos], color: s.lineColor, finisher: s.finisher };
      redraw();
    } else if (s.tool === "curved" && s.curveActive && s.curvePoints.length >= 1) {
      const prev = [...s.curvePoints, pos];
      s.tempLine = prev.length >= 2
        ? { type: "curved", points: prev, color: s.lineColor, finisher: s.finisher }
        : { type: "straight", points: [s.curvePoints[0], pos], color: s.lineColor, finisher: "none" };
      redraw();
    }
  };

  const onUp = e => {
    const pos = getPos(e), s = is.current;
    if (s.dragId) {
      s.players = s.players.map(p => p.id === s.dragId ? { ...p, x: pos.x - s.dragOx, y: pos.y - s.dragOy } : p);
      s.dragId = null; s.highlightId = null; setPlayers([...s.players]);
    } else if ((s.tool === "straight" || s.tool === "dashed") && s.mouseDown) {
      const d = s.drawStart ? Math.hypot(pos.x - s.drawStart.x, pos.y - s.drawStart.y) : 0;
      if (d > 8) {
        pushHistory();
        const nl = { id: uid(), type: s.tool, points: [s.drawStart, pos], color: s.lineColor, finisher: s.finisher };
        const ls2 = [...s.lines, nl]; s.lines = ls2; setLines(ls2);
      }
      s.mouseDown = false; s.drawStart = null; s.tempLine = null; redraw();
    }
  };

  const onDblClick = e => {
    const s = is.current;
    if (s.tool === "curved") return;
    if (s.tool === "select") {
      const pos = getPos(e), p = playerAt(pos.x, pos.y);
      if (p) { pushHistory(); const ps2 = s.players.filter(pp => pp.id !== p.id); s.players = ps2; setPlayers(ps2); }
    }
  };

  // ── Play management ───────────────────────────────────────────────────────
  const savePlay = () => {
    const imgData = canvasRef.current.toDataURL("image/png");
    const snapshot = {
      players: JSON.parse(JSON.stringify(is.current.players)),
      lines:   JSON.parse(JSON.stringify(is.current.lines)),
    };
    setPlays(prev => [...prev, { id: uid(), name: playName, imgData, ...snapshot }]);
    const n = parseInt(playName.match(/(\d+)$/)?.[1] || "1") + 1;
    setPlayName("Play " + n);
  };

  const loadPlay = p => {
    cancelCurve();
    is.current.players = JSON.parse(JSON.stringify(p.players || []));
    is.current.lines   = JSON.parse(JSON.stringify(p.lines   || []));
    setPlayers(is.current.players);
    setLines(is.current.lines);
    setPlayName(p.name + " (edit)");
    history.current = [];
  };

  const duplicatePlay = p => {
    setPlays(prev => {
      const idx = prev.findIndex(pp => pp.id === p.id);
      const copy = { ...p, id: uid(), name: p.name + " (copy)" };
      const next = [...prev]; next.splice(idx + 1, 0, copy); return next;
    });
  };

  const clearAll = () => {
    cancelCurve();
    is.current.players = []; is.current.lines = [];
    setPlayers([]); setLines([]); history.current = [];
  };

  const exportPlays = () => {
    const json = JSON.stringify(plays, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "plays.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const importPlays = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const imported = JSON.parse(ev.target.result);
          if (!Array.isArray(imported)) { alert("Invalid plays.json file."); return; }
          // Merge: skip any whose id already exists
          setPlays(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const fresh = imported.filter(p => !existingIds.has(p.id));
            return [...prev, ...fresh];
          });
        } catch (_) { alert("Could not read file — make sure it's a valid plays.json."); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const switchTool = id => {
    if (id !== "curved") cancelCurve();
    is.current.eraseHoverId = null;
    setTool(id);
    redraw();
  };

  // ── Print layout ──────────────────────────────────────────────────────────
  const ppp = parseInt(printLayout);
  const printPages = [];
  for (let i = 0; i < plays.length; i += ppp) printPages.push(plays.slice(i, i + ppp));

  // ── Styles (inline, no Tailwind needed for the core UI) ───────────────────
  const bg = "#0d1117", panel = "#161b22", bdr = "#30363d";
  const accent = "#238636";
  const tp = "#f0f6fc", tm = "#b1bac4", td = "#6e7681";
  const secLabel = { fontSize: "10px", color: "#8b949e", letterSpacing: "1.2px", marginBottom: "7px", textTransform: "uppercase", fontWeight: "bold" };
  const btnBase = { display: "flex", alignItems: "center", gap: "7px", width: "100%", padding: "7px 10px", marginBottom: "3px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "'Courier New',monospace", textAlign: "left", transition: "all 0.12s", border: "none" };
  const isLineTool = ["straight", "dashed", "curved"].includes(tool);

  const toolTip = {
    select:   "Drag to move  •  Dbl-click to delete",
    place:    "Click field to place a player",
    straight: "Click & drag to draw a route",
    dashed:   "Click & drag to draw a motion route",
    curved:   is.current.curveActive
      ? `${curvePts} pt${curvePts !== 1 ? "s" : ""}  •  Dbl-click or Enter to finish`
      : "Click start → add bends → dbl-click finish",
    erase:    "Click any player or route to delete",
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: bg, color: tp, fontFamily: "'Courier New',monospace", overflow: "hidden", userSelect: "none" }}>

      {/* HEADER */}
      <header style={{ background: panel, borderBottom: `2px solid ${accent}`, padding: "0 16px", height: "50px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span style={{ fontSize: "22px" }}>🏈</span>
          <div>
            <div style={{ fontWeight: "bold", fontSize: "14px", letterSpacing: "3px", color: accent, textTransform: "uppercase", lineHeight: 1 }}>Play Creator</div>
            <div style={{ color: tm, fontSize: "10px", letterSpacing: "1.5px" }}>6-ON-6 FLAG FOOTBALL</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: tm, fontSize: "12px", flexShrink: 0 }}>Play Name:</span>
          <input value={playName} onChange={e => setPlayName(e.target.value)}
            style={{ background: "#0d1117", border: `1px solid ${bdr}`, color: tp, padding: "5px 10px", borderRadius: "6px", fontSize: "13px", width: "140px", outline: "none", fontFamily: "inherit" }} />
          <button onClick={savePlay} style={{ background: accent, color: "white", border: "none", padding: "6px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", flexShrink: 0 }}>+ SAVE PLAY</button>
          <button onClick={doUndo}   style={{ background: "transparent", color: tm, border: `1px solid ${bdr}`, padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", flexShrink: 0 }}>↩ UNDO</button>
          <button onClick={clearAll} style={{ background: "transparent", color: "#f85149", border: "1px solid #f85149", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", flexShrink: 0 }}>CLEAR</button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* LEFT SIDEBAR */}
        <aside style={{ width: "172px", background: panel, borderRight: `1px solid ${bdr}`, padding: "14px 10px", display: "flex", flexDirection: "column", gap: "12px", flexShrink: 0, overflowY: "auto" }}>
          <section>
            <div style={secLabel}>Tools</div>
            {TOOLS.map(t => (
              <button key={t.id} onClick={() => switchTool(t.id)}
                style={{ ...btnBase, background: tool === t.id ? (t.id === "erase" ? "#6e1a1a" : accent) : "transparent", color: tool === t.id ? "white" : t.id === "erase" ? "#f85149" : tm, border: `1px solid ${tool === t.id ? (t.id === "erase" ? "#f85149" : accent) : t.id === "erase" ? "#6e1a1a" : bdr}` }}>
                <span style={{ fontSize: "15px", width: "18px", textAlign: "center", flexShrink: 0 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </section>

          {tool === "place" && (
            <section>
              <div style={secLabel}>Player Shape</div>
              <div style={{ display: "flex", gap: "6px" }}>
                {[["circle", "●"], ["square", "■"]].map(([s, ic]) => (
                  <button key={s} onClick={() => setShape(s)}
                    style={{ flex: 1, padding: "7px 0", fontSize: "18px", background: shape === s ? "#1f6feb" : "transparent", color: shape === s ? "white" : tm, border: `1px solid ${shape === s ? "#1f6feb" : bdr}`, borderRadius: "6px", cursor: "pointer" }}>{ic}</button>
                ))}
              </div>
            </section>
          )}

          {tool === "place" && (
            <section>
              <div style={secLabel}>Player Color</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "6px" }}>
                {PALETTE.map(({ hex, name }) => (
                  <button key={hex} onClick={() => setPlayerColor(hex)} title={name}
                    style={{ width: "28px", height: "28px", borderRadius: "50%", background: hex, border: playerColor === hex ? "3px solid #f0f6fc" : `2px solid ${bdr}`, cursor: "pointer", boxSizing: "border-box", boxShadow: playerColor === hex ? `0 0 8px ${hex}99` : "none" }} />
                ))}
              </div>
            </section>
          )}

          {isLineTool && (
            <section>
              <div style={secLabel}>Route Color</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "6px" }}>
                {PALETTE.map(({ hex, name }) => (
                  <button key={hex} onClick={() => setLineColor(hex)} title={name}
                    style={{ width: "28px", height: "28px", borderRadius: "50%", background: hex, border: lineColor === hex ? "3px solid #f0f6fc" : `2px solid ${bdr}`, cursor: "pointer", boxSizing: "border-box", boxShadow: lineColor === hex ? `0 0 8px ${hex}99` : "none" }} />
                ))}
              </div>
            </section>
          )}

          {isLineTool && (
            <section>
              <div style={secLabel}>Route End</div>
              {FINISHERS.map(f => (
                <button key={f.id} onClick={() => setFinisher(f.id)}
                  style={{ ...btnBase, marginBottom: "4px", background: finisher === f.id ? "#1f3d4a" : "transparent", color: finisher === f.id ? "#7dd3fc" : tm, border: `1px solid ${finisher === f.id ? "#0ea5e9" : bdr}`, padding: "6px 8px", fontSize: "12px" }}>
                  <span style={{ width: "52px", flexShrink: 0, fontWeight: "bold" }}>{f.label}</span>
                  <span style={{ fontSize: "10px", color: finisher === f.id ? "#7dd3fc" : td }}>{f.desc}</span>
                </button>
              ))}
            </section>
          )}

          {tool === "curved" && is.current.curveActive && (
            <section style={{ background: "#192a19", borderRadius: "8px", padding: "10px", border: `1px solid ${accent}` }}>
              <div style={{ fontSize: "10px", color: accent, letterSpacing: "1px", marginBottom: "6px", fontWeight: "bold" }}>● DRAWING CURVE</div>
              <div style={{ fontSize: "12px", color: tp, marginBottom: "4px", fontWeight: "bold" }}>{curvePts} point{curvePts !== 1 ? "s" : ""}</div>
              <div style={{ fontSize: "11px", color: tm, lineHeight: "1.9", marginBottom: "8px" }}>Click → add bend<br />Dbl-click → finish<br />Enter → finish<br />ESC → cancel</div>
              <button onClick={() => { pushHistory(); commitCurve(); }} disabled={curvePts < 2}
                style={{ width: "100%", padding: "6px", background: curvePts >= 2 ? accent : "#21262d", color: curvePts >= 2 ? "white" : td, border: "none", borderRadius: "5px", cursor: curvePts >= 2 ? "pointer" : "default", fontSize: "12px", fontFamily: "inherit", fontWeight: "bold", marginBottom: "5px" }}>✓ Finish Route</button>
              <button onClick={cancelCurve}
                style={{ width: "100%", padding: "5px", background: "transparent", color: "#f85149", border: "1px solid #f85149", borderRadius: "5px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}>✕ Cancel</button>
            </section>
          )}

          <div style={{ marginTop: "auto", fontSize: "10px", color: tm, lineHeight: "1.8", borderTop: `1px solid ${bdr}`, paddingTop: "10px" }}>{toolTip[tool]}</div>
        </aside>

        {/* CANVAS */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0f14", position: "relative", padding: "16px", overflow: "hidden" }}>
          {statusMsg && (
            <div style={{ position: "absolute", top: "10px", left: "50%", transform: "translateX(-50%)", background: "#fbbf24", color: "#0d1117", padding: "5px 16px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", zIndex: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.5)", whiteSpace: "nowrap" }}>{statusMsg}</div>
          )}
          <canvas ref={canvasRef} width={CW} height={CH}
            style={{ cursor: tool === "select" ? "default" : tool === "erase" ? "not-allowed" : "crosshair", border: `1px solid ${bdr}`, borderRadius: "4px", boxShadow: `0 0 0 1px #1a6b2840,0 8px 48px rgba(0,0,0,0.7)`, maxWidth: "100%", maxHeight: "100%" }}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onDoubleClick={onDblClick} />
          <div style={{ marginTop: "10px", fontSize: "11px", color: tm, letterSpacing: "0.5px" }}>Ctrl+Z undo  •  LOS = dashed line  •  Endzone at top</div>
        </main>

        {/* RIGHT PANEL */}
        <aside style={{ width: "222px", background: panel, borderLeft: `1px solid ${bdr}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "11px 14px", borderBottom: `1px solid ${bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: tm, letterSpacing: "1px", textTransform: "uppercase", fontWeight: "bold" }}>Saved Plays</span>
            <span style={{ fontSize: "11px", background: "#30363d", color: tp, padding: "1px 9px", borderRadius: "20px", fontWeight: "bold" }}>{plays.length}</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {plays.length === 0 ? (
              <div style={{ color: tm, fontSize: "12px", textAlign: "center", marginTop: "28px", lineHeight: "2" }}>No plays saved yet.<br /><span style={{ color: td, fontSize: "11px" }}>Design a play and<br />click "+ SAVE PLAY"</span></div>
            ) : plays.map(p => (
              <div key={p.id} style={{ marginBottom: "10px", border: `1px solid ${bdr}`, borderRadius: "6px", overflow: "hidden", background: bg }}>
                {editingId === p.id ? (
                  <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)}
                    onBlur={() => { setPlays(prev => prev.map(pp => pp.id === p.id ? { ...pp, name: editingName || pp.name } : pp)); setEditingId(null); }}
                    onKeyDown={e => { if (e.key === "Enter") { setPlays(prev => prev.map(pp => pp.id === p.id ? { ...pp, name: editingName || pp.name } : pp)); setEditingId(null); } }}
                    style={{ width: "100%", background: accent, border: "none", color: "white", padding: "5px 8px", fontSize: "12px", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
                ) : (
                  <div style={{ padding: "5px 6px", background: "#1c2128", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "2px" }}>
                    <span title="Click to rename" onClick={() => { setEditingId(p.id); setEditingName(p.name); }}
                      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontSize: "12px", color: tp, cursor: "pointer", padding: "1px 2px" }}>{p.name}</span>
                    <button title="Load to canvas" onClick={() => loadPlay(p)} style={{ background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: "13px", padding: "1px 3px", lineHeight: 1, flexShrink: 0 }}>↙</button>
                    <button title="Duplicate"      onClick={() => duplicatePlay(p)} style={{ background: "transparent", border: "none", color: "#a3e635", cursor: "pointer", fontSize: "12px", padding: "1px 3px", lineHeight: 1, flexShrink: 0 }}>⧉</button>
                    <button title="Delete"         onClick={() => setPlays(prev => prev.filter(pp => pp.id !== p.id))} style={{ background: "transparent", border: "none", color: "#f85149", cursor: "pointer", fontSize: "15px", padding: "1px 3px", lineHeight: 1, flexShrink: 0 }}>×</button>
                  </div>
                )}
                <img src={p.imgData} alt={p.name} style={{ width: "100%", display: "block" }} />
              </div>
            ))}
          </div>

          <div style={{ padding: "12px 14px", borderTop: `1px solid ${bdr}` }}>
            <div style={secLabel}>Print Layout</div>
            <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
              {[["4", "2×2", "4/page"], ["6", "2×3", "6/page"]].map(([val, grid, sub]) => (
                <button key={val} onClick={() => setPrintLayout(val)}
                  style={{ flex: 1, padding: "7px 4px", background: printLayout === val ? "#7d5a00" : "transparent", color: printLayout === val ? "#fbbf24" : tm, border: `1px solid ${printLayout === val ? "#9e6a03" : bdr}`, borderRadius: "6px", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                  <div style={{ fontSize: "13px", fontWeight: "bold" }}>{grid}</div>
                  <div style={{ fontSize: "10px", opacity: 0.8 }}>{sub}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowPrint(true)} disabled={plays.length === 0}
              style={{ width: "100%", padding: "9px", background: plays.length > 0 ? "#9e6a03" : "#21262d", color: plays.length > 0 ? "#fbbf24" : td, border: "none", borderRadius: "6px", cursor: plays.length > 0 ? "pointer" : "default", fontWeight: "bold", fontSize: "13px", letterSpacing: "1px", fontFamily: "inherit" }}>
              🖨 PRINT PREVIEW
            </button>
            <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
              <button onClick={exportPlays} disabled={plays.length === 0}
                style={{ flex: 1, padding: "7px 4px", background: plays.length > 0 ? "#1f3d4a" : "#21262d", color: plays.length > 0 ? "#7dd3fc" : td, border: `1px solid ${plays.length > 0 ? "#0ea5e9" : bdr}`, borderRadius: "6px", cursor: plays.length > 0 ? "pointer" : "default", fontWeight: "bold", fontSize: "11px", fontFamily: "inherit" }}>
                ⬇ EXPORT
              </button>
              <button onClick={importPlays}
                style={{ flex: 1, padding: "7px 4px", background: "#192a19", color: "#4ade80", border: `1px solid ${accent}`, borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "11px", fontFamily: "inherit" }}>
                ⬆ IMPORT
              </button>
            </div>
            {plays.length > 0 && (
              <div style={{ fontSize: "11px", color: tm, textAlign: "center", marginTop: "7px" }}>
                {plays.length} play{plays.length !== 1 ? "s" : ""} · {Math.ceil(plays.length / ppp)} page{Math.ceil(plays.length / ppp) !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* PRINT PREVIEW OVERLAY */}
      {showPrint && (
        <div id="fpc-print-overlay" style={{ position: "fixed", inset: 0, background: "#e8e8e8", zIndex: 1000, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="fpc-print-toolbar" style={{ background: "#222", color: "white", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: "12px" }}>
            <div style={{ fontSize: "14px", fontWeight: "bold" }}>🖨 Print Preview — {plays.length} play{plays.length !== 1 ? "s" : ""} · {printPages.length} page{printPages.length !== 1 ? "s" : ""} · Landscape</div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "#fbbf24", fontWeight: "bold" }}>👆 Press Ctrl+P / Cmd+P to print</span>
              <button onClick={() => setShowPrint(false)} style={{ background: "transparent", color: "#f87171", border: "1px solid #f87171", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>✕ Close</button>
            </div>
          </div>
          <div className="fpc-print-scroller" style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
            {printPages.map((group, pi) => {
              const cols = ppp === 6 ? 3 : 2;
              const rows = ppp === 6 ? 2 : 2;
              return (
                <div key={pi} className="fpc-print-page" style={{ width: "11in", height: "8.5in", background: "white", boxShadow: "0 4px 24px rgba(0,0,0,0.25)", padding: "0.3in", boxSizing: "border-box", display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gridTemplateRows: `repeat(${rows},1fr)`, gap: "0.15in" }}>
                  {group.map(p => (
                    <div key={p.id} style={{ border: "1.5px solid #333", borderRadius: "4px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <div style={{ fontFamily: "Georgia,serif", fontWeight: "bold", fontSize: "10pt", textAlign: "center", padding: "4px 8px", background: "#222", color: "white", letterSpacing: "0.5px", flexShrink: 0 }}>{p.name}</div>
                      <img src={p.imgData} alt={p.name} style={{ flex: 1, width: "100%", display: "block", objectFit: "contain" }} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
