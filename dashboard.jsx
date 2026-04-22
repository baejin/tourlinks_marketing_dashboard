import { useState, useEffect, useRef } from "react";
import { supabase } from "./src/lib/supabaseClient";

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */
const fmt = n => (n == null || n === 0) ? "–" : n.toLocaleString("ko-KR");
const sum = a => a.filter(v => v != null).reduce((s, v) => s + v, 0);
const uid = () => Math.random().toString(36).slice(2, 8);
const WEEKS = [0, 1, 2, 3, 4]; // W1-W5
const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
const PROJECT_TABLE = "dashboard_projects";

const FUNNEL_KEYS = [
  { k: "ad", lb: "광고 홍보 진행" },
  { k: "uv", lb: "홈페이지 방문자수" },
  { k: "entry", lb: "기획전 유입자수" },
  { k: "detail", lb: "상품 상세 방문자수" },
  { k: "inquiry", lb: "실 문의자 수" },
  { k: "quote", lb: "실 견적 인원수" },
];

const emptyFunnel = () => ({ ad: 0, uv: 0, entry: 0, detail: 0, inquiry: 0, quote: 0, theme: "" });
const emptyMonth = () => ({ theme: "", funnel: emptyFunnel(), channels: [], creatives: [], cells: {} });

const normalizeMonth = month => ({
  ...emptyMonth(),
  ...month,
  funnel: { ...emptyFunnel(), ...(month?.funnel || {}) },
  channels: Array.isArray(month?.channels) ? month.channels : [],
  creatives: Array.isArray(month?.creatives) ? month.creatives : [],
  cells: month?.cells && typeof month.cells === "object" ? month.cells : {},
});

const normalizeDashboardData = input => {
  const sourceMonths = input?.months || {};
  const months = {};
  for (const month of MONTHS) {
    months[month] = normalizeMonth(sourceMonths[month]);
  }
  return { monthOrder: [...MONTHS], months };
};

const makeEmptyData = () => normalizeDashboardData({ months: {} });

const monthHasData = month => {
  if (!month) return false;
  if (month.theme) return true;
  if (month.channels?.length || month.creatives?.length) return true;
  return FUNNEL_KEYS.some(({ k }) => Number(month.funnel?.[k] || 0) !== 0);
};

const preferredMonth = data => {
  const order = data?.monthOrder || MONTHS;
  for (let i = order.length - 1; i >= 0; i--) {
    const month = order[i];
    if (monthHasData(data?.months?.[month])) return month;
  }
  const current = `${new Date().getMonth() + 1}월`;
  return data?.months?.[current] ? current : MONTHS[0];
};

/* ══════════════════════════════════════════════════════════════
   INITIAL DATA — March 2026 sample
   ══════════════════════════════════════════════════════════════ */
