import jsPDF from "jspdf"
import html2canvas from "html2canvas"

const PREVIEW_STYLES = `
  .report-preview-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .report-preview-label {
    font-size: 11px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
  }
  .report-export-btn {
    background: #0f172a;
    border: 1px solid #334155;
    color: #cbd5e1;
    border-radius: 10px;
    padding: 8px 14px;
    font-size: 11px;
    letter-spacing: 0.08em;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
  }
  .report-export-btn:hover { border-color: #475569; background: #1e293b; }
  .report-kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }
  .report-kpi-card {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    padding: 16px;
  }
  .report-kpi-title { font-size: 11px; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
  .report-kpi-value { font-size: 22px; font-weight: 700; color: #e2e8f0; letter-spacing: -0.5px; }
  .report-kpi-unit { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .report-warning {
    background: #3f2004;
    border: 1px solid #9a3412;
    border-radius: 10px;
    padding: 14px;
    margin-bottom: 16px;
  }
  .report-warning-title { font-size: 11px; color: #fdba74; letter-spacing: 0.1em; margin-bottom: 6px; font-weight: 700; }
  .report-warning-body { font-size: 12px; color: #fed7aa; }
  .report-compliance {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 12px;
  }
  .report-compliance-title {
    font-size: 10px;
    color: #94a3b8;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 16px;
    font-weight: 700;
  }
  .report-badges { display: flex; gap: 8px; flex-wrap: wrap; }
  .report-badge {
    font-size: 10px;
    letter-spacing: 0.08em;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid;
    font-weight: 600;
  }
  .report-badge.ok { border-color: #14532d; color: #bbf7d0; background: #052e16; }
  .report-badge.warn { border-color: #9a3412; color: #fdba74; background: #431407; }
  .report-hint {
    font-size: 12px;
    color: #94a3b8;
    text-align: center;
    padding: 16px 0;
  }
`

