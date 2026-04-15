from dotenv import load_dotenv
load_dotenv()
from openai import OpenAI
import json

client = OpenAI()

# Blended installed cost per metre of DN200 pre-insulated district heating pipe
# Includes pipe, fittings, civil works, backfill. Source: CIBSE CP1 2021, Euroheat & Power 2023
PIPE_COST_PER_METRE = 1000  # EUR/m

HPA_JURISDICTION_CONFIG = {
    "germany": {
        "currency": "EUR",
        "base_heat_price_mwh": 55,
        "ttf_distribution_markup": 18,
        "capacity_charge_mw_year": 28000,
        "regulatory": {
            "framework": "EU Energy Efficiency Directive (EED) Article 24 — waste heat recovery obligation for facilities >1MW",
            "national": "Gebäudeenergiegesetz (GEG) 2024 — municipal heat planning mandates",
            "grid_access": "Wärmeplanungsgesetz 2024 — data centres must register waste heat capacity with local authority",
        }
    },
    "denmark": {
        "currency": "DKK",
        "base_heat_price_mwh": 80,
        "ttf_distribution_markup": 22,
        "capacity_charge_mw_year": 35000,
        "regulatory": {
            "framework": "EU EED Article 24",
            "national": "Danish Heat Supply Act §14a (2023) — facilities >1MW IT load may be legally required to offer waste heat to local fjernvarme utility",
            "grid_access": "Fjernvarme connection terms negotiated with municipal utility (forsyning)",
        }
    },
    "netherlands": {
        "currency": "EUR",
        "base_heat_price_mwh": 48,
        "ttf_distribution_markup": 16,
        "capacity_charge_mw_year": 24000,
        "regulatory": {
            "framework": "EU EED Article 24",
            "national": "SDE++ feed-in premium applicable to qualifying waste heat recovery installations",
            "grid_access": "WarmteWet (Heat Act) governs third-party access to heat networks",
        }
    },
    "uk": {
        "currency": "GBP",
        "base_heat_price_mwh": 45,
        "ttf_distribution_markup": 20,
        "capacity_charge_mw_year": 22000,
        "regulatory": {
            "framework": "Heat Networks (Scotland) Act 2021 / England & Wales Heat Network Zoning (2025)",
            "national": "DESNZ Heat Network Zoning — data centres in designated zones mandated to connect from 2025",
            "grid_access": "Ofgem heat network licence conditions apply where network serves >500 connections",
        }
    },
    "sweden": {
        "currency": "SEK",
        "base_heat_price_mwh": 60,
        "ttf_distribution_markup": 14,
        "capacity_charge_mw_year": 30000,
        "regulatory": {
            "framework": "EU EED Article 24",
            "national": "Lag om energieffektivisering (2023:752) — large sites must assess and report waste heat potential",
            "grid_access": "Fjärrvärmelagen — district heating operators must offer connection on reasonable terms",
        }
    }
}

HEAT_BUYER_DESCRIPTIONS = {
    "district_heating": "Municipal or private district heating network operator",
    "industrial": "Industrial process heat consumer",
    "greenhouse_horticulture": "Greenhouse or horticultural facility",
    "industrial_process": "Industrial process heat consumer",
}

COOLING_TYPE_DELIVERY_TEMPS = {
    "air_cooled": 35,
    "direct_liquid": 60,
    "immersion": 70,
}


