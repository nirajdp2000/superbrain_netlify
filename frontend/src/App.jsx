import { useEffect, useRef, useState } from "react";
import TopSignalsTab from "./TopSignalsTab.jsx";
import "./styles.css";

const RECENT_ASKS_KEY = "superbrain_recent_asks_v5";
const DEFAULT_WATCHLIST = "RELIANCE,TCS,HDFCBANK,ICICIBANK,INFY,SUNPHARMA,LT,BHARTIARTL";
const DEFAULT_QUERY = "Analyze RELIANCE across all strategies with full evidence";
const DEFAULT_QUICK = ["RELIANCE", "TCS", "HDFCBANK", "APOLLO", "APOLLOHOSP", "INFY", "SUNPHARMA", "LT", "BHARTIARTL", "ICICIBANK", "WIPRO", "AXISBANK"];

function fmt(value, suffix = "", digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }
  return `${Number(value).toFixed(digits)}${suffix}`;
}

function timeAgo(value) {
  if (!value) {
    return "--";
  }
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 60) {
    return `${Math.max(1, minutes)}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
}

function fmtTag(value = "") {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function fmtVerdict(value = "") {
  return String(value || "").replaceAll("_", " ");
}

function fmtSource(value = "") {
  return String(value || "--").replaceAll("_", " ");
}

function fmtStrategy(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "position") return "Short Term";
  if (normalized === "longterm") return "Long Term";
  if (normalized === "intraday") return "Intraday";
  if (normalized === "swing") return "Swing";
  return fmtTag(value || "--");
}

function fmtAnalysisTimeframe(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "--";
  if (normalized === "daily" || normalized === "1d") return "Daily";
  if (normalized === "weekly" || normalized === "1w") return "Weekly";
  if (normalized === "monthly" || normalized === "1mo") return "Monthly";
  if (normalized === "intraday" || normalized === "1m" || normalized === "5m" || normalized === "15m" || normalized === "1h") return "Intraday";
  return fmtTag(value);
}

function candlestickQualityColor(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "ultra") return "cyan";
  if (normalized === "high" || normalized === "strong") return "green";
  if (normalized === "moderate") return "amber";
  return "red";
}

function candlestickPatternLabel(candlestick = {}) {
  const timeframe = fmtAnalysisTimeframe(candlestick?.analysisTimeframes?.pattern || candlestick?.timeframe || "daily");
  const pattern = candlestick?.detectedPattern || "No high-quality pattern";
  return `${timeframe}: ${pattern}`;
}

function getFundamentalsAvailability(focus) {
  if (!focus) {
    return {
      label: "--",
      detail: "--",
      discipline: "Fundamentals: --",
    };
  }

  const fundamentals = focus?.fundamentals || {};
  const source = focus?.verification?.fundamentalsSource || fundamentals.source;

  if (source && source !== "UNAVAILABLE") {
    const label = fmtSource(source);
    return {
      label,
      detail: fundamentals.symbol || "--",
      discipline: `Fundamentals: ${label}`,
    };
  }

  const reason = fundamentals.reason || "Screener public source is unreachable right now.";
  return {
    label: "Source issue",
    detail: reason,
    discipline: `Fundamentals: Source issue (${reason})`,
  };
}

function getCandlestickAnalysisStatus(focus) {
  const status = focus?.candlestickStatus || focus?.decisionEngine?.candlestickStatus;
  if (status === "ACTIVE" || status === "INACTIVE") {
    return status;
  }

  const raw = focus?.technicalSnapshot?.candlestick || {};
  const summary = String(raw.summary || focus?.candlestickAnalysis?.summary || "");
  const insufficientHistory = /not enough candle history/i.test(summary);
  const trend = String(raw.context?.trend || focus?.candlestickAnalysis?.context?.trend || "").toUpperCase();
  const location = String(raw.context?.location || focus?.candlestickAnalysis?.context?.location || "").toUpperCase();
  const hasEvaluatedContext = Boolean(raw.detectedPattern || focus?.candlestickAnalysis?.detectedPattern)
    && trend !== "UNKNOWN"
    && location !== "UNKNOWN";

  return !insufficientHistory && hasEvaluatedContext ? "ACTIVE" : "INACTIVE";
}

function verdictColor(value = "") {
  if (value.includes("BUY")) {
    return "green";
  }
  if (value.includes("SELL")) {
    return "red";
  }
  return "amber";
}

function tradeDecisionColor(value = "") {
  if (value === "BUY") return "green";
  if (value === "SELL") return "red";
  return "amber";
}

function safeUrl(value = "") {
  try {
    const url = new URL(value, location.origin);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return "#";
  }
  return "#";
}

function readRecent() {
  try {
    const raw = localStorage.getItem(RECENT_ASKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecent(items) {
  try {
    localStorage.setItem(RECENT_ASKS_KEY, JSON.stringify(items.slice(0, 8)));
  } catch {
    // Ignore localStorage failures.
  }
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `${response.status}`;
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(message);
  }
  return response.json();
}

function credibilityInsight(focus) {
  const verification = focus?.verification || {};
  const newsSummary = focus?.newsSummary || {};
  const verified = Number(verification.verifiedHeadlineCount || newsSummary.verifiedCount || 0);
  const official = Number(verification.officialHeadlineCount || newsSummary.officialCount || 0);
  const headlines = Number(verification.headlineCount || newsSummary.newsCount || 0);
  const realTime = Number(verification.realTimeHeadlineCount || newsSummary.realTimeCount || 0);
  const grade = verification.evidenceGrade || newsSummary.evidenceGrade || "";
  const note = focus?.evidence?.note || newsSummary.credibilityNote;

  if (grade === "A" || grade === "B") {
    return note || `Evidence grade ${grade} with ${realTime} real-time headline${realTime === 1 ? "" : "s"} in scope.`;
  }

  if (official > 0) {
    return `${official} official source${official === 1 ? "" : "s"} support this view.`;
  }
  if (verified >= 2) {
    return `${verified} headlines are cross-verified, which improves confidence in the narrative.`;
  }
  if (headlines > 0) {
    return "Relevant headlines exist, but they are mostly single-source, so treat them as directional rather than final proof.";
  }
  return note || "No fresh company-specific headline cluster was found, so conviction leans more on price, fundamentals, and macro context.";
}

function sourceDiscipline(focus) {
  const verification = focus?.verification || {};
  const newsSummary = focus?.newsSummary || {};
  const fundamentalsInfo = getFundamentalsAvailability(focus);
  return [
    `Price feed: ${fmtSource(verification.marketSource || focus?.quote?.source)}`,
    fundamentalsInfo.discipline,
    `Evidence grade: ${verification.evidenceGrade || newsSummary.evidenceGrade || "--"}`,
    `Real-time headlines: ${Number(verification.realTimeHeadlineCount || newsSummary.realTimeCount || 0)}`,
    `High-credibility sources: ${Number(verification.highCredibilityCount || newsSummary.highCredibilityCount || 0)}`,
    `Verified headlines: ${Number(verification.verifiedHeadlineCount || newsSummary.verifiedCount || 0)}`,
    `Official disclosures: ${Number(verification.officialHeadlineCount || newsSummary.officialCount || 0)}`,
  ];
}

function marketPlaybook(score) {
  if (score <= -1) {
    return [
      "Reduce position size and demand cleaner setups before acting.",
      "Prefer names with stronger balance-sheet support and smaller drawdowns.",
      "Treat unverified headlines as context only, not execution triggers.",
    ];
  }

  if (score >= 1) {
    return [
      "Momentum conditions are friendlier, but the stock still needs its own catalyst.",
      "Favor leaders with rising relative strength and clean risk controls.",
      "Use breadth and verification to avoid chasing crowded moves.",
    ];
  }

  return [
    "The market is mixed, so weight conviction toward stock-specific evidence.",
    "Prefer setups with balanced technical, fundamental, and news support.",
    "Use macro tags as guardrails rather than as standalone trade triggers.",
  ];
}

function Kicker({ children }) {
  return <span className="kicker">{children}</span>;
}

function Badge({ children, color = "default" }) {
  return <span className={`badge badge-${color}`}>{children}</span>;
}

function Pill({ children, color = "default" }) {
  return <span className={`pill pill-${color}`}>{children}</span>;
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function ScoreBar({ value = 0, color = "green" }) {
  return (
    <div className="score-bar-wrap">
      <div className="score-bar-track">
        <div
          className={`score-bar-fill score-fill-${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span>{fmt(value, "", 0)}</span>
    </div>
  );
}

function StatBox({ label, value, sub, color }) {
  return (
    <div className="stat-box">
      <span className="stat-label">{label}</span>
      <strong className={`stat-value ${color || ""}`}>{value}</strong>
      {sub ? <span className="stat-sub">{sub}</span> : null}
    </div>
  );
}

function ConnectionBanner({ info, quickConnect }) {
  if (!info) {
    return null;
  }

  const connected = Boolean(info.connected);
  return (
    <div className={`conn-banner ${connected ? "conn-live" : "conn-off"}`}>
      <div className="conn-dot" />
      <div className="conn-copy">
        <strong>{connected ? "Upstox connected" : "Public market data"}</strong>
        <span>{connected ? info.userInfo?.userName || "Live session active" : quickConnect?.message || info.message || "Connect Upstox for live feeds"}</span>
      </div>
      {!connected ? (
        <a href={quickConnect?.action?.url || quickConnect?.connectUrl || "/upstox/connect"} className="conn-btn">
          Connect
        </a>
      ) : (
        <span className="conn-source">Live</span>
      )}
    </div>
  );
}