function makeInitialData() {
  const months = {};

  // Helper
  const mkMonth = (key, theme, funnel, channels, creatives, cells) => {
    months[key] = { theme, funnel, channels, creatives, cells };
  };

  const marChannels = ["카카오톡", "SMS", "유튜브", "인스타그램", "블로그", "밴드"];
  const marCreatives = [
    { id: "cr1", name: "기획전 메인" },
    { id: "cr2", name: "푸꾸옥 에스츄리" },
    { id: "cr3", name: "소나시 야시장" },
  ];

  // cells: keyed by `${crId}__${channel}`
  const marCells = {
    "cr1__카카오톡": [{ id: "v1", label: "플러스친구 CPC", img: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=280&h=160&fit=crop", period: "03/05–03/12", w: [4817, null, null, null, null] }],
    "cr1__SMS": [{ id: "v1", label: "문자발송", img: "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=280&h=160&fit=crop", period: "03/12", w: [6262, null, null, null, null] }],
    "cr1__유튜브": [{ id: "v1", label: "기획전 숏츠", img: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=280&h=160&fit=crop", period: "03/12", w: [245, null, null, null, null] }],
    "cr1__인스타그램": [{ id: "v1", label: "이미지 게시물", img: "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=280&h=160&fit=crop", period: "03/12", w: [163, null, null, null, null] }],
    "cr1__블로그": [{ id: "v1", label: "블로그 포스팅", img: "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=280&h=160&fit=crop", period: "03/11", w: [11, null, null, null, null] }],
    "cr1__밴드": [{ id: "v1", label: "밴드 게시물", img: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=280&h=160&fit=crop", period: "03/14", w: [73, null, null, null, null] }],
    "cr2__유튜브": [
      { id: "v1", label: "숏츠 #1 리조트", img: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=280&h=160&fit=crop", period: "03/17–31", w: [860, 720, 410, 196, null] },
      { id: "v2", label: "숏츠 #2 코스", img: "https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=280&h=160&fit=crop", period: "03/18–31", w: [180, 130, 60, 28, null] },
      { id: "v3", label: "숏츠 #3 전경", img: "https://images.unsplash.com/photo-1592919505780-303950717480?w=280&h=160&fit=crop", period: "03/26–31", w: [200, 120, 47, 20, null] },
    ],
    "cr2__인스타그램": [
      { id: "v1", label: "릴스 #1 리조트", img: "https://images.unsplash.com/photo-1504544750208-dc0358e63f7f?w=280&h=160&fit=crop", period: "03/17–31", w: [95, 72, 40, 26, null] },
      { id: "v2", label: "릴스 #2 코스", img: "https://images.unsplash.com/photo-1592919505780-303950717480?w=280&h=160&fit=crop", period: "03/18–31", w: [90, 65, 32, 19, null] },
      { id: "v3", label: "릴스 #3 전경", img: "https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=280&h=160&fit=crop", period: "03/26–31", w: [95, 62, 30, 17, null] },
    ],
    "cr3__유튜브": [{ id: "v1", label: "야시장 브이로그", img: "https://images.unsplash.com/photo-1504544750208-dc0358e63f7f?w=280&h=160&fit=crop", period: "03/25–31", w: [620, 340, 160, 64, null] }],
    "cr3__인스타그램": [{ id: "v1", label: "야시장 릴스", img: "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=280&h=160&fit=crop", period: "03/25–31", w: [148, 102, 54, 29, null] }],
  };

  mkMonth("3월", "골프시즌 개막", { ad: 16871, uv: 7568, entry: 200, detail: 54, inquiry: 107, quote: 376 }, marChannels, marCreatives, marCells);
  mkMonth("2월", "봄 얼리버드", { ad: 12322, uv: 7385, entry: 193, detail: 98, inquiry: 209, quote: 375 }, ["카카오톡", "SMS", "유튜브", "인스타그램", "블로그", "밴드"], [{ id: "cr1", name: "봄 얼리버드 메인" }], {
    "cr1__카카오톡": [{ id: "v1", label: "플러스친구", img: "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=280&h=160&fit=crop", period: "02/04–02/24", w: [4389, null, null, null, null] }],
    "cr1__SMS": [{ id: "v1", label: "문자발송", img: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=280&h=160&fit=crop", period: "02/11", w: [6262, null, null, null, null] }],
  });

  return normalizeDashboardData({ months });
}

/* ══════════════════════════════════════════════════════════════
   DATA UTILS
   ══════════════════════════════════════════════════════════════ */
const cellKey = (crId, ch) => `${crId}__${ch}`;
const versionsTotal = vs => vs ? vs.reduce((s, v) => s + sum(v.w), 0) : 0;
const crTotalInMonth = (m, crId) => m.channels.reduce((s, ch) => s + versionsTotal(m.cells[cellKey(crId, ch)]), 0);
const chTotalInMonth = (m, ch) => m.creatives.reduce((s, cr) => s + versionsTotal(m.cells[cellKey(cr.id, ch)]), 0);
const monthGrandTotal = m => m.creatives.reduce((s, cr) => s + crTotalInMonth(m, cr.id), 0);

/* ══════════════════════════════════════════════════════════════
   CSV Export/Import — long table format
   ══════════════════════════════════════════════════════════════ */
function exportCSV(data) {
  const rows = [["type", "month", "creative_id", "creative_name", "channel", "version_id", "version_label", "img", "period", "w1", "w2", "w3", "w4", "w5", "funnel_key", "funnel_value", "theme"].join(",")];

  for (const mo of data.monthOrder) {
    const m = data.months[mo];
    // Funnel rows
    for (const fk of FUNNEL_KEYS) {
      rows.push(["funnel", mo, "", "", "", "", "", "", "", "", "", "", "", "", fk.k, m.funnel[fk.k] ?? "", m.theme].join(","));
    }
    // Cell rows
    for (const cr of m.creatives) {
      for (const ch of m.channels) {
        const vs = m.cells[cellKey(cr.id, ch)] || [];
        if (vs.length === 0) continue;
        for (const v of vs) {
          const w = v.w || [];
          rows.push(["cell", mo, cr.id, `"${cr.name}"`, `"${ch}"`, v.id, `"${v.label}"`, `"${v.img}"`, `"${v.period}"`, w[0] ?? "", w[1] ?? "", w[2] ?? "", w[3] ?? "", w[4] ?? "", "", "", ""].join(","));
        }
      }
    }
  }
  return rows.join("\n");
}

function importCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return null;

  const data = { monthOrder: [], months: {} };
  const seenMonths = new Set();

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parse respecting quotes
    const cols = [];
    let cur = "", inQ = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    cols.push(cur.trim());

    const [type, mo] = cols;
    if (!mo) continue;

    if (!seenMonths.has(mo)) {
      seenMonths.add(mo);
      data.monthOrder.push(mo);
      data.months[mo] = { theme: "", funnel: emptyFunnel(), channels: [], creatives: [], cells: {} };
    }
    const m = data.months[mo];

    if (type === "funnel") {
      const fk = cols[14], fv = cols[15], theme = cols[16];
      if (fk) m.funnel[fk] = fv === "" ? 0 : Number(fv);
      if (theme) m.theme = theme;
    } else if (type === "cell") {
      const crId = cols[2], crName = cols[3], ch = cols[4];
      const vId = cols[5], vLabel = cols[6], img = cols[7], period = cols[8];
      const w = [cols[9], cols[10], cols[11], cols[12], cols[13]].map(v => v === "" ? null : Number(v));

      if (!m.channels.includes(ch)) m.channels.push(ch);
      if (!m.creatives.find(c => c.id === crId)) m.creatives.push({ id: crId, name: crName });
      const ck = cellKey(crId, ch);
      if (!m.cells[ck]) m.cells[ck] = [];
      m.cells[ck].push({ id: vId, label: vLabel, img, period, w });
    }
  }
  return normalizeDashboardData(data);
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTS
   ══════════════════════════════════════════════════════════════ */

// Shared styles
const S = {
  btn: { fontSize: 11, border: "none", borderRadius: 5, cursor: "pointer", padding: "5px 10px", fontWeight: 500, transition: "all 0.15s" },
  btnPrimary: { background: "#2563eb", color: "#fff" },
  btnGhost: { background: "transparent", color: "#2563eb" },
  btnDanger: { background: "#fef2f2", color: "#dc2626" },
  input: { padding: "6px 9px", fontSize: 12, border: "1px solid #ddd", borderRadius: 5, width: "100%", boxSizing: "border-box", outline: "none", fontFamily: "inherit" },
  mono: { fontFamily: "'DM Mono',monospace" },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: "#888", letterSpacing: "0.02em" },
};

function WBars({ w, h = 16 }) {
  const mx = Math.max(...w.filter(v => v != null), 1);
  return (
    <div style={{ display: "flex", gap: 1.5, alignItems: "flex-end", height: h }}>
      {w.map((v, i) => v != null ? (
        <div key={i} style={{ width: 7, height: Math.max(2, (v / mx) * h), borderRadius: 1.5, background: `rgba(37,99,235,${0.25 + (v / mx) * 0.5})` }} title={`W${i + 1}: ${fmt(v)}`} />
      ) : (
        <div key={i} style={{ width: 7, height: 2, borderRadius: 1, background: "#e5e7eb" }} />
      ))}
    </div>
  );
}

function CellThumb({ versions, onClick, rowHeight = 82 }) {
  if (!versions?.length) return <div style={{ color: "#ddd", fontSize: 11, textAlign: "center", minHeight: Math.max(44, rowHeight - 10), display: "grid", placeItems: "center", padding: 10 }}>–</div>;
  const total = versionsTotal(versions);
  const rep = versions[0];
  const aggW = WEEKS.map(wi => versions.reduce((s, v) => s + (v.w[wi] || 0), 0) || null);
  const imageHeight = Math.max(28, Math.min(82, rowHeight - 42));

  return (
    <div onClick={onClick} style={{ cursor: "pointer", padding: 3, minHeight: Math.max(44, rowHeight - 10), display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ position: "relative", borderRadius: 3, overflow: "hidden", marginBottom: 3, height: imageHeight }}>
        {rep.img ? (
          <img src={rep.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#bbb" }}>no img</div>
        )}
        {versions.length > 1 && (
          <div style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 7, fontWeight: 700, padding: "1px 4px", borderRadius: 2, ...S.mono }}>{versions.length}건</div>
        )}
      </div>
      <div style={{ fontSize: 8, color: "#999", ...S.mono, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>
        {versions.length === 1 ? rep.period : `${rep.period} 외`}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 3 }}>
        <WBars w={aggW} h={14} />
        <div style={{ fontSize: 10, fontWeight: 700, color: "#222", ...S.mono, whiteSpace: "nowrap" }}>{fmt(total)}</div>
      </div>
    </div>
  );
}

/* Detail Modal */
function DetailModal({ crName, ch, versions, onClose, onEdit }) {
  if (!versions) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)" }} />
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", background: "#fff", borderRadius: 12, maxWidth: 540, width: "92%", maxHeight: "82vh", overflow: "auto", boxShadow: "0 16px 48px rgba(0,0,0,0.12)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{crName} · {ch}</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{versions.length}개 버전</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onEdit} style={{ ...S.btn, ...S.btnPrimary, fontSize: 10 }}>데이터 입력 →</button>
            <button onClick={onClose} style={{ ...S.btn, background: "#f3f4f6", color: "#666" }}>✕</button>
          </div>
        </div>
        <div style={{ padding: "10px 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {versions.map((v, vi) => (
            <div key={v.id} style={{ display: "flex", gap: 12, padding: 10, background: "#f9fafb", borderRadius: 8, border: "1px solid #f0f0f0" }}>
              {v.img ? <img src={v.img} alt="" style={{ width: 90, height: 60, objectFit: "cover", borderRadius: 5, flexShrink: 0 }} /> :
                <div style={{ width: 90, height: 60, background: "#eee", borderRadius: 5, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#222" }}>{v.label}</div>
                <div style={{ fontSize: 10, color: "#888", ...S.mono, marginTop: 1 }}>{v.period}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                  {v.w.map((val, wi) => (
                    <div key={wi} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 8, color: "#aaa", ...S.mono }}>W{wi + 1}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: val != null ? "#222" : "#ccc", ...S.mono }}>{val != null ? fmt(val) : "–"}</div>
                    </div>
                  ))}
                  <div style={{ borderLeft: "1px solid #e5e7eb", paddingLeft: 6, textAlign: "center" }}>
                    <div style={{ fontSize: 8, color: "#aaa", ...S.mono }}>합계</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", ...S.mono }}>{fmt(sum(v.w))}</div>
                  </div>
                </div>
                <div style={{ marginTop: 4 }}><WBars w={v.w} h={10} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Funnel Strip */
function FunnelStrip({ data, prev }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${FUNNEL_KEYS.length},1fr)`, border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
      {FUNNEL_KEYS.map((s, i) => {
        const v = data[s.k] || 0, pv = prev?.[s.k];
        const diff = pv != null ? v - pv : null;
        const ps = i > 0 ? (data[FUNNEL_KEYS[i - 1].k] || 0) : null;
        const rate = ps ? ((v / ps) * 100).toFixed(1) : null;
        return (
          <div key={s.k} style={{ padding: "12px 4px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, borderRight: i < FUNNEL_KEYS.length - 1 ? "1px solid #f0f0f0" : "none" }}>
            <div style={{ fontSize: 10, color: "#888", textAlign: "center", lineHeight: 1.2 }}>{s.lb}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111", ...S.mono, letterSpacing: "-0.03em", marginTop: 2 }}>{fmt(v)}</div>
            {rate && i > 0 && <div style={{ fontSize: 9, color: "#aaa", ...S.mono }}>↓ {rate}%</div>}
            {diff != null && <div style={{ fontSize: 9, fontWeight: 600, ...S.mono, color: diff > 0 ? "#16a34a" : diff < 0 ? "#dc2626" : "#aaa" }}>{diff > 0 ? "▲ " : diff < 0 ? "▼ " : ""}{fmt(Math.abs(diff))}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DATA INPUT TAB
   ══════════════════════════════════════════════════════════════ */
function DataInputTab({ monthData, setMonthData, initCr, initCh }) {
  const m = monthData;
  const [selCrIdx, setSelCrIdx] = useState(() => initCr != null ? Math.max(0, m.creatives.findIndex(c => c.id === initCr)) : 0);
  const [selCh, setSelCh] = useState(initCh || m.channels[0] || "");
  const [selVer, setSelVer] = useState(0);
  const [newChName, setNewChName] = useState("");
  const [confirmDel, setConfirmDel] = useState(null); // {type:"creative"|"version"|"channel", idx, label}

  const cr = m.creatives[selCrIdx];
  const ck = cr ? cellKey(cr.id, selCh) : "";
  const versions = cr ? (m.cells[ck] || []) : [];
  const ver = versions[selVer];

  const update = fn => {
    const next = JSON.parse(JSON.stringify(m));
    fn(next);
    setMonthData(next);
  };

  const doDeleteCreative = (ci, cId) => {
    update(n => {
      n.creatives.splice(ci, 1);
      Object.keys(n.cells).filter(k => k.startsWith(cId + "__")).forEach(k => delete n.cells[k]);
    });
    setSelCrIdx(prev => prev >= m.creatives.length - 1 ? Math.max(0, prev - 1) : prev);
    setSelVer(0);
    setConfirmDel(null);
  };

  const doDeleteVersion = (vi) => {
    update(n => {
      if (n.cells[ck]) {
        n.cells[ck].splice(vi, 1);
        if (n.cells[ck].length === 0) delete n.cells[ck];
      }
    });
    setSelVer(prev => Math.max(0, prev - 1));
    setConfirmDel(null);
  };

  const doDeleteChannel = (chName) => {
    update(n => {
      n.channels = n.channels.filter(c => c !== chName);
      Object.keys(n.cells).filter(k => k.endsWith("__" + chName)).forEach(k => delete n.cells[k]);
    });
    if (selCh === chName) setSelCh(m.channels.find(c => c !== chName) || "");
    setConfirmDel(null);
  };

  const iStyle = S.input;
  const wStyle = { ...S.input, width: 64, textAlign: "center", ...S.mono, fontWeight: 600 };

  // Inline confirm banner
  const ConfirmBanner = () => {
    if (!confirmDel) return null;
    return (
      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "8px 12px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#991b1b" }}>"{confirmDel.label}" 을(를) 삭제하시겠습니까?</span>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={() => {
            if (confirmDel.type === "creative") doDeleteCreative(confirmDel.idx, confirmDel.id);
            else if (confirmDel.type === "version") doDeleteVersion(confirmDel.idx);
            else if (confirmDel.type === "channel") doDeleteChannel(confirmDel.id);
          }} style={{ ...S.btn, fontSize: 10, background: "#dc2626", color: "#fff" }}>삭제</button>
          <button onClick={() => setConfirmDel(null)} style={{ ...S.btn, fontSize: 10, background: "#fff", color: "#666", border: "1px solid #ddd" }}>취소</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 0, minHeight: 420 }}>
      {/* Left: creative list */}
      <div style={{ borderRight: "1px solid #e5e7eb", padding: "10px 0", overflowY: "auto" }}>
        <div style={{ padding: "0 10px 6px", ...S.sectionTitle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          소재 목록
          <button onClick={() => { update(n => { n.creatives.push({ id: uid(), name: "새 소재" }); }); setSelCrIdx(m.creatives.length); setSelVer(0); setConfirmDel(null); }} style={{ ...S.btn, fontSize: 10, ...S.btnPrimary }}>+ 추가</button>
        </div>
        {m.creatives.map((c, ci) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center" }}>
            <div onClick={() => { setSelCrIdx(ci); setSelVer(0); setConfirmDel(null); }} style={{ flex: 1, padding: "7px 10px", cursor: "pointer", fontSize: 12, background: ci === selCrIdx ? "#eff6ff" : "transparent", color: ci === selCrIdx ? "#2563eb" : "#444", fontWeight: ci === selCrIdx ? 600 : 400, borderLeft: ci === selCrIdx ? "3px solid #2563eb" : "3px solid transparent" }}>
              {c.name}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDel({ type: "creative", idx: ci, id: c.id, label: c.name }); }}
              style={{ fontSize: 11, color: "#ccc", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}
              title="소재 삭제"
            >✕</button>
          </div>
        ))}
      </div>

      {/* Right: form */}
      <div style={{ padding: 14, overflowY: "auto" }}>
        <ConfirmBanner />
        {cr ? (
          <>
            {/* Creative name */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: "#888", fontWeight: 500, display: "block", marginBottom: 3 }}>소재명</label>
              <input value={cr.name} onChange={e => update(n => { n.creatives[selCrIdx].name = e.target.value; })} style={iStyle} />
            </div>

            {/* Channel selector + add + delete */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, color: "#888", fontWeight: 500, display: "block", marginBottom: 3 }}>채널</label>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
                {m.channels.map(c => {
                  const has = (m.cells[cellKey(cr.id, c)] || []).length > 0;
                  const isSel = c === selCh;
                  return (
                    <div key={c} style={{ display: "flex", alignItems: "center", position: "relative" }}>
                      <button onClick={() => { setSelCh(c); setSelVer(0); setConfirmDel(null); }} style={{ ...S.btn, fontSize: 10, border: "1px solid", borderColor: isSel ? "#2563eb" : has ? "#ccc" : "#e5e7eb", background: isSel ? "#eff6ff" : "transparent", color: isSel ? "#2563eb" : has ? "#444" : "#bbb", fontWeight: isSel ? 600 : 400, paddingRight: 20 }}>
                        {c}{has ? ` (${(m.cells[cellKey(cr.id, c)] || []).length})` : ""}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDel({ type: "channel", id: c, label: c + " 채널" }); }}
                        style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "#ccc", background: "none", border: "none", cursor: "pointer", padding: "0 3px", lineHeight: 1 }}
                        title="채널 삭제"
                      >✕</button>
                    </div>
                  );
                })}
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  <input value={newChName} onChange={e => setNewChName(e.target.value)} placeholder="새 채널명" style={{ ...iStyle, width: 80, fontSize: 10 }} onKeyDown={e => { if (e.key === "Enter" && newChName.trim()) { update(n => { if (!n.channels.includes(newChName.trim())) n.channels.push(newChName.trim()); }); setSelCh(newChName.trim()); setNewChName(""); } }} />
                  <button onClick={() => { if (!newChName.trim()) return; update(n => { if (!n.channels.includes(newChName.trim())) n.channels.push(newChName.trim()); }); setSelCh(newChName.trim()); setNewChName(""); }} style={{ ...S.btn, fontSize: 9, ...S.btnPrimary }}>+</button>
                </div>
              </div>
            </div>

            {selCh && (
              <>
                {/* Version tabs */}
                <div style={{ display: "flex", gap: 3, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, color: "#888", fontWeight: 500, marginRight: 2 }}>버전:</span>
                  {versions.map((v, vi) => (
                    <div key={v.id} style={{ display: "flex", alignItems: "center", position: "relative" }}>
                      <button onClick={() => { setSelVer(vi); setConfirmDel(null); }} style={{ ...S.btn, fontSize: 10, border: "1px solid", borderColor: vi === selVer ? "#2563eb" : "#ddd", background: vi === selVer ? "#eff6ff" : "#fff", color: vi === selVer ? "#2563eb" : "#666", fontWeight: vi === selVer ? 600 : 400, paddingRight: 18 }}>
                        {v.label || `v${vi + 1}`}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDel({ type: "version", idx: vi, label: v.label || `버전 ${vi + 1}` }); }}
                        style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "#ccc", background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
                        title="버전 삭제"
                      >✕</button>
                    </div>
                  ))}
                  <button onClick={() => { update(n => { if (!n.cells[ck]) n.cells[ck] = []; n.cells[ck].push({ id: uid(), label: "새 버전", img: "", period: "", w: [null, null, null, null, null] }); }); setSelVer(versions.length); setConfirmDel(null); }} style={{ ...S.btn, fontSize: 9, border: "1px dashed #93c5fd", background: "none", color: "#2563eb" }}>+ 버전</button>
                </div>

                {ver && (
                  <div style={{ background: "#f9fafb", border: "1px solid #f0f0f0", borderRadius: 8, padding: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 10, color: "#888", display: "block", marginBottom: 3 }}>버전 라벨</label>
                        <input value={ver.label} onChange={e => update(n => { n.cells[ck][selVer].label = e.target.value; })} style={iStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "#888", display: "block", marginBottom: 3 }}>기간</label>
                        <input value={ver.period} onChange={e => update(n => { n.cells[ck][selVer].period = e.target.value; })} style={iStyle} placeholder="03/17–03/31" />
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 10, color: "#888", display: "block", marginBottom: 3 }}>이미지 URL</label>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input value={ver.img} onChange={e => update(n => { n.cells[ck][selVer].img = e.target.value; })} style={{ ...iStyle, flex: 1 }} placeholder="https://..." />
                        {ver.img && <img src={ver.img} alt="" style={{ width: 44, height: 30, objectFit: "cover", borderRadius: 3, border: "1px solid #eee" }} />}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#888", display: "block", marginBottom: 4 }}>주단위 유입</label>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {WEEKS.map(wi => (
                          <div key={wi} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 8, color: "#aaa", ...S.mono, marginBottom: 2 }}>W{wi + 1}</div>
                            <input type="number" value={ver.w[wi] ?? ""} onChange={e => update(n => { n.cells[ck][selVer].w[wi] = e.target.value === "" ? null : Number(e.target.value); })} style={wStyle} placeholder="–" />
                          </div>
                        ))}
                        <div style={{ borderLeft: "1px solid #e5e7eb", paddingLeft: 6, textAlign: "center" }}>
                          <div style={{ fontSize: 8, color: "#aaa", ...S.mono, marginBottom: 2 }}>합계</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#2563eb", ...S.mono }}>{fmt(sum(ver.w))}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 6 }}><WBars w={ver.w} /></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div style={{ color: "#bbb", fontSize: 12, padding: 20 }}>소재를 추가해주세요.</div>
        )}
      </div>
    </div>
  );
}

/* Funnel Input Tab */
function FunnelInputTab({ monthData, setMonthData }) {
  const m = monthData;
  const update = (key, val) => {
    const next = JSON.parse(JSON.stringify(m));
    next.funnel[key] = val === "" ? 0 : Number(val);
    setMonthData(next);
  };
  return (
    <div style={{ padding: 20, maxWidth: 500 }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 10, color: "#888", display: "block", marginBottom: 3 }}>기획전 테마</label>
        <input value={m.theme} onChange={e => { const next = JSON.parse(JSON.stringify(m)); next.theme = e.target.value; setMonthData(next); }} style={S.input} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {FUNNEL_KEYS.map(fk => (
          <div key={fk.k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ width: 140, fontSize: 11, color: "#555" }}>{fk.lb}</label>
            <input type="number" value={m.funnel[fk.k] || ""} onChange={e => update(fk.k, e.target.value)} style={{ ...S.input, width: 120, ...S.mono, fontWeight: 600, textAlign: "right" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    const credentials = { email: email.trim(), password };
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp(credentials);

    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("가입 확인 메일을 확인한 뒤 로그인해주세요.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "grid", placeItems: "center", padding: 20, fontFamily: "'Pretendard','Apple SD Gothic Neo',-apple-system,sans-serif", color: "#1a1a1a" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 360, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 22, boxShadow: "0 10px 30px rgba(15,23,42,0.06)" }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#111", fontFamily: "'Outfit',sans-serif", marginBottom: 4 }}>Tourlinks</div>
          <div style={{ fontSize: 12, color: "#777" }}>{mode === "signin" ? "대시보드에 로그인" : "새 계정 만들기"}</div>
        </div>
        <div style={{ display: "flex", gap: 1, background: "#f3f4f6", borderRadius: 6, padding: 2, marginBottom: 14 }}>
          {[{ k: "signin", lb: "로그인" }, { k: "signup", lb: "회원가입" }].map(t => (
            <button key={t.k} type="button" onClick={() => { setMode(t.k); setError(""); setMessage(""); }} style={{ flex: 1, padding: "7px 10px", fontSize: 12, border: "none", borderRadius: 4, cursor: "pointer", background: mode === t.k ? "#fff" : "transparent", color: mode === t.k ? "#111" : "#999", fontWeight: mode === t.k ? 700 : 500, boxShadow: mode === t.k ? "0 1px 2px rgba(0,0,0,0.06)" : "none" }}>{t.lb}</button>
          ))}
        </div>
        <label style={{ fontSize: 10, color: "#888", display: "block", marginBottom: 3 }}>아이디(이메일)</label>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" required style={{ ...S.input, marginBottom: 10 }} placeholder="name@example.com" />
        <label style={{ fontSize: 10, color: "#888", display: "block", marginBottom: 3 }}>비밀번호</label>
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={6} style={{ ...S.input, marginBottom: 12 }} placeholder="6자 이상" />
        {error && <div style={{ fontSize: 11, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "8px 10px", marginBottom: 10 }}>{error}</div>}
        {message && <div style={{ fontSize: 11, color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "8px 10px", marginBottom: 10 }}>{message}</div>}
        <button type="submit" disabled={busy} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "9px 12px", fontSize: 12, opacity: busy ? 0.65 : 1 }}>{busy ? "처리 중..." : mode === "signin" ? "로그인" : "회원가입"}</button>
      </form>
    </div>
  );
}

function LoadingScreen({ label = "불러오는 중..." }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "grid", placeItems: "center", fontFamily: "'Pretendard','Apple SD Gothic Neo',-apple-system,sans-serif", color: "#666", fontSize: 13 }}>
      {label}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════════════════════════ */
export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [remoteReady, setRemoteReady] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const [data, setData] = useState(makeInitialData);
  const [mo, setMo] = useState(() => preferredMonth(makeInitialData()));
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [projectBusy, setProjectBusy] = useState(false);
  const [showRowTotals, setShowRowTotals] = useState(true);
  const [showColumnTotals, setShowColumnTotals] = useState(true);
  const [rowHeight, setRowHeight] = useState(82);
  const [tab, setTab] = useState("matrix");
  const [detail, setDetail] = useState(null);
  const [editTarget, setEditTarget] = useState(null); // {crId, ch} for navigating from modal
  const fileRef = useRef(null);
  const latestSavedRef = useRef("");
  const saveTimerRef = useRef(null);

  const m = data.months[mo];
  const pi = data.monthOrder.indexOf(mo) - 1;
  const prevFunnel = pi >= 0 ? data.months[data.monthOrder[pi]]?.funnel : null;

  const setMonthData = next => {
    setData(prev => ({ ...prev, months: { ...prev.months, [mo]: next } }));
  };

  const persistProject = async (targetProjectId, payload) => {
    const { error } = await supabase
      .from(PROJECT_TABLE)
      .update({
        payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetProjectId)
      .eq("user_id", session.user.id);

    if (error) throw error;
  };

  const flushCurrentProject = async () => {
    if (!projectId || !remoteReady) return;
    const serialized = JSON.stringify(data);
    if (serialized === latestSavedRef.current) return;

    window.clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    await persistProject(projectId, data);
    latestSavedRef.current = serialized;
    setProjects(prev => prev.map(project => project.id === projectId ? { ...project, payload: data, updated_at: new Date().toISOString() } : project));
    setSaveState("saved");
  };

  const handleProjectSelect = async e => {
    const nextProjectId = e.target.value;
    if (nextProjectId === projectId) return;
    const selected = projects.find(project => project.id === nextProjectId);
    if (!selected) return;

    setProjectBusy(true);
    setSaveError("");
    try {
      await flushCurrentProject();
      const nextData = normalizeDashboardData(selected.payload);
      setProjectId(selected.id);
      setData(nextData);
      setMo(prev => nextData.months[prev] ? prev : preferredMonth(nextData));
      latestSavedRef.current = JSON.stringify(nextData);
      setSaveState("saved");
    } catch (err) {
      setSaveError(err.message);
      setSaveState("error");
    } finally {
      setProjectBusy(false);
    }
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim() || `프로젝트 ${projects.length + 1}`;
    setProjectBusy(true);
    setSaveError("");

    try {
      await flushCurrentProject();
      const payload = makeEmptyData();
      const { data: row, error } = await supabase
        .from(PROJECT_TABLE)
        .insert({ user_id: session.user.id, name, payload })
        .select("id,name,payload,updated_at")
        .single();

      if (error) throw error;
      const created = { ...row, payload: normalizeDashboardData(row.payload) };
      setProjects(prev => [created, ...prev]);
      setProjectId(created.id);
      setData(created.payload);
      setMo(preferredMonth(created.payload));
      latestSavedRef.current = JSON.stringify(created.payload);
      setNewProjectName("");
      setSaveState("saved");
    } catch (err) {
      setSaveError(err.message);
      setSaveState("error");
    } finally {
      setProjectBusy(false);
    }
  };

  const handleDeleteProject = async () => {
    const selected = projects.find(project => project.id === projectId);
    if (!selected || !window.confirm(`"${selected.name}" 프로젝트를 삭제하시겠습니까?`)) return;

    setProjectBusy(true);
    setSaveError("");
    window.clearTimeout(saveTimerRef.current);

    try {
      const { error } = await supabase
        .from(PROJECT_TABLE)
        .delete()
        .eq("id", selected.id)
        .eq("user_id", session.user.id);

      if (error) throw error;

      let remaining = projects.filter(project => project.id !== selected.id);
      if (remaining.length === 0) {
        const payload = makeInitialData();
        const { data: row, error: createError } = await supabase
          .from(PROJECT_TABLE)
          .insert({ user_id: session.user.id, name: "기본 프로젝트", payload })
          .select("id,name,payload,updated_at")
          .single();

        if (createError) throw createError;
        remaining = [{ ...row, payload: normalizeDashboardData(row.payload) }];
      }

      const nextProject = remaining[0];
      const nextData = normalizeDashboardData(nextProject.payload);
      setProjects(remaining);
      setProjectId(nextProject.id);
      setData(nextData);
      setMo(preferredMonth(nextData));
      latestSavedRef.current = JSON.stringify(nextData);
      setSaveState("saved");
    } catch (err) {
      setSaveError(err.message);
      setSaveState("error");
    } finally {
      setProjectBusy(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: authData }) => {
      if (!mounted) return;
      setSession(authData.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setRemoteReady(false);
      setSaveError("");
      setSaveState("idle");
      if (!nextSession) {
        const initial = makeInitialData();
        setProjects([]);
        setProjectId("");
        setData(initial);
        setMo(preferredMonth(initial));
        latestSavedRef.current = "";
      }
    });

    return () => {
      mounted = false;
      listener.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;

    const createInitialProject = async (name = "기본 프로젝트") => {
      const payload = makeInitialData();
      const { data: row, error } = await supabase
        .from(PROJECT_TABLE)
        .insert({ user_id: session.user.id, name, payload })
        .select("id,name,payload,updated_at")
        .single();

      if (error) throw error;
      return { ...row, payload: normalizeDashboardData(row.payload) };
    };

    const loadProjects = async () => {
      setRemoteReady(false);
      setSaveState("loading");
      setSaveError("");

      const { data: rows, error } = await supabase
        .from(PROJECT_TABLE)
        .select("id,name,payload,updated_at")
        .eq("user_id", session.user.id)
        .order("updated_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        setSaveError(error.message);
        setSaveState("error");
        setRemoteReady(true);
        return;
      }

      let nextProjects = (rows || []).map(row => ({ ...row, payload: normalizeDashboardData(row.payload) }));
      if (nextProjects.length === 0) {
        try {
          nextProjects = [await createInitialProject()];
        } catch (err) {
          if (cancelled) return;
          setSaveError(err.message);
          setSaveState("error");
          setRemoteReady(true);
          return;
        }
      }

      const selected = nextProjects[0];
      const nextData = normalizeDashboardData(selected.payload);
      setProjects(nextProjects);
      setProjectId(selected.id);
      setData(nextData);
      setMo(preferredMonth(nextData));
      latestSavedRef.current = JSON.stringify(nextData);
      setRemoteReady(true);
      setSaveState("saved");
    };

    loadProjects();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || !projectId || !remoteReady) return;
    const serialized = JSON.stringify(data);
    if (serialized === latestSavedRef.current) return;

    window.clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    setSaveError("");

    saveTimerRef.current = window.setTimeout(async () => {
      const { error } = await supabase
        .from(PROJECT_TABLE)
        .update({
          payload: data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)
        .eq("user_id", session.user.id);

      if (error) {
        setSaveError(error.message);
        setSaveState("error");
        return;
      }
      latestSavedRef.current = serialized;
      setProjects(prev => prev.map(project => project.id === projectId ? { ...project, payload: data, updated_at: new Date().toISOString() } : project));
      setSaveState("saved");
    }, 700);

    return () => window.clearTimeout(saveTimerRef.current);
  }, [data, projectId, remoteReady, session?.user?.id]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // CSV export — use data URI (Blob/createObjectURL blocked in sandbox)
  const handleExport = () => {
    try {
      const csv = exportCSV(data);
      const encoded = encodeURIComponent("\uFEFF" + csv);
      const a = document.createElement("a");
      a.href = "data:text/csv;charset=utf-8," + encoded;
      a.download = `tourlinks_data_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      // Fallback: copy to clipboard
      try {
        const csv = exportCSV(data);
        navigator.clipboard.writeText(csv);
      } catch (e2) {
        console.error("Export failed:", e2);
      }
    }
  };

  // CSV import
  const handleImport = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = importCSV(ev.target.result);
      if (result && result.monthOrder.length) {
        setData(result);
        setMo(preferredMonth(result));
        setTab("matrix");
      } else {
        console.error("CSV import failed: invalid format");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Navigate from detail modal to edit
  useEffect(() => {
    if (editTarget) {
      setTab("input");
      setDetail(null);
    }
  }, [editTarget]);

  if (authLoading) return <LoadingScreen label="세션 확인 중..." />;
  if (!session) return <AuthScreen />;
  if (!remoteReady) return <LoadingScreen label="대시보드 데이터를 불러오는 중..." />;

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", fontFamily: "'Pretendard','Apple SD Gothic Neo',-apple-system,sans-serif", color: "#1a1a1a" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderBottom: "1px solid #e5e7eb", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#111", fontFamily: "'Outfit',sans-serif", letterSpacing: "-0.03em" }}>Tourlinks</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#f3f4f6", borderRadius: 6, padding: 2 }}>
            <select value={projectId} onChange={handleProjectSelect} disabled={projectBusy} style={{ height: 24, minWidth: 140, maxWidth: 220, border: "none", borderRadius: 4, background: "#fff", color: "#111", fontSize: 11, fontWeight: 600, padding: "0 6px", outline: "none" }}>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleCreateProject(); }} disabled={projectBusy} placeholder="새 프로젝트" style={{ height: 24, width: 96, border: "1px solid #e5e7eb", borderRadius: 4, background: "#fff", color: "#333", fontSize: 10, padding: "0 7px", outline: "none" }} />
            <button onClick={handleCreateProject} disabled={projectBusy} style={{ ...S.btn, fontSize: 9, ...S.btnPrimary, padding: "4px 7px", height: 24 }}>생성</button>
            <button onClick={handleDeleteProject} disabled={projectBusy || !projectId} style={{ ...S.btn, fontSize: 9, ...S.btnDanger, padding: "4px 7px", height: 24 }}>삭제</button>
          </div>
          {m && <span style={{ fontSize: 10, color: "#2563eb", background: "#eff6ff", padding: "2px 7px", borderRadius: 4, ...S.mono, fontWeight: 500 }}>{m.theme || mo}</span>}
          <span style={{ fontSize: 10, color: saveState === "error" ? "#dc2626" : "#777", background: saveState === "error" ? "#fef2f2" : "#f3f4f6", padding: "2px 7px", borderRadius: 4 }}>
            {saveState === "saving" ? "저장 중" : saveState === "saved" ? "저장됨" : saveState === "error" ? "저장 오류" : "개인 데이터"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 1, background: "#f3f4f6", borderRadius: 6, padding: 2 }}>
            {[{ k: "matrix", lb: "대시보드" }, { k: "input", lb: "소재 입력" }, { k: "funnel_input", lb: "퍼널 입력" }].map(t => (
              <button key={t.k} onClick={() => { setTab(t.k); setEditTarget(null); }} style={{ padding: "4px 10px", fontSize: 10, border: "none", borderRadius: 4, cursor: "pointer", background: tab === t.k ? "#fff" : "transparent", color: tab === t.k ? "#111" : "#999", fontWeight: tab === t.k ? 600 : 400, boxShadow: tab === t.k ? "0 1px 2px rgba(0,0,0,0.06)" : "none" }}>{t.lb}</button>
            ))}
          </div>
          {/* Month selector */}
          <div style={{ display: "flex", gap: 1, background: "#f3f4f6", borderRadius: 6, padding: 2, alignItems: "center" }}>
            {data.monthOrder.map(m2 => (
              <button key={m2} onClick={() => setMo(m2)} style={{ padding: "4px 9px", fontSize: 10, border: "none", borderRadius: 4, cursor: "pointer", ...S.mono, background: m2 === mo ? "#fff" : "transparent", color: m2 === mo ? "#2563eb" : "#999", fontWeight: m2 === mo ? 700 : 400, boxShadow: m2 === mo ? "0 1px 2px rgba(0,0,0,0.06)" : "none" }}>{m2}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f3f4f6", borderRadius: 6, padding: "3px 6px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#555", cursor: "pointer", whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={showRowTotals} onChange={e => setShowRowTotals(e.target.checked)} style={{ width: 12, height: 12, margin: 0 }} />
              행 합계
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#555", cursor: "pointer", whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={showColumnTotals} onChange={e => setShowColumnTotals(e.target.checked)} style={{ width: 12, height: 12, margin: 0 }} />
              열 합계
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: "#777", whiteSpace: "nowrap" }}>행 높이</span>
              <input type="range" min="62" max="132" step="2" value={rowHeight} onChange={e => setRowHeight(Number(e.target.value))} style={{ width: 78 }} />
              <span style={{ fontSize: 9, color: "#999", ...S.mono, width: 28 }}>{rowHeight}px</span>
            </div>
          </div>
          {/* Save/Load */}
          <div style={{ display: "flex", gap: 3 }}>
            <button onClick={handleExport} style={{ ...S.btn, fontSize: 10, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>💾 저장(CSV)</button>
            <button onClick={() => fileRef.current?.click()} style={{ ...S.btn, fontSize: 10, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>📂 불러오기</button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleImport} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, color: "#777", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.user.email}</span>
            <button onClick={handleSignOut} style={{ ...S.btn, fontSize: 10, background: "#f3f4f6", color: "#555", border: "1px solid #e5e7eb" }}>로그아웃</button>
          </div>
        </div>
      </div>

      {saveError && (
        <div style={{ background: "#fef2f2", borderBottom: "1px solid #fecaca", color: "#991b1b", fontSize: 11, padding: "7px 20px" }}>
          Supabase 저장 오류: {saveError}
        </div>
      )}

      {/* Content */}
      {m && (
        <div style={{ padding: "14px 20px 28px", maxWidth: 1400, margin: "0 auto" }}>
          {tab === "matrix" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Matrix */}
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: "#fafbfc" }}>
                      <th style={{ width: 120, padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#888", borderBottom: "2px solid #e5e7eb", borderRight: "1px solid #eee", position: "sticky", left: 0, background: "#fafbfc", zIndex: 1 }}>소재</th>
                      {m.channels.map(ch => (
                        <th key={ch} style={{ padding: "8px 6px", textAlign: "center", fontSize: 10, fontWeight: 600, color: "#888", borderBottom: "2px solid #e5e7eb", borderRight: "1px solid #eee", minWidth: 110 }}>{ch}</th>
                      ))}
                      {showRowTotals && <th style={{ width: 70, padding: "8px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#555", borderBottom: "2px solid #e5e7eb", background: "#f7f8fa" }}>합계</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {m.creatives.map(cr => (
                      <tr key={cr.id} style={{ height: rowHeight }}>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid #f0f0f0", borderRight: "1px solid #eee", verticalAlign: "middle", position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#222" }}>{cr.name}</div>
                          <div style={{ fontSize: 9, color: "#bbb", marginTop: 1 }}>{m.channels.filter(ch => (m.cells[cellKey(cr.id, ch)] || []).length).length}ch</div>
                        </td>
                        {m.channels.map(ch => {
                          const vs = m.cells[cellKey(cr.id, ch)] || [];
                          return (
                            <td key={ch} style={{ padding: 3, borderBottom: "1px solid #f0f0f0", borderRight: "1px solid #eee", verticalAlign: "middle" }}>
                              <CellThumb versions={vs} rowHeight={rowHeight} onClick={() => vs.length ? setDetail({ crName: cr.name, crId: cr.id, ch, versions: vs }) : null} />
                            </td>
                          );
                        })}
                        {showRowTotals && <td style={{ padding: "8px 10px", textAlign: "right", borderBottom: "1px solid #f0f0f0", fontSize: 12, fontWeight: 700, color: "#111", ...S.mono, background: "#f7f8fa", verticalAlign: "middle" }}>{fmt(crTotalInMonth(m, cr.id))}</td>}
                      </tr>
                    ))}
                    {showColumnTotals && (
                      <tr style={{ background: "#f7f8fa" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 700, fontSize: 10, color: "#555", borderTop: "2px solid #e5e7eb", borderRight: "1px solid #eee", position: "sticky", left: 0, background: "#f7f8fa", zIndex: 1 }}>채널별 합계</td>
                        {m.channels.map(ch => (
                          <td key={ch} style={{ padding: "8px 4px", textAlign: "center", borderTop: "2px solid #e5e7eb", borderRight: "1px solid #eee", fontSize: 11, fontWeight: 700, color: "#111", ...S.mono }}>{chTotalInMonth(m, ch) > 0 ? fmt(chTotalInMonth(m, ch)) : "–"}</td>
                        ))}
                        {showRowTotals && <td style={{ padding: "8px 10px", textAlign: "right", borderTop: "2px solid #e5e7eb", fontSize: 13, fontWeight: 800, color: "#2563eb", ...S.mono, background: "#eff6ff" }}>{fmt(monthGrandTotal(m))}</td>}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Funnel */}
              <div>
                <div style={{ ...S.sectionTitle, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>퍼널 요약</span>
                  {prevFunnel && <span style={{ fontWeight: 400, color: "#bbb", fontSize: 10, ...S.mono }}>vs {data.monthOrder[pi]}</span>}
                </div>
                <FunnelStrip data={m.funnel} prev={prevFunnel} />
              </div>
            </div>
          )}

          {tab === "input" && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
              <DataInputTab monthData={m} setMonthData={setMonthData} initCr={editTarget?.crId} initCh={editTarget?.ch} />
            </div>
          )}

          {tab === "funnel_input" && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
              <FunnelInputTab monthData={m} setMonthData={setMonthData} />
            </div>
          )}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <DetailModal
          crName={detail.crName} ch={detail.ch} versions={detail.versions}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditTarget({ crId: detail.crId, ch: detail.ch }); }}
        />
      )}

    </div>
  );
}
