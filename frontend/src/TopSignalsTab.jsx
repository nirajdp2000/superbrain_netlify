import { useEffect, useRef, useState } from "react";

function fmt(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }
  return Number(value).toFixed(digits);
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

function polarPoint(cx, cy, radius, angleDeg) {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + Math.cos(radians) * radius,
    y: cy + Math.sin(radians) * radius,
  };
}

function OverviewCard({ label, value, sub, tone = "neutral" }) {
  return (
    <div className={`signals-stat signals-stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function RadarSignalHero({ overview, bullishStocks, bearishStocks, timeframe, autoRefresh, lastUpdated }) {
  const sectorLeader = Array.isArray(overview?.sectorRotation) ? overview.sectorRotation[0] : null;
  const anomaly = Array.isArray(overview?.unusualActivity) ? overview.unusualActivity[0] : null;
  const totalStocks = Number(overview?.totalStocks || overview?.totalAnalyzed || 0);
  const deepRanked = Number(overview?.deepAnalyzed || 0);
  const breadthBias = Number(overview?.bullishCount || 0) - Number(overview?.bearishCount || 0);
  const sentiment = String(overview?.marketSentiment || "neutral").toUpperCase();
  const plottedSignals = [
    ...bullishStocks.slice(0, 4).map((stock) => ({ ...stock, tone: "bullish" })),
    ...bearishStocks.slice(0, 4).map((stock) => ({ ...stock, tone: "bearish" })),
  ];
  const points = plottedSignals.map((stock, index) => {
    const signal = Math.min(100, Math.max(0, Number(stock.radarScore || stock.score || 0)));
    const angle = plottedSignals.length > 1 ? (360 / plottedSignals.length) * index : 0;
    const radius = 78 + signal * 0.7;
    return {
      ...stock,
      signal,
      ...polarPoint(180, 180, radius, angle),
    };
  });

  return (
    <div className="signals-hero-grid">
      <div className="signals-radar-panel">
        <div className="signals-radar-copy">
          <span className="kicker">Radar Graphics</span>
          <h3>AI signal dome</h3>
          <p>The scanner plots live opportunity nodes from the ranked shortlist, so the buy and sell lanes feel like an active radar board rather than a plain list.</p>

          <div className="signals-radar-metrics">
            <div className="signals-metric-chip">
              <span>Mode</span>
              <strong>{String(timeframe || "swing").replaceAll("_", " ")}</strong>
            </div>
            <div className="signals-metric-chip">
              <span>Sweep</span>
              <strong>{autoRefresh ? "Live pulse" : "Manual pulse"}</strong>
            </div>
            <div className="signals-metric-chip">
              <span>Sentiment</span>
              <strong>{sentiment}</strong>
            </div>
          </div>
        </div>

        <div className="signals-radar-stage">
          <svg className="radar-svg" viewBox="0 0 360 360" role="img" aria-label="Signal radar graphic">
            <defs>
              <radialGradient id="radarCoreGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(106, 220, 255, 0.42)" />
                <stop offset="100%" stopColor="rgba(106, 220, 255, 0)" />
              </radialGradient>
            </defs>

            <circle cx="180" cy="180" r="146" className="radar-ring" />
            <circle cx="180" cy="180" r="110" className="radar-ring" />
            <circle cx="180" cy="180" r="74" className="radar-ring" />
            <circle cx="180" cy="180" r="38" className="radar-ring radar-ring-inner" />
            <line x1="180" y1="20" x2="180" y2="340" className="radar-axis" />
            <line x1="20" y1="180" x2="340" y2="180" className="radar-axis" />
            <line x1="67" y1="67" x2="293" y2="293" className="radar-axis radar-axis-soft" />
            <line x1="293" y1="67" x2="67" y2="293" className="radar-axis radar-axis-soft" />

            <g className="radar-sweep-group">
              <path d="M180 180 L180 28 A152 152 0 0 1 290 74 Z" className="radar-sweep-cone" />
              <line x1="180" y1="180" x2="180" y2="24" className="radar-sweep-line" />
            </g>

            <circle cx="180" cy="180" r="86" fill="url(#radarCoreGlow)" />

            {points.map((point) => (
              <g key={`${point.symbol}-${point.tone}`} className={`radar-node radar-node-${point.tone}`}>
                <circle cx={point.x} cy={point.y} r="8" className="radar-node-dot" />
                <circle cx={point.x} cy={point.y} r="18" className="radar-node-halo" />
                <text x={point.x} y={point.y - 16} textAnchor="middle" className="radar-node-label">
                  {point.symbol}
                </text>
              </g>
            ))}

            <circle cx="180" cy="180" r="10" className="radar-center-dot" />
          </svg>

          <div className="radar-center-readout">
            <span>Tracked nodes</span>
            <strong>{points.length || deepRanked}</strong>
            <small>{lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : "Radar syncing"}</small>
          </div>
        </div>
      </div>

      <div className="signals-intel-stack">
        <div className="signals-intel-card signals-intel-primary">
          <span>Universe coverage</span>
          <strong>{totalStocks}</strong>
          <small>{deepRanked} deep-ranked setups in the active sweep</small>
        </div>

        <div className="signals-intel-grid">
          <div className="signals-intel-card">
            <span>Breadth bias</span>
            <strong>{breadthBias >= 0 ? `+${breadthBias}` : breadthBias}</strong>
            <small>{breadthBias >= 0 ? "bullish skew" : "bearish skew"}</small>
          </div>
          <div className="signals-intel-card">
            <span>Auto refresh</span>
            <strong>{autoRefresh ? "ON" : "OFF"}</strong>
            <small>{autoRefresh ? "30 second cadence" : "manual control"}</small>
          </div>
        </div>

        <div className="signals-intel-card signals-intel-note">
          <span>Sector lead</span>
          <strong>{sectorLeader?.sector || "Scanning"}</strong>
          <small>{sectorLeader ? `${fmt(sectorLeader.averageScore, 0)} average signal strength` : "Waiting for leadership data"}</small>
        </div>

        {anomaly ? (
          <div className="signals-intel-card signals-intel-alert">
            <span>Unusual activity</span>
            <strong>{anomaly.symbol}</strong>
            <small>{anomaly.note}</small>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SignalCard({ stock, type, onFocus }) {
  const bearish = type === "bearish";
  const changeClass = Number(stock.changePercent || 0) >= 0 ? "green" : "red";
  const strength = Math.min(100, Math.max(0, Number(stock.score || 0)));
  const radarLabel = String(stock.radarVerdict || (bearish ? "SELL" : "BUY")).replaceAll("_", " ");

  return (
    <button className={`signal-card ${bearish ? "signal-card-bearish" : "signal-card-bullish"}`} type="button" onClick={() => onFocus?.(stock.symbol, stock.name)}>
      <div className="signal-card-top">
        <div>
          <strong>{stock.symbol}</strong>
          <span>{stock.name}</span>
        </div>
        <div className="signal-card-score">
          <span>Radar</span>
          <strong>{fmt(stock.score, 0)}</strong>
        </div>
      </div>

      <div className="signal-card-middle">
        <div className="signal-card-price">
          <strong>Rs {fmt(stock.price)}</strong>
          <span className={changeClass}>
            {Number(stock.changePercent || 0) >= 0 ? "+" : ""}
            {fmt(stock.changePercent)}%
          </span>
        </div>
        <span className={`signal-pill ${bearish ? "signal-pill-bearish" : "signal-pill-bullish"}`}>{radarLabel}</span>
      </div>

      <p className="signal-card-reason">{stock.reason || "No server-generated summary is available for this setup."}</p>

      <div className="signal-strength">
        <span>Radar strength</span>
        <div className="signal-strength-track">
          <div className="signal-strength-fill" style={{ width: `${strength}%` }} />
        </div>
        <span>{strength}%</span>
      </div>

      <div className="signal-card-tags">
        {stock.sector ? <span>{stock.sector}</span> : null}
        {stock.evidenceGrade ? <span>Evidence {stock.evidenceGrade}</span> : null}
        {stock.strictVerdict && stock.strictVerdict !== stock.radarVerdict ? <span>Core {String(stock.strictVerdict).replaceAll("_", " ")}</span> : null}
        {Number(stock.quickScore || 0) > 0 ? <span>Pre-scan {fmt(stock.quickScore, 0)}</span> : null}
        {stock.riskReward ? <span>RR {fmt(stock.riskReward)}:1</span> : null}
        {stock.executionReadiness ? <span>{stock.executionReadiness === "READY FOR EXECUTION" ? "Execution ready" : "Watch only"}</span> : null}
        {Number(stock.realTimeCount || 0) > 0 ? <span>{stock.realTimeCount} live news</span> : null}
      </div>
    </button>
  );
}

function EmptySignalState({ title, body }) {
  return (
    <div className="signal-empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

export default function TopSignalsTab({ onFocus }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bullishStocks, setBullishStocks] = useState([]);
  const [bearishStocks, setBearishStocks] = useState([]);
  const [marketOverview, setMarketOverview] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState("swing");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refreshInterval = useRef(null);

  const timeframes = [
    { value: "intraday", label: "Intraday" },
    { value: "swing", label: "Swing" },
    { value: "short_term", label: "Short Term" },
    { value: "long_term", label: "Long Term" },
  ];

  async function fetchTopSignals() {
    setLoading(true);
    setError("");

    try {
      const [overviewResponse, bullishResponse, bearishResponse] = await Promise.all([
        fetch("/api/v2/market-signals"),
        fetch(`/api/v2/top-signals?type=bullish&timeframe=${selectedTimeframe}&limit=10`),
        fetch(`/api/v2/top-signals?type=bearish&timeframe=${selectedTimeframe}&limit=10`),
      ]);

      if (!overviewResponse.ok || !bullishResponse.ok || !bearishResponse.ok) {
        throw new Error("Signal scan is temporarily unavailable.");
      }

      const overviewData = await overviewResponse.json();
      const bullishData = await bullishResponse.json();
      const bearishData = await bearishResponse.json();

      if (overviewData.error || bullishData.error || bearishData.error) {
        throw new Error(overviewData.error || bullishData.error || bearishData.error);
      }

      setBullishStocks(bullishData.stocks || []);
      setBearishStocks(bearishData.stocks || []);
      setMarketOverview({
        ...overviewData,
        totalStocks: overviewData.totalStocks || bullishData.totalAnalyzed || bearishData.totalAnalyzed || 0,
        totalAnalyzed: overviewData.totalAnalyzed || bullishData.totalAnalyzed || bearishData.totalAnalyzed || 0,
        deepAnalyzed: bullishData.deepAnalyzed || bearishData.deepAnalyzed || overviewData.deepAnalyzed || 0,
      });
      setLastUpdated(bullishData.lastUpdated || bearishData.lastUpdated || overviewData.lastUpdated || new Date().toISOString());
    } catch (nextError) {
      setError(nextError.message || "Signal scan failed.");
      setBullishStocks([]);
      setBearishStocks([]);
      setMarketOverview(null);
      setLastUpdated(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTopSignals();
  }, [selectedTimeframe]);

  useEffect(() => {
    if (autoRefresh) {
      refreshInterval.current = setInterval(fetchTopSignals, 30000);
    }

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [autoRefresh, selectedTimeframe]);

  const neutralCount = Math.max(0, Number(marketOverview?.neutralCount ?? (marketOverview?.totalStocks || 0) - (marketOverview?.bullishCount || 0) - (marketOverview?.bearishCount || 0)));

  return (
    <div className="signals-shell">
      <div className="signals-header">
        <div>
          <span className="kicker">Signal Radar</span>
          <h2>Server-ranked opportunity scan</h2>
          <p>Review only the setups the backend currently scores high enough to surface. The scanner now pre-screens the broad NSE and BSE equity universe before ranking a deeper shortlist.</p>
        </div>
        <div className="signals-actions">
          <button className={`signals-toggle ${autoRefresh ? "active" : ""}`} type="button" onClick={() => setAutoRefresh((value) => !value)}>
            {autoRefresh ? "Auto refresh on" : "Auto refresh off"}
          </button>
          <button className="btn-secondary" type="button" onClick={fetchTopSignals}>
            Refresh now
          </button>
        </div>
      </div>

      <div className="signals-timeframes">
        {timeframes.map((item) => (
          <button
            key={item.value}
            className={`signals-timeframe-btn ${selectedTimeframe === item.value ? "active" : ""}`}
            type="button"
            onClick={() => setSelectedTimeframe(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <RadarSignalHero
        overview={marketOverview}
        bullishStocks={bullishStocks}
        bearishStocks={bearishStocks}
        timeframe={selectedTimeframe}
        autoRefresh={autoRefresh}
        lastUpdated={lastUpdated}
      />

      <div className="signals-overview">
        <OverviewCard label="Bullish" value={marketOverview?.bullishCount || 0} sub="cleared threshold" tone="bullish" />
        <OverviewCard label="Neutral" value={neutralCount} sub="mixed conviction" />
        <OverviewCard label="Bearish" value={marketOverview?.bearishCount || 0} sub="cleared threshold" tone="bearish" />
        <OverviewCard label="Universe" value={marketOverview?.totalStocks || marketOverview?.totalAnalyzed || 0} sub={marketOverview?.deepAnalyzed ? `${marketOverview.deepAnalyzed} deep ranked` : (marketOverview?.marketSentiment || "updating")} />
      </div>

      <div className="quality-note signals-note">
        <strong>Coverage rule</strong>
        <p>The broad universe is pre-scanned first, then a smaller shortlist is deeply ranked with the full research stack. If no names clear the threshold, the panel stays empty instead of inventing example signals.</p>
      </div>

      {error ? <div className="error-bar">{error}</div> : null}

      {loading ? (
        <div className="signals-loading">
          <div className="spinner large" />
          <p>Refreshing market signals...</p>
        </div>
      ) : (
        <div className="signals-board">
          <section className="signals-column">
            <div className="signals-column-head">
              <h3>Most bullish stocks</h3>
              <span>{bullishStocks.length} names</span>
            </div>
            <div className="signals-list">
              {bullishStocks.length ? (
                bullishStocks.map((stock) => <SignalCard key={stock.symbol} stock={stock} type="bullish" onFocus={onFocus} />)
              ) : (
                <EmptySignalState
                  title="No bullish names cleared the threshold"
                  body="That usually means breadth is weak for this timeframe, which is itself a useful caution signal."
                />
              )}
            </div>
          </section>

          <section className="signals-column">
            <div className="signals-column-head">
              <h3>Most bearish stocks</h3>
              <span>{bearishStocks.length} names</span>
            </div>
            <div className="signals-list">
              {bearishStocks.length ? (
                bearishStocks.map((stock) => <SignalCard key={stock.symbol} stock={stock} type="bearish" onFocus={onFocus} />)
              ) : (
                <EmptySignalState
                  title="No bearish names cleared the threshold"
                  body="The engine is not currently finding enough downside conviction in this timeframe to rank a bearish shortlist."
                />
              )}
            </div>
          </section>
        </div>
      )}

      {lastUpdated ? (
        <div className="signals-footer">
          Last updated {timeAgo(lastUpdated)} | {autoRefresh ? "Refresh every 30 seconds" : "Manual refresh"}
        </div>
      ) : null}
    </div>
  );
}
