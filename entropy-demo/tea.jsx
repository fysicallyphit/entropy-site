// dropdown menu for specs
// "user_type": "colocation data centre",
// #         "it_load_mw": 10,
// #         "pue": 1.4,
// # c        "cooling_type": "direct_liquid",   # air_cooled | direct_liquid | immersion
// # c        "heat_buyer_type": "district_heating",
// #         "location": "east_london",
// #         "capex_gbp": None,  # Will use benchmark if None
// # c        "jurisdiction" : "uk"

import {useState} from "react"

const JURISDICTIONS = ["germany", "uk", "denmark", "netherlands", "sweden"]
const COOLING_TYPES = ["air_cooled", "direct_liquid", "immersion"]
const BUYER_TYPES = {
    germany:     ["district_heating", "industrial"],
    uk:          ["district_heating", "industrial_process", "greenhouse_horticulture"],
    denmark:     ["district_heating"],
    netherlands: ["district_heating", "greenhouse_horticulture"],
    sweden:      ["district_heating"],

}

export default function SpecsForm({ onSubmit }) {
  // One state object holding all form values
  const [specs, setSpecs] = useState({
    jurisdiction: "germany",
    it_load_mw: "",
    pue: "",
    cooling_type: "direct_liquid",
    heat_buyer_type: "district_heating",
  })

  // One reusable updater — works for any field
  // "...specs" keeps all existing values, then overrides just the one that changed
  const update = (field, value) =>
    setSpecs(prev => ({ ...prev, [field]: value }))
  
  // When jurisdiction changes, also reset buyer_type
  // because e.g. "greenhouse_horticulture" doesn't exist in Denmark
  const handleJurisdictionChange = (value) => {
    update("jurisdiction", value)
    update("heat_buyer_type", BUYER_TYPES[value][0]) // reset to first valid option
  }
  
}