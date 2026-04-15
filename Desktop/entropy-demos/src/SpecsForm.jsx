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

export default function SpecsForm({ onSubmit, loading }) {
  const [specs, setSpecs] = useState({
    user_type: "data_center",
    jurisdiction: "germany",
    it_load_mw: "",
    pue: "",
    cooling_type: "direct_liquid",
    heat_buyer_type: "district_heating",
    capex: null,
  })

  const update = (field, value) =>
    setSpecs(prev => ({ ...prev, [field]: value }))

  const handleJurisdictionChange = (value) => {
    update("jurisdiction", value)
    update("heat_buyer_type", BUYER_TYPES[value][0])
  }

  const handleSubmit = async () => {
    if (!specs.it_load_mw || !specs.pue) {
      alert("Please fill in IT load and PUE")
      return
    }
    await onSubmit(specs)
  }

  return (
    <div>
      <label>User Type</label>
      <select value={specs.user_type} onChange={e => update("user_type", e.target.value)}>
        {USER_TYPES.map(u => (
          <option key={u} value={u}>{u.replace(/_/g, " ")}</option>
        ))}
      </select>

      <label>Jurisdiction</label>
      <select value={specs.jurisdiction} onChange={e => handleJurisdictionChange(e.target.value)}>
        {JURISDICTIONS.map(j => (
          <option key={j} value={j}>{j}</option>
        ))}
      </select>

      <label>IT Load (MW)</label>
      <input
        type="number"
        value={specs.it_load_mw}
        onChange={e => update("it_load_mw", parseFloat(e.target.value))}
        placeholder="e.g. 10"
        min="0.1"
        max="500"
      />

      <label>PUE</label>
      <input
        type="number"
        value={specs.pue}
        onChange={e => update("pue", parseFloat(e.target.value))}
        placeholder="1.1 – 2.0"
        min="1.1"
        max="2.5"
        step="0.05"
      />

      <label>Cooling Type</label>
      <select value={specs.cooling_type} onChange={e => update("cooling_type", e.target.value)}>
        {COOLING_TYPES.map(c => (
          <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
        ))}
      </select>

      <label>Heat Buyer Type</label>
      <select value={specs.heat_buyer_type} onChange={e => update("heat_buyer_type", e.target.value)}>
        {BUYER_TYPES[specs.jurisdiction].map(b => (
          <option key={b} value={b}>{b.replace(/_/g, " ")}</option>
        ))}
      </select>

      <label>Known CAPEX (optional, leave blank for estimate)</label>
      <input
        type="number"
        value={specs.capex || ""}
        onChange={e => update("capex", e.target.value ? parseFloat(e.target.value) : null)}
        placeholder="e.g. 500000"
      />

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Generating..." : "Generate Report"}
      </button>
    </div>
  )
}