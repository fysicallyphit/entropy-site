from dotenv import load_dotenv
load_dotenv()

from openai import OpenAI
import json

client = OpenAI()

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

BUYER_TEMP_REQUIREMENTS = {
    "district_heating": 55,
    "industrial": 45,
    "industrial_process": 45,
    "greenhouse_horticulture": 35,
    "aquaculture": 25,
}

SEASONAL_LOAD_FACTORS = {
    "district_heating": 0.72,
    "industrial": 0.90,
    "industrial_process": 0.90,
    "greenhouse_horticulture": 0.85,
    "aquaculture": 0.88,
}

# Blended installed cost per metre of DN200 pre-insulated district heating pipe
# Includes pipe, fittings, civil works, backfill. Source: CIBSE CP1 2021, Euroheat & Power 2023
PIPE_COST_PER_METRE = 1000  # EUR/m

JURISDICTION_CONFIG = {
    "germany": {
        "heat_prices": {
            "district_heating": 55,
            "industrial": 42,
        },
        "carbon_credit_price": 65,
        "carbon_intensity": 0.380,
        "electricity_price": 0.18,
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
                "notes": "1.5% loan for heat network infrastructure.",
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
        "electricity_price": 0.22,
        "incentives": [
            {
                "name": "Fjernvarme feed-in obligation",
                "type": "regulatory",
                "notes": "Data centres >1MW IT load may be legally required to offer waste heat to local utility.",
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
        "electricity_price": 0.17,
        "incentives": [
            {
                "name": "SDE++ (Stimulering Duurzame Energieproductie)",
                "type": "feed_in_premium",
                "notes": "Covers waste heat from data centres since 2022 revision. Competitive tender.",
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
        "electricity_price": 0.22,
        "incentives": [
            {
                "name": "Heat Network Zoning (HNZ)",
                "type": "regulatory_mandate",
                "notes": "From 2025, data centres in designated zones must connect.",
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
        "electricity_price": 0.10,
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
            "revenue as a new income stream",
            "ESG and reputational benefits",
            "ERF score for EU Energy Efficiency Directive compliance",
            "regulatory risk if heat zoning mandates emerge",
        ],
        "call_to_action": "Connect with a qualified heat buyer via Entropy's marketplace"
    },
    "district_heating_network": {
        "report_emphasis": [
            "security and price stability vs gas",
            "temperature suitability for their network",
            "volume reliability and seasonal load matching",
            "carbon reporting benefits",
        ],
        "call_to_action": "Request a Heat Purchasing Agreement term sheet via Entropy"
    }
}

TEA_PROMPT = """You are a techno-economic analyst specialising in industrial heat recovery and data centre decarbonisation.

The following calculations have already been performed using verified physical formulas. Your job is to:
1. Write an executive summary interpreting these results for the given user type
2. Explain the methodology in plain language, including any heat pump requirement
3. Flag risks and assumptions the reader should scrutinise
4. State what government incentives apply for the given jurisdiction

Be specific. Do not invent numbers — only use what is provided below.
If a heat pump is required, explain why and what it means for the economics.
If pipe infrastructure cost is included, mention it as a component of total CAPEX.

--- INPUT SPECIFICATIONS ---
{specs_json}

--- CALCULATED RESULTS ---
{results_json}

--- REPORT PERSONA ---
This report is written for a {user_type}. Emphasise: {persona_emphasis}
End with this call to action: {call_to_action}

--- OUTPUT FORMAT ---
EXECUTIVE SUMMARY (2-3 paragraphs)
METHODOLOGY NOTE (1 paragraph)
RISKS & ASSUMPTIONS (bullet list, max 6 points)
"""


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

    # --- Core physics ---
    total_facility_kw = it_load_kw * pue
    total_heat_rejected_kw = total_facility_kw
    recovery_factor = COOLING_RECOVERY_FACTORS[cooling_type]
    recoverable_heat_kw = total_heat_rejected_kw * recovery_factor
    output_temp_c = HEAT_OUTPUT_TEMPS[cooling_type]

    # ERF — EU Energy Efficiency Directive metric
    erf = recoverable_heat_kw / it_load_kw

    # Seasonal correction
    seasonal_factor = SEASONAL_LOAD_FACTORS.get(buyer_type, 0.95)
    annual_heat_mwh_raw = (recoverable_heat_kw / 1000) * 8760 * 0.95
    annual_heat_mwh = annual_heat_mwh_raw * seasonal_factor

    # --- Temperature gating and heat pump ---
    buyer_inlet_required = BUYER_TEMP_REQUIREMENTS.get(buyer_type, 45)
    heat_pump_required = output_temp_c < buyer_inlet_required

    heat_pump_capex = 0
    heat_pump_annual_opex = 0
    heat_pump_cop = None
    temp_lift = 0

    if heat_pump_required:
        temp_lift = buyer_inlet_required - output_temp_c
        heat_pump_cop = max(1.5, 4.5 - (temp_lift * 0.05))
        heat_pump_capex = recoverable_heat_kw * 400
        heat_pump_electricity_mwh = annual_heat_mwh / heat_pump_cop
        heat_pump_annual_opex = heat_pump_electricity_mwh * 1000 * config["electricity_price"]

    # --- Revenue ---
    heat_price = config["heat_prices"][buyer_type]
    annual_heat_revenue = annual_heat_mwh * heat_price

    # --- Carbon credits ---
    tonnes_co2_displaced = (annual_heat_mwh * 1000 * config["carbon_intensity"]) / 1000
    annual_carbon_credit = tonnes_co2_displaced * config["carbon_credit_price"]

    # --- CAPEX ---
    hex_capex = specs.get("capex") or (recoverable_heat_kw * 200)
    pipe_distance_m = specs.get("pipe_distance_m") or 0
    pipe_capex = pipe_distance_m * PIPE_COST_PER_METRE
    gross_capex = hex_capex + heat_pump_capex + pipe_capex

    grants = [i for i in config["incentives"] if i["type"] == "grant"]
    total_grant_pct = sum(g.get("value_pct_capex", 0) for g in grants)
    grant_value = gross_capex * total_grant_pct
    net_capex = gross_capex - grant_value

    # --- OPEX ---
    annual_maintenance_opex = net_capex * 0.02
    annual_total_opex = annual_maintenance_opex + heat_pump_annual_opex

    # --- Profitability ---
    annual_net_benefit = annual_heat_revenue + annual_carbon_credit - annual_total_opex
    simple_payback_years = (
        net_capex / annual_net_benefit if annual_net_benefit > 0 else float("inf")
    )

    return {
        "inputs": specs,
        "physics": {
            "total_facility_load_kw": round(total_facility_kw, 1),
            "total_heat_rejected_kw": round(total_heat_rejected_kw, 1),
            "recoverable_heat_kw": round(recoverable_heat_kw, 1),
            "output_temp_c": output_temp_c,
            "buyer_inlet_required_c": buyer_inlet_required,
            "heat_pump_required": heat_pump_required,
            "heat_pump_cop": round(heat_pump_cop, 2) if heat_pump_cop else None,
            "temp_lift_c": temp_lift,
            "seasonal_load_factor": seasonal_factor,
            "annual_heat_mwh_pre_seasonal": round(annual_heat_mwh_raw, 0),
            "annual_heat_mwh": round(annual_heat_mwh, 0),
            "erf": round(erf, 3),
            "erf_pct": f"{round(erf * 100, 1)}%",
        },
        "financials": {
            "annual_heat_revenue": round(annual_heat_revenue, 0),
            "tonnes_co2_displaced_annual": round(tonnes_co2_displaced, 1),
            "annual_carbon_credit": round(annual_carbon_credit, 0),
            "hex_capex": round(hex_capex, 0),
            "heat_pump_capex": round(heat_pump_capex, 0),
            "pipe_distance_m": pipe_distance_m,
            "pipe_capex": round(pipe_capex, 0),
            "gross_capex": round(gross_capex, 0),
            "grant_value": round(grant_value, 0),
            "net_capex": round(net_capex, 0),
            "annual_maintenance_opex": round(annual_maintenance_opex, 0),
            "annual_heat_pump_opex": round(heat_pump_annual_opex, 0),
            "annual_total_opex": round(annual_total_opex, 0),
            "annual_net_benefit": round(annual_net_benefit, 0),
            "simple_payback_years": round(simple_payback_years, 1),
        },
        "compliance": {
            "erf": round(erf, 3),
            "erf_band": (
                "above 75%" if erf > 0.75 else
                "50-75%" if erf > 0.50 else
                "25-50%" if erf > 0.25 else
                "below 25%"
            ),
            "eu_eed_target_met": erf >= 0.75,
            "wue_impact": "improved" if not heat_pump_required else "neutral",
            "pue_impact": "neutral" if not heat_pump_required else "slightly worsened",
        },
        "incentives_applied": config["incentives"],
        "currency": "EUR" if jurisdiction != "uk" else "GBP",
        "sources": {
            "heat_prices": "BEIS/Ofgem 2023, BMWK 2024, RVO 2024",
            "carbon_intensity": "DESNZ / EEA national grid intensity figures 2024",
            "carbon_credit_price": "EU ETS + national voluntary markets Q1 2025",
            "capex_benchmark": "CIBSE Heat Networks Code of Practice 2021: £150-250/kW HEX, £350-450/kW heat pump",
            "pipe_cost_benchmark": "CIBSE CP1 2021, Euroheat & Power 2023: EUR 800-1,200/m installed DN200",
            "heat_pump_cop": "Carnot-derived COP with 0.05 degradation per °C temperature lift",
            "seasonal_factors": "Eurostat district heating demand profiles 2023",
            "erf": "EU Energy Efficiency Directive Article 24, recast 2023",
        }
    }


def generate_tea_report(specs: dict) -> dict:
    calculated = calculate_physics(specs)
    persona = USER_TYPE_PERSONAS[specs["user_type"]]

    response = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=1500,
        temperature=0,
        messages=[{
            "role": "user",
            "content": TEA_PROMPT.format(
                specs_json=json.dumps(specs, indent=2),
                results_json=json.dumps(calculated, indent=2),
                user_type=specs["user_type"],
                persona_emphasis=json.dumps(persona["report_emphasis"], indent=2),
                call_to_action=persona["call_to_action"]
            )
        }]
    )

    narrative = response.choices[0].message.content

    return {
        "calculated": calculated,
        "narrative": narrative,
    }


if __name__ == "__main__":
    print("=== Test: immersion → district heating, 300m pipe run ===")
    specs = {
        "user_type": "data_center",
        "it_load_mw": 10,
        "pue": 1.4,
        "cooling_type": "immersion",
        "heat_buyer_type": "district_heating",
        "jurisdiction": "germany",
        "capex": None,
        "pipe_distance_m": 300,
    }
    result = generate_tea_report(specs)
    f = result["calculated"]["financials"]
    print(f"Pipe CAPEX: EUR {f['pipe_capex']:,} ({f['pipe_distance_m']}m)")
    print(f"Gross CAPEX: EUR {f['gross_capex']:,}")
    print(f"Net CAPEX (after grants): EUR {f['net_capex']:,}")
    print(f"Payback: {f['simple_payback_years']} years")