function SearchBar({ onSubmitRef, loading }) {
  const [text, setText] = useState(DEFAULT_QUERY);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);

  SearchBar._setTextRef = setText;

  useEffect(() => {
    const handleMouseDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      clearTimeout(timerRef.current);
    };
  }, []);

  async function performSearch(query) {
    const trimmed = String(query || "").trim();
    if (!trimmed) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const semanticEndpoint = `/api/search/semantic?q=${encodeURIComponent(trimmed)}&limit=8`;
    const directEndpoint = `/api/universe?q=${encodeURIComponent(trimmed)}&limit=8`;
    const fuzzyEndpoint = `/api/search/fuzzy?q=${encodeURIComponent(trimmed)}&limit=8&tolerance=2`;

    try {
      const useSemanticFirst = /\s/.test(trimmed) || trimmed.length > 4;
      const primary = await apiFetch(useSemanticFirst ? semanticEndpoint : directEndpoint);
      let items = primary.items || [];

      if (!items.length && useSemanticFirst) {
        const fallback = await apiFetch(directEndpoint);
        items = fallback.items || [];
      }

      if (!items.length && trimmed.length >= 3) {
        const fuzzy = await apiFetch(fuzzyEndpoint);
        items = fuzzy.items || [];
      }

      setSuggestions(items);
      setOpen(true);
    } catch {
      setSuggestions([]);
      setOpen(true);
    }
  }

  function handleChange(value) {
    setText(value);
    clearTimeout(timerRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setOpen(true);
    timerRef.current = setTimeout(() => {
      performSearch(value);
    }, 220);
  }

  function submitQuery(nextQuery) {
    const query = String(nextQuery ?? text).trim();
    if (!query) {
      return;
    }
    setOpen(false);
    setSuggestions([]);
    onSubmitRef.current(query);
  }

  function pickSuggestion(symbol, companyName) {
    const query = `Analyze ${symbol}${companyName ? ` (${companyName})` : ""} across all strategies with full evidence`;
    setText(query);
    setOpen(false);
    setSuggestions([]);
    onSubmitRef.current(query, symbol, companyName);
  }

  return (
    <div className="search-wrap" ref={wrapRef}>
      <div className="search-box">
        <span className="search-icon">AI</span>
        <input
          id="query-input"
          className="search-input"
          value={text}
          placeholder="Ask: Analyze RELIANCE across all strategies with full evidence"
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => {
            if (text.trim()) {
              setOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitQuery();
            }
          }}
        />
        <button className="search-btn" type="button" onClick={() => submitQuery()} disabled={loading}>
          {loading ? <span className="spinner" /> : "Analyze"}
        </button>
      </div>

      <div className="search-guides">
        <div className="search-guide-card">
          <span>Best prompts</span>
          <p>Ask for the full cross-strategy view, compare two names, or request what changed today with evidence.</p>
        </div>
        <div className="search-guide-card">
          <span>What AI checks</span>
          <p>Trend, valuation, catalysts, risks, source quality, and how the call changes across intraday to long-term setups.</p>
        </div>
        <div className="search-guide-card">
          <span>Use with discipline</span>
          <p>Single-source headlines reduce confidence. Use the evidence cards to verify what is confirmed before acting.</p>
        </div>
      </div>

      {open && text.trim() ? (
        <div className="search-dropdown">
          <div className="search-results-header">
            <span>{suggestions.length ? `${suggestions.length} symbol matches` : "No direct symbol match yet"}</span>
            <Badge>AI interpretation stays on</Badge>
          </div>
          {suggestions.length ? (
            suggestions.map((item) => (
              <button
                key={item.symbol}
                className="search-suggestion"
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  pickSuggestion(item.symbol, item.companyName || item.name);
                }}
              >
                <strong>{item.symbol}</strong>
                <span>{item.companyName || item.name}</span>
                <Badge>{item.sector || "--"}</Badge>
              </button>
            ))
          ) : (
            <div className="search-empty-state">
              <p>No symbol matched that phrase directly. Press Analyze to let Superbrain interpret the full question.</p>
              <button className="btn-secondary" type="button" onClick={() => submitQuery()}>
                Analyze this question
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ConsensusBanner({ consensus, selection }) {
  if (!consensus) {
    return null;
  }

  return (
    <div className="consensus-banner">
      <div>
        <Kicker>Cross-Strategy Read</Kicker>
        <div className="consensus-title">{consensus.alignment}</div>
        <p className="muted">{consensus.summary}</p>
      </div>
      <div className="consensus-metrics">
        <div className="consensus-chip">
          <span>Bullish</span>
          <strong>{consensus.bullishCount}</strong>
        </div>
        <div className="consensus-chip">
          <span>Neutral</span>
          <strong>{consensus.neutralCount}</strong>
        </div>
        <div className="consensus-chip">
          <span>Bearish</span>
          <strong>{consensus.bearishCount}</strong>
        </div>
        <div className="consensus-chip consensus-chip-focus">
          <span>{selection?.mode === "explicit" ? "Requested Focus" : "Lead View"}</span>
          <strong>{selection?.primaryLabel || "--"}</strong>
        </div>
      </div>
    </div>
  );
}

function StrategyEvidenceCard({ item, selection }) {
  const itemColor = verdictColor(item.verdict || "");
  const supportive = (item.evidenceFor || []).length ? item.evidenceFor : (item.catalysts || []);
  const caution = (item.evidenceAgainst || []).length ? item.evidenceAgainst : (item.risks || []);
  const topDrivers = item.topDrivers || [];
  const sourceCoverage = item.verification?.sourceCoverage || [];

  return (
    <div className={`timeframe-card timeframe-${itemColor}`}>
      <div className="timeframe-top">
        <strong>{item.label || fmtStrategy(item.strategy)}</strong>
        {item.isPrimary ? (
          <Badge color="cyan">{selection?.mode === "explicit" ? "Requested focus" : "Lead view"}</Badge>
        ) : null}
      </div>

      <div className={`timeframe-verdict verdict-${itemColor}`}>{fmtVerdict(item.verdict || "HOLD")}</div>
      <p className="timeframe-summary">{item.recommendationSummary || item.thesis || "No strategy-specific summary is available yet."}</p>

      <div className="timeframe-badges">
        <Badge color={item.verification?.evidenceGrade === "A" || item.verification?.evidenceGrade === "B" ? "green" : "amber"}>
          Evidence {item.verification?.evidenceGrade || "--"}
        </Badge>
        <Badge>{item.verification?.verifiedHeadlineCount || 0} verified</Badge>
        <Badge>{item.verification?.headlineCount || 0} headlines</Badge>
        {item.dataCoverage?.coverageScore != null ? <Badge>Coverage {fmt(item.dataCoverage.coverageScore, "%", 0)}</Badge> : null}
      </div>

      <div className="timeframe-meta">
        <span>Confidence {fmt(item.confidence, "%", 0)}</span>
        <span>Score {fmt(item.adjustedScore, "", 1)}</span>
        <span>Action {fmtVerdict(item.tradeDecision?.action || "NO_TRADE")}</span>
        <span>Target {fmt(item.targets?.targetPrice)}</span>
        <span>Stop {fmt(item.targets?.stopLoss)}</span>
        <span>{fmtSource(item.verification?.marketSource)}</span>
      </div>

      <div className="timeframe-columns">
        <div className="timeframe-list-block">
          <span>Evidence for</span>
          <ul className="signal-list">
            {supportive.length ? supportive.slice(0, 3).map((entry) => <li key={entry}>{entry}</li>) : <li>No strong supportive cluster is active.</li>}
          </ul>
        </div>
        <div className="timeframe-list-block">
          <span>Watch-outs</span>
          <ul className="signal-list">
            {caution.length ? caution.slice(0, 3).map((entry) => <li key={entry}>{entry}</li>) : <li>No material counter-signal is active.</li>}
          </ul>
        </div>
      </div>

      {topDrivers.length ? (
        <div className="timeframe-driver-strip">
          {topDrivers.slice(0, 2).map((driver) => (
            <div key={driver.key || driver.title} className="timeframe-driver-chip">
              <strong>{driver.title}</strong>
              <p>{driver.signal}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="timeframe-foot">
        <span>{item.tradeDecision?.status || "WAIT - CONDITIONS NOT MET"}</span>
        <span>{candlestickPatternLabel(item.candlestick)}</span>
        {sourceCoverage[0] ? <span>{sourceCoverage[0].source} x{sourceCoverage[0].count}</span> : null}
      </div>
    </div>
  );
}

function SearchVisualPanel({ dashboard, focus }) {
  const regime = dashboard?.marketContext?.regime || "SYNCING";
  const evidenceGrade = focus?.verification?.evidenceGrade || "--";
  const coverage = dashboard?.summary?.totalCovered || 0;
  const focusSymbol = focus?.symbol || "SUPERBRAIN";
  const conviction = focus?.recommendation?.conviction || "Institutional scan online";
  const tiles = [
    { label: "Focus", value: focusSymbol, tone: "cyan" },
    { label: "Regime", value: regime, tone: dashboard?.marketContext?.riskOnScore >= 0 ? "green" : "red" },
    { label: "Evidence", value: evidenceGrade, tone: evidenceGrade === "A" || evidenceGrade === "B" ? "green" : "amber" },
    { label: "Coverage", value: coverage ? `${coverage} names` : "Syncing", tone: "amber" },
  ];

  return (
    <div className="search-visual-panel">
      <div className="search-visual-ring search-ring-outer" />
      <div className="search-visual-ring search-ring-mid" />
      <div className="search-visual-ring search-ring-inner" />
      <div className="search-visual-grid" />

      <div className="search-visual-core">
        <span className="search-visual-label">AI Core</span>
        <strong>{focusSymbol}</strong>
        <small>{conviction}</small>
      </div>

      <div className="search-visual-wave" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} />
        ))}
      </div>

      <div className="search-visual-tiles">
        {tiles.map((tile) => (
          <div key={tile.label} className={`search-visual-tile search-tile-${tile.tone}`}>
            <span>{tile.label}</span>
            <strong>{tile.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketGraphic({ dashboard, focus }) {
  const width = 460;
  const height = 220;
  const padding = 26;
  const benchmarks = (dashboard?.marketContext?.benchmarks || []).slice(0, 5);
  const fallback = [
    { label: "Nifty 50", changePct: 0.8 },
    { label: "Sensex", changePct: 0.4 },
    { label: "USDINR", changePct: -0.3 },
    { label: "Brent", changePct: 1.1 },
    { label: "Gold", changePct: -0.4 },
  ];
  const rawSeries = benchmarks.length ? benchmarks : fallback;
  const series = rawSeries.map((item, index) => ({
    label: item.label,
    value: Number(item.changePct || 0),
    x: padding + (index * (width - padding * 2)) / Math.max(1, (rawSeries.length - 1)),
  }));
  const maxAbs = Math.max(1, ...series.map((item) => Math.abs(item.value)));
  const points = series.map((item) => {
    const y = height / 2 - (item.value / maxAbs) * (height / 2 - padding);
    return { ...item, y };
  });
  const linePoints = points.map((item) => `${item.x},${item.y}`).join(" ");
  const areaPoints = `${padding},${height - padding} ${linePoints} ${width - padding},${height - padding}`;

  return (
    <div className="hero-card hero-card-chart">
      <div className="hero-card-head">
        <div>
          <Kicker>Market Graphic</Kicker>
          <h3>Benchmarks and pressure map</h3>
        </div>
        <Badge color={dashboard?.marketContext?.riskOnScore >= 0 ? "green" : "red"}>
          {dashboard?.marketContext?.regime || "Loading"}
        </Badge>
      </div>
      <div className="market-graphic-wrap">
        <svg className="market-graphic" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Market benchmark graphic">
          <defs>
            <linearGradient id="marketArea" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(27, 174, 115, 0.36)" />
              <stop offset="100%" stopColor="rgba(81, 102, 191, 0.04)" />
            </linearGradient>
          </defs>
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} className="market-axis" />
          <polygon points={areaPoints} className="market-area" />
          <polyline points={linePoints} className="market-line" />
          {points.map((item) => (
            <g key={item.label}>
              <circle cx={item.x} cy={item.y} r="5.5" className="market-point" />
              <text x={item.x} y={height - 10} textAnchor="middle" className="market-label">
                {item.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="market-graphic-foot">
        <div className="market-highlight">
          <span className="market-highlight-label">Focus</span>
          <strong>{focus?.symbol || dashboard?.focus?.symbol || "RELIANCE"}</strong>
          <span>{focus?.recommendation?.summary || dashboard?.focus?.recommendation?.summary || "Search any stock for a fresh recommendation."}</span>
        </div>
        <div className="market-highlight">
          <span className="market-highlight-label">Coverage</span>
          <strong>{dashboard?.summary?.totalCovered || 0}</strong>
          <span>{dashboard?.summary?.buySignals || 0} buy setups, {dashboard?.summary?.sellSignals || 0} sell setups</span>
        </div>
      </div>
    </div>
  );
}

function ResearchQualityCard({ focus, dashboard }) {
  const verification = focus?.verification || {};
  const newsSummary = focus?.newsSummary || {};
  const fundamentalsInfo = getFundamentalsAvailability(focus);
  const items = [
    ["Market feed", fmtSource(verification.marketSource || focus?.quote?.source), focus?.quote?.asOf ? timeAgo(focus.quote.asOf) : "--"],
    ["Fundamentals", fundamentalsInfo.label, fundamentalsInfo.detail],
    ["Headline coverage", verification.headlineCount ?? newsSummary.newsCount ?? 0, `${verification.verifiedHeadlineCount ?? newsSummary.verifiedCount ?? 0} verified`],
    ["Official support", verification.officialHeadlineCount ?? newsSummary.officialCount ?? 0, `${newsSummary.sourceCoverage?.length || 0} sources`],
  ];

  return (
    <div className="hero-card hero-card-quality">
      <div className="hero-card-head">
        <div>
          <Kicker>Research Quality</Kicker>
          <h3>How to trust this output</h3>
        </div>
        <Badge color={(verification.verifiedHeadlineCount || 0) > 0 || (verification.officialHeadlineCount || 0) > 0 ? "green" : "amber"}>
          Source discipline
        </Badge>
      </div>
      <p className="hero-muted">
        Superbrain should work as an evidence layer, not as a blind trade trigger. Review source quality, freshness, and verification before acting.
      </p>
      <div className="quality-grid">
        {items.map(([label, value, sub]) => (
          <div key={label} className="quality-item">
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{sub}</small>
          </div>
        ))}
      </div>
      <div className="quality-note">
        <strong>{credibilityInsight(focus)}</strong>
        <p>{dashboard?.disclaimer || "This output is a research aid. Confirm liquidity, price, and execution conditions before trading."}</p>
      </div>
      <ul className="quality-list">
        <li>Prefer ideas where price, fundamentals, and news all align.</li>
        <li>Use verified or official headlines over single-source narratives.</li>
        <li>Let market regime shape position size, not just direction.</li>
      </ul>
    </div>
  );
}

function VerdictCard({ focus, answer, disclaimer, allStrategies = [], strategyConsensus = null, strategySelection = null }) {
  if (!focus) {
    return <Empty text="Ask Superbrain about any Indian stock to see the verdict." />;
  }

  const color = verdictColor(focus.verdict);
  const changePct = Number(focus.quote?.changePct || 0);
  const lastQuoteUpdate = focus.quote?.asOf ? timeAgo(focus.quote.asOf) : "--";
  const tradeDecision = focus.tradeDecision || focus.decisionEngine?.tradeDecision || {};
  const executionPlan = focus.executionPlan || focus.decisionEngine?.executionPlan || {};
  const topDrivers = focus.decisionEngine?.topMarketDrivers || [];
  const candlestick = focus.candlestickAnalysis || focus.decisionEngine?.candlestickAnalysis || {};
  const candlestickStatus = getCandlestickAnalysisStatus(focus);
  const strategyCards = Array.isArray(allStrategies) && allStrategies.length
    ? allStrategies
    : [{
      strategy: focus.strategy,
      label: fmtStrategy(focus.strategy),
      isPrimary: true,
      verdict: focus.verdict,
      confidence: focus.confidence,
      adjustedScore: focus.adjustedScore || focus.score,
      targets: focus.targets,
      tradeDecision: {
        action: tradeDecision.action || "NO_TRADE",
        status: tradeDecision.status || "WAIT - CONDITIONS NOT MET",
        riskReward: tradeDecision.riskReward ?? null,
      },
    }];

  return (
    <div className="verdict-card">
      <div className="verdict-top">
        <div>
          <div className="verdict-symbol-row">
            <span className="verdict-symbol">{focus.symbol}</span>
            <span className="verdict-company">{focus.companyName}</span>
            {focus.sector ? <Pill color={color}>{focus.sector}</Pill> : null}
          </div>
          <div className={`verdict-action verdict-${color}`}>{fmtVerdict(focus.verdict)}</div>
          <p className="verdict-thesis">{answer || focus.recommendation?.summary || focus.thesis}</p>
        </div>
        <div className={`verdict-score-box score-${color}`}>
          <span>Confidence</span>
          <strong>{fmt(focus.confidence, "%", 0)}</strong>
          <span>{focus.recommendation?.conviction || "Measured"}</span>
        </div>
      </div>
      <div className="verdict-stats">
        <StatBox label="Price" value={fmt(focus.quote?.price)} sub={changePct >= 0 ? `+${fmt(changePct, "%")}` : fmt(changePct, "%")} color={changePct >= 0 ? "green" : "red"} />
        <StatBox label="Score" value={fmt(focus.adjustedScore || focus.score, "", 1)} sub={fmtStrategy(focus.strategy)} />
        <StatBox label="Target" value={fmt(focus.targets?.targetPrice)} sub={fmt(focus.targets?.targetPct, "%")} color="green" />
        <StatBox label="Stop" value={fmt(focus.targets?.stopLoss)} sub={focus.eventExposure?.pressure || "Mixed"} color="red" />
        <StatBox label="Risk" value={fmt(focus.scoreBreakdown?.risk, "", 0)} sub="risk score" />
        <StatBox label="Last Quote" value={lastQuoteUpdate} sub={fmtSource(focus.verification?.marketSource || focus.quote?.source)} />
      </div>
      <ConsensusBanner consensus={strategyConsensus} selection={strategySelection} />
      <div className="timeframe-section">
        <div className="timeframe-head">
          <Kicker>All Timeframe Recommendations</Kicker>
          <Badge>Intraday, Swing, Short Term, Long Term</Badge>
        </div>
        <div className="timeframe-grid">
          {strategyCards.map((item) => (
            <StrategyEvidenceCard key={item.strategy || item.label} item={item} selection={strategySelection} />
          ))}
        </div>
      </div>
      <div className="verdict-bars">
        {[
          ["Technical", focus.scoreBreakdown?.technical, "green"],
          ["Fundamentals", focus.scoreBreakdown?.fundamentals, "green"],
          ["News", focus.scoreBreakdown?.news, "amber"],
          ["Macro", focus.scoreBreakdown?.macro, "amber"],
          ["Events", focus.scoreBreakdown?.events, "amber"],
        ].map(([label, value, colorKey]) => (
          <div key={label} className="bar-row">
            <span>{label}</span>
            <ScoreBar value={value} color={colorKey} />
          </div>
        ))}
      </div>
      <div className="detail-grid">
        <div className="detail-card">
          <Kicker>Catalysts</Kicker>
          <ul className="signal-list">
            {(focus.catalysts || []).length ? (focus.catalysts || []).slice(0, 4).map((entry) => <li key={entry}>{entry}</li>) : <li>No strong catalyst cluster is active.</li>}
          </ul>
        </div>
        <div className="detail-card">
          <Kicker>Risk Flags</Kicker>
          <ul className="signal-list">
            {(focus.risks || []).length ? (focus.risks || []).slice(0, 4).map((entry) => <li key={entry}>{entry}</li>) : <li>No major risk flags are available.</li>}
          </ul>
        </div>
        <div className="detail-card">
          <Kicker>Trade Decision</Kicker>
          <ul className="signal-list">
            <li>Decision: {fmtVerdict(tradeDecision.action || "NO_TRADE")}</li>
            <li>Status: {tradeDecision.status || "WAIT - CONDITIONS NOT MET"}</li>
            <li>Reward to risk: {tradeDecision.riskReward ? `${tradeDecision.riskReward}:1` : "--"}</li>
            <li>Entry type: {executionPlan.entryType || "Wait"}</li>
            <li>Entry: {fmt(executionPlan.entry)}</li>
            <li>Stop loss: {fmt(executionPlan.stopLoss || focus.recommendation?.stopLoss || focus.targets?.stopLoss)}</li>
          </ul>
        </div>
        <div className="detail-card">
          <Kicker>Candlestick Analysis Status</Kicker>
          <div className={`lt-stance lt-${candlestickStatus === "ACTIVE" ? "green" : "red"}`}>{candlestickStatus}</div>
          <div className="news-tags">
            <Badge color={candlestickQualityColor(candlestick.signalQuality || candlestick.strength)}>{candlestick.signalQuality || candlestick.strength || "Weak"}</Badge>
            <Badge>{fmtAnalysisTimeframe(candlestick.analysisTimeframes?.pattern || candlestick.timeframe || "daily")} chart</Badge>
            <Badge>{fmtAnalysisTimeframe(candlestick.analysisTimeframes?.trend || "weekly")} filter</Badge>
          </div>
        </div>
        <div className="detail-card">
          <Kicker>Candlestick Context</Kicker>
          <div className="coverage-list">
            <span>Pattern {candlestick.detectedPattern || "No high-quality pattern"}</span>
            <span>Type {candlestick.kind || "--"}</span>
            <span>Pattern chart {fmtAnalysisTimeframe(candlestick.analysisTimeframes?.pattern || candlestick.timeframe || "daily")}</span>
            <span>Trend filter {fmtAnalysisTimeframe(candlestick.analysisTimeframes?.trend || "weekly")}</span>
            <span>Signal quality {candlestick.signalQuality || "--"}</span>
            <span>Quality score {fmt(candlestick.qualityScore, "", 1)}</span>
          </div>
          <ul className="signal-list">
            <li>Trend: {candlestick.context?.trend || "--"}</li>
            <li>Higher-timeframe bias: {candlestick.context?.higherTimeframeTrend || "--"}</li>
            <li>Location: {candlestick.context?.location || "--"}</li>
            <li>Strength: {candlestick.strength || "Weak"}</li>
            <li>Validity: {candlestick.validity || "Ignore"}</li>
          </ul>
          <p className="muted">{candlestick.summary || "Candlestick analysis will appear here when enough daily history is available."}</p>
          <ul className="signal-list">
            <li>Volume confirmation: {candlestick.context?.volumeConfirmation || "--"}</li>
            <li>Market structure: {candlestick.context?.marketStructure || "--"}</li>
            <li>Regime: {candlestick.context?.regime || "--"}</li>
            <li>Trigger: {candlestick.trigger || "Wait for stronger candle confirmation before using it as a trigger."}</li>
            {(candlestick.notes || []).slice(0, 2).map((note) => <li key={note}>{note}</li>)}
            <li>{candlestick.trapText || "No active trap signature is standing out."}</li>
          </ul>
        </div>
        <div className="detail-card">
          <Kicker>Source Discipline</Kicker>
          <ul className="signal-list">{sourceDiscipline(focus).map((entry) => <li key={entry}>{entry}</li>)}</ul>
          <p className="muted">{disclaimer || credibilityInsight(focus)}</p>
        </div>
      </div>
      {topDrivers.length ? (
        <div className="institutional-panel">
          <div className="institutional-head">
            <Kicker>Top 3 Market Drivers</Kicker>
            <Badge color={tradeDecisionColor(tradeDecision.action || "NO_TRADE")}>{tradeDecision.status || "Decision engine active"}</Badge>
          </div>
          <div className="driver-grid">
            {topDrivers.map((driver) => (
              <div key={driver.key || driver.title} className="reason-card driver-card">
                <strong>{driver.title}</strong>
                <div className="news-tags">
                  <Badge color={driver.direction === "bullish" ? "green" : driver.direction === "bearish" ? "red" : "amber"}>{driver.direction}</Badge>
                  <Badge>{driver.impactLevel}</Badge>
                </div>
                <p>{driver.signal}</p>
                <ul className="signal-list">
                  <li>{driver.what}</li>
                  <li>{driver.why}</li>
                  <li>{driver.impact}</li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="verdict-tags">
        {focus.longTermView ? <Badge color={verdictColor(focus.longTermView.stance)}>LT: {fmtVerdict(focus.longTermView.stance)}</Badge> : null}
        {focus.peerComparison?.position ? <Badge>{fmtTag(focus.peerComparison.position)}</Badge> : null}
        <Badge>{fmtSource(focus.verification?.marketSource || focus.quote?.source)}</Badge>
      </div>
    </div>
  );
}

function ReasonPanel({ focus, answer, allStrategies = [], strategyConsensus = null, strategySelection = null }) {
  if (!focus) {
    return <Empty text="Ask for a stock to unlock the evidence engine." />;
  }

  const peer = focus.peerComparison;
  const newsSummary = focus.newsSummary || {};
  const sourceCoverage = newsSummary.sourceCoverage || [];
  const decisionEngine = focus.decisionEngine || {};
  const scenarios = decisionEngine.scenarioAnalysis || [];
  const conflicts = decisionEngine.conflicts || [];
  const dataCoverage = decisionEngine.dataCoverage || {};
  const marketWide = decisionEngine.marketWideOpportunities || {};
  const candlestick = focus.candlestickAnalysis || decisionEngine.candlestickAnalysis || {};

  return (
    <div className="reason-grid">
      {allStrategies.length ? (
        <div className="reason-card reason-card-wide">
          <Kicker>Cross-Strategy Evidence Map</Kicker>
          {strategyConsensus ? <p>{strategyConsensus.summary}</p> : null}
          <div className="strategy-evidence-grid">
            {allStrategies.map((item) => (
              <div key={item.strategy} className="strategy-evidence-block">
                <div className="strategy-evidence-top">
                  <strong>{item.label}</strong>
                  <Badge color={verdictColor(item.verdict || "")}>{fmtVerdict(item.verdict || "HOLD")}</Badge>
                  {item.isPrimary ? <Badge color="cyan">{strategySelection?.mode === "explicit" ? "Requested focus" : "Lead view"}</Badge> : null}
                </div>
                <p>{item.recommendationSummary || item.thesis || "No strategy-specific summary is available yet."}</p>
                <div className="coverage-list">
                  <span>Confidence {fmt(item.confidence, "%", 0)}</span>
                  <span>Evidence {item.verification?.evidenceGrade || "--"}</span>
                  <span>{item.verification?.verifiedHeadlineCount || 0} verified</span>
                  <span>Coverage {fmt(item.dataCoverage?.coverageScore, "%", 0)}</span>
                </div>
                <div className="strategy-evidence-columns">
                  <ul className="signal-list">
                    {(((item.evidenceFor || []).length ? item.evidenceFor : item.catalysts || []).length
                      ? ((item.evidenceFor || []).length ? item.evidenceFor : item.catalysts || []).slice(0, 2).map((entry) => <li key={entry}>{entry}</li>)
                      : <li>No strong supportive cluster is active.</li>)}
                  </ul>
                  <ul className="signal-list">
                    {(((item.evidenceAgainst || []).length ? item.evidenceAgainst : item.risks || []).length
                      ? ((item.evidenceAgainst || []).length ? item.evidenceAgainst : item.risks || []).slice(0, 2).map((entry) => <li key={entry}>{entry}</li>)
                      : <li>No material counter-signal is active.</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="reason-card">
        <Kicker>Top 3 Market Drivers</Kicker>
        <ul className="signal-list">
          {(decisionEngine.topMarketDrivers || []).length ? (
            (decisionEngine.topMarketDrivers || []).map((driver) => (
              <li key={driver.key || driver.title}>
                <strong>{driver.title}:</strong> {driver.signal}
              </li>
            ))
          ) : (
            <li>No ranked market drivers are available yet.</li>
          )}
        </ul>
      </div>
      <div className="reason-card">
        <Kicker>Scenario Analysis</Kicker>
        <div className="scenario-list">
          {scenarios.length ? scenarios.map((scenario) => (
            <div key={scenario.name} className="scenario-item">
              <div className="scenario-top">
                <strong>{scenario.name}</strong>
                <Badge color={scenario.name === "Bullish" ? "green" : scenario.name === "Bearish" ? "red" : "amber"}>{scenario.probability}%</Badge>
              </div>
              <ul className="signal-list">
                {(scenario.case || []).map((entry) => <li key={entry}>{entry}</li>)}
              </ul>
            </div>
          )) : <p className="muted">Scenario engine is not ready yet.</p>}
        </div>
      </div>
      <div className="reason-card">
        <Kicker>AI Thesis</Kicker>
        <strong>{focus.symbol} - {fmtVerdict(focus.verdict)}</strong>
        <p>{answer || focus.recommendation?.summary || focus.thesis}</p>
      </div>
      <div className="reason-card">
        <Kicker>Evidence For The Case</Kicker>
        <ul className="signal-list">{(focus.buyReasons || []).length ? (focus.buyReasons || []).map((entry) => <li key={entry}>{entry}</li>) : <li>No strong bullish evidence cluster is active.</li>}</ul>
      </div>
      <div className="reason-card">
        <Kicker>Evidence Against The Case</Kicker>
        <ul className="signal-list">{(focus.sellReasons || []).length ? (focus.sellReasons || []).map((entry) => <li key={entry}>{entry}</li>) : <li>No major bearish evidence cluster is active.</li>}</ul>
      </div>
      <div className="reason-card">
        <Kicker>What Would Change The Call</Kicker>
        <ul className="signal-list">{(focus.monitorPoints || []).length ? (focus.monitorPoints || []).map((entry) => <li key={entry}>{entry}</li>) : <li>No explicit invalidation points are available for this setup.</li>}</ul>
      </div>
      <div className="reason-card">
        <Kicker>Candlestick Analysis</Kicker>
        <div className="coverage-list">
          <span>{candlestick.detectedPattern || "No pattern"}</span>
          <span>{fmtAnalysisTimeframe(candlestick.analysisTimeframes?.pattern || candlestick.timeframe || "daily")} chart</span>
          <span>{fmtAnalysisTimeframe(candlestick.analysisTimeframes?.trend || "weekly")} filter</span>
          <span>{candlestick.kind || "--"}</span>
          <span>{candlestick.context?.trend || "--"}</span>
          <span>{candlestick.context?.location || "--"}</span>
          <span>{candlestick.signalQuality || candlestick.strength || "Weak"}</span>
          <span>{candlestick.validity || "Ignore"}</span>
          <span>Score {fmt(candlestick.qualityScore, "", 1)}</span>
        </div>
        <div className="news-tags">
          <Badge color={candlestickQualityColor(candlestick.signalQuality || candlestick.strength)}>{candlestick.signalQuality || candlestick.strength || "Weak"}</Badge>
          <Badge>{fmtAnalysisTimeframe(candlestick.analysisTimeframes?.pattern || candlestick.timeframe || "daily")} pattern</Badge>
          <Badge>{fmtAnalysisTimeframe(candlestick.analysisTimeframes?.trend || "weekly")} confirmation</Badge>
        </div>
        <p>{candlestick.summary || "Candlestick context is not available yet."}</p>
        <ul className="signal-list">
          <li>Higher-timeframe bias: {candlestick.context?.higherTimeframeTrend || "--"}</li>
          <li>Volume confirmation: {candlestick.context?.volumeConfirmation || "--"}</li>
          <li>Market structure: {candlestick.context?.marketStructure || "--"}</li>
          <li>Regime: {candlestick.context?.regime || "--"}</li>
          <li>Trigger: {candlestick.trigger || "Wait for stronger candle confirmation before using it as a trigger."}</li>
          {(candlestick.notes || []).slice(0, 3).map((note) => <li key={note}>{note}</li>)}
          <li>{candlestick.trapText || "No active trap signature is standing out."}</li>
        </ul>
        {(candlestick.candidates || []).length > 1 ? (
          <div className="coverage-list">
            {(candlestick.candidates || []).slice(1, 3).map((entry) => (
              <span key={entry.pattern}>{entry.pattern} ({entry.signalQuality || entry.strength || "Weak"})</span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="reason-card">
        <Kicker>Conflict Detection</Kicker>
        <ul className="signal-list">
          {conflicts.length ? conflicts.map((entry) => (
            <li key={entry.title}>
              <strong>{entry.severity}:</strong> {entry.title}. {entry.detail}
            </li>
          )) : <li>No material signal conflicts are active.</li>}
        </ul>
      </div>
      <div className="reason-card">
        <Kicker>Macro And Event Drivers</Kicker>
        <div className="headline-rail">
          {(focus.macroDrivers || []).length ? (
            (focus.macroDrivers || []).slice(0, 4).map((entry) => (
              <a key={`${entry.source}-${entry.headline}`} className="headline-link-card" href={safeUrl(entry.url)} target="_blank" rel="noreferrer">
                <div className="news-meta">
                  <span>{entry.source}</span>
                  <span className="muted">{timeAgo(entry.publishedAt)}</span>
                </div>
                <strong>{entry.headline}</strong>
                <p>{entry.summary}</p>
                <div className="news-tags">
                  <Badge color={entry.impact >= 0 ? "green" : "red"}>{entry.impact >= 0 ? "Positive impact" : "Negative impact"}</Badge>
                  {(entry.tags || []).slice(0, 2).map((tag) => <Badge key={tag}>{fmtTag(tag)}</Badge>)}
                </div>
              </a>
            ))
          ) : (
            <p className="muted">No macro-driver stack is available right now.</p>
          )}
        </div>
      </div>
      <div className="reason-card">
        <Kicker>News Verification</Kicker>
        <div className="coverage-list">
          <span>Grade {newsSummary.evidenceGrade || focus?.verification?.evidenceGrade || "--"}</span>
          <span>{newsSummary.newsCount || 0} headlines in scope</span>
          <span>{newsSummary.realTimeCount || focus?.verification?.realTimeHeadlineCount || 0} real-time</span>
          <span>{newsSummary.verifiedCount || 0} cross-verified</span>
          <span>{newsSummary.officialCount || 0} official</span>
          <span>{sourceCoverage.length || 0} source groups</span>
        </div>
        <p className="muted">{credibilityInsight(focus)}</p>
        <ul className="signal-list">{sourceCoverage.length ? sourceCoverage.map((entry) => <li key={entry.source}>{entry.source}: {entry.count}</li>) : <li>No meaningful source clustering is available yet.</li>}</ul>
      </div>
      <div className="reason-card">
        <Kicker>Data Coverage</Kicker>
        <div className="coverage-list">
          <span>{(dataCoverage.available || []).length} inputs live</span>
          <span>{(dataCoverage.missingCritical || []).length} critical gaps</span>
          <span>{(dataCoverage.missingSupporting || []).length} supporting gaps</span>
          <span>Coverage {fmt(dataCoverage.coverageScore, "%", 0)}</span>
        </div>
        <ul className="signal-list">
          {(dataCoverage.available || []).slice(0, 4).map((entry) => <li key={entry}>{entry}</li>)}
          {(dataCoverage.missingCritical || []).slice(0, 3).map((entry) => <li key={entry}>{entry}</li>)}
        </ul>
      </div>
      <div className="reason-card">
        <Kicker>Peer Context</Kicker>
        {peer?.available ? (
          <>
            <strong>{fmtTag(peer.position || "mixed")}</strong>
            <p>{peer.summary}</p>
            <ul className="signal-list">
              {(peer.advantages || []).slice(0, 2).map((entry) => <li key={entry}>{entry}</li>)}
              {(peer.disadvantages || []).slice(0, 3).map((entry) => <li key={entry}>{entry}</li>)}
            </ul>
          </>
        ) : (
          <p className="muted">Peer comparison is not available for this name yet.</p>
        )}
      </div>
      <div className="reason-card">
        <Kicker>Market-Wide Opportunities</Kicker>
        <div className="split-grid">
          <div className="split-card compact">
            <strong>Strongest</strong>
            <ul className="signal-list">
              {(marketWide.strongest || []).length ? (marketWide.strongest || []).map((entry) => <li key={entry.symbol}>{entry.symbol}: {entry.reason}</li>) : <li>No leaders surfaced.</li>}
            </ul>
          </div>
          <div className="split-card compact">
            <strong>Weakest</strong>
            <ul className="signal-list">
              {(marketWide.weakest || []).length ? (marketWide.weakest || []).map((entry) => <li key={entry.symbol}>{entry.symbol}: {entry.reason}</li>) : <li>No laggards surfaced.</li>}
            </ul>
          </div>
        </div>
        <ul className="signal-list">
          {(marketWide.unusualActivity || []).slice(0, 3).map((entry) => <li key={entry.symbol}>{entry.symbol}: {entry.note}</li>)}
        </ul>
      </div>
      <div className="reason-card">
        <Kicker>Self-Critique</Kicker>
        <ul className="signal-list">
          {(decisionEngine.selfCritique?.whatCouldBeWrong || []).length ? (
            (decisionEngine.selfCritique?.whatCouldBeWrong || []).map((entry) => <li key={entry}>{entry}</li>)
          ) : (
            <li>No explicit critique points were generated.</li>
          )}
          {decisionEngine.selfCritique?.highestUncertainty ? <li>Highest uncertainty: {decisionEngine.selfCritique.highestUncertainty}</li> : null}
        </ul>
      </div>
    </div>
  );
}

function LongTermPanel({ focus }) {
  const longTermView = focus?.longTermView;
  const fundamentals = focus?.fundamentals;
  const fundamentalsInfo = getFundamentalsAvailability(focus);
  if (!longTermView) {
    return <Empty text="Long-horizon analysis will appear here after asking about a stock." />;
  }

  const color = longTermView.score >= 70 ? "green" : longTermView.score >= 52 ? "amber" : "red";

  return (
    <div className="lt-wrap">
      <div className="lt-head">
        <div>
          <Kicker>12-24 Month View</Kicker>
          <div className={`lt-stance lt-${color}`}>{longTermView.stance.replaceAll("_", " ")}</div>
        </div>
        <div className={`lt-score score-${color}`}>
          <span>Score</span>
          <strong>{fmt(longTermView.score, "", 1)}</strong>
          <span>{longTermView.horizon}</span>
        </div>
      </div>
      <p className="muted">{longTermView.summary}</p>
      {fundamentals?.source === "UNAVAILABLE" ? (
        <div className="quality-note">
          <strong>Fundamental data source issue</strong>
          <p>{fundamentalsInfo.detail}</p>
        </div>
      ) : null}
      <div className="verdict-stats">
        <StatBox label="P/E" value={fmt(fundamentals?.pe, "", 1)} sub="valuation" />
        <StatBox label="ROE" value={fmt(fundamentals?.roe, "%", 1)} sub="quality" color="green" />
        <StatBox label="ROCE" value={fmt(fundamentals?.roce, "%", 1)} sub="efficiency" color="green" />
        <StatBox label="3Y Sales" value={fmt(fundamentals?.salesGrowth3yr, "%", 0)} sub="growth" />
        <StatBox label="3Y Profit" value={fmt(fundamentals?.profitGrowth3yr, "%", 0)} sub="growth" />
        <StatBox label="Dividend" value={fmt(fundamentals?.dividendYield, "%", 2)} sub="yield" />
      </div>
      <div className="pillar-grid">
        {(longTermView.pillars || []).map((pillar) => (
          <div key={pillar.label} className="pillar-card">
            <span>{pillar.label}</span>
            <ScoreBar value={pillar.value} color={pillar.value >= 65 ? "green" : pillar.value >= 45 ? "amber" : "red"} />
            <p>{pillar.detail}</p>
          </div>
        ))}
      </div>
      <div className="split-grid">
        <div className="split-card">
          <Kicker>Structural Positives</Kicker>
          <ul className="signal-list">{(longTermView.opportunities || []).map((entry) => <li key={entry}>{entry}</li>)}</ul>
        </div>
        <div className="split-card">
          <Kicker>Structural Risks</Kicker>
          <ul className="signal-list">{(longTermView.concerns || []).map((entry) => <li key={entry}>{entry}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}

function MarketPanel({ dashboard }) {
  const regime = dashboard?.marketContext?.regime || "--";
  const riskOnScore = Number(dashboard?.marketContext?.riskOnScore || 0);
  const benchmarks = dashboard?.marketContext?.benchmarks || [];
  const events = dashboard?.eventRadar || [];
  const macroSignals = dashboard?.macroSignals || [];
  const playbook = marketPlaybook(riskOnScore);
  const marketWide = dashboard?.marketWideOpportunities || {};
  const sectorLeaders = marketWide?.sectorRotation?.leaders || [];
  const sectorLaggards = marketWide?.sectorRotation?.laggards || [];
  const unusualActivity = marketWide?.unusualActivity || [];

  return (
    <div className="market-wrap">
      <div className="market-snapshot-grid">
        <div className="stat-box">
          <span className="stat-label">Regime</span>
          <strong className={regime.includes("BULL") ? "green" : regime.includes("BEAR") || regime.includes("RISK_OFF") ? "red" : "amber"}>{regime}</strong>
          <span className="stat-sub">background condition</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Risk Score</span>
          <strong>{fmt(riskOnScore, "", 2)}</strong>
          <span className="stat-sub">market appetite</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Coverage</span>
          <strong>{dashboard?.summary?.totalCovered || 0}</strong>
          <span className="stat-sub">names reviewed</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Average Confidence</span>
          <strong>{fmt(dashboard?.summary?.avgConfidence, "%", 0)}</strong>
          <span className="stat-sub">across dashboard</span>
        </div>
      </div>
      <div className="bench-grid">
        {benchmarks.map((item) => (
          <div key={item.label} className="bench-card">
            <span>{item.label}</span>
            <strong>{fmt(item.price)}</strong>
            <span className={item.changePct >= 0 ? "green" : "red"}>
              {item.changePct >= 0 ? "+" : ""}
              {fmt(item.changePct, "%")}
            </span>
          </div>
        ))}
      </div>
      <div className="split-grid">
        <div className="split-card">
          <Kicker>Market Playbook</Kicker>
          <ul className="signal-list">{playbook.map((entry) => <li key={entry}>{entry}</li>)}</ul>
        </div>
        <div className="split-card">
          <Kicker>Event Radar</Kicker>
          <div className="event-list event-list-compact">
            {events.slice(0, 6).map((item) => (
              <div key={item.tag} className="event-row">
                <span>{fmtTag(item.tag)}</span>
                <div className="event-right">
                  <span className="muted">{item.count} signals</span>
                  <ScoreBar value={item.score} color={item.score >= 55 ? "green" : item.score <= 44 ? "red" : "amber"} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="split-grid">
        <div className="split-card">
          <Kicker>Sector Rotation</Kicker>
          <ul className="signal-list">
            {sectorLeaders.length ? sectorLeaders.map((item) => (
              <li key={item.sector}>{item.sector}: avg score {fmt(item.averageScore, "", 1)}, bullish share {fmt(item.bullishShare, "%", 0)}</li>
            )) : <li>Sector leadership is still loading.</li>}
          </ul>
        </div>
        <div className="split-card">
          <Kicker>Sector Laggards</Kicker>
          <ul className="signal-list">
            {sectorLaggards.length ? sectorLaggards.map((item) => (
              <li key={item.sector}>{item.sector}: avg score {fmt(item.averageScore, "", 1)}, bearish share {fmt(item.bearishShare, "%", 0)}</li>
            )) : <li>Sector laggard view is still loading.</li>}
          </ul>
        </div>
      </div>
      <div className="quality-note">
        <strong>Market-wide scan</strong>
        <p>
          {marketWide?.totalStocks
            ? `The broad engine pre-scanned ${marketWide.totalStocks} Indian equities and deep-ranked ${marketWide.deepAnalyzed || 0} names for the current timeframe.`
            : "Market-wide scan metadata is not available yet."}
        </p>
      </div>
      {unusualActivity.length ? (
        <div className="split-card compact">
          <Kicker>Unusual Activity</Kicker>
          <ul className="signal-list">
            {unusualActivity.slice(0, 5).map((item) => <li key={item.symbol}>{item.symbol}: {item.note}</li>)}
          </ul>
        </div>
      ) : null}
      <div className="news-list">
        {macroSignals.slice(0, 4).map((item) => (
          <a key={`${item.source}-${item.headline}`} className="news-card" href={safeUrl(item.url)} target="_blank" rel="noreferrer">
            <div className="news-meta">
              <span>{item.source}</span>
              <span className="muted">{timeAgo(item.publishedAt)}</span>
            </div>
            <strong>{item.headline}</strong>
            {item.summary ? <p>{item.summary}</p> : null}
            <div className="news-tags">
              {(item.tags || []).slice(0, 3).map((tag) => <Badge key={tag}>{fmtTag(tag)}</Badge>)}
              <Badge>{item.verificationCount || 0} source</Badge>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function LeadersPanel({ leaders = [], onFocus }) {
  if (!leaders.length) {
    return <Empty text="No leaderboard is available for the current dashboard selection." />;
  }

  return (
    <div className="leaders-grid">
      {leaders.map((item, index) => (
        <div key={item.symbol} className="leader-card">
          <div className="leader-card-top">
            <div>
              <div className="leader-rank-row">
                <span className="leader-rank">{index + 1}</span>
                <strong>{item.symbol}</strong>
              </div>
              <span className="leader-company">{item.companyName}</span>
            </div>
            <Pill color={verdictColor(item.verdict)}>{fmtVerdict(item.verdict)}</Pill>
          </div>

          <div className="leader-metrics">
            <div>
              <span>Price</span>
              <strong>{fmt(item.quote?.price)}</strong>
            </div>
            <div>
              <span>Confidence</span>
              <strong>{fmt(item.confidence, "%", 0)}</strong>
            </div>
            <div>
              <span>Score</span>
              <strong>{fmt(item.adjustedScore || item.score, "", 1)}</strong>
            </div>
            <div>
              <span>Target</span>
              <strong>{fmt(item.targets?.targetPct, "%")}</strong>
            </div>
          </div>

          <p className="leader-summary">{item.recommendation?.summary || item.thesis}</p>

          <div className="news-tags">
            {item.sector ? <Badge>{item.sector}</Badge> : null}
            {item.peerComparison?.position ? <Badge>{fmtTag(item.peerComparison.position)}</Badge> : null}
            <Badge>{fmtSource(item.verification?.marketSource || item.quote?.source)}</Badge>
          </div>

          <button className="btn-primary leader-card-action" type="button" onClick={() => onFocus(item.symbol, item.companyName)}>
            Open full analysis
          </button>
        </div>
      ))}
    </div>
  );
}

function NewsPanel({ focus, dashboard }) {
  const stockNews = focus?.news || [];
  const macroSignals = dashboard?.macroSignals || [];
  const sourceCoverage = focus?.newsSummary?.sourceCoverage || [];
  const grade = focus?.verification?.evidenceGrade || focus?.newsSummary?.evidenceGrade || "--";
  const credibilityNote = focus?.evidence?.note || focus?.newsSummary?.credibilityNote;

  return (
    <div className="news-sections">
      <div className="news-section">
        <div className="hero-card-head">
          <div>
            <Kicker>{focus?.symbol ? `${focus.symbol} News` : "Company News"}</Kicker>
            <h3>Stock-specific evidence</h3>
          </div>
          <Badge color={stockNews.some((item) => item.verified || item.official) ? "green" : "amber"}>
            {stockNews.length ? `${stockNews.length} items` : "No active cluster"}
          </Badge>
        </div>
        {credibilityNote ? (
          <div className="quality-note">
            <strong>Evidence grade {grade}</strong>
            <p>{credibilityNote}</p>
          </div>
        ) : null}
        {stockNews.length ? (
          <div className="news-list">
            {stockNews.map((item) => (
              <a key={`${item.source}-${item.headline}`} className="news-card" href={safeUrl(item.url)} target="_blank" rel="noreferrer">
                <div className="news-meta">
                  <span>{item.source}</span>
                  <span className="muted">{timeAgo(item.publishedAt)}</span>
                </div>
                <strong>{item.headline}</strong>
                {item.summary ? <p>{item.summary}</p> : null}
                <div className="news-tags">
                  {item.sentiment ? <Badge color={item.sentiment === "POSITIVE" ? "green" : item.sentiment === "NEGATIVE" ? "red" : "amber"}>{fmtTag(item.sentiment)}</Badge> : null}
                  {item.realTime ? <Badge color="cyan">Real-time</Badge> : null}
                  {item.credibilityLabel ? <Badge>{item.credibilityLabel}</Badge> : null}
                  {(item.tags || []).slice(0, 3).map((tag) => <Badge key={tag}>{fmtTag(tag)}</Badge>)}
                  {item.official ? <Badge color="cyan">Official</Badge> : null}
                  {item.verified ? <Badge color="green">Verified</Badge> : <Badge>{item.verificationCount || 1} source</Badge>}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <Empty text="No company-specific headline cluster was found in the current run. Use price, fundamentals, and macro context more heavily." />
        )}
        {sourceCoverage.length ? (
          <div className="quality-note">
            <strong>Source coverage</strong>
            <p>{sourceCoverage.map((entry) => `${entry.source} (${entry.count})`).join(", ")}</p>
          </div>
        ) : null}
      </div>

      <div className="news-section">
        <div className="hero-card-head">
          <div>
            <Kicker>Macro Backdrop</Kicker>
            <h3>Broad market headlines</h3>
          </div>
          <Badge>{macroSignals.length} items</Badge>
        </div>
        <div className="news-list">
          {macroSignals.slice(0, 6).map((item) => (
            <a key={`${item.source}-${item.headline}`} className="news-card" href={safeUrl(item.url)} target="_blank" rel="noreferrer">
              <div className="news-meta">
                <span>{item.source}</span>
                <span className="muted">{timeAgo(item.publishedAt)}</span>
              </div>
              <strong>{item.headline}</strong>
              {item.summary ? <p>{item.summary}</p> : null}
              <div className="news-tags">
                {(item.tags || []).slice(0, 3).map((tag) => <Badge key={tag}>{fmtTag(tag)}</Badge>)}
                {item.official ? <Badge color="cyan">Official</Badge> : null}
                <Badge>{item.verificationCount || 1} source</Badge>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResolutionPanel({ result, onFocus }) {
  if (!result) {
    return null;
  }

  const suggestions = result.suggestions || [];
  return (
    <div className="resolution-panel">
      <div className="resolution-message">{result.answer || "I could not map that query cleanly yet."}</div>
      {suggestions.length ? (
        <div className="disambig-chips">
          {suggestions.map((item) => (
            <button key={item.symbol} className="disambig-chip" type="button" onClick={() => onFocus(item.symbol, item.companyName)}>
              <strong>{item.symbol}</strong>
              <span>{item.companyName}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="resolution-hint">Try a tradable symbol such as RELIANCE, TCS, HDFCBANK, or ask a more direct question.</p>
      )}
    </div>
  );
}

function Sidebar({ dashboard, onFocus, activeTab, setActiveTab }) {
  const regime = dashboard?.marketContext?.regime || "--";
  const riskOn = dashboard?.marketContext?.riskOnScore;
  const tabs = ["Verdict", "Evidence", "Long Term", "Market", "Leaders", "News", "Signal Radar"];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <BrandMark />
        <div>
          <div className="brand-name">Superbrain</div>
          <div className="brand-sub">India Intelligence</div>
        </div>
      </div>
      <div className="sidebar-stats">
        <div className="ss-item">
          <span>Regime</span>
          <strong className={regime.includes("BULL") ? "green" : regime.includes("BEAR") ? "red" : "amber"}>{regime}</strong>
        </div>
        <div className="ss-item">
          <span>Risk Score</span>
          <strong>{riskOn != null ? fmt(riskOn, "", 2) : "--"}</strong>
        </div>
        <div className="ss-item">
          <span>Coverage</span>
          <strong>{dashboard?.summary?.totalCovered || 0}</strong>
        </div>
        <div className="ss-item">
          <span>Updated</span>
          <strong>{dashboard?.generatedAt ? timeAgo(dashboard.generatedAt) : "--"}</strong>
        </div>
      </div>
      <nav className="sidebar-nav">
        {tabs.map((tab) => (
          <button key={tab} className={`nav-item ${activeTab === tab ? "nav-active" : ""}`} type="button" onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>
      <div className="sidebar-leaders">
        <Kicker>Top Picks</Kicker>
        {(dashboard?.leaders || []).slice(0, 5).map((item, index) => (
          <button key={item.symbol} className="mini-leader" type="button" onClick={() => onFocus(item.symbol, item.companyName)}>
            <span className="mini-rank">{index + 1}</span>
            <span className="mini-sym">{item.symbol}</span>
            <Pill color={verdictColor(item.verdict)}>{(item.verdict || "").replaceAll("_", " ")}</Pill>
          </button>
        ))}
      </div>
    </aside>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [symbolsInput, setSymbolsInput] = useState(DEFAULT_WATCHLIST);
  const [strategy, setStrategy] = useState("swing");
  const [horizon, setHorizon] = useState("");
  const [recentAsks, setRecentAsks] = useState(readRecent);
  const [dashLoading, setDashLoading] = useState(false);
  const [askLoading, setAskLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Verdict");
  const [showSettings, setShowSettings] = useState(false);

  const onSubmitRef = useRef(null);

  const focus = analysisResult?.found ? analysisResult.analysis : dashboard?.focus || null;
  const answer = analysisResult?.found ? analysisResult.answer : "";
  const unresolved = analysisResult && !analysisResult.found ? analysisResult : null;
  const allStrategies = analysisResult?.found ? (analysisResult.allStrategies || []) : [];
  const strategyConsensus = analysisResult?.found ? (analysisResult.strategyConsensus || null) : null;
  const strategySelection = analysisResult?.found ? (analysisResult.strategySelection || null) : null;

  async function loadDashboard(preserve = false) {
    setDashLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ symbols: symbolsInput, strategy });
      if (horizon) {
        params.set("horizonDays", horizon);
      }
      const nextDashboard = await apiFetch(`/api/dashboard?${params.toString()}`);
      setDashboard(nextDashboard);
      if (!preserve) {
        setAnalysisResult(null);
      }
    } catch (nextError) {
      setError(nextError.message || "Dashboard load failed.");
    } finally {
      setDashLoading(false);
    }
  }

  function rememberAsk(query, symbol = "", companyName = "") {
    const trimmed = String(query || "").trim();
    if (!trimmed) {
      return;
    }
    const merged = [
      { query: trimmed, symbol, companyName, at: new Date().toISOString() },
      ...recentAsks.filter((item) => item.query !== trimmed),
    ].slice(0, 8);
    writeRecent(merged);
    setRecentAsks(merged);
  }

  async function runAsk(query, symbol = "", companyName = "") {
    const trimmed = String(query || "").trim();
    if (!trimmed) {
      return;
    }

    setAskLoading(true);
    setError("");

    try {
      let payload = await apiFetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          includeAllStrategies: true,
        }),
      });

      if (!payload.found && (!Array.isArray(payload.suggestions) || payload.suggestions.length === 0)) {
        try {
          const fallback = await apiFetch(`/api/search/semantic?q=${encodeURIComponent(trimmed)}&limit=5`);
          const items = Array.isArray(fallback.items) && fallback.items.length
            ? fallback.items
            : (await apiFetch(`/api/universe?q=${encodeURIComponent(trimmed)}&limit=5`)).items || [];
          if (Array.isArray(items) && items.length) {
            payload = {
              ...payload,
              suggestions: items.map((item) => ({
                symbol: item.symbol,
                companyName: item.companyName || item.name,
              })),
            };
          }
        } catch {
          // Keep the original unresolved payload.
        }
      }

      setAnalysisResult(payload);
      setActiveTab("Verdict");

      if (payload.found) {
        rememberAsk(trimmed, payload.symbol || symbol, payload.companyName || companyName);
      }
    } catch (nextError) {
      setError(nextError.message || "Ask failed.");
    } finally {
      setAskLoading(false);
    }
  }

  onSubmitRef.current = runAsk;

  function focusSymbol(symbol, companyName = "") {
    const query = `Analyze ${symbol}${companyName ? ` (${companyName})` : ""} across all strategies with full evidence`;
    if (SearchBar._setTextRef) {
      SearchBar._setTextRef(query);
    }
    runAsk(query, symbol, companyName);
  }

  function connectUpstox() {
    window.location.href = "/upstox/connect";
  }

  useEffect(() => {
    loadDashboard(true);
  }, []);

  useEffect(() => {
    const handleSlashFocus = (event) => {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        event.preventDefault();
        document.getElementById("query-input")?.focus();
      }
    };
    window.addEventListener("keydown", handleSlashFocus);
    return () => {
      window.removeEventListener("keydown", handleSlashFocus);
    };
  }, []);

  const quickSymbols = [...new Set([...(dashboard?.leaders || []).map((item) => item.symbol), ...DEFAULT_QUICK])].slice(0, 12);

  return (
    <div className="app">
      <Sidebar
        dashboard={dashboard}
        onFocus={focusSymbol}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">Superbrain India</span>
            <span className="topbar-regime">{dashboard?.marketContext?.regime || "Loading"}</span>
          </div>
          <div className="topbar-right">
            <button className="btn-secondary" type="button" onClick={connectUpstox}>
              Upstox Connect
            </button>
            <button className="btn-secondary" type="button" onClick={() => loadDashboard(true)} disabled={dashLoading}>
              {dashLoading ? "Refreshing..." : "Refresh"}
            </button>
            <button className="icon-btn" type="button" onClick={() => setShowSettings((value) => !value)} title="Settings">
              S
            </button>
          </div>
        </header>

        <div className="main-scroll">
          <section className="search-section">
            <div className="search-shell">
              <div className="search-hero-row">
                <div className="search-copy">
                  <Kicker>Ask Superbrain</Kicker>
                  <h1>AI research cockpit for Indian equities.</h1>
                  <p>Ask one natural-language question and Superbrain now shows the full cross-strategy stack with evidence, not just a single swing or long-term bias.</p>
                </div>
                <SearchVisualPanel dashboard={dashboard} focus={focus} />
              </div>
              <SearchBar onSubmitRef={onSubmitRef} loading={askLoading} />
              <div className="quick-chips">
                {quickSymbols.map((symbol) => (
                  <button key={symbol} className="quick-chip" type="button" onClick={() => focusSymbol(symbol)}>
                    {symbol}
                  </button>
                ))}
              </div>
              {recentAsks.length ? (
                <div className="recent-row">
                  <span className="muted">Recent</span>
                  {recentAsks.slice(0, 5).map((item) => (
                    <button
                      key={item.at}
                      className="recent-chip"
                      type="button"
                      onClick={() => {
                        if (SearchBar._setTextRef) {
                          SearchBar._setTextRef(item.query);
                        }
                        runAsk(item.query);
                      }}
                    >
                      {item.symbol || item.query.slice(0, 20)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section className="hero-grid">
            <div className="hero-card hero-card-summary">
              <div className="hero-card-head">
                <div>
                  <Kicker>Decision Overview</Kicker>
                  <h2>{focus?.symbol || "Market overview"}</h2>
                </div>
                {focus?.verdict ? <Pill color={verdictColor(focus.verdict)}>{fmtVerdict(focus.verdict)}</Pill> : <Badge>Research live</Badge>}
              </div>
              <p className="hero-muted">
                {answer || focus?.recommendation?.summary || "Use the tabs below to move from headline verdict to evidence, long-term context, market regime, and signal scans."}
              </p>
              <div className="hero-stats">
                <StatBox label="Average confidence" value={fmt(dashboard?.summary?.avgConfidence, "%", 0)} sub="across coverage" />
                <StatBox label="Buy setups" value={dashboard?.summary?.buySignals || 0} sub="current dashboard" color="green" />
                <StatBox label="Sell setups" value={dashboard?.summary?.sellSignals || 0} sub="current dashboard" color="red" />
              </div>
            </div>
            <MarketGraphic dashboard={dashboard} focus={focus} />
            <ResearchQualityCard focus={focus} dashboard={dashboard} />
          </section>

          {error ? <div className="error-bar">{error}</div> : null}
          <ResolutionPanel result={unresolved} onFocus={focusSymbol} />

          {showSettings ? (
            <div className="settings-panel">
              <Kicker>Dashboard Settings</Kicker>
              <p className="muted settings-note">These filters only affect the watchlist dashboard. Stock search always runs all strategies and shows the full evidence stack.</p>
              <div className="settings-grid">
                <label className="field">
                  <span>Watchlist</span>
                  <input value={symbolsInput} onChange={(event) => setSymbolsInput(event.target.value)} />
                </label>
                <label className="field">
                  <span>Dashboard Bias</span>
                  <select value={strategy} onChange={(event) => setStrategy(event.target.value)}>
                    <option value="swing">Swing</option>
                    <option value="position">Position</option>
                    <option value="longterm">Long Term</option>
                    <option value="intraday">Intraday</option>
                  </select>
                </label>
                <label className="field">
                  <span>Dashboard Horizon</span>
                  <select value={horizon} onChange={(event) => setHorizon(event.target.value)}>
                    <option value="">Auto</option>
                    <option value="20">20 Days</option>
                    <option value="60">60 Days</option>
                    <option value="240">12 Months</option>
                  </select>
                </label>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => {
                    setShowSettings(false);
                    loadDashboard();
                  }}
                >
                  Apply Dashboard Filters
                </button>
              </div>
              <div className="integration-strip">
                <div>
                  <Kicker>Broker Integration</Kicker>
                  <p>Open the Upstox authorization flow when you want local OAuth and broker-backed quote access. Status is intentionally kept out of the main dashboard.</p>
                </div>
                <button className="btn-secondary" type="button" onClick={connectUpstox}>
                  Open Upstox Connect
                </button>
              </div>
            </div>
          ) : null}

          <div className="tab-content">
            {activeTab === "Verdict" ? <VerdictCard focus={focus} answer={answer} disclaimer={dashboard?.disclaimer} allStrategies={allStrategies} strategyConsensus={strategyConsensus} strategySelection={strategySelection} /> : null}
            {activeTab === "Evidence" ? <ReasonPanel focus={focus} answer={answer} allStrategies={allStrategies} strategyConsensus={strategyConsensus} strategySelection={strategySelection} /> : null}
            {activeTab === "Long Term" ? <LongTermPanel focus={focus} /> : null}
            {activeTab === "Market" ? <MarketPanel dashboard={dashboard} /> : null}
            {activeTab === "Leaders" ? <LeadersPanel leaders={dashboard?.leaders || []} onFocus={focusSymbol} /> : null}
            {activeTab === "News" ? <NewsPanel focus={focus} dashboard={dashboard} /> : null}
            {activeTab === "Signal Radar" ? <TopSignalsTab onFocus={focusSymbol} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
