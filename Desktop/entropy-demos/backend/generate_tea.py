from dotenv import load_dotenv
load_dotenv()

from openai import OpenAI
import os
import json
import math

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.environ["GROQ_API_KEY"],
)

# ---------------------------------------------------------------------------
# Physical constants
# ---------------------------------------------------------------------------

# Specific heat capacity of common data-centre coolants (kJ/kg·K)
# Source: OCP Heat Reuse Reference Design Paper; ASHRAE fundamentals
FLUID_CP = {
    "water":  4.18,   # Pure water
    "pg25":   3.84,   # Propylene glycol 25% — OCP reference fluid
    "pg40":   3.43,   # Propylene glycol 40%
}

# Fluid density at typical operating temperature (kg/L) — used for L/min → kg/s
FLUID_DENSITY = {
    "water": 0.998,
    "pg25":  1.018,
    "pg40":  1.033,
}

# ---------------------------------------------------------------------------
# Existing lookup tables (unchanged)
# ---------------------------------------------------------------------------

COOLING_RECOVERY_FACTORS = {
    "air_cooled":     0.35,
    "direct_liquid":  0.70,
    "immersion":      0.90,
}

HEAT_OUTPUT_TEMPS = {
    "air_cooled":    35,
    "direct_liquid": 60,
    "immersion":     70,
}

BUYER_TEMP_REQUIREMENTS = {
    "district_heating":       55,
    "industrial":             45,
    "industrial_process":     45,
    "greenhouse_horticulture": 35,
    "aquaculture":            25,
}

SEASONAL_LOAD_FACTORS = {
    "district_heating":        0.72,
    "industrial":              0.90,
    "industrial_process":      0.90,
    "greenhouse_horticulture": 0.85,
    "aquaculture":             0.88,
}

PIPE_COST_PER_METRE = 1000  # EUR/m, blended installed DN200 pre-insulated pipe

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


# ---------------------------------------------------------------------------
# Step 1: Derive mass flow rate from Q = ṁ × Cp × ΔT
# ---------------------------------------------------------------------------

def derive_mass_flow(
    q_available_kw: float,
    t_supply_c: float,
    t_return_c: float,
    fluid: str = "pg25",
) -> dict:
    """
    Given available thermal power and supply/return temperatures,
    derive coolant mass flow rate.

    Q = ṁ × Cp × ΔT  →  ṁ = Q / (Cp × ΔT)

    Args:
        q_available_kw: Thermal power available for recovery (kW)
        t_supply_c:     Coolant supply temperature to IT (°C)  — T1 (hot side HX inlet)
        t_return_c:     Coolant return temperature from IT (°C) — T2 (hot side HX outlet)
        fluid:          One of 'water', 'pg25', 'pg40'

    Returns dict with mass_flow_kgs, vol_flow_lpm, delta_t, cp_used
    """
    cp = FLUID_CP.get(fluid, FLUID_CP["pg25"])          # kJ/kg·K
    rho = FLUID_DENSITY.get(fluid, FLUID_DENSITY["pg25"])  # kg/L
    delta_t = t_return_c - t_supply_c

    assert delta_t > 0, (
        f"Return temp ({t_return_c}°C) must exceed supply temp ({t_supply_c}°C). "
        "Heat flows from hot IT fluid to coolant."
    )

    mass_flow_kgs = q_available_kw / (cp * delta_t)     # kg/s
    vol_flow_lps  = mass_flow_kgs / rho                  # L/s
    vol_flow_lpm  = vol_flow_lps * 60                    # L/min

    return {
        "fluid": fluid,
        "cp_kj_kgK": cp,
        "delta_t_c": round(delta_t, 1),
        "mass_flow_kgs": round(mass_flow_kgs, 2),
        "vol_flow_lpm": round(vol_flow_lpm, 1),
    }


# ---------------------------------------------------------------------------
# Step 2: Heat exchanger model — approach temperature, effectiveness
# ---------------------------------------------------------------------------

