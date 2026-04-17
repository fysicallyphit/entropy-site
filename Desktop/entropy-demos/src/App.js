import { useState } from "react"
import SpecsForm from './SpecsForm'
import Report from './Report'
import HPAWizard from './HPAWizard'

const logo_src = require('./Entropy_Dark_Logo.png'); // with require

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html {
    background: #020617;
    overscroll-behavior: none;
  }
  body {
    background: radial-gradient(circle at top, #0f172a 0%, #0b1120 45%, #020617 100%);
    color: #e2e8f0;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.45;
    overscroll-behavior: none;
  }
  .logo1{
  width: 15%
}
  .page { max-width: 860px; margin: 0 auto; padding: 56px 24px 72px; }
  .wordmark-logo { display: block; width: 220px; max-width: 100%; margin-bottom: 10px; filter: invert(1); }
  .tagline { color: #94a3b8; font-size: 14px; margin-bottom: 28px; }
  .tabs {
    display: inline-flex;
    gap: 8px;
    padding: 6px;
    border: 1px solid #1e293b;
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(6px);
    margin-bottom: 24px;
  }
  .tab {
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 600;
    color: #94a3b8;
    cursor: pointer;
    border: none;
    border-radius: 8px;
    transition: all 0.15s;
    background: transparent;
    font-family: inherit;
    letter-spacing: 0.01em;
  }
  .tab:hover { background: #1e293b; color: #f8fafc; }
  .tab.active { color: #f8fafc; background: #334155; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.2); }
  .card {
    background: rgba(15, 23, 42, 0.88);
    border: 1px solid #1e293b;
    border-radius: 16px;
    padding: 30px;
    margin-bottom: 16px;
    box-shadow: 0 14px 30px rgba(2, 6, 23, 0.35);
  }
  .card-title { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; margin-bottom: 22px; }
  label { display: block; font-size: 12px; color: #cbd5e1; font-weight: 600; margin-bottom: 6px; margin-top: 16px; }
  label:first-of-type { margin-top: 0; }
  input, select {
    width: 100%;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 10px;
    color: #e2e8f0;
    font-size: 14px;
    padding: 11px 12px;
    outline: none;
    appearance: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  input::placeholder { color: #64748b; }
  input:focus, select:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.28); }
  .btn {
    width: 100%;
    margin-top: 24px;
    padding: 12px;
    background: linear-gradient(135deg, #4f46e5, #4338ca);
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.12s, box-shadow 0.12s, opacity 0.15s;
  }
  .btn:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(67, 56, 202, 0.3); }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; box-shadow: none; }
  .loading { text-align: center; color: #94a3b8; padding: 48px 0 24px; font-size: 13px; }
  .dot { display: inline-block; animation: blink 1.4s infinite both; }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink { 0%, 80%, 100% { opacity: 0; } 40% { opacity: 1; } }
`

export default function App() {
  const [tab, setTab] = useState("tea")
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
        <img className = "logo1" alt = "" src={logo_src}/>
        <div className="tagline">Data center heat reuse infrastructure</div>

        <div className="tabs">
          <button className={`tab ${tab === "tea" ? "active" : ""}`} onClick={() => setTab("tea")}>
            TEA Report
          </button>
          <button className={`tab ${tab === "hpa" ? "active" : ""}`} onClick={() => setTab("hpa")}>
            HPA Wizard
          </button>
        </div>

        {tab === "tea" && (
          <>
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
          </>
        )}

        {tab === "hpa" && (
          <div className="card">
            <div className="card-title">Heat Purchasing Agreement</div>
            <HPAWizard />
          </div>
        )}
      </div>
    </>
  )
}