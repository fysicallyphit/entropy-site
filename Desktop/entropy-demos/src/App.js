import { useState } from "react"
import SpecsForm from './SpecsForm'
import Report from './Report'
import HPAWizard from './HPAWizard'

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0a0a0a;
    color: #ededed;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
  }
  .page { max-width: 720px; margin: 0 auto; padding: 48px 24px; }
  .wordmark { font-size: 18px; font-weight: 600; letter-spacing: -0.5px; color: #fff; margin-bottom: 4px; }
  .tagline { color: #555; font-size: 13px; margin-bottom: 32px; }
  .tabs { display: flex; gap: 0; border-bottom: 1px solid #1a1a1a; margin-bottom: 32px; }
  .tab { padding: 10px 0; margin-right: 28px; font-size: 13px; color: #444; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.15s; background: none; border-top: none; border-left: none; border-right: none; font-family: inherit; letter-spacing: 0.01em; }
  .tab:hover { color: #888; }
  .tab.active { color: #ededed; border-bottom-color: #fff; }
  .card { background: #111; border: 1px solid #222; border-radius: 12px; padding: 28px; margin-bottom: 16px; }
  .card-title { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #555; margin-bottom: 20px; }
  label { display: block; font-size: 12px; color: #888; margin-bottom: 6px; margin-top: 16px; }
  label:first-of-type { margin-top: 0; }
  input, select { width: 100%; background: #0a0a0a; border: 1px solid #222; border-radius: 8px; color: #ededed; font-size: 14px; padding: 10px 12px; outline: none; appearance: none; transition: border-color 0.15s; }
  input:focus, select:focus { border-color: #444; }
  .btn { width: 100%; margin-top: 24px; padding: 12px; background: #fff; color: #000; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
  .btn:hover { opacity: 0.85; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .loading { text-align: center; color: #555; padding: 48px 0; font-size: 13px; }
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
        <div className="wordmark">Entropy</div>
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