def model_heat_exchanger(
    q_available_kw: float,
    t_supply_c: float,
    t_return_c: float,
    approach_dt_c: float = 4.0,
    hx_effectiveness: float = 0.85,
    system_efficiency: float = 0.90,
) -> dict:
    """
    Model the heat exchanger using the OCP approach-temperature framework.

    Hot side (data centre):  T2 (return) → T1 (supply)
    Cold side (offtaker):    T3 (offtaker supply out) ← T4 (offtaker return in)

    Approach temperature ΔT_approach = T2 - T3_out  (hot outlet vs cold outlet)
    i.e. the closest temperature difference in the HX.

    Q_recoverable = Q_available × η_hx × η_sys

    Args:
        q_available_kw:   Thermal power available (kW)
        t_supply_c:       T1 — coolant supply to IT (°C)
        t_return_c:       T2 — coolant return from IT / hot HX inlet (°C)
        approach_dt_c:    Approach temperature (°C); OCP default 4°C
        hx_effectiveness: Plate HX thermal effectiveness (0.7–0.95)
        system_efficiency: Combined pump + piping losses (0.85–0.98)

    Returns dict with recoverable heat, outlet temperatures, area proxy
    """
    # Hot side: T2 → T1 (heat given up to HX)
    t_hot_in  = t_return_c   # T2
    t_hot_out = t_supply_c   # T1 (approximation: hot outlet ≈ supply temp)

    # Cold side outlet temperature: limited by approach from hot inlet
    t_cold_out = t_hot_in - approach_dt_c   # T3 — offtaker supply temperature
    t_cold_in  = t_hot_out - approach_dt_c  # T4 — offtaker return temperature

    # LMTD for reference (not used in cost calc, but informative)
    dt1 = t_hot_in  - t_cold_out   # = approach_dt_c
    dt2 = t_hot_out - t_cold_in    # = approach_dt_c (parallel approach)
    lmtd = approach_dt_c  # symmetric by definition in this model

    q_recoverable_kw = q_available_kw * hx_effectiveness * system_efficiency

    # Normalised HX area proxy: lower approach → higher NTU → larger HX
    # NTU ≈ 1/approach for a balanced counter-flow HX (simplified)
    area_proxy_ntu = round(1.0 / approach_dt_c, 2)

    return {
        "approach_dt_c":       approach_dt_c,
        "hx_effectiveness":    hx_effectiveness,
        "system_efficiency":   system_efficiency,
        "t_hot_in_c":          t_hot_in,
        "t_hot_out_c":         t_hot_out,
        "t_cold_out_c":        round(t_cold_out, 1),   # offtaker supply
        "t_cold_in_c":         round(t_cold_in, 1),    # offtaker return
        "lmtd_c":              round(lmtd, 1),
        "q_recoverable_kw":    round(q_recoverable_kw, 1),
        "area_proxy_ntu":      area_proxy_ntu,
        "hx_size_note": (
            "Large HX (high NTU) — best heat quality"   if approach_dt_c <= 2 else
            "Compact HX — more temperature degradation" if approach_dt_c >= 5 else
            "Moderate HX — good cost/quality balance"
        ),
    }


# ---------------------------------------------------------------------------
# Step 3: Pump operating cost (Promethean Step 3 extension)
# ---------------------------------------------------------------------------