const REPORT_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #ffffff;
    color: #000000;
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 13px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  .page {
    max-width: 650px;
    margin: 0 auto;
    padding: 48px 24px;
  }

  /* ---- header ---- */
  .report-header {
    border-bottom: 1px solid #2a2a2a;
    padding-bottom: 32px;
    margin-bottom: 40px;
  }

  .entropy-mark {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #000000;
    margin-bottom: 28px;
  }

  .report-title {
    font-size: 28px;
    font-weight: normal;
    letter-spacing: -0.5px;
    line-height: 1.2;
    color: #000000;
    margin-bottom: 8px;
  }

  .report-subtitle {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #000000;
  }

  /* ---- section ---- */
  .section {
    margin-bottom: 40px;
  }

  .section-label {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: #000000;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid #706f6f;
  }

  /* ---- KPI strip ---- */
  .kpi-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    background: #1a1a1a;
    border: 1px solid #1a1a1a;
    margin-bottom: 40px;
  }

  .kpi-cell {
    background: #060606;
    padding: 20px 16px;
  }

  .kpi-figure {
    font-size: 26px;
    font-weight: normal;
    color: #338302;
    letter-spacing: -1px;
    line-height: 1;
    margin-bottom: 6px;
  }

  .kpi-label {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #000000;
    margin-bottom: 2px;
  }

  .kpi-unit {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    color: #080808;
  }

  /* ---- data rows ---- */
  .data-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 9px 0;
    border-bottom: 1px solid #0f0f0f;
    gap: 24px;
  }

  .data-row:last-child { border-bottom: none; }

  .data-label {
    color: #000000;
    font-size: 12px;
    font-family: 'Courier New', monospace;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }

  .data-value {
    color: #000000;
    font-size: 12px;
    text-align: right;
  }

  .data-value.accent { color: #c8f0b0; }
  .data-value.warn { color: #f0c878; }

  /* ---- alert box ---- */
  .alert {
    border: 1px solid #2a2a1a;
    background: #0d0d08;
    padding: 14px 16px;
    margin-bottom: 8px;
  }

  .alert-name {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #c8f0b0;
    margin-bottom: 6px;
  }

  .alert-body {
    font-size: 12px;
    color: #444;
    line-height: 1.5;
  }

  .alert-source {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    color: #2a2a2a;
    margin-top: 6px;
  }

  /* ---- heat pump warning ---- */
  .hp-warning {
    border: 1px solid #3a2a0a;
    background: #0d0a04;
    padding: 14px 16px;
    margin-bottom: 40px;
  }

  .hp-warning-label {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #f0c878;
    margin-bottom: 6px;
  }

  .hp-warning-body {
    font-size: 12px;
    color: #555;
    line-height: 1.5;
  }

  /* ---- narrative ---- */
  .narrative-section { margin-bottom: 28px; }

  .narrative-heading {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #333;
    margin-bottom: 12px;
  }

  .narrative-body {
    font-size: 13px;
    color: #666;
    line-height: 1.8;
  }

  .narrative-body p { margin-bottom: 12px; }
  .narrative-body p:last-child { margin-bottom: 0; }

  .risk-list {
    list-style: none;
    padding: 0;
  }

  .risk-list li {
    font-size: 12px;
    color: #555;
    line-height: 1.6;
    padding: 6px 0;
    border-bottom: 1px solid #0f0f0f;
    padding-left: 12px;
    position: relative;
  }

  .risk-list li:before {
    content: '—';
    position: absolute;
    left: 0;
    color: #333;
  }

  /* ---- footer ---- */
  .report-footer {
    border-top: 1px solid #1a1a1a;
    padding-top: 24px;
    margin-top: 48px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .footer-entropy {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #222;
  }

  .footer-disclaimer {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    color: #1a1a1a;
    text-align: right;
    max-width: 200px;
    line-height: 1.4;
  }

  /* ---- compliance badge ---- */
  .compliance-row {
    display: flex;
    gap: 8px;
    margin-bottom: 40px;
    flex-wrap: wrap;
  }

  .badge {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 5px 10px;
    border: 1px solid #1a1a1a;
    color: #333;
  }

  .badge.pass {
    border-color: #1a3a0a;
    color: #4a8a2a;
  }

  .badge.warn {
    border-color: #3a2a0a;
    color: #8a6a2a;
  }
`

function generateReportHTML(result) {
  const f = result.calculated.financials
  const p = result.calculated.physics
  const c = result.calculated.compliance
  const cur = result.calculated.currency
  const specs = result.calculated.inputs
  const date = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric"
  })

  // Parse narrative into sections
  const raw = result.narrative
  const execMatch = raw.match(/EXECUTIVE SUMMARY[\s\S]*?(?=METHODOLOGY NOTE|$)/i)
  const methMatch = raw.match(/METHODOLOGY NOTE[\s\S]*?(?=RISKS|$)/i)
  const riskMatch = raw.match(/RISKS & ASSUMPTIONS[\s\S]*?(?=CALL TO ACTION|$)/i)
  const ctaMatch  = raw.match(/CALL TO ACTION[\s\S]*/i)

  const clean = (str) => str
    ? str.replace(/\*\*/g, "").replace(/^.*?(SUMMARY|NOTE|ASSUMPTIONS|ACTION)[:\s]*/i, "").trim()
    : ""

  const execText = clean(execMatch?.[0] || "")
  const methText = clean(methMatch?.[0] || "")
  const riskText = clean(riskMatch?.[0] || "")
  const ctaText  = clean(ctaMatch?.[0] || "")

  const riskLines = riskText
    .split("\n")
    .map(l => l.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean)

  const execParas = execText.split(/\n\n+/).filter(Boolean)

  const fmt = (n) => typeof n === "number" ? n.toLocaleString() : n

  const heatPumpBlock = p.heat_pump_required ? `
    <div class="hp-warning">
      <div class="hp-warning-label">⚠ Heat pump required</div>
      <div class="hp-warning-body">
        Output temperature (${p.output_temp_c}°C) is below the buyer's required inlet temperature (${p.buyer_inlet_required_c}°C).
        A heat pump with a ${p.temp_lift_c}°C temperature lift is needed — COP ${p.heat_pump_cop}.
        This adds ${cur} ${fmt(f.heat_pump_capex)} to CAPEX and ${cur} ${fmt(f.annual_heat_pump_opex)}/yr to OPEX.
      </div>
    </div>` : ""

  const incentivesHTML = result.calculated.incentives_applied.map(i => `
    <div class="alert">
      <div class="alert-name">${i.name}</div>
      <div class="alert-body">${i.notes}</div>
      <div class="alert-source">Source: ${i.source}</div>
    </div>`).join("")

  const risksHTML = riskLines.map(r => `<li>${r}</li>`).join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Entropy — TEA Report</title>
  <style>${REPORT_STYLES}</style>
</head>
<body>
<div class="page">

  <header class="report-header">
    <div class="entropy-mark">Entropy / Techno-Economic Analysis</div>
    <h1 class="report-title">${specs.it_load_mw} MW ${specs.cooling_type.replace(/_/g, " ")} facility<br>${specs.jurisdiction.charAt(0).toUpperCase() + specs.jurisdiction.slice(1)} — ${specs.heat_buyer_type.replace(/_/g, " ")} offtake</h1>
    <div class="report-subtitle">Generated ${date} &nbsp;&nbsp;·&nbsp;&nbsp; ${specs.user_type.replace(/_/g, " ")}</div>
  </header>

  <div class="kpi-row">
    <div class="kpi-cell">
      <div class="kpi-label">Payback period</div>
      <div class="kpi-figure">${f.simple_payback_years}</div>
      <div class="kpi-unit">years</div>
    </div>
    <div class="kpi-cell">
      <div class="kpi-label">Annual revenue</div>
      <div class="kpi-figure">${fmt(f.annual_heat_revenue)}</div>
      <div class="kpi-unit">${cur} / year</div>
    </div>
    <div class="kpi-cell">
      <div class="kpi-label">CO₂ displaced</div>
      <div class="kpi-figure">${fmt(f.tonnes_co2_displaced_annual)}</div>
      <div class="kpi-unit">tonnes / year</div>
    </div>
  </div>

  <div class="compliance-row">
    <div class="badge ${c.eu_eed_target_met ? "pass" : "warn"}">ERF ${c.erf_pct} — ${c.erf_band}</div>
    <div class="badge ${c.eu_eed_target_met ? "pass" : "warn"}">EU EED ${c.eu_eed_target_met ? "compliant" : "below target"}</div>
    <div class="badge">WUE ${c.wue_impact}</div>
    <div class="badge">PUE ${c.pue_impact}</div>
  </div>

  ${heatPumpBlock}

  <div class="section">
    <div class="section-label">Financials — ${cur}</div>
    ${[
      ["Annual heat revenue",      fmt(f.annual_heat_revenue),     "accent"],
      ["Annual carbon credits",    fmt(f.annual_carbon_credit),    "accent"],
      ["Annual net benefit",       fmt(f.annual_net_benefit),      "accent"],
      ["Heat exchanger CAPEX",     fmt(f.hex_capex),               ""],
      p.heat_pump_required ? ["Heat pump CAPEX", fmt(f.heat_pump_capex), "warn"] : null,
      ["Gross CAPEX",              fmt(f.gross_capex),             ""],
      ["Grant value",              `(${fmt(f.grant_value)})`,      ""],
      ["Net CAPEX after grants",   fmt(f.net_capex),               ""],
      ["Annual maintenance OPEX",  fmt(f.annual_maintenance_opex), ""],
      p.heat_pump_required ? ["Annual heat pump OPEX", fmt(f.annual_heat_pump_opex), "warn"] : null,
      ["Annual total OPEX",        fmt(f.annual_total_opex),       ""],
    ].filter(Boolean).map(([label, value, cls]) => `
      <div class="data-row">
        <span class="data-label">${label}</span>
        <span class="data-value ${cls}">${value}</span>
      </div>`).join("")}
  </div>

  <div class="section">
    <div class="section-label">Physics</div>
    ${[
      ["Total facility load",           `${fmt(p.total_facility_load_kw)} kW`],
      ["Recoverable heat",              `${fmt(p.recoverable_heat_kw)} kW`],
      ["Output temperature",            `${p.output_temp_c}°C`],
      ["Buyer inlet required",          `${p.buyer_inlet_required_c}°C`],
      ["Seasonal load factor",          `${(p.seasonal_load_factor * 100).toFixed(0)}%`],
      ["Annual thermal energy",         `${fmt(p.annual_heat_mwh)} MWh`],
      ["Energy Reuse Factor (ERF)",     p.erf_pct],
    ].map(([label, value]) => `
      <div class="data-row">
        <span class="data-label">${label}</span>
        <span class="data-value">${value}</span>
      </div>`).join("")}
  </div>

  <div class="section">
    <div class="section-label">Incentives & Regulation</div>
    ${incentivesHTML}
  </div>

  <div class="section">
    <div class="section-label">Analysis</div>

    <div class="narrative-section">
      <div class="narrative-heading">Executive Summary</div>
      <div class="narrative-body">
        ${execParas.map(p => `<p>${p}</p>`).join("")}
      </div>
    </div>

    <div class="narrative-section">
      <div class="narrative-heading">Methodology</div>
      <div class="narrative-body"><p>${methText}</p></div>
    </div>

    <div class="narrative-section">
      <div class="narrative-heading">Risks & Assumptions</div>
      <ul class="risk-list">${risksHTML}</ul>
    </div>

    ${ctaText ? `
    <div class="narrative-section">
      <div class="narrative-heading">Next Step</div>
      <div class="narrative-body"><p>${ctaText}</p></div>
    </div>` : ""}
  </div>

  <div class="section">
    <div class="section-label">Sources</div>
    ${Object.entries(result.calculated.sources).map(([k, v]) => `
      <div class="data-row">
        <span class="data-label">${k.replace(/_/g, " ")}</span>
        <span class="data-value" style="font-size:11px;color:#333;max-width:60%;text-align:right">${v}</span>
      </div>`).join("")}
  </div>

  <footer class="report-footer">
    <div class="footer-entropy">Entropy — entropy.energy</div>
    <div class="footer-disclaimer">For informational purposes only. Not financial advice. Verify all figures independently.</div>
  </footer>

</div>
</body>
</html>`
}

export default function Report({ result }) {
  const f = result.calculated.financials
  const p = result.calculated.physics
  const c = result.calculated.compliance
  const cur = result.calculated.currency

const handleExport = async () => {
  // 1. Write the report HTML into a hidden iframe so it renders fully
  const html = generateReportHTML(result)
  const iframe = document.createElement("iframe")
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;height:1123px;border:none;"
  document.body.appendChild(iframe)

  iframe.contentDocument.open()
  iframe.contentDocument.write(html)
  iframe.contentDocument.close()

  // 2. Wait for fonts and layout to settle
  await new Promise(res => setTimeout(res, 800))

  const iframeBody = iframe.contentDocument.body
  const totalHeight = iframeBody.scrollHeight

  // 3. Render to canvas at 2x for sharpness
  const canvas = await html2canvas(iframeBody, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    width: 794,
    height: totalHeight,
    windowWidth: 794,
    windowHeight: totalHeight,
  })

  document.body.removeChild(iframe)

  // 4. Build PDF — A4 size, split across pages cleanly
  // 4. Build PDF — A4 with margins on every page
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageW = 210
  const pageH = 297
  const marginY = 12  // top and bottom margin in mm
  const marginX = 0

  const imgW = pageW - marginX * 2
  const contentH = pageH - marginY * 2  // usable height per page in mm

  // How many canvas pixels fit in one page's content area?
  const pxPerMm = canvas.width / imgW
  const contentPxPerPage = contentH * pxPerMm

  const totalPages = Math.ceil(canvas.height / contentPxPerPage)

  for (let i = 0; i < totalPages; i++) {
    if (i > 0) pdf.addPage()

    // Slice the canvas vertically for this page
    const srcY = Math.round(i * contentPxPerPage)
    const srcH = Math.min(contentPxPerPage, canvas.height - srcY)

    const sliceCanvas = document.createElement("canvas")
    sliceCanvas.width = canvas.width
    sliceCanvas.height = Math.round(contentPxPerPage)

    const ctx = sliceCanvas.getContext("2d")
    ctx.fillStyle = "#060606"
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
    ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)

    const sliceH = (sliceCanvas.height / pxPerMm)

    pdf.addImage(
      sliceCanvas.toDataURL("image/png"),
      "PNG",
      marginX,
      marginY,       // top margin on every page
      imgW,
      sliceH
    )
  }

  // 5. Open in browser as blob URL — no download, no print dialog
  const blob = pdf.output("blob")
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank")
}
  const fmt = (n) => typeof n === "number" ? n.toLocaleString() : n

  return (
    <div>
      <style>{PREVIEW_STYLES}</style>
      <div className="report-preview-head">
        <span className="report-preview-label">
          Techno-Economic Analysis
        </span>
        <button onClick={handleExport} className="report-export-btn">
          EXPORT REPORT →
        </button>
      </div>

      <div className="report-kpi-grid">
        {[
          ["Payback", f.simple_payback_years, "years"],
          ["Revenue", fmt(f.annual_heat_revenue), `${cur}/yr`],
          ["CO₂", fmt(f.tonnes_co2_displaced_annual), "t/yr"],
        ].map(([label, val, unit]) => (
          <div key={label} className="report-kpi-card">
            <div className="report-kpi-title">{label}</div>
            <div className="report-kpi-value">{val}</div>
            <div className="report-kpi-unit">{unit}</div>
          </div>
        ))}
      </div>

      {p.heat_pump_required && (
        <div className="report-warning">
          <div className="report-warning-title">
            ⚠ HEAT PUMP REQUIRED
          </div>
          <div className="report-warning-body">
            Output {p.output_temp_c}°C is below buyer requirement ({p.buyer_inlet_required_c}°C).
            COP {p.heat_pump_cop} — adds {cur} {fmt(f.heat_pump_capex)} CAPEX.
          </div>
        </div>
      )}

      <div className="report-compliance">
        <div className="report-compliance-title">
          Compliance
        </div>
        <div className="report-badges">
          {[
            [c.eu_eed_target_met ? "ERF ✓" : "ERF ✗", `${p.erf_pct}`, c.eu_eed_target_met],
            ["EU EED", c.eu_eed_target_met ? "compliant" : "below target", c.eu_eed_target_met],
            ["WUE", c.wue_impact, true],
          ].map(([label, val, ok]) => (
            <div key={label} className={`report-badge ${ok ? "ok" : "warn"}`}>
              {label} — {val}
            </div>
          ))}
        </div>
      </div>

      <div className="report-hint">
        Click EXPORT REPORT → for the full formatted document
      </div>
    </div>
  )
}