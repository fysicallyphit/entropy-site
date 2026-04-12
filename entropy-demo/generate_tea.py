from dotenv import load_dotenv
load_dotenv()
import json
from openai import OpenAI
client = OpenAI()
import json

COOLING_RECOVERY_FACTORS = {
    "air_cooled": 0.35,
    "direct_liquid": 0.70,
    "immersion": 0.90,
}

HEAT_OUTPUT_TEMPS = {
    "air_cooled": 35,
    "direct_liquid": 60,
    "immersion": 70,
}

JURISDICTION_CONFIG = {
    "germany": {
        "heat_prices": {
            "district_heating": 55,
            "industrial": 42,
        },
        "carbon_credit_price": 65,
        "carbon_intensity": 0.380,
        "incentives": [
            {
                "name": "BAFA Bundesförderung Effiziente Wärmenetze (BEW)",
                "type": "grant",
                "value_pct_capex": 0.40,
                "notes": "Requires connection to qualifying Wärmenetz. Apply via BAFA portal.",
                "source": "BMWK BEW Programme 2024"
            },
            {
                "name": "KfW 293 Wärmenetze",
                "type": "low_interest_loan",
                "interest_rate": 0.015,
                "notes": "1.5% loan for heat network infrastructure",
                "source": "KfW 2024"
            }
        ]
    },
    "denmark": {
        "heat_prices": {
            "district_heating": 80,
        },
        "carbon_credit_price": 60,
        "carbon_intensity": 0.120,
        "incentives": [
            {
                "name": "Fjernvarme feed-in obligation",
                "type": "regulatory",
                "notes": "Data centres >1MW IT load may be legally required to offer waste heat to local utility. Not optional.",
                "source": "Danish Heat Supply Act §14a, 2023"
            }
        ]
    },
    "netherlands": {
        "heat_prices": {
            "district_heating": 48,
            "greenhouse_horticulture": 35,
        },
        "carbon_credit_price": 62,
        "carbon_intensity": 0.270,
        "incentives": [
            {
                "name": "SDE++ (Stimulering Duurzame Energieproductie)",
                "type": "feed_in_premium",
                "notes": "Covers waste heat from data centres since 2022 revision. Competitive tender — not guaranteed.",
                "source": "RVO SDE++ 2024"
            }
        ]
    },
    "uk": {
        "heat_prices": {
            "district_heating": 45,
            "industrial_process": 38,
            "greenhouse_horticulture": 30,
        },
        "carbon_credit_price": 45,
        "carbon_intensity": 0.207,
        "incentives": [
            {
                "name": "Heat Network Zoning (HNZ)",
                "type": "regulatory_mandate",
                "notes": "From 2025, data centres in designated zones must connect. Creates guaranteed buyer.",
                "source": "DESNZ Heat Network Zoning 2024"
            }
        ]
    },
    "sweden": {
        "heat_prices": {
            "district_heating": 60,
        },
        "carbon_credit_price": 55,
        "carbon_intensity": 0.040,
        "incentives": [
            {
                "name": "Energimyndigheten waste heat grants",
                "type": "grant",
                "value_pct_capex": 0.30,
                "source": "Swedish Energy Agency 2024"
            }
        ]
    }
}

USER_TYPE_PERSONAS = {
    "data_center": {
        "report_emphasis": [
            "payback period and net CAPEX after grants",
            "revenue as a new income stream, not core business",
            "reputational and ESG benefits",
            "regulatory risk if heat zoning mandates emerge (Denmark precedent)",
        ],
        "call_to_action": "Connect with a qualified heat buyer via Entropy's marketplace"
    },
    "district_heating_network": {
        "report_emphasis": [
            "security and price stability of heat supply vs gas",
            "temperature suitability for their network (output_temp_c vs required inlet temp)",
            "volume reliability — data centers have ~95% uptime vs seasonal demand",
            "carbon reporting benefits for their own obligations",
        ],
        "call_to_action": "Request a Heat Purchasing Agreement term sheet via Entropy"
    }
}

#-----------------------------------------------------------
TEA_PROMPT = """You are a techno-economic analyst specialising in industrial heat recovery and data centre decarbonisation.

The following calculations have already been performed using verified physical formulas. Your job is to:
1. Write an executive summary interpreting these results for a potential heat buyer or investor
2. Explain the methodology in plain language (not equations — the equations are already in the appendix)
3. Flag any risks or assumptions the reader should scrutinise
4. State what government incentives apply for the given jurisdiction

Be specific and cite real figures. Do not invent numbers — only use what is provided below.

--- INPUT SPECIFICATIONS ---
{specs_json}

--- CALCULATED RESULTS ---
{results_json}

--- YOUR OUTPUT FORMAT ---
Write three sections:
EXECUTIVE SUMMARY (2-3 paragraphs)
METHODOLOGY NOTE (1 paragraph explaining the physics chain)
RISKS & ASSUMPTIONS (bullet list, max 6 points)

--- REPORT PERSONA ---
This report is written for a {user_type}. Emphasise the following: {persona_emphasis}
End with this call to action: {call_to_action}
"""
#-----------------------------------------------------------