def pump_operating_cost(
    vol_flow_lpm: float,
    head_loss_kpa: float = 150.0,
    pump_efficiency: float = 0.75,
    electricity_price_per_kwh: float = 0.10,
    annual_hours: float = 8760 * 0.85,
) -> dict:
    """
    Estimate annual pump energy cost.

    P_hydraulic = Q × ΔP
    P_shaft     = P_hydraulic / η_pump
    Annual kWh  = P_shaft × hours

    Args:
        vol_flow_lpm:              Volumetric flow rate (L/min)
        head_loss_kpa:             System head loss (kPa); OCP default ~150 kPa
        pump_efficiency:           Pump mechanical efficiency (0.65–0.85)
        electricity_price_per_kwh: Electricity rate (€/kWh)
        annual_hours:              Operating hours/year

    Returns dict with shaft power, annual energy, annual cost
    """
    vol_flow_m3s = vol_flow_lpm / (1000 * 60)          # m³/s
    p_hydraulic_kw = vol_flow_m3s * head_loss_kpa       # kW  (kPa × m³/s = kW)
    p_shaft_kw = p_hydraulic_kw / pump_efficiency

    annual_kwh = p_shaft_kw * annual_hours
    annual_cost = annual_kwh * electricity_price_per_kwh

    return {
        "head_loss_kpa":        head_loss_kpa,
        "pump_efficiency":      pump_efficiency,
        "pump_shaft_power_kw":  round(p_shaft_kw, 2),
        "pump_annual_kwh":      round(annual_kwh, 0),
        "pump_annual_cost":     round(annual_cost, 0),
    }


# ---------------------------------------------------------------------------
# Step 4 & 5: NPV with energy-cost escalation (Promethean Steps 4–5)
# ---------------------------------------------------------------------------

def npv_analysis(
    net_capex: float,
    annual_net_benefit: float,
    discount_rate: float = 0.08,
    project_life_years: int = 15,
    cost_escalation_rate: float = 0.03,
    annual_maintenance_opex: float = 0,
) -> dict:
    """
    Full NPV calculation with energy cost escalation.

    NPV = Σ [ CF_t / (1 + r)^t ] - CAPEX
    where CF_t = annual_net_benefit × (1 + g)^(t-1) - maintenance

    Args:
        net_capex:              Net capital expenditure after grants (EUR)
        annual_net_benefit:     Year-1 net annual benefit (EUR)
        discount_rate:          Discount rate r (default 8%)
        project_life_years:     Project lifetime (years)
        cost_escalation_rate:   Annual energy/heat-price escalation g (default 3%)
        annual_maintenance_opex: Annual maintenance cost (EUR/yr, already in benefit)

    Returns dict with NPV, IRR proxy, payback, annual cashflows
    """
    simple_payback = (
        net_capex / annual_net_benefit if annual_net_benefit > 0 else float("inf")
    )

    npv = -net_capex
    cashflows = []
    cumulative = -net_capex
    breakeven_year = None

    for t in range(1, project_life_years + 1):
        cf_nominal = annual_net_benefit * ((1 + cost_escalation_rate) ** (t - 1))
        cf_discounted = cf_nominal / ((1 + discount_rate) ** t)
        npv += cf_discounted
        cumulative += cf_nominal
        cashflows.append({
            "year": t,
            "cf_nominal": round(cf_nominal, 0),
            "cf_discounted": round(cf_discounted, 0),
            "cumulative_nominal": round(cumulative, 0),
        })
        if breakeven_year is None and cumulative >= 0:
            breakeven_year = t

    # IRR approximation (Newton-Raphson, 50 iterations)
    irr = None
    try:
        r = 0.10
        for _ in range(50):
            f  = -net_capex + sum(
                annual_net_benefit * ((1 + cost_escalation_rate) ** (t - 1))
                / ((1 + r) ** t)
                for t in range(1, project_life_years + 1)
            )
            df = sum(
                -t * annual_net_benefit * ((1 + cost_escalation_rate) ** (t - 1))
                / ((1 + r) ** (t + 1))
                for t in range(1, project_life_years + 1)
            )
            if df == 0:
                break
            r_new = r - f / df
            if abs(r_new - r) < 1e-6:
                r = r_new
                break
            r = r_new
        irr = round(r * 100, 1) if 0 < r < 2 else None
    except Exception:
        pass

    roi_pct = round((annual_net_benefit / net_capex) * 100, 1) if net_capex > 0 else None

    verdict = (
        "Excellent — payback < 3 years" if simple_payback < 3 else
        "Good — payback 3–5 years"      if simple_payback < 5 else
        "Marginal — payback > 5 years"
    )

    return {
        "simple_payback_years": round(simple_payback, 1),
        "breakeven_year":       breakeven_year,
        "npv":                  round(npv, 0),
        "irr_pct":              irr,
        "roi_annual_pct":       roi_pct,
        "verdict":              verdict,
        "annual_cashflows":     cashflows,
    }


