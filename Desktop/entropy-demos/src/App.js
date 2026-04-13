import { useState } from "react"
import SpecsForm from './SpecsForm'

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #0a0a0a;
    color: #ededed;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
  }

  .page {
    max-width: 900px;
    margin: 0 auto;
    padding: 48px 24px;
  }

  .wordmark {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.5px;
    color: #fff;
    margin-bottom: 4px;
  }

  .tagline {
    color: #555;
    font-size: 13px;
    margin-bottom: 48px;
  }

  .card {
    background: #111;
    border: 1px solid #222;
    border-radius: 12px;
    padding: 28px;
    margin-bottom: 16px;
  }

  .card-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #555;
    margin-bottom: 20px;
  }

  label {
    display: block;
    font-size: 12px;
    color: #888;
    margin-bottom: 6px;
    margin-top: 16px;
  }

  label:first-of-type { margin-top: 0; }

  input, select {
    width: 100%;
    background: #0a0a0a;
    border: 1px solid #222;
    border-radius: 8px;
    color: #ededed;
    font-size: 14px;
    padding: 10px 12px;
    outline: none;
    appearance: none;
    transition: border-color 0.15s;
  }

  input:focus, select:focus { border-color: #444; }

  .btn {
    width: 100%;
    margin-top: 24px;
    padding: 12px;
    background: #fff;
    color: #000;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn:hover { opacity: 0.85; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }

  .kpi {
    background: #0a0a0a;
    border: 1px solid #222;
    border-radius: 10px;
    padding: 16px;
  }

  .kpi-label {
    font-size: 11px;
    color: #555;
    margin-bottom: 6px;
  }

  .kpi-value {
    font-size: 22px;
    font-weight: 600;
    color: #fff;
    letter-spacing: -0.5px;
  }

  .kpi-unit {
    font-size: 11px;
    color: #555;
    margin-top: 2px;
  }

  .kpi.highlight { border-color: #1a3a2a; background: #0d1f16; }
  .kpi.highlight .kpi-value { color: #4ade80; }

  table { width: 100%; border-collapse: collapse; }

  tr { border-bottom: 1px solid #1a1a1a; }
  tr:last-child { border-bottom: none; }

  td { padding: 10px 0; color: #888; }
  td:last-child { text-align: right; color: #ededed; font-weight: 500; }

  .incentive {
    background: #0a0a0a;
    border: 1px solid #1a3a2a;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 8px;
  }

  .incentive-name {
    font-size: 13px;
    font-weight: 500;
    color: #4ade80;
    margin-bottom: 4px;
  }

  .incentive-note {
    font-size: 12px;
    color: #555;
    line-height: 1.6;
  }

  .narrative {
    white-space: pre-wrap;
    font-size: 13px;
    line-height: 1.8;
    color: #888;
  }

  .narrative strong, .narrative b { color: #ededed; }

  .divider {
    border: none;
    border-top: 1px solid #1a1a1a;
    margin: 24px 0;
  }

  .print-btn {
    background: transparent;
    border: 1px solid #222;
    color: #888;
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 12px;
    cursor: pointer;
    float: right;
    transition: border-color 0.15s, color 0.15s;
  }

  .print-btn:hover { border-color: #444; color: #ededed; }

  .loading {
    text-align: center;
    color: #555;
    padding: 48px 0;
    font-size: 13px;
  }

  .dot {
    display: inline-block;
    animation: blink 1.4s infinite both;
  }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes blink {
    0%, 80%, 100% { opacity: 0; }
    40% { opacity: 1; }
  }

  @media print {
    body { background: #fff; color: #000; }
    .card { border: 1px solid #ddd; background: #fff; }
    .kpi { background: #f9f9f9; border: 1px solid #ddd; }
    .kpi-value { color: #000; }
    .btn, .print-btn { display: none; }
  }
`

function fmt(n) {
  return typeof n === "number" ? n.toLocaleString() : n
}

function Report({ result }) {
  const f = result.calculated.financials
  const p = result.calculated.physics
  const cur = result.calculated.currency

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Techno-Economic Analysis
        </span>
        <button className="print-btn" onClick={() => window.print()}>
          Export PDF
        </button>
      </div>

      {/* KPI strip */}
      <div className="kpi-grid">
        <div className="kpi highlight">
          <div className="kpi-label">Payback period</div>
          <div className="kpi-value">{f.simple_payback_years}</div>
          <div className="kpi-unit">years</div>
        </div>
        <div className="kpi highlight">
          <div className="kpi-label">Annual revenue</div>
          <div className="kpi-value">{fmt(f.annual_heat_revenue)}</div>
          <div className="kpi-unit">{cur} / year</div>
        </div>
        <div className="kpi highlight">
          <div className="kpi-label">CO₂ displaced</div>
          <div className="kpi-value">{fmt(f.tonnes_co2_displaced_annual)}</div>
          <div className="kpi-unit">tonnes / year</div>
        </div>
      </div>

      {/* Financials */}
      <div className="card">
        <div className="card-title">Financials — {cur}</div>
        <table>
          <tbody>
            {[
              ["Annual heat revenue",    fmt(f.annual_heat_revenue)],
              ["Annual carbon credits",  fmt(f.annual_carbon_credit)],
              ["Annual net benefit",     fmt(f.annual_net_benefit)],
              ["Gross CAPEX",            fmt(f.gross_capex)],
              ["Grant value",            fmt(f.grant_value)],
              ["Net CAPEX after grants", fmt(f.net_capex)],
              ["Annual OPEX",            fmt(f.annual_opex)],
            ].map(([label, value]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Physics */}
      <div className="card">
        <div className="card-title">Physics</div>
        <table>
          <tbody>
            {[
              ["Total facility load",    `${fmt(p.total_facility_load_kw)} kW`],
              ["Recoverable heat",       `${fmt(p.recoverable_heat_kw)} kW`],
              ["Output temperature",     `${p.output_temp_c}°C`],
              ["Annual thermal energy",  `${fmt(p.annual_heat_mwh)} MWh`],
            ].map(([label, value]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Incentives */}
      {result.calculated.incentives_applied.length > 0 && (
        <div className="card">
          <div className="card-title">Incentives & Regulation</div>
          {result.calculated.incentives_applied.map(i => (
            <div className="incentive" key={i.name}>
              <div className="incentive-name">{i.name}</div>
              <div className="incentive-note">{i.notes}</div>
              <div className="incentive-note" style={{ marginTop: 4, color: "#333" }}>
                Source: {i.source}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Narrative */}
      <div className="card">
        <div className="card-title">AI Analysis</div>
        <div className="narrative">{result.narrative}</div>
      </div>
    </div>
  )
}

export default function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (specs) => {
    setLoading(true)
    setResult(null)
    const response = await fetch("http://127.0.0.1:5001/api/generate-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(specs)
    })
    const data = await response.json()
    setResult(data)
    setLoading(false)
  }

  return (
    <>
      <style>{STYLES}</style>
      <div className="page">
        <div className="wordmark">Entropy</div>
        <div className="tagline">Data center heat reuse infrastructure</div>

        <div className="card">
          <div className="card-title">Data Center Specifications</div>
          <SpecsForm onSubmit={handleSubmit} loading={loading} />
        </div>

        {loading && (
          <div className="loading">
            Generating report
            <span className="dot">.</span>
            <span className="dot">.</span>
            <span className="dot">.</span>
          </div>
        )}

        {result && <Report result={result} />}
      </div>
    </>
  )
}