def calculate_hpa_terms(specs: dict) -> dict:
    jurisdiction = specs["jurisdiction"]
    assert jurisdiction in HPA_JURISDICTION_CONFIG, f"Unsupported jurisdiction: {jurisdiction}"

    config = HPA_JURISDICTION_CONFIG[jurisdiction]

    contracted_capacity_mw = specs["contracted_capacity_mw"]
    availability_pct = specs["availability_guarantee_pct"] / 100
    term_years = specs["term_years"]
    cooling_type = specs["cooling_type"]
    ttf_spot = specs["ttf_spot_eur_mwh"]

    assert contracted_capacity_mw > 0
    assert 0.5 <= availability_pct <= 1.0, "Availability guarantee must be 50–100%"
    assert 5 <= term_years <= 30, "Term must be 5–30 years"

    # Volume
    guaranteed_min_mwh_year = contracted_capacity_mw * availability_pct * 8760
    max_annual_mwh = contracted_capacity_mw * 8760

    # Pricing
    base_price = config["base_heat_price_mwh"]
    collar_floor = round(base_price * 0.80, 2)
    collar_ceiling = round(base_price * 1.20, 2)
    capacity_charge_year = config["capacity_charge_mw_year"] * contracted_capacity_mw

    # Shortfall
    shortfall_rate = ttf_spot + config["ttf_distribution_markup"]

    # Revenue
    annual_usage_revenue = guaranteed_min_mwh_year * base_price
    annual_total_revenue = capacity_charge_year + annual_usage_revenue
    total_contract_value = annual_total_revenue * term_years

    # Shortfall exposure
    max_monthly_shortfall_mwh = (contracted_capacity_mw * 8760) / 12
    max_monthly_shortfall_payment = max_monthly_shortfall_mwh * shortfall_rate

    # Indexation
    cpi_assumption_pct = 2.5
    price_year_10 = round(base_price * ((1 + cpi_assumption_pct / 100) ** 10), 2)
    price_year_20 = round(base_price * ((1 + cpi_assumption_pct / 100) ** 20), 2)

    # Delivery specs
    delivery_temp_c = COOLING_TYPE_DELIVERY_TEMPS[cooling_type]
    min_delivery_temp_c = delivery_temp_c - 5

    # Pipe infrastructure — Seller capital obligation, disclosed in term sheet
    pipe_distance_m = specs.get("pipe_distance_m") or 0
    pipe_capex = pipe_distance_m * PIPE_COST_PER_METRE

    return {
        "inputs": specs,
        "parties": {
            "seller_role": "Data Centre Operator (Heat Seller)",
            "buyer_role": HEAT_BUYER_DESCRIPTIONS.get(specs["heat_buyer_type"], "Heat Buyer"),
            "jurisdiction": jurisdiction,
            "currency": config["currency"],
        },
        "capacity_and_volume": {
            "contracted_capacity_mw": contracted_capacity_mw,
            "availability_guarantee_pct": specs["availability_guarantee_pct"],
            "guaranteed_min_mwh_year": round(guaranteed_min_mwh_year, 0),
            "max_annual_mwh": round(max_annual_mwh, 0),
            "delivery_temp_c": delivery_temp_c,
            "min_delivery_temp_c": min_delivery_temp_c,
        },
        "pricing": {
            "capacity_charge_eur_mw_year": config["capacity_charge_mw_year"],
            "capacity_charge_total_year": round(capacity_charge_year, 0),
            "usage_charge_eur_mwh": base_price,
            "collar_floor_eur_mwh": collar_floor,
            "collar_ceiling_eur_mwh": collar_ceiling,
            "indexation": f"CPI + {cpi_assumption_pct}% annual cap",
            "price_year_10_eur_mwh": price_year_10,
            "price_year_20_eur_mwh": price_year_20,
        },
        "shortfall": {
            "mechanism": "Shortfall Payment — Seller compensates Buyer at market reference rate for undelivered volume",
            "shortfall_rate_eur_mwh": round(shortfall_rate, 2),
            "shortfall_rate_basis": f"TTF spot ({ttf_spot} EUR/MWh) + distribution markup ({config['ttf_distribution_markup']} EUR/MWh)",
            "max_monthly_shortfall_mwh": round(max_monthly_shortfall_mwh, 0),
            "max_monthly_shortfall_payment": round(max_monthly_shortfall_payment, 0),
            "measurement_period": "Calendar month",
            "cure_period_days": specs.get("cure_period_days", 30),
        },
        "term": {
            "duration_years": term_years,
            "renewal_option_years": specs.get("renewal_option_years", 5),
            "break_clause_year": specs.get("break_clause_year", None),
            "seller_step_in_rights": True,
        },
        "infrastructure": {
            "pipe_distance_m": pipe_distance_m,
            "pipe_capex": round(pipe_capex, 0),
            "pipe_cost_basis": f"{PIPE_COST_PER_METRE} EUR/m blended installed (DN200)",
            "note": "Pipe infrastructure cost is a Seller capital obligation and does not affect heat price.",
        },
        "financials": {
            "annual_capacity_revenue": round(capacity_charge_year, 0),
            "annual_usage_revenue": round(annual_usage_revenue, 0),
            "annual_total_revenue": round(annual_total_revenue, 0),
            "total_contract_value_undiscounted": round(total_contract_value, 0),
        },
        "regulatory": config["regulatory"],
        "sources": {
            "heat_price_benchmark": "BEIS/Ofgem 2023, BMWK 2024, RVO 2024, Energistyrelsen 2024",
            "shortfall_index": "TTF Natural Gas front-month (ICE), distribution markup per CIBSE Heat Networks CoP 2021",
            "capacity_charge_benchmark": "Euroheat & Power District Heating Price Survey 2023",
            "pipe_cost_benchmark": "CIBSE CP1 2021, Euroheat & Power 2023: EUR 800-1,200/m installed DN200",
            "eed_reference": "EU Energy Efficiency Directive 2023/1791, Article 24",
        }
    }


