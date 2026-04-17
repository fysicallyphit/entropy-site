import { useState } from "react"

const JURISDICTIONS = ["germany", "uk", "denmark", "netherlands", "sweden"]

const COOLING_TYPES = ["air_cooled", "direct_liquid", "immersion"]

const USER_TYPES = ["data_center", "district_heating_network"]

const BUYER_TYPES = {
  germany:     ["district_heating", "industrial"],
  uk:          ["district_heating", "industrial_process", "greenhouse_horticulture"],
  denmark:     ["district_heating"],
  netherlands: ["district_heating", "greenhouse_horticulture"],
  sweden:      ["district_heating"],
}

const FLUID_OPTIONS = [
  { value: "pg25",  label: "PG 25% — Cp 3.84 kJ/kg·K (OCP reference)" },
  { value: "water", label: "Water — Cp 4.18 kJ/kg·K" },
  { value: "pg40",  label: "PG 40% — Cp 3.43 kJ/kg·K" },
]

// Default supply/return temps per cooling type (°C)
const COOLING_TEMP_DEFAULTS = {
  air_cooled:     { t_supply_c: 25, t_return_c: 35 },
  direct_liquid:  { t_supply_c: 40, t_return_c: 50 },
  immersion:      { t_supply_c: 60, t_return_c: 70 },
}

const toTitleCase = (value) => {
  if (!value) return ""
  if (value === "uk") return "UK"
  return value
    .split("_")
    .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : "")
    .join(" ")
}

const FORM_STYLES = `
  .specs-form section {
    margin-bottom: 28px;
  }
  .specs-form h3 {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid #1e293b;
  }
  .specs-form h4 {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #475569;
    margin: 20px 0 12px;
  }
  .field {
    margin-bottom: 14px;
  }
  .field label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
    margin-top: 0;
  }
  .field-hint {
    display: block;
    font-size: 11px;
    color: #475569;
    margin-top: 5px;
    line-height: 1.4;
  }
  .delta-readout {
    font-size: 12px;
    color: #64748b;
    margin-top: -4px;
    margin-bottom: 14px;
    padding: 8px 12px;
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 8px;
  }
  .error-inline {
    color: #f87171;
    font-weight: 600;
  }
  .toggle-advanced {
    background: none;
    border: none;
    color: #e3e7ec;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    letter-spacing: 0.03em;
    font-family: inherit;
    transition: color 0.15s;
  }
  .toggle-advanced:hover { color: #94a3b8; }
  .advanced-fields {
    margin-top: 18px;
    padding: 18px;
    background: #080f1e;
    border: 1px solid #1e293b;
    border-radius: 10px;
  }
  .advanced-fields h4:first-child { margin-top: 0; }
`