def calculate_physics(specs: dict) -> dict:
    it_load_kw = specs["it_load_mw"] * 1000
    pue = specs["pue"]
    cooling_type = specs["cooling_type"]
    buyer_type = specs["heat_buyer_type"]
    jurisdiction = specs["jurisdiction"]

    assert 1.0 < pue < 2.5, f"PUE {pue} outside realistic range"
    assert specs["it_load_mw"] > 0
    assert jurisdiction in JURISDICTION_CONFIG, f"Unsupported jurisdiction: {jurisdiction}"

    config = JURISDICTION_CONFIG[jurisdiction]

    assert buyer_type in config["heat_prices"], \
        f"{buyer_type} not available in {jurisdiction}. Options: {list(config['heat_prices'].keys())}"

    # Physics
    total_facility_kw = it_load_kw * pue
    total_heat_rejected_kw = total_facility_kw
    recovery_factor = COOLING_RECOVERY_FACTORS[cooling_type]
    recoverable_heat_kw = total_heat_rejected_kw * recovery_factor
    output_temp_c = HEAT_OUTPUT_TEMPS[cooling_type]
    annual_heat_mwh = (recoverable_heat_kw / 1000) * 8760 * 0.95

    # Revenue
    heat_price = config["heat_prices"][buyer_type]
    annual_heat_revenue = annual_heat_mwh * heat_price

    # Carbon
    tonnes_co2_displaced = (annual_heat_mwh * 1000 * config["carbon_intensity"]) / 1000
    annual_carbon_credit = tonnes_co2_displaced * config["carbon_credit_price"]

    # CAPEX — apply grants before payback
    gross_capex = specs.get("capex") or (recoverable_heat_kw * 200)
    grants = [i for i in config["incentives"] if i["type"] == "grant"]
    total_grant_pct = sum(g.get("value_pct_capex", 0) for g in grants)
    grant_value = gross_capex * total_grant_pct
    net_capex = gross_capex - grant_value

    annual_opex = net_capex * 0.02
    annual_net_benefit = annual_heat_revenue + annual_carbon_credit - annual_opex
    simple_payback_years = net_capex / annual_net_benefit if annual_net_benefit > 0 else float('inf')

    return {
        "inputs": specs,
        "physics": {
            "total_facility_load_kw": round(total_facility_kw, 1),
            "recoverable_heat_kw": round(recoverable_heat_kw, 1),
            "output_temp_c": output_temp_c,
            "annual_heat_mwh": round(annual_heat_mwh, 0),
        },
        "financials": {
            "annual_heat_revenue": round(annual_heat_revenue, 0),
            "tonnes_co2_displaced_annual": round(tonnes_co2_displaced, 1),
            "annual_carbon_credit": round(annual_carbon_credit, 0),
            "gross_capex": round(gross_capex, 0),
            "grant_value": round(grant_value, 0),
            "net_capex": round(net_capex, 0),
            "annual_opex": round(annual_opex, 0),
            "annual_net_benefit": round(annual_net_benefit, 0),
            "simple_payback_years": round(simple_payback_years, 1),
        },
        "incentives_applied": config["incentives"],
        "currency": "EUR" if jurisdiction != "uk" else "GBP",
        "sources": {
            "heat_prices": "BEIS/Ofgem 2023, BMWK 2024, RVO 2024",
            "carbon_intensity": "DESNZ / EEA national grid intensity figures 2024",
            "carbon_credit_price": "EU ETS + national voluntary markets Q1 2025",
            "capex_benchmark": "CIBSE Heat Networks Code of Practice 2021: £150-250/kW installed",
        }
    }


def generate_tea_report(specs: dict) -> dict:
    calculated = calculate_physics(specs)
    persona = USER_TYPE_PERSONAS[specs["user_type"]]

    response = client.chat.completions.create(
        model="gpt-4",
        max_tokens=1500,
        temperature=0,  # Deterministic for a professional report
        messages=[{
            "role": "user",
            "content": TEA_PROMPT.format(
                specs_json=json.dumps(specs, indent=2),
                results_json=json.dumps(calculated, indent=2),
                persona_emphasis=json.dumps(persona, indent=2)

            )
        }]
    )

    narrative = response.content[0].text

    return {
        "calculated": calculated,
        "narrative": narrative,
    }


if __name__ == "__main__":
    example_specs = {
        "user_type": "colocation data centre",
        "it_load_mw": 10,
        "pue": 1.4,
        "cooling_type": "direct_liquid",
        "heat_buyer_type": "district_heating",
        "jurisdiction": "germany",
        "capex": None,
    }

    result = generate_tea_report(example_specs)

    with open("tea_calculated.json", "w") as f:
        json.dump(result["calculated"], f, indent=2)

    with open("tea_narrative.txt", "w") as f:
        f.write(result["narrative"])

    print(f"Payback: {result['calculated']['financials']['simple_payback_years']} years")
    print(f"Annual revenue: {result['calculated']['currency']} {result['calculated']['financials']['annual_heat_revenue']:,}")
    print(f"Grant value: {result['calculated']['currency']} {result['calculated']['financials']['grant_value']:,}")