HPA_PROMPT = """You are a senior energy lawyer and commercial advisor specialising in heat offtake agreements for data centre waste heat recovery projects in Europe.

The following commercial terms have been calculated using verified market data. Your job is to produce a structured Heat Purchasing Agreement (HPA) term sheet.

This is a bankable commercial document — it will be reviewed by lenders, lawyers, and CFOs. Write with precision. Use defined terms in CAPITALS on first use. Do not invent numbers — only use what is provided.

--- CALCULATED TERMS ---
{terms_json}

--- OUTPUT FORMAT (follow exactly) ---

HEAT PURCHASING AGREEMENT — INDICATIVE TERM SHEET

1. PARTIES
   Seller: [full description]
   Buyer: [full description]
   Effective Date: [to be agreed]

2. FACILITY & DELIVERY POINT
   [Facility description, delivery temperature, metering]

3. CONTRACTED CAPACITY & VOLUME
   [Contracted MW, guaranteed minimum MWh/year, availability guarantee, measurement period]

4. PAYMENT STRUCTURE
   4.1 Capacity Charge
   4.2 Usage Charge
   4.3 Price Collar (Floor / Ceiling)
   4.4 Indexation

5. SHORTFALL PAYMENT MECHANISM
   [Full description of shortfall calculation, reference rate, cure period, measurement]

6. AGREEMENT TERM & OPTIONALITY
   [Duration, renewal, break clause, step-in rights]

7. FORCE MAJEURE & CURTAILMENT
   [Triggers, carve-outs, obligations]

8. REGULATORY COMPLIANCE
   [Applicable EED obligations, national law, grid access rights]

9. INDICATIVE CONTRACT VALUE
   [Annual revenue, total undiscounted contract value, lender headline metrics]
   If pipe infrastructure is included, state it as a Seller capital obligation separate from the payment structure.

10. CONDITIONS PRECEDENT & NEXT STEPS
    [What must happen before execution]

End with: "This term sheet is indicative only and does not constitute a binding agreement. Parties should seek independent legal advice before execution."
"""


def generate_hpa_report(specs: dict) -> dict:
    calculated = calculate_hpa_terms(specs)

    response = client.chat.completions.create(
        model="gpt-4o",
        temperature=0,
        messages=[{
            "role": "user",
            "content": HPA_PROMPT.format(
                terms_json=json.dumps(calculated, indent=2)
            )
        }]
    )

    narrative = response.choices[0].message.content

    return {
        "calculated": calculated,
        "narrative": narrative,
    }


if __name__ == "__main__":
    example_specs = {
        "jurisdiction": "germany",
        "cooling_type": "direct_liquid",
        "heat_buyer_type": "district_heating",
        "contracted_capacity_mw": 5.0,
        "availability_guarantee_pct": 95,
        "term_years": 15,
        "renewal_option_years": 5,
        "break_clause_year": None,
        "ttf_spot_eur_mwh": 38,
        "pipe_distance_m": 300,
        "seller_name": "Example Data Centre GmbH",
        "buyer_name": "Stadtwerke Musterstadt",
    }

    result = generate_hpa_report(example_specs)

    with open("hpa_calculated.json", "w") as f:
        json.dump(result["calculated"], f, indent=2)

    with open("hpa_term_sheet.txt", "w") as f:
        f.write(result["narrative"])

    financials = result["calculated"]["financials"]
    infra = result["calculated"]["infrastructure"]
    currency = result["calculated"]["parties"]["currency"]
    print(f"Annual revenue: {currency} {financials['annual_total_revenue']:,}")
    print(f"Total contract value: {currency} {financials['total_contract_value_undiscounted']:,}")
    print(f"Pipe CAPEX (Seller obligation): {currency} {infra['pipe_capex']:,} ({infra['pipe_distance_m']}m)")