const Field = ({ label, hint, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
    {hint && <span className="field-hint">{hint}</span>}
  </div>
)

export default function SpecsForm({ onSubmit, loading }) {
  const [specs, setSpecs] = useState({
    // ── existing fields ──────────────────────────────────────────────────
    user_type:        "data_center",
    jurisdiction:     "germany",
    it_load_mw:       "",
    pue:              "",
    cooling_type:     "direct_liquid",
    heat_buyer_type:  "district_heating",
    capex:            null,
    pipe_distance_m:  0,

    // ── new physical inputs (matching generate_tea.py) ───────────────────
    fluid:              "pg25",
    liq_fraction:       0.70,
    t_supply_c:         40,
    t_return_c:         50,

    // ── HX design ────────────────────────────────────────────────────────
    approach_dt_c:      4,
    hx_effectiveness:   0.85,
    system_efficiency:  0.90,
    utilization_factor: 0.95,

    // ── pump ─────────────────────────────────────────────────────────────
    head_loss_kpa:      150,
    pump_efficiency:    0.75,

    // ── financial ────────────────────────────────────────────────────────
    discount_rate:      0.08,
    project_life_years: 15,
    cost_escalation_rate: 0.03,
  })

  const [showAdvanced, setShowAdvanced] = useState(false)

  const update = (field, value) =>
    setSpecs(prev => ({ ...prev, [field]: value }))

  const handleJurisdictionChange = (value) => {
    update("jurisdiction", value)
    update("heat_buyer_type", BUYER_TYPES[value][0])
  }

  const handleCoolingTypeChange = (value) => {
    update("cooling_type", value)
    const defaults = COOLING_TEMP_DEFAULTS[value]
    update("t_supply_c", defaults.t_supply_c)
    update("t_return_c", defaults.t_return_c)
  }

  const handleSubmit = async () => {
    if (!specs.it_load_mw || !specs.pue) {
      alert("Please fill in IT load and PUE")
      return
    }
    if (parseFloat(specs.t_return_c) <= parseFloat(specs.t_supply_c)) {
      alert("T2 (return) must be greater than T1 (supply) — heat flows from the IT fluid")
      return
    }
    if (parseFloat(specs.liq_fraction) <= 0 || parseFloat(specs.liq_fraction) > 1) {
      alert("Liquid-cooled fraction must be between 0.05 and 1.0")
      return
    }

    const payload = {
      ...specs,
      it_load_mw:           parseFloat(specs.it_load_mw),
      pue:                  parseFloat(specs.pue),
      liq_fraction:         parseFloat(specs.liq_fraction),
      t_supply_c:           parseFloat(specs.t_supply_c),
      t_return_c:           parseFloat(specs.t_return_c),
      approach_dt_c:        parseFloat(specs.approach_dt_c),
      hx_effectiveness:     parseFloat(specs.hx_effectiveness),
      system_efficiency:    parseFloat(specs.system_efficiency),
      utilization_factor:   parseFloat(specs.utilization_factor),
      head_loss_kpa:        parseFloat(specs.head_loss_kpa),
      pump_efficiency:      parseFloat(specs.pump_efficiency),
      discount_rate:        parseFloat(specs.discount_rate),
      project_life_years:   parseInt(specs.project_life_years, 10),
      cost_escalation_rate: parseFloat(specs.cost_escalation_rate),
      pipe_distance_m:      parseFloat(specs.pipe_distance_m) || 0,
      capex:                specs.capex ? parseFloat(specs.capex) : null,
    }

    await onSubmit(payload)
  }

  return (
    <div className="specs-form">
      <style>{FORM_STYLES}</style>

      {/* ── Section 1: Data center ─────────────────────────────────────── */}
      <section>
        <h3>Data center</h3>

        <Field label="User type">
          <select value={specs.user_type} onChange={e => update("user_type", e.target.value)}>
            {USER_TYPES.map(u => (
              <option key={u} value={u}>{toTitleCase(u)}</option>
            ))}
          </select>
        </Field>

        <Field label="Jurisdiction">
          <select value={specs.jurisdiction} onChange={e => handleJurisdictionChange(e.target.value)}>
            {JURISDICTIONS.map(j => (
              <option key={j} value={j}>{toTitleCase(j)}</option>
            ))}
          </select>
        </Field>

        <Field label="IT load (MW)" hint="Total IT power draw">
          <input
            type="number"
            value={specs.it_load_mw}
            onChange={e => update("it_load_mw", e.target.value)}
            placeholder="e.g. 10"
            min="0.1"
            max="500"
          />
        </Field>

        <Field label="PUE">
          <input
            type="number"
            value={specs.pue}
            onChange={e => update("pue", e.target.value)}
            placeholder="1.1 – 2.0"
            min="1.05"
            max="2.5"
            step="0.05"
          />
        </Field>

        <Field label="Cooling type">
          <select value={specs.cooling_type} onChange={e => handleCoolingTypeChange(e.target.value)}>
            {COOLING_TYPES.map(c => (
              <option key={c} value={c}>{toTitleCase(c)}</option>
            ))}
          </select>
        </Field>

        <Field label="Heat buyer type">
          <select value={specs.heat_buyer_type} onChange={e => update("heat_buyer_type", e.target.value)}>
            {BUYER_TYPES[specs.jurisdiction].map(b => (
              <option key={b} value={b}>{toTitleCase(b)}</option>
            ))}
          </select>
        </Field>
      </section>

      {/* ── Section 2: Coolant temperatures ───────────────────────────── */}
      <section>
        <h3>Coolant temperatures — Q = ṁ × Cp × ΔT</h3>

        <Field
          label="Coolant fluid"
          hint="Determines specific heat Cp used in mass flow calculation"
        >
          <select value={specs.fluid} onChange={e => update("fluid", e.target.value)}>
            {FLUID_OPTIONS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </Field>

        <Field
          label="Liquid-cooled fraction"
          hint="Fraction of IT load served by liquid cooling (0.05 – 1.0)"
        >
          <input
            type="number"
            value={specs.liq_fraction}
            onChange={e => update("liq_fraction", e.target.value)}
            min="0.05"
            max="1.0"
            step="0.05"
          />
        </Field>

        <Field
          label="T1 — coolant supply to IT (°C)"
          hint="Hot side HX inlet temperature"
        >
          <input
            type="number"
            value={specs.t_supply_c}
            onChange={e => update("t_supply_c", e.target.value)}
            min="20"
            max="65"
          />
        </Field>

        <Field
          label="T2 — coolant return from IT (°C)"
          hint="Hot side HX outlet temperature — must be greater than T1"
        >
          <input
            type="number"
            value={specs.t_return_c}
            onChange={e => update("t_return_c", e.target.value)}
            min="25"
            max="80"
          />
        </Field>

        {/* Live ΔT readout */}
        {specs.t_supply_c && specs.t_return_c && (
          <p className="delta-readout">
            ΔT = {(parseFloat(specs.t_return_c) - parseFloat(specs.t_supply_c)).toFixed(1)}°C
            {parseFloat(specs.t_return_c) <= parseFloat(specs.t_supply_c) && (
              <span className="error-inline"> — T2 must exceed T1</span>
            )}
          </p>
        )}
      </section>

      {/* ── Section 3: Advanced (collapsed by default) ────────────────── */}
      <section>
        <button
          type="button"
          className="toggle-advanced"
          onClick={() => setShowAdvanced(v => !v)}
        >
          {showAdvanced ? "▾" : "▸"} Advanced parameters
        </button>

        {showAdvanced && (
          <div className="advanced-fields">
            <h4>Heat exchanger design</h4>

            <Field
              label="Approach ΔT (°C)"
              hint="OCP default 4°C — lower = larger HX, better heat quality"
            >
              <select value={specs.approach_dt_c} onChange={e => update("approach_dt_c", e.target.value)}>
                <option value={2}>2°C — large HX, best heat quality</option>
                <option value={3}>3°C</option>
                <option value={4}>4°C — OCP default</option>
                <option value={5}>5°C — compact HX</option>
              </select>
            </Field>

            <Field
              label="HX effectiveness η_hx"
              hint="Plate & frame: 0.80–0.95"
            >
              <input
                type="number"
                value={specs.hx_effectiveness}
                onChange={e => update("hx_effectiveness", e.target.value)}
                min="0.60"
                max="0.97"
                step="0.01"
              />
            </Field>

            <Field
              label="System efficiency η_sys"
              hint="Combined pump and piping losses (0.85–0.98)"
            >
              <input
                type="number"
                value={specs.system_efficiency}
                onChange={e => update("system_efficiency", e.target.value)}
                min="0.60"
                max="0.98"
                step="0.01"
              />
            </Field>

            <Field
              label="Utilization factor"
              hint="Fraction of year operating (0.3 – 1.0)"
            >
              <input
                type="number"
                value={specs.utilization_factor}
                onChange={e => update("utilization_factor", e.target.value)}
                min="0.30"
                max="1.0"
                step="0.05"
              />
            </Field>

            <h4>Pump</h4>

            <Field
              label="Head loss (kPa)"
              hint="OCP default 150 kPa — used to estimate pump operating cost"
            >
              <input
                type="number"
                value={specs.head_loss_kpa}
                onChange={e => update("head_loss_kpa", e.target.value)}
                min="50"
                max="400"
              />
            </Field>

            <Field label="Pump efficiency" hint="0.65 – 0.85">
              <input
                type="number"
                value={specs.pump_efficiency}
                onChange={e => update("pump_efficiency", e.target.value)}
                min="0.50"
                max="0.92"
                step="0.01"
              />
            </Field>

            <h4>Financial</h4>

            <Field label="Discount rate" hint="e.g. 0.08 for 8%">
              <input
                type="number"
                value={specs.discount_rate}
                onChange={e => update("discount_rate", e.target.value)}
                min="0.01"
                max="0.20"
                step="0.01"
              />
            </Field>

            <Field label="Project life (years)">
              <input
                type="number"
                value={specs.project_life_years}
                onChange={e => update("project_life_years", e.target.value)}
                min="5"
                max="30"
              />
            </Field>

            <Field label="Cost escalation rate" hint="e.g. 0.03 for 3%/yr">
              <input
                type="number"
                value={specs.cost_escalation_rate}
                onChange={e => update("cost_escalation_rate", e.target.value)}
                min="0.00"
                max="0.10"
                step="0.005"
              />
            </Field>
          </div>
        )}
      </section>

      {/* ── Section 4: CAPEX overrides ─────────────────────────────────── */}
      <section>
        <h3>CAPEX (optional)</h3>

        <Field
          label="Known HEX CAPEX (leave blank for estimate)"
          hint="If blank, defaults to €200/kW recovered (CIBSE benchmark)"
        >
          <input
            type="number"
            value={specs.capex || ""}
            onChange={e => update("capex", e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="e.g. 500000"
          />
        </Field>

        <Field
          label="Pipe run to heat buyer (m)"
          hint="€1,000/m installed DN200 pre-insulated (CIBSE CP1)"
        >
          <input
            type="number"
            value={specs.pipe_distance_m}
            onChange={e => update("pipe_distance_m", e.target.value)}
            min="0"
            max="5000"
            placeholder="0"
          />
        </Field>
      </section>

      <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
        {loading ? "Generating..." : "Generate report"}
      </button>

    </div>
  )
}