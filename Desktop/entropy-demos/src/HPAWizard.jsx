import { useState } from "react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

const STEPS = [
  { id: "parties",   label: "Parties",   num: "01" },
  { id: "capacity",  label: "Capacity",  num: "02" },
  { id: "pricing",   label: "Pricing",   num: "03" },
  { id: "shortfall", label: "Shortfall", num: "04" },
  { id: "term",      label: "Term",      num: "05" },
  { id: "review",    label: "Review",    num: "06" },
]

const JURISDICTIONS = ["germany", "uk", "denmark", "netherlands", "sweden"]
const COOLING_TYPES = ["air_cooled", "direct_liquid", "immersion"]
const HEAT_BUYER_TYPES = ["district_heating", "industrial", "greenhouse_horticulture", "industrial_process"]

const toTitleCase = (value) => {
  if (!value) return ""
  if (value === "uk") return "UK"
  return value
    .split("_")
    .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ")
}

const escapeHtml = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")

const HPA_DOC_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #ffffff;
    color: #111827;
    font-family: "Georgia", "Times New Roman", serif;
    font-size: 12.5px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }
  .pdf-page { width: 794px; min-height: 1123px; margin: 0 auto; padding: 54px 54px 56px; background: #ffffff; }
  .pdf-page + .pdf-page { page-break-before: always; }
  .doc-topline { font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: #374151; margin-bottom: 14px; }
  .doc-title { font-size: 22px; font-weight: normal; letter-spacing: -0.2px; margin-bottom: 10px; }
  .doc-subtitle { font-size: 11px; color: #374151; }
  .rule { height: 1px; background: #d1d5db; margin: 18px 0 22px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; margin-bottom: 18px; }
  .meta-item { font-size: 11px; color: #111827; }
  .meta-k { display: block; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
  .meta-v { display: block; }
  .section { margin-top: 18px; }
  .h { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #111827; margin-bottom: 10px; }
  .p { margin-bottom: 10px; color: #111827; }
  .mono { font-family: "Courier New", Courier, monospace; font-size: 11px; }
  .terms { border: 1px solid #e5e7eb; padding: 14px 16px; background: #fafafa; }
  .terms-row { display: flex; justify-content: space-between; gap: 24px; padding: 7px 0; border-bottom: 1px solid #e5e7eb; }
  .terms-row:last-child { border-bottom: none; }
  .terms-k { color: #374151; }
  .terms-v { color: #111827; text-align: right; }
  .narrative { white-space: pre-wrap; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 26px; }
  .sig { border-top: 1px solid #9ca3af; padding-top: 10px; }
  .sig small { display: block; color: #6b7280; margin-top: 6px; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
  .footer { margin-top: 26px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #6b7280; display:flex; justify-content: space-between; gap: 16px; }
`

function generateHPADocHTML(result) {
  const c = result.calculated
  const inp = result._input || {}
  const rawParties = c.parties || {}
  const p = {
    seller_name:    rawParties.seller_name    || inp.seller_name    || "",
    buyer_name:     rawParties.buyer_name     || inp.buyer_name     || "",
    governing_law:  rawParties.governing_law  || inp.governing_law  || "",
    heat_buyer_type:rawParties.heat_buyer_type|| inp.heat_buyer_type|| "",
    cooling_type:   rawParties.cooling_type   || inp.cooling_type   || "",
    term_years:     rawParties.term_years     || inp.term_years     || "",
    currency:       rawParties.currency       || inp.currency       || "€",
  }
  const cap = c.capacity_and_volume
  const fin = c.financials
  const short = c.shortfall
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })

  const safeNarrative = escapeHtml(result.narrative)

  const row = (k, v) => `
    <div class="terms-row">
      <div class="terms-k">${escapeHtml(k)}</div>
      <div class="terms-v">${escapeHtml(v)}</div>
    </div>
  `

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Entropy — Heat Purchasing Agreement (Indicative)</title>
  <style>${HPA_DOC_STYLES}</style>
</head>
<body>
  <div class="pdf-page">
    <div class="doc-topline">Entropy / Heat Purchasing Agreement</div>
    <div class="doc-title">Indicative Heat Purchasing Agreement Term Sheet</div>
    <div class="doc-subtitle">Generated ${escapeHtml(date)} · For discussion purposes only</div>
    <div class="rule"></div>

    <div class="meta">
      <div class="meta-item"><span class="meta-k">Seller</span><span class="meta-v">${escapeHtml(p.seller_name)}</span></div>
      <div class="meta-item"><span class="meta-k">Buyer</span><span class="meta-v">${escapeHtml(p.buyer_name)}</span></div>
      <div class="meta-item"><span class="meta-k">Jurisdiction</span><span class="meta-v">${escapeHtml(toTitleCase(p.jurisdiction))}</span></div>
      <div class="meta-item"><span class="meta-k">Governing Law</span><span class="meta-v">${escapeHtml(toTitleCase(p.governing_law))}</span></div>
      <div class="meta-item"><span class="meta-k">Heat Buyer Type</span><span class="meta-v">${escapeHtml(toTitleCase(p.heat_buyer_type))}</span></div>
      <div class="meta-item"><span class="meta-k">Cooling Technology</span><span class="meta-v">${escapeHtml(toTitleCase(p.cooling_type))}</span></div>
    </div>

    <div class="section">
      <div class="h">Commercial Terms (Summary)</div>
      <div class="terms">
        ${row("Contracted Capacity", `${cap.contracted_capacity_mw} MW`)}
        ${row("Availability Guarantee", `${cap.availability_guarantee_pct}%`)}
        ${row("Guaranteed Minimum Volume", `${Number(cap.guaranteed_min_mwh_year).toLocaleString()} MWh / year`)}
        ${row("Agreement Term", `${p.term_years} years`)}
        ${row("Annual Total Revenue", `${p.currency} ${Number(fin.annual_total_revenue).toLocaleString()}`)}
        ${row("Total Contract Value (Undiscounted)", `${p.currency} ${Number(fin.total_contract_value_undiscounted).toLocaleString()}`)}
        ${row("Shortfall Rate", `${p.currency} ${short.shortfall_rate_eur_mwh}/MWh`)}
      </div>
    </div>
  </div>

  <div class="pdf-page">
    <div class="doc-topline">Entropy / Heat Purchasing Agreement</div>
    <div class="doc-title">Indicative Term Sheet (Narrative)</div>
    <div class="doc-subtitle">${escapeHtml(p.seller_name)} and ${escapeHtml(p.buyer_name)}</div>
    <div class="rule"></div>

    <div class="section">
      <div class="terms">
        <div class="narrative">${safeNarrative}</div>
      </div>
    </div>

    <div class="section">
      <div class="h">Signatures (Indicative)</div>
      <div class="sig-grid">
        <div>
          <div class="sig"></div>
          <small>For and on behalf of Seller</small>
          <div class="mono">${escapeHtml(p.seller_name)}</div>
        </div>
        <div>
          <div class="sig"></div>
          <small>For and on behalf of Buyer</small>
          <div class="mono">${escapeHtml(p.buyer_name)}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div>Entropy — Indicative term sheet</div>
      <div>Not legal advice. Subject to definitive documentation.</div>
    </div>
  </div>
</body>
</html>`
}

const FIELD_STYLES = `
  .wiz-field { margin-bottom: 20px; }
  .wiz-label { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; }
  .wiz-input { width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 10px; color: #e2e8f0; font-size: 14px; padding: 11px 12px; outline: none; appearance: none; transition: border-color 0.15s, box-shadow 0.15s; font-family: inherit; }
  .wiz-input:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.28); }
  .wiz-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .wiz-hint { font-size: 11px; color: #64748b; margin-top: 5px; }
  .wiz-section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #1e293b; }
  .wiz-nav { display: flex; gap: 10px; margin-top: 28px; }
  .wiz-btn-back { flex: 1; padding: 11px; background: #0f172a; color: #cbd5e1; border: 1px solid #334155; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: inherit; }
  .wiz-btn-back:hover { border-color: #475569; background: #1e293b; }
  .wiz-btn-next { flex: 2; padding: 11px; background: linear-gradient(135deg, #4f46e5, #4338ca); color: #ffffff; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s, opacity 0.15s; font-family: inherit; }
  .wiz-btn-next:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(67, 56, 202, 0.3); }
  .wiz-btn-next:disabled { opacity: 0.3; cursor: not-allowed; }
  .wiz-stepper { display: flex; gap: 0; margin-bottom: 32px; }
  .wiz-step { flex: 1; display: flex; flex-direction: column; gap: 6px; padding-bottom: 10px; border-bottom: 2px solid #1e293b; transition: border-color 0.2s; }
  .wiz-step.active { border-color: #818cf8; }
  .wiz-step.done { border-color: #475569; }
  .wiz-step-num { font-size: 10px; color: #64748b; font-weight: 700; letter-spacing: 0.05em; }
  .wiz-step.active .wiz-step-num { color: #818cf8; }
  .wiz-step.done .wiz-step-num { color: #94a3b8; }
  .wiz-step-label { font-size: 10px; color: #64748b; letter-spacing: 0.03em; }
  .wiz-step.active .wiz-step-label { color: #e2e8f0; }
  .wiz-step.done .wiz-step-label { color: #94a3b8; }
  .review-row { display: flex; justify-content: space-between; align-items: baseline; padding: 10px 0; border-bottom: 1px solid #1e293b; }
  .review-row:last-child { border-bottom: none; }
  .review-key { font-size: 12px; color: #94a3b8; }
  .review-val { font-size: 13px; color: #e2e8f0; font-weight: 600; }
  .review-group { margin-bottom: 24px; }
  .review-group-title { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
  .term-sheet { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 28px; margin-top: 4px; }
  .term-sheet-text { font-size: 13px; color: #cbd5e1; line-height: 1.8; white-space: pre-wrap; font-family: "SF Mono", "Fira Code", monospace; }
  .term-sheet-actions { display: flex; gap: 10px; margin-top: 20px; }
  .ts-btn { flex: 1; padding: 10px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; letter-spacing: 0.03em; }
  .ts-btn-copy { background: #0f172a; border: 1px solid #334155; color: #cbd5e1; }
  .ts-btn-copy:hover { border-color: #475569; background: #1e293b; }
  .ts-btn-new { background: linear-gradient(135deg, #4f46e5, #4338ca); border: none; color: #ffffff; }
  .ts-btn-new:hover { opacity: 0.9; }
  .ts-btn-export { background: #0f172a; border: 1px solid #334155; color: #cbd5e1; }
  .ts-btn-export:hover { border-color: #475569; background: #1e293b; }
  .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
  .metric-cell { background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 14px; }
  .metric-label { font-size: 10px; color: #64748b; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px; }
  .metric-value { font-size: 18px; font-weight: 700; color: #e2e8f0; letter-spacing: -0.5px; }
  .metric-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .wiz-note { background: #172554; border: 1px solid #334155; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px; }
  .wiz-note-text { font-size: 12px; color: #cbd5e1; line-height: 1.7; }
  .wiz-inline-hint { margin-top: -10px; margin-bottom: 16px; }
  .wiz-subhint { margin-bottom: 6px; }
  .wiz-error { font-size: 12px; color: #dc2626; margin-top: 12px; }
`

function Field({ label, hint, children }) {
  return (
    <div className="wiz-field">
      <label className="wiz-label">{label}</label>
      {children}
      {hint && <div className="wiz-hint">{hint}</div>}
    </div>
  )
}

function Select({ value, onChange, options }) {
  return (
    <select className="wiz-input" value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function Input({ value, onChange, type = "text", placeholder, min, max, step }) {
  return (
    <input
      className="wiz-input"
      type={type}
      value={value}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      onChange={e => onChange(e.target.value)}
    />
  )
}

// Step components
function StepParties({ data, set }) {
  return (
    <>
      <div className="wiz-section-title">Counterparties</div>
      <Field label="Seller — Data Centre Operator">
        <Input value={data.seller_name} onChange={v => set("seller_name", v)} placeholder="e.g. Nordics DC GmbH" />
      </Field>
      <Field label="Buyer — Heat Offtaker">
        <Input value={data.buyer_name} onChange={v => set("buyer_name", v)} placeholder="e.g. Stadtwerke Musterstadt" />
      </Field>
      <div className="wiz-row">
        <Field label="Jurisdiction">
          <Select value={data.jurisdiction} onChange={v => set("jurisdiction", v)}
            options={JURISDICTIONS.map(j => ({ value: j, label: toTitleCase(j) }))} />
        </Field>
        <Field label="Heat Buyer Type">
          <Select value={data.heat_buyer_type} onChange={v => set("heat_buyer_type", v)}
            options={HEAT_BUYER_TYPES.map(t => ({ value: t, label: toTitleCase(t) }))} />
        </Field>
      </div>
      <Field label="Cooling Technology">
        <Select value={data.cooling_type} onChange={v => set("cooling_type", v)}
          options={COOLING_TYPES.map(t => ({ value: t, label: toTitleCase(t) }))} />
      </Field>
    </>
  )
}

function StepCapacity({ data, set }) {
  return (
    <>
      <div className="wiz-section-title">Capacity & Volume</div>
      <Field label="Contracted Capacity (MW)" hint="Baseload heat output guaranteed to buyer">
        <Input type="number" value={data.contracted_capacity_mw} onChange={v => set("contracted_capacity_mw", v)} placeholder="5.0" min="0.1" step="0.1" />
      </Field>
      <Field label="Availability Guarantee (%)" hint="Minimum % of hours per year heat must be available">
        <Input type="number" value={data.availability_guarantee_pct} onChange={v => set("availability_guarantee_pct", v)} placeholder="95" min="50" max="100" />
      </Field>
      <div className="wiz-hint wiz-inline-hint">
        At {data.availability_guarantee_pct}% availability — guaranteed minimum {Math.round(data.contracted_capacity_mw * (data.availability_guarantee_pct / 100) * 8760).toLocaleString()} MWh/year
      </div>
    </>
  )
}

function StepPricing({ data, set }) {
  return (
    <>
      <div className="wiz-section-title">Pricing Structure</div>
      <div className="wiz-row">
        <Field label="TTF Spot Price (€/MWh)" hint="Current gas index reference">
          <Input type="number" value={data.ttf_spot_eur_mwh} onChange={v => set("ttf_spot_eur_mwh", v)} placeholder="38" min="0" step="0.5" />
        </Field>
        <Field label="Agreement Term (Years)">
          <Input type="number" value={data.term_years} onChange={v => set("term_years", v)} placeholder="15" min="5" max="30" />
        </Field>
      </div>
      <Field label="Price Collar" hint="Floor and ceiling applied to base heat price to protect both parties">
        <div className="wiz-row">
          <div>
            <div className="wiz-hint wiz-subhint">Floor (% of base)</div>
            <Input type="number" value={data.collar_floor_pct} onChange={v => set("collar_floor_pct", v)} placeholder="80" min="50" max="100" />
          </div>
          <div>
            <div className="wiz-hint wiz-subhint">Ceiling (% of base)</div>
            <Input type="number" value={data.collar_ceiling_pct} onChange={v => set("collar_ceiling_pct", v)} placeholder="120" min="100" max="200" />
          </div>
        </div>
      </Field>
      <Field label="CPI Escalator Cap (% per year)" hint="Maximum annual price increase">
        <Input type="number" value={data.cpi_cap_pct} onChange={v => set("cpi_cap_pct", v)} placeholder="2.5" min="0" step="0.5" max="10" />
      </Field>
    </>
  )
}

function StepShortfall({ data, set }) {
  return (
    <>
      <div className="wiz-section-title">Shortfall Payment Mechanism</div>
      <div className="wiz-note">
        <div className="wiz-note-text">
          If the Seller delivers less than the contracted capacity in any calendar month, the Seller pays the Buyer the cost of sourcing the shortfall from the market — at TTF spot + distribution markup. No penalty. No adversarial trigger.
        </div>
      </div>
      <Field label="Cure Period (Days)" hint="Days Seller has to restore delivery before shortfall payment is triggered">
        <Input type="number" value={data.cure_period_days} onChange={v => set("cure_period_days", v)} placeholder="30" min="0" max="90" />
      </Field>
      <Field label="Renewal Option (Years)" hint="Buyer option to extend at end of term">
        <Input type="number" value={data.renewal_option_years} onChange={v => set("renewal_option_years", v)} placeholder="5" min="0" max="15" />
      </Field>
      <Field label="Break Clause (Year)" hint="Optional — leave blank for no break clause">
        <Input type="number" value={data.break_clause_year} onChange={v => set("break_clause_year", v)} placeholder="None" min="1" />
      </Field>
    </>
  )
}

function StepTerm({ data, set }) {
  return (
    <>
      <div className="wiz-section-title">Additional Details</div>
      <Field label="Seller Legal Entity / Company Number">
        <Input value={data.seller_entity} onChange={v => set("seller_entity", v)} placeholder="e.g. registered in Germany, HRB 123456" />
      </Field>
      <Field label="Buyer Legal Entity / Company Number">
        <Input value={data.buyer_entity} onChange={v => set("buyer_entity", v)} placeholder="e.g. registered in Germany, HRB 654321" />
      </Field>
      <Field label="Delivery Point Description" hint="Physical location where heat transfers from Seller to Buyer">
        <Input value={data.delivery_point} onChange={v => set("delivery_point", v)} placeholder="e.g. Heat exchanger at site boundary, Frankfurt-Sachsenhausen" />
      </Field>
      <Field label="Governing Law">
        <Select value={data.governing_law} onChange={v => set("governing_law", v)}
          options={[
            { value: "germany", label: "German Law" },
            { value: "uk", label: "English Law" },
            { value: "denmark", label: "Danish Law" },
            { value: "netherlands", label: "Dutch Law" },
            { value: "sweden", label: "Swedish Law" },
          ]} />
      </Field>
    </>
  )
}

function ReviewRow({ label, value }) {
  return (
    <div className="review-row">
      <span className="review-key">{label}</span>
      <span className="review-val">{value}</span>
    </div>
  )
}

function StepReview({ data }) {
  const minMwh = Math.round(data.contracted_capacity_mw * (data.availability_guarantee_pct / 100) * 8760)
  return (
    <>
      <div className="wiz-section-title">Review Terms</div>
      <div className="review-group">
        <div className="review-group-title">Parties</div>
        <ReviewRow label="Seller" value={data.seller_name || "—"} />
        <ReviewRow label="Buyer" value={data.buyer_name || "—"} />
        <ReviewRow label="Jurisdiction" value={toTitleCase(data.jurisdiction)} />
        <ReviewRow label="Buyer Type" value={toTitleCase(data.heat_buyer_type)} />
      </div>
      <div className="review-group">
        <div className="review-group-title">Capacity</div>
        <ReviewRow label="Contracted Capacity" value={`${data.contracted_capacity_mw} MW`} />
        <ReviewRow label="Availability Guarantee" value={`${data.availability_guarantee_pct}%`} />
        <ReviewRow label="Guaranteed Min Volume" value={`${minMwh.toLocaleString()} MWh/year`} />
        <ReviewRow label="Cooling Type" value={toTitleCase(data.cooling_type)} />
      </div>
      <div className="review-group">
        <div className="review-group-title">Pricing</div>
        <ReviewRow label="TTF Reference" value={`€${data.ttf_spot_eur_mwh}/MWh`} />
        <ReviewRow label="Price Collar" value={`${data.collar_floor_pct}% – ${data.collar_ceiling_pct}%`} />
        <ReviewRow label="CPI Cap" value={`${data.cpi_cap_pct}% / year`} />
        <ReviewRow label="Cure Period" value={`${data.cure_period_days} days`} />
      </div>
      <div className="review-group">
        <div className="review-group-title">Term</div>
        <ReviewRow label="Duration" value={`${data.term_years} years`} />
        <ReviewRow label="Renewal Option" value={data.renewal_option_years ? `${data.renewal_option_years} years` : "None"} />
        <ReviewRow label="Break Clause" value={data.break_clause_year ? `Year ${data.break_clause_year}` : "None"} />
        <ReviewRow label="Governing Law" value={data.governing_law.charAt(0).toUpperCase() + data.governing_law.slice(1)} />
      </div>
    </>
  )
}

function TermSheet({ result, onReset }) {
  const [copied, setCopied] = useState(false)
  const c = result.calculated
  const currency = c.parties.currency

  const fmt = n => Number(n).toLocaleString()

  const handleExport = async () => {
    const html = generateHPADocHTML(result)
    const iframe = document.createElement("iframe")
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;height:10000px;border:none;"
    document.body.appendChild(iframe)

    iframe.contentDocument.open()
    iframe.contentDocument.write(html)
    iframe.contentDocument.close()

    await new Promise(res => setTimeout(res, 800))

    const pages = Array.from(iframe.contentDocument.querySelectorAll(".pdf-page"))

    const pageW = 210
    let pdf = null

    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i]
      const naturalH = pageEl.scrollHeight
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 794,
        height: naturalH,
        windowWidth: 794,
        windowHeight: naturalH,
      })

      const imgH = Math.ceil(pageW * canvas.height / canvas.width)
      if (i === 0) {
        pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, imgH] })
      } else {
        pdf.addPage([pageW, imgH])
      }
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, imgH)
    }

    document.body.removeChild(iframe)

    const blob = pdf.output("blob")
    const url = URL.createObjectURL(blob)
    window.open(url, "_blank")
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result.narrative)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="wiz-section-title">Indicative Term Sheet</div>

      <div className="metrics-grid">
        <div className="metric-cell">
          <div className="metric-label">Annual Revenue</div>
          <div className="metric-value">{currency} {fmt(c.financials.annual_total_revenue)}</div>
          <div className="metric-sub">capacity + usage charges</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">Contract Value</div>
          <div className="metric-value">{currency} {fmt(c.financials.total_contract_value_undiscounted)}</div>
          <div className="metric-sub">undiscounted over term</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">Shortfall Rate</div>
          <div className="metric-value">{currency} {c.shortfall.shortfall_rate_eur_mwh}/MWh</div>
          <div className="metric-sub">TTF + distribution markup</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">Guaranteed Volume</div>
          <div className="metric-value">{fmt(c.capacity_and_volume.guaranteed_min_mwh_year)}</div>
          <div className="metric-sub">MWh / year minimum</div>
        </div>
      </div>

      <div className="term-sheet">
        <div className="term-sheet-text">{result.narrative}</div>
      </div>

      <div className="term-sheet-actions">
        <button className="ts-btn ts-btn-copy" onClick={handleCopy}>
          {copied ? "Copied" : "Copy text"}
        </button>
        <button className="ts-btn ts-btn-export" onClick={handleExport}>
          Export PDF
        </button>
        <button className="ts-btn ts-btn-new" onClick={onReset}>
          New agreement
        </button>
      </div>
    </>
  )
}

const DEFAULT = {
  seller_name: "",
  buyer_name: "",
  seller_entity: "",
  buyer_entity: "",
  jurisdiction: "germany",
  heat_buyer_type: "district_heating",
  cooling_type: "direct_liquid",
  contracted_capacity_mw: 5,
  availability_guarantee_pct: 95,
  ttf_spot_eur_mwh: 38,
  term_years: 15,
  collar_floor_pct: 80,
  collar_ceiling_pct: 120,
  cpi_cap_pct: 2.5,
  cure_period_days: 30,
  renewal_option_years: 5,
  break_clause_year: "",
  delivery_point: "",
  governing_law: "germany",
}

export default function HPAWizard() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState(DEFAULT)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const set = (key, value) => setData(d => ({ ...d, [key]: value }))

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = {
        ...data,
        contracted_capacity_mw: parseFloat(data.contracted_capacity_mw),
        availability_guarantee_pct: parseFloat(data.availability_guarantee_pct),
        ttf_spot_eur_mwh: parseFloat(data.ttf_spot_eur_mwh),
        term_years: parseInt(data.term_years),
        collar_floor_pct: parseFloat(data.collar_floor_pct),
        collar_ceiling_pct: parseFloat(data.collar_ceiling_pct),
        cpi_cap_pct: parseFloat(data.cpi_cap_pct),
        cure_period_days: parseInt(data.cure_period_days),
        renewal_option_years: parseInt(data.renewal_option_years) || 0,
        break_clause_year: data.break_clause_year ? parseInt(data.break_clause_year) : null,
      }
      const res = await fetch("http://127.0.0.1:5001/api/generate-hpa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      setResult({ ...json, _input: payload })
    } catch (e) {
      setError("Failed to generate term sheet. Is the server running?")
    }
    setLoading(false)
  }

  const reset = () => {
    setResult(null)
    setStep(0)
    setData(DEFAULT)
  }

  const stepComponents = [
    <StepParties data={data} set={set} />,
    <StepCapacity data={data} set={set} />,
    <StepPricing data={data} set={set} />,
    <StepShortfall data={data} set={set} />,
    <StepTerm data={data} set={set} />,
    <StepReview data={data} />,
  ]

  const isLast = step === STEPS.length - 1

  return (
    <>
      <style>{FIELD_STYLES}</style>

      {result ? (
        <TermSheet result={result} onReset={reset} />
      ) : (
        <>
          {/* Stepper */}
          <div className="wiz-stepper">
            {STEPS.map((s, i) => (
              <div key={s.id} className={`wiz-step ${i === step ? "active" : i < step ? "done" : ""}`}>
                <div className="wiz-step-num">{s.num}</div>
                <div className="wiz-step-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Step content */}
          {stepComponents[step]}

          {/* Error */}
          {error && <div className="wiz-error">{error}</div>}

          {/* Nav */}
          <div className="wiz-nav">
            {step > 0 && (
              <button className="wiz-btn-back" onClick={() => setStep(s => s - 1)}>Back</button>
            )}
            {isLast ? (
              <button
                className="wiz-btn-next"
                onClick={handleGenerate}
                disabled={loading}
                style={{ flex: step > 0 ? 2 : 1 }}
              >
                {loading ? "Generating…" : "Generate Term Sheet"}
              </button>
            ) : (
              <button
                className="wiz-btn-next"
                onClick={() => setStep(s => s + 1)}
                style={{ flex: step > 0 ? 2 : 1 }}
              >
                Continue →
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}