# ---------------------------------------------------------------------------
# Main physics engine (replaces the old calculate_physics)
# ---------------------------------------------------------------------------

def calculate_physics(specs: dict) -> dict:
    it_load_kw  = specs["it_load_mw"] * 1000
    pue         = specs["pue"]
    cooling_type = specs["cooling_type"]
    buyer_type  = specs["heat_buyer_type"]
    jurisdiction = specs["jurisdiction"]

    # Optional new fields with sensible defaults
    fluid            = specs.get("fluid", "pg25")
    t_supply_c       = specs.get("t_supply_c", HEAT_OUTPUT_TEMPS[cooling_type] - 10)
    t_return_c       = specs.get("t_return_c", HEAT_OUTPUT_TEMPS[cooling_type])
    approach_dt_c    = specs.get("approach_dt_c", 4.0)
    hx_effectiveness = specs.get("hx_effectiveness", 0.85)
    system_efficiency = specs.get("system_efficiency", 0.90)
    utilization_factor = specs.get("utilization_factor", 0.95)
    head_loss_kpa    = specs.get("head_loss_kpa", 150.0)
    pump_efficiency  = specs.get("pump_efficiency", 0.75)
    discount_rate    = specs.get("discount_rate", 0.08)
    project_life     = specs.get("project_life_years", 15)
    cost_escalation  = specs.get("cost_escalation_rate", 0.03)

    assert 1.0 < pue < 2.5, f"PUE {pue} outside realistic range"
    assert specs["it_load_mw"] > 0
    assert jurisdiction in JURISDICTION_CONFIG, f"Unsupported jurisdiction: {jurisdiction}"

    config = JURISDICTION_CONFIG[jurisdiction]

    assert buyer_type in config["heat_prices"], (
        f"{buyer_type} not available in {jurisdiction}. "
        f"Options: {list(config['heat_prices'].keys())}"
    )

    # -----------------------------------------------------------------------
    # Step 1 — Available heat using Q = ṁ × Cp × ΔT
    # -----------------------------------------------------------------------
    total_facility_kw     = it_load_kw * pue
    recovery_factor       = COOLING_RECOVERY_FACTORS[cooling_type]
    q_available_kw        = total_facility_kw * recovery_factor

    # Derive mass flow rate from first principles
    flow_model = derive_mass_flow(
        q_available_kw=q_available_kw,
        t_supply_c=t_supply_c,
        t_return_c=t_return_c,
        fluid=fluid,
    )

    # -----------------------------------------------------------------------
    # Step 2 — Recoverable heat via HX model
    # -----------------------------------------------------------------------
    hx_model = model_heat_exchanger(
        q_available_kw=q_available_kw,
        t_supply_c=t_supply_c,
        t_return_c=t_return_c,
        approach_dt_c=approach_dt_c,
        hx_effectiveness=hx_effectiveness,
        system_efficiency=system_efficiency,
    )
    q_recoverable_kw = hx_model["q_recoverable_kw"]

    # ERF — EU Energy Efficiency Directive metric
    erf = q_recoverable_kw / it_load_kw

    # -----------------------------------------------------------------------
    # Step 3 — Annual energy (Promethean methodology)
    #   E_savings = Q_recoverable × hours × (1 / η_displaced)
    # -----------------------------------------------------------------------
    seasonal_factor    = SEASONAL_LOAD_FACTORS.get(buyer_type, 0.95)
    annual_hours       = 8760 * utilization_factor * seasonal_factor
    annual_heat_mwh    = (q_recoverable_kw / 1000) * annual_hours

    # Pump operating cost
    pump_model = pump_operating_cost(
        vol_flow_lpm=flow_model["vol_flow_lpm"],
        head_loss_kpa=head_loss_kpa,
        pump_efficiency=pump_efficiency,
        electricity_price_per_kwh=config["electricity_price"],
        annual_hours=annual_hours,
    )

    # -----------------------------------------------------------------------
    # Temperature gating and heat pump (unchanged logic, improved inputs)
    # -----------------------------------------------------------------------
    output_temp_c        = hx_model["t_cold_out_c"]   # actual offtaker supply temp
    buyer_inlet_required = BUYER_TEMP_REQUIREMENTS.get(buyer_type, 45)
    heat_pump_required   = output_temp_c < buyer_inlet_required

    heat_pump_capex       = 0
    heat_pump_annual_opex = 0
    heat_pump_cop         = None
    temp_lift             = 0

    if heat_pump_required:
        temp_lift       = buyer_inlet_required - output_temp_c
        heat_pump_cop   = max(1.5, 4.5 - (temp_lift * 0.05))
        heat_pump_capex = q_recoverable_kw * 400
        hp_elec_mwh     = annual_heat_mwh / heat_pump_cop
        heat_pump_annual_opex = hp_elec_mwh * 1000 * config["electricity_price"]

    # -----------------------------------------------------------------------
    # Step 4 — Financial savings (Promethean Step 4)
    # -----------------------------------------------------------------------
    heat_price           = config["heat_prices"][buyer_type]
    annual_heat_revenue  = annual_heat_mwh * heat_price

    tonnes_co2_displaced   = (annual_heat_mwh * 1000 * config["carbon_intensity"]) / 1000
    annual_carbon_credit   = tonnes_co2_displaced * config["carbon_credit_price"]

    # CO₂ avoidance in tonnes (Promethean formula: CO₂ = E_savings × emission_factor)
    co2_avoided_annual_t = tonnes_co2_displaced  # same quantity, named clearly

    # -----------------------------------------------------------------------
    # CAPEX
    # -----------------------------------------------------------------------
    hex_capex       = specs.get("capex") or (q_recoverable_kw * 200)
    pipe_distance_m = specs.get("pipe_distance_m") or 0
    pipe_capex      = pipe_distance_m * PIPE_COST_PER_METRE
    gross_capex     = hex_capex + heat_pump_capex + pipe_capex

    grants          = [i for i in config["incentives"] if i["type"] == "grant"]
    total_grant_pct = sum(g.get("value_pct_capex", 0) for g in grants)
    grant_value     = gross_capex * total_grant_pct
    net_capex       = gross_capex - grant_value

    # -----------------------------------------------------------------------
    # OPEX — now includes pump energy
    # -----------------------------------------------------------------------
    annual_maintenance_opex = net_capex * 0.02
    annual_total_opex = (
        annual_maintenance_opex
        + heat_pump_annual_opex
        + pump_model["pump_annual_cost"]   # ← NEW: pump energy
    )

    annual_net_benefit = annual_heat_revenue + annual_carbon_credit - annual_total_opex

    # -----------------------------------------------------------------------
    # Step 5 — ROI / NPV / payback (Promethean Step 5, with escalation)
    # -----------------------------------------------------------------------
    investment_metrics = npv_analysis(
        net_capex=net_capex,
        annual_net_benefit=annual_net_benefit,
        discount_rate=discount_rate,
        project_life_years=project_life,
        cost_escalation_rate=cost_escalation,
        annual_maintenance_opex=annual_maintenance_opex,
    )

    return {
        "inputs": specs,

        # ── Thermal model ──────────────────────────────────────────────────
        "physics": {
            "total_facility_load_kw":      round(total_facility_kw, 1),
            "q_available_kw":              round(q_available_kw, 1),
            "flow_model":                  flow_model,
            "hx_model":                    hx_model,
            "q_recoverable_kw":            q_recoverable_kw,
            "output_temp_c":               output_temp_c,
            "buyer_inlet_required_c":      buyer_inlet_required,
            "heat_pump_required":          heat_pump_required,
            "heat_pump_cop":               round(heat_pump_cop, 2) if heat_pump_cop else None,
            "temp_lift_c":                 temp_lift,
            "utilization_factor":          utilization_factor,
            "seasonal_load_factor":        seasonal_factor,
            "annual_hours":                round(annual_hours, 0),
            "annual_heat_mwh":             round(annual_heat_mwh, 0),
            "erf":                         round(erf, 3),
            "erf_pct":                     f"{round(erf * 100, 1)}%",
            "pump_model":                  pump_model,
        },

        # ── Financials ─────────────────────────────────────────────────────
        "financials": {
            "annual_heat_revenue":         round(annual_heat_revenue, 0),
            "tonnes_co2_displaced_annual": round(co2_avoided_annual_t, 1),
            "annual_carbon_credit":        round(annual_carbon_credit, 0),
            "hex_capex":                   round(hex_capex, 0),
            "heat_pump_capex":             round(heat_pump_capex, 0),
            "pipe_distance_m":             pipe_distance_m,
            "pipe_capex":                  round(pipe_capex, 0),
            "gross_capex":                 round(gross_capex, 0),
            "grant_value":                 round(grant_value, 0),
            "net_capex":                   round(net_capex, 0),
            "annual_maintenance_opex":     round(annual_maintenance_opex, 0),
            "annual_heat_pump_opex":       round(heat_pump_annual_opex, 0),
            "annual_pump_energy_opex":     pump_model["pump_annual_cost"],
            "annual_total_opex":           round(annual_total_opex, 0),
            "annual_net_benefit":          round(annual_net_benefit, 0),
            # Legacy simple payback retained for backward compatibility
            "simple_payback_years":        investment_metrics["simple_payback_years"],
        },

        # ── Investment metrics (new) ────────────────────────────────────────
        "investment_metrics": investment_metrics,

        # ── Compliance ─────────────────────────────────────────────────────
        "compliance": {
            "erf": round(erf, 3),
            "erf_band": (
                "above 75%" if erf > 0.75 else
                "50-75%"    if erf > 0.50 else
                "25-50%"    if erf > 0.25 else
                "below 25%"
            ),
            "eu_eed_target_met": erf >= 0.75,
            "wue_impact":  "improved"          if not heat_pump_required else "neutral",
            "pue_impact":  "neutral"            if not heat_pump_required else "slightly worsened",
            "offtaker_supply_temp_c": output_temp_c,
            "approach_dt_used_c": approach_dt_c,
        },

        "incentives_applied": config["incentives"],
        "currency": "EUR" if jurisdiction != "uk" else "GBP",

        "sources": {
            "heat_prices":          "BEIS/Ofgem 2023, BMWK 2024, RVO 2024",
            "carbon_intensity":     "DESNZ / EEA national grid intensity figures 2024",
            "carbon_credit_price":  "EU ETS + national voluntary markets Q1 2025",
            "capex_benchmark":      "CIBSE Heat Networks Code of Practice 2021: £150-250/kW HEX, £350-450/kW heat pump",
            "pipe_cost_benchmark":  "CIBSE CP1 2021, Euroheat & Power 2023: EUR 800-1,200/m installed DN200",
            "fluid_cp":             "OCP Heat Reuse Reference Design Paper; ASHRAE Fundamentals",
            "heat_exchanger_model": "OCP Heat Reuse Reference Design Paper Table 4; approach temperature framework",
            "pump_model":           "P = Q × ΔP / η_pump; OCP default head loss assumption 150 kPa",
            "heat_pump_cop":        "Carnot-derived COP with 0.05 degradation per °C temperature lift",
            "seasonal_factors":     "Eurostat district heating demand profiles 2023",
            "erf":                  "EU Energy Efficiency Directive Article 24, recast 2023",
            "npv_methodology":      "Promethean Energy heat recovery savings methodology; 3% cost escalation",
        }
    }


# ---------------------------------------------------------------------------
# Report generator (unchanged interface)
# ---------------------------------------------------------------------------

def generate_tea_report(specs: dict) -> dict:
    calculated = calculate_physics(specs)
    persona    = USER_TYPE_PERSONAS[specs["user_type"]]

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
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
        "narrative":  narrative,
    }


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=== Test: immersion → district heating, 300m pipe run ===")
    specs = {
        "user_type":        "data_center",
        "it_load_mw":       10,
        "pue":              1.4,
        "cooling_type":     "immersion",
        "heat_buyer_type":  "district_heating",
        "jurisdiction":     "germany",
        "capex":            None,
        "pipe_distance_m":  300,
        # New physical inputs (all optional — defaults applied if omitted)
        "fluid":            "pg25",      # OCP reference fluid
        "t_supply_c":       60,          # coolant supply to IT (°C)
        "t_return_c":       70,          # coolant return from IT (°C)
        "approach_dt_c":    4,           # HX approach temperature (°C)
        "hx_effectiveness": 0.85,        # plate HX effectiveness
        "system_efficiency": 0.90,       # pump + piping losses
        "utilization_factor": 0.95,      # fraction of year operating
        "head_loss_kpa":    150,         # OCP default head loss
        "pump_efficiency":  0.75,
        "discount_rate":    0.08,
        "project_life_years": 15,
        "cost_escalation_rate": 0.03,
    }

    result = generate_tea_report(specs)
    c = result["calculated"]
    f = c["financials"]
    p = c["physics"]
    m = c["investment_metrics"]

    print(f"\n── Thermal ──")
    print(f"Q available:        {p['q_available_kw']:,.0f} kW")
    print(f"Mass flow:          {p['flow_model']['mass_flow_kgs']} kg/s  "
          f"({p['flow_model']['vol_flow_lpm']} L/min)")
    print(f"Q recoverable:      {p['q_recoverable_kw']:,.0f} kW  "
          f"(η_hx={specs['hx_effectiveness']}, η_sys={specs['system_efficiency']})")
    print(f"Offtaker supply:    {p['output_temp_c']}°C  "
          f"(approach ΔT = {specs['approach_dt_c']}°C)")
    print(f"Heat pump required: {p['heat_pump_required']}")
    print(f"Annual heat:        {p['annual_heat_mwh']:,.0f} MWh/yr")
    print(f"ERF:                {p['erf_pct']}")

    print(f"\n── Pump ──")
    pm = p["pump_model"]
    print(f"Shaft power:        {pm['pump_shaft_power_kw']} kW")
    print(f"Annual pump cost:   EUR {pm['pump_annual_cost']:,}")

    print(f"\n── Financials ──")
    print(f"Pipe CAPEX:         EUR {f['pipe_capex']:,} ({f['pipe_distance_m']}m)")
    print(f"Gross CAPEX:        EUR {f['gross_capex']:,}")
    print(f"Net CAPEX:          EUR {f['net_capex']:,} (after grants)")
    print(f"Annual net benefit: EUR {f['annual_net_benefit']:,}")

    print(f"\n── Investment ──")
    print(f"Simple payback:     {m['simple_payback_years']} years  → {m['verdict']}")
    print(f"NPV ({specs['project_life_years']}yr, {int(specs['discount_rate']*100)}%): "
          f"EUR {m['npv']:,}")
    if m['irr_pct']:
        print(f"IRR:                {m['irr_pct']}%")
    print(f"Breakeven year:     {m['breakeven_year']}")