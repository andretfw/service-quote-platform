import type { Question, QuoteTemplate } from "./types";

const selection = (
  id: string,
  label: string,
  type: "choice" | "multiselect",
  entries: [string, string][],
): Question => ({
  id,
  label,
  type,
  options: entries.map(([label, value]) => ({ label, value })),
});
const quantity = (id: string, label: string, min: number, max: number, step = 1): Question => ({
  id,
  label,
  type: "number",
  min,
  max,
  step,
});

export const templates: QuoteTemplate[] = [
  {
    currency: "USD",
    rangePct: 0.08,
    slug: "painting",
    name: "Painting estimate",
    industry: "Painting",
    minPrice: 450,
    description:
      "Residential interior/exterior painting with prep, stories and scope adjustments. Budget estimate only; final scope and price are confirmed by the business.",
    questions: [
      {
        ...selection("scope", "What are you painting?", "choice", [
          ["Interior", "interior"],
          ["Exterior", "exterior"],
          ["Both", "both"],
        ]),
        required: true,
      },
      {
        ...quantity("area", "Interior paintable wall area (sq ft)", 1, 100000, 1),
        required: true,
        help: "Measure the actual surface, not the property floor area. Your business can change the unit and its matching rate.",
        showWhen: [{ field: "scope", op: "neq", value: "exterior" }],
      },
      {
        ...selection("stories", "Number of stories", "choice", [
          ["1", "1"],
          ["2", "2"],
          ["3+", "3"],
        ]),
        required: true,
      },
      {
        ...selection("condition", "Current condition", "choice", [
          ["Good", "good"],
          ["Average", "average"],
          ["Heavy prep", "heavy"],
        ]),
        required: true,
      },
      selection("extras", "Include", "multiselect", [
        ["Ceilings", "ceilings"],
        ["Trim", "trim"],
        ["Doors", "doors"],
      ]),
      {
        id: "postcode",
        label: "ZIP / postcode",
        type: "postcode",
        required: true,
        help: "Used to check the business service area; this is not automatic travel pricing.",
      },
      {
        ...quantity("exterior_area", "Exterior paintable wall area (sq ft)", 1, 100000, 1),
        required: true,
        showWhen: [{ field: "scope", op: "neq", value: "interior" }],
      },
      {
        ...quantity("ceilings_quantity", "Ceiling area (sq ft)", 1, 100000, 1),
        required: true,
        showWhen: [{ field: "extras", op: "includes", value: "ceilings" }],
      },
      {
        ...quantity("trim_quantity", "Trim length (linear ft)", 1, 100000, 1),
        required: true,
        showWhen: [{ field: "extras", op: "includes", value: "trim" }],
      },
      {
        ...quantity("doors_quantity", "Number of door faces", 1, 100000, 1),
        required: true,
        showWhen: [{ field: "extras", op: "includes", value: "doors" }],
      },
      {
        ...selection("coats", "Number of finish coats", "choice", [
          ["Two coats", "two_coats"],
          ["One coat", "one_coat"],
          ["Three coats", "three_coats"],
        ]),
        required: false,
      },
      {
        ...selection("paint_supply", "Who supplies the paint?", "choice", [
          ["Business", "business"],
          ["Customer", "customer"],
        ]),
        required: false,
      },
      {
        ...selection("access", "Access and furniture", "choice", [
          ["Clear rooms / easy access", "clear_rooms_easy_access"],
          ["Furniture to move", "furniture_to_move"],
          ["Scaffolding or lift needed", "scaffolding_or_lift_needed"],
        ]),
        required: false,
      },
      {
        id: "preferred_date",
        label: "Preferred date or timeframe",
        type: "text",
        required: false,
      },
      {
        id: "notes",
        label: "Other requirements or access restrictions",
        type: "text",
        required: false,
      },
    ],
    rules: [
      { kind: "base", amount: 250 },
      { kind: "number", field: "area", perUnit: 1.85 },
      { kind: "choice", field: "condition", map: { good: 0, average: 250, heavy: 650 } },
      { kind: "multiplier", field: "stories", map: { "1": 1, "2": 1.12, "3": 1.25 } },
      { kind: "number", field: "exterior_area", perUnit: 2.5 },
      { kind: "number", field: "ceilings_quantity", perUnit: 1.4 },
      { kind: "number", field: "trim_quantity", perUnit: 2 },
      { kind: "number", field: "doors_quantity", perUnit: 90 },
      {
        kind: "multiplier",
        field: "coats",
        map: { two_coats: 1, one_coat: 0.75, three_coats: 1.3 },
      },
      { kind: "choice", field: "paint_supply", map: { business: 0, customer: -100 } },
      {
        kind: "choice",
        field: "access",
        map: {
          clear_rooms_easy_access: 0,
          furniture_to_move: 150,
          scaffolding_or_lift_needed: 500,
        },
      },
    ],
  },
  {
    currency: "USD",
    rangePct: 0.08,
    slug: "cleaning",
    name: "Cleaning estimate",
    industry: "Cleaning",
    minPrice: 90,
    description:
      "Standard, deep and move-out cleaning with room-level pricing. Budget estimate only; final scope and price are confirmed by the business.",
    questions: [
      {
        ...selection("service", "Cleaning type", "choice", [
          ["Standard", "standard"],
          ["Deep", "deep"],
          ["Move out", "moveout"],
        ]),
        required: true,
      },
      { ...quantity("bedrooms", "Bedrooms", 0, 20, 1), required: true },
      { ...quantity("bathrooms", "Bathrooms", 0, 20, 1), required: true },
      {
        ...selection("frequency", "Frequency", "choice", [
          ["One time", "once"],
          ["Weekly", "weekly"],
          ["Biweekly", "biweekly"],
        ]),
        required: true,
      },
      selection("extras", "Extras", "multiselect", [
        ["Inside oven", "oven"],
        ["Inside fridge", "fridge"],
        ["Windows", "windows"],
      ]),
      {
        id: "postcode",
        label: "ZIP / postcode",
        type: "postcode",
        required: true,
        help: "Used to check the business service area; this is not automatic travel pricing.",
      },
      { ...quantity("floor_area", "Floor area to clean (sq ft)", 0, 100000, 1), required: false },
      {
        ...selection("property", "Property type", "choice", [
          ["House", "house"],
          ["Apartment", "apartment"],
          ["Office", "office"],
        ]),
        required: false,
      },
      {
        ...selection("condition", "Condition", "choice", [
          ["Maintained", "maintained"],
          ["Very dirty", "very_dirty"],
          ["Post-construction", "post_construction"],
        ]),
        required: false,
      },
      {
        ...selection("pets", "Pets at the property", "choice", [
          ["No", "no"],
          ["Yes", "yes"],
        ]),
        required: false,
      },
      {
        id: "preferred_date",
        label: "Preferred date or timeframe",
        type: "text",
        required: false,
      },
      {
        id: "notes",
        label: "Other requirements or access restrictions",
        type: "text",
        required: false,
      },
    ],
    rules: [
      { kind: "base", amount: 65 },
      { kind: "number", field: "bedrooms", perUnit: 28 },
      { kind: "number", field: "bathrooms", perUnit: 35 },
      { kind: "choice", field: "service", map: { standard: 0, deep: 90, moveout: 140 } },
      { kind: "multiselect", field: "extras", map: { oven: 30, fridge: 30, windows: 55 } },
      { kind: "multiplier", field: "frequency", map: { once: 1, weekly: 0.82, biweekly: 0.9 } },
      { kind: "number", field: "floor_area", perUnit: 0.03 },
      {
        kind: "choice",
        field: "condition",
        map: { maintained: 0, very_dirty: 80, post_construction: 180 },
      },
    ],
  },
  {
    currency: "USD",
    rangePct: 0.08,
    slug: "tiling",
    name: "Tiling estimate",
    industry: "Tiling",
    minPrice: 550,
    description:
      "Tile installation quote with demolition, prep and tile-size complexity. Budget estimate only; final scope and price are confirmed by the business.",
    questions: [
      {
        ...quantity("area", "Surface area to be worked on (sq ft)", 1, 100000, 1),
        required: true,
        help: "Measure the actual surface, not the property floor area. Your business can change the unit and its matching rate.",
      },
      {
        ...selection("surface", "Surface", "choice", [
          ["Floor", "floor"],
          ["Wall", "wall"],
          ["Both", "both"],
        ]),
        required: true,
      },
      {
        ...selection("remove", "Existing tile removal?", "choice", [
          ["No", "no"],
          ["Yes", "yes"],
        ]),
        required: true,
      },
      {
        ...selection("tile", "Tile format", "choice", [
          ["Standard", "standard"],
          ["Large format", "large"],
          ["Mosaic", "mosaic"],
        ]),
        required: true,
      },
      {
        id: "postcode",
        label: "ZIP / postcode",
        type: "postcode",
        required: true,
        help: "Used to check the business service area; this is not automatic travel pricing.",
      },
      {
        ...quantity("removal_area", "Existing tile area to remove (sq ft)", 1, 100000, 1),
        required: true,
        showWhen: [{ field: "remove", op: "eq", value: "yes" }],
      },
      {
        ...selection("supply", "Tile supply", "choice", [
          ["Customer supplies tiles", "customer_supplies_tiles"],
          ["Business supplies tiles", "business_supplies_tiles"],
        ]),
        required: false,
      },
      {
        ...selection("subfloor", "Surface preparation", "choice", [
          ["Ready for tiling", "ready_for_tiling"],
          ["Leveling required", "leveling_required"],
          ["Waterproofing required", "waterproofing_required"],
        ]),
        required: false,
      },
      {
        ...quantity("waterproof_area", "Area requiring waterproofing (sq ft)", 0, 100000, 1),
        required: false,
        showWhen: [{ field: "subfloor", op: "eq", value: "waterproofing_required" }],
      },
      {
        ...quantity("level_area", "Area requiring leveling (sq ft)", 0, 100000, 1),
        required: false,
        showWhen: [{ field: "subfloor", op: "eq", value: "leveling_required" }],
      },
      {
        ...{
          id: "tile_details",
          label: "Tile dimensions, layout and material preference",
          type: "text",
        },
        required: false,
        help: "Business confirms tile supply costs after checking the selected product.",
      },
      {
        id: "preferred_date",
        label: "Preferred date or timeframe",
        type: "text",
        required: false,
      },
      {
        id: "notes",
        label: "Other requirements or access restrictions",
        type: "text",
        required: false,
      },
    ],
    rules: [
      { kind: "base", amount: 300 },
      { kind: "number", field: "area", perUnit: 11 },
      { kind: "choice", field: "surface", map: { floor: 0, wall: 180, both: 320 } },
      { kind: "multiplier", field: "tile", map: { standard: 1, large: 1.18, mosaic: 1.35 } },
      { kind: "number", field: "removal_area", perUnit: 3 },
      { kind: "number", field: "waterproof_area", perUnit: 4 },
      { kind: "number", field: "level_area", perUnit: 3 },
    ],
  },
  {
    currency: "USD",
    rangePct: 0.08,
    slug: "landscaping",
    name: "Landscaping estimate",
    industry: "Landscaping",
    minPrice: 250,
    description:
      "Yard projects priced by area, service and access. Budget estimate only; final scope and price are confirmed by the business.",
    questions: [
      {
        ...quantity("area", "Surface area to be worked on (sq ft)", 1, 100000, 1),
        required: true,
        help: "Measure the actual surface, not the property floor area. Your business can change the unit and its matching rate.",
      },
      {
        ...selection("service", "Service", "choice", [
          ["Maintenance", "maintenance"],
          ["New planting", "planting"],
          ["Full redesign", "redesign"],
        ]),
        required: true,
      },
      {
        ...selection("access", "Site access", "choice", [
          ["Easy", "easy"],
          ["Restricted", "restricted"],
        ]),
        required: true,
      },
      {
        id: "postcode",
        label: "ZIP / postcode",
        type: "postcode",
        required: true,
        help: "Used to check the business service area; this is not automatic travel pricing.",
      },
      {
        ...selection("frequency", "Visit frequency", "choice", [
          ["One visit", "one_visit"],
          ["Weekly", "weekly"],
          ["Fortnightly", "fortnightly"],
          ["Monthly", "monthly"],
        ]),
        required: false,
      },
      {
        ...quantity("plants", "Number of plants to supply and plant", 0, 100000, 1),
        required: false,
      },
      {
        ...quantity("waste", "Garden waste to remove (cubic yards)", 0, 100000, 1),
        required: false,
      },
      {
        id: "design",
        label: "Planting or redesign brief",
        type: "text",
        required: false,
        help: "Describe planting, paving, irrigation or drainage needs. A site visit may be needed.",
      },
      {
        id: "preferred_date",
        label: "Preferred date or timeframe",
        type: "text",
        required: false,
      },
      {
        id: "notes",
        label: "Other requirements or access restrictions",
        type: "text",
        required: false,
      },
    ],
    rules: [
      { kind: "base", amount: 120 },
      { kind: "number", field: "area", perUnit: 0.55 },
      { kind: "choice", field: "service", map: { maintenance: 0, planting: 350, redesign: 1200 } },
      { kind: "multiplier", field: "access", map: { easy: 1, restricted: 1.18 } },
      { kind: "number", field: "plants", perUnit: 35 },
      { kind: "number", field: "waste", perUnit: 75 },
    ],
  },
  {
    currency: "USD",
    rangePct: 0.08,
    slug: "roofing",
    name: "Roofing estimate",
    industry: "Roofing",
    minPrice: 150,
    description:
      "Roof replacement/repair estimator with pitch and material adjustments. Budget estimate only; final scope and price are confirmed by the business.",
    questions: [
      {
        ...quantity("area", "Surface area to be worked on (sq ft)", 1, 100000, 1),
        required: true,
        help: "Measure the actual surface, not the property floor area. Your business can change the unit and its matching rate.",
        showWhen: [{ field: "job", op: "eq", value: "replace" }],
      },
      {
        ...selection("job", "Job type", "choice", [
          ["Repair", "repair"],
          ["Replacement", "replace"],
        ]),
        required: true,
      },
      {
        ...selection("material", "Material", "choice", [
          ["Asphalt", "asphalt"],
          ["Metal", "metal"],
          ["Tile", "tile"],
        ]),
        required: true,
        showWhen: [{ field: "job", op: "eq", value: "replace" }],
      },
      {
        ...selection("pitch", "Roof pitch", "choice", [
          ["Low", "low"],
          ["Medium", "medium"],
          ["Steep", "steep"],
        ]),
        required: true,
        showWhen: [{ field: "job", op: "eq", value: "replace" }],
      },
      {
        id: "postcode",
        label: "ZIP / postcode",
        type: "postcode",
        required: true,
        help: "Used to check the business service area; this is not automatic travel pricing.",
      },
      {
        ...quantity("tearoff_area", "Old roofing area to remove (sq ft)", 0, 100000, 1),
        required: false,
        showWhen: [{ field: "job", op: "eq", value: "replace" }],
      },
      {
        id: "damage",
        label: "Describe leaks, damage or replacement needs",
        type: "text",
        required: false,
        help: "Repair estimate is an inspection / call-out fee only. Repairs, decking and structural work are quoted after inspection.",
      },
      {
        id: "preferred_date",
        label: "Preferred date or timeframe",
        type: "text",
        required: false,
      },
      {
        id: "notes",
        label: "Other requirements or access restrictions",
        type: "text",
        required: false,
      },
    ],
    rules: [
      { kind: "number", field: "area", perUnit: 4.8 },
      { kind: "conditional", when: [{ field: "job", op: "eq", value: "repair" }], amount: 150 },
      { kind: "conditional", when: [{ field: "job", op: "eq", value: "replace" }], amount: 700 },
      {
        kind: "number",
        field: "area",
        perUnit: 2.64,
        when: [{ field: "material", op: "eq", value: "metal" }],
      },
      {
        kind: "number",
        field: "area",
        perUnit: 3.84,
        when: [{ field: "material", op: "eq", value: "tile" }],
      },
      { kind: "number", field: "tearoff_area", perUnit: 1.2 },
    ],
  },
  {
    currency: "USD",
    rangePct: 0.08,
    slug: "hvac",
    name: "HVAC estimate",
    industry: "HVAC",
    minPrice: 100,
    description:
      "HVAC repair/replacement pre-qualification and budget estimate. Budget estimate only; final scope and price are confirmed by the business.",
    questions: [
      {
        ...selection("job", "What do you need?", "choice", [
          ["Repair", "repair"],
          ["Replace system", "replace"],
          ["New install", "new"],
        ]),
        required: true,
      },
      {
        ...quantity("home_size", "Property floor area (sq ft)", 100, 20000, 1),
        required: true,
        showWhen: [{ field: "job", op: "neq", value: "repair" }],
      },
      {
        ...selection("system", "System", "choice", [
          ["AC", "ac"],
          ["Heat pump", "heatpump"],
          ["Furnace + AC", "furnace"],
        ]),
        required: true,
        showWhen: [{ field: "job", op: "neq", value: "repair" }],
      },
      {
        id: "postcode",
        label: "ZIP / postcode",
        type: "postcode",
        required: true,
        help: "Used to check the business service area; this is not automatic travel pricing.",
      },
      {
        ...selection("ductwork", "Ductwork condition", "choice", [
          ["Existing ducts usable", "existing_ducts_usable"],
          ["New ducts required", "new_ducts_required"],
          ["Not sure", "not_sure"],
        ]),
        required: false,
      },
      {
        ...{
          id: "symptoms",
          label: "Fault, equipment age or installation requirements",
          type: "text",
        },
        required: false,
        help: "Repair estimate is the diagnostic visit fee. Equipment sizing, repair parts, permits and ductwork need professional assessment.",
      },
      {
        id: "preferred_date",
        label: "Preferred date or timeframe",
        type: "text",
        required: false,
      },
      {
        id: "notes",
        label: "Other requirements or access restrictions",
        type: "text",
        required: false,
      },
    ],
    rules: [
      { kind: "number", field: "home_size", perUnit: 1.4 },
      { kind: "conditional", when: [{ field: "job", op: "eq", value: "repair" }], amount: 100 },
      { kind: "conditional", when: [{ field: "job", op: "eq", value: "replace" }], amount: 2150 },
      { kind: "conditional", when: [{ field: "job", op: "eq", value: "new" }], amount: 2950 },
      { kind: "choice", field: "system", map: { ac: 0, heatpump: 1200, furnace: 1600 } },
    ],
  },
  {
    currency: "USD",
    rangePct: 0.08,
    slug: "moving",
    name: "Moving estimate",
    industry: "Moving",
    minPrice: 250,
    description:
      "Local moving estimate by home size, distance and access. Budget estimate only; final scope and price are confirmed by the business.",
    questions: [
      { ...quantity("rooms", "Rooms", 1, 30, 1), required: true },
      { ...quantity("distance", "Distance (miles)", 1, 3000, 1), required: true },
      {
        ...selection("stairs", "Stairs?", "choice", [
          ["No", "no"],
          ["Yes", "yes"],
        ]),
        required: true,
      },
      {
        ...selection("packing", "Packing help?", "choice", [
          ["No", "no"],
          ["Yes", "yes"],
        ]),
        required: true,
      },
      {
        id: "postcode",
        label: "ZIP / postcode",
        type: "postcode",
        required: true,
        help: "Used to check the business service area; this is not automatic travel pricing.",
      },
      {
        id: "destination",
        label: "Destination ZIP / postcode",
        type: "text",
        required: false,
      },
      {
        ...selection("origin_access", "Collection access", "choice", [
          ["Ground floor", "ground_floor"],
          ["Elevator", "elevator"],
          ["Stairs", "stairs"],
        ]),
        required: false,
      },
      {
        ...selection("destination_access", "Delivery access", "choice", [
          ["Ground floor", "ground_floor"],
          ["Elevator", "elevator"],
          ["Stairs", "stairs"],
        ]),
        required: false,
      },
      { ...quantity("boxes", "Boxes to pack", 0, 100000, 1), required: false },
      { ...quantity("bulky", "Bulky or fragile items", 0, 100000, 1), required: false },
      {
        id: "inventory",
        label: "Furniture inventory and special handling",
        type: "text",
        required: false,
        help: "Include pianos, safes, disassembly, parking restrictions and storage. Long-distance work needs a confirmed inventory.",
      },
      {
        id: "preferred_date",
        label: "Preferred date or timeframe",
        type: "text",
        required: false,
      },
      {
        id: "notes",
        label: "Other requirements or access restrictions",
        type: "text",
        required: false,
      },
    ],
    rules: [
      { kind: "base", amount: 150 },
      { kind: "number", field: "rooms", perUnit: 95 },
      { kind: "number", field: "distance", perUnit: 2.1 },
      { kind: "choice", field: "stairs", map: { no: 0, yes: 120 } },
      { kind: "choice", field: "packing", map: { no: 0, yes: 250 } },
      { kind: "number", field: "boxes", perUnit: 8 },
      { kind: "number", field: "bulky", perUnit: 45 },
    ],
  },
  {
    currency: "USD",
    rangePct: 0.08,
    slug: "pressure-washing",
    name: "Pressure washing estimate",
    industry: "Pressure Washing",
    minPrice: 120,
    description:
      "Driveway, siding, deck and patio instant estimate. Budget estimate only; final scope and price are confirmed by the business.",
    questions: [
      {
        ...quantity("area", "Surface area to be worked on (sq ft)", 1, 100000, 1),
        required: true,
        help: "Measure the actual surface, not the property floor area. Your business can change the unit and its matching rate.",
      },
      {
        ...selection("surface", "Surface", "choice", [
          ["Driveway", "driveway"],
          ["Siding", "siding"],
          ["Deck/patio", "deck"],
        ]),
        required: true,
      },
      {
        ...selection("condition", "Condition", "choice", [
          ["Normal", "normal"],
          ["Heavy staining", "heavy"],
        ]),
        required: true,
      },
      {
        id: "postcode",
        label: "ZIP / postcode",
        type: "postcode",
        required: true,
        help: "Used to check the business service area; this is not automatic travel pricing.",
      },
      {
        ...selection("height", "Working height", "choice", [
          ["Ground level", "ground_level"],
          ["Two stories", "two_stories"],
          ["Three stories", "three_stories"],
        ]),
        required: false,
      },
      {
        ...selection("water", "Water supply on site", "choice", [
          ["Available", "available"],
          ["Unavailable", "unavailable"],
        ]),
        required: false,
      },
      {
        ...quantity("stain_area", "Oil, rust or heavy stain area (sq ft)", 0, 100000, 1),
        required: false,
      },
      {
        id: "preferred_date",
        label: "Preferred date or timeframe",
        type: "text",
        required: false,
      },
      {
        id: "notes",
        label: "Other requirements or access restrictions",
        type: "text",
        required: false,
      },
    ],
    rules: [
      { kind: "base", amount: 60 },
      { kind: "number", field: "area", perUnit: 0.22 },
      { kind: "choice", field: "surface", map: { driveway: 0, siding: 80, deck: 40 } },
      { kind: "multiplier", field: "condition", map: { normal: 1, heavy: 1.3 } },
      { kind: "number", field: "stain_area", perUnit: 0.15 },
      { kind: "choice", field: "water", map: { available: 0, unavailable: 50 } },
      {
        kind: "choice",
        field: "height",
        map: { ground_level: 0, two_stories: 80, three_stories: 180 },
      },
    ],
  },
  {
    currency: "USD",
    rangePct: 0.08,
    slug: "auto-detailing",
    name: "Auto detailing estimate",
    industry: "Auto Detailing",
    minPrice: 80,
    description:
      "Vehicle detailing estimate by vehicle size, package and condition. Budget estimate only; final scope and price are confirmed by the business.",
    questions: [
      {
        ...selection("vehicle", "Vehicle", "choice", [
          ["Sedan", "sedan"],
          ["SUV", "suv"],
          ["Truck/van", "large"],
        ]),
        required: true,
      },
      {
        ...selection("package", "Package", "choice", [
          ["Exterior", "exterior"],
          ["Interior", "interior"],
          ["Full detail", "full"],
        ]),
        required: true,
      },
      {
        ...selection("condition", "Condition", "choice", [
          ["Normal", "normal"],
          ["Heavy", "heavy"],
        ]),
        required: true,
      },
      selection("extras", "Extras", "multiselect", [
        ["Pet hair", "pet"],
        ["Engine bay", "engine"],
        ["Headlights", "lights"],
      ]),
      {
        ...selection("location", "Service location", "choice", [
          ["At detailing shop", "at_detailing_shop"],
          ["Mobile at customer address", "mobile_at_customer_address"],
        ]),
        required: false,
      },
      {
        ...selection("protection", "Paint protection", "choice", [
          ["None", "none"],
          ["Wax", "wax"],
          ["Sealant", "sealant"],
        ]),
        required: false,
      },
      {
        id: "location_details",
        label: "ZIP / postcode and vehicle details",
        type: "text",
        required: false,
        help: "Give make, model and access to water / power for mobile visits.",
      },
      {
        id: "preferred_date",
        label: "Preferred date or timeframe",
        type: "text",
        required: false,
      },
      {
        id: "notes",
        label: "Other requirements or access restrictions",
        type: "text",
        required: false,
      },
    ],
    rules: [
      { kind: "base", amount: 45 },
      { kind: "choice", field: "vehicle", map: { sedan: 30, suv: 55, large: 75 } },
      { kind: "choice", field: "package", map: { exterior: 20, interior: 35, full: 90 } },
      { kind: "multiplier", field: "condition", map: { normal: 1, heavy: 1.35 } },
      { kind: "multiselect", field: "extras", map: { pet: 35, engine: 40, lights: 25 } },
      {
        kind: "choice",
        field: "location",
        map: { at_detailing_shop: 0, mobile_at_customer_address: 35 },
      },
      { kind: "choice", field: "protection", map: { none: 0, wax: 45, sealant: 90 } },
    ],
  },
  {
    currency: "USD",
    rangePct: 0.08,
    slug: "handyman",
    name: "Handyman estimate",
    industry: "Handyman",
    minPrice: 95,
    description:
      "Small-job estimate using expected hours and materials. Budget estimate only; final scope and price are confirmed by the business.",
    questions: [
      { ...quantity("hours", "Estimated labor hours (if known)", 1, 40, 1), required: false },
      {
        ...selection("materials", "Materials allowance", "choice", [
          ["None", "none"],
          ["Small", "small"],
          ["Medium", "medium"],
          ["Large", "large"],
        ]),
        required: true,
      },
      {
        ...selection("urgent", "Urgent / same-day?", "choice", [
          ["No", "no"],
          ["Yes", "yes"],
        ]),
        required: true,
      },
      {
        id: "postcode",
        label: "ZIP / postcode",
        type: "postcode",
        required: true,
        help: "Used to check the business service area; this is not automatic travel pricing.",
      },
      {
        ...selection("task", "Work required", "choice", [
          ["Furniture assembly", "furniture_assembly"],
          ["Wall mounting", "wall_mounting"],
          ["Minor repair", "minor_repair"],
          ["Several small tasks", "several_small_tasks"],
        ]),
        required: false,
      },
      {
        id: "task_details",
        label: "Describe tasks and quantities",
        type: "text",
        required: false,
        help: "A business confirms labor hours, materials and suitability before starting. Specialist licensed work is assessed separately.",
      },
      {
        id: "preferred_date",
        label: "Preferred date or timeframe",
        type: "text",
        required: false,
      },
      {
        id: "notes",
        label: "Other requirements or access restrictions",
        type: "text",
        required: false,
      },
    ],
    rules: [
      { kind: "base", amount: 45 },
      { kind: "number", field: "hours", perUnit: 75 },
      { kind: "choice", field: "materials", map: { none: 0, small: 50, medium: 150, large: 350 } },
      { kind: "multiplier", field: "urgent", map: { no: 1, yes: 1.25 } },
    ],
  },
  {
    currency: "USD",
    rangePct: 0.08,
    slug: "flooring",
    name: "Flooring estimate",
    industry: "Flooring",
    minPrice: 500,
    description:
      "Floor installation with removal and material complexity. Budget estimate only; final scope and price are confirmed by the business.",
    questions: [
      {
        ...quantity("area", "Surface area to be worked on (sq ft)", 1, 100000, 1),
        required: true,
        help: "Measure the actual surface, not the property floor area. Your business can change the unit and its matching rate.",
      },
      {
        ...selection("material", "Flooring", "choice", [
          ["Laminate", "laminate"],
          ["Vinyl", "vinyl"],
          ["Hardwood", "hardwood"],
          ["Tile", "tile"],
        ]),
        required: true,
      },
      {
        ...selection("remove", "Remove old floor?", "choice", [
          ["No", "no"],
          ["Yes", "yes"],
        ]),
        required: true,
      },
      {
        id: "postcode",
        label: "ZIP / postcode",
        type: "postcode",
        required: true,
        help: "Used to check the business service area; this is not automatic travel pricing.",
      },
      {
        ...quantity("removal_area", "Old flooring to remove (sq ft)", 1, 100000, 1),
        required: true,
        showWhen: [{ field: "remove", op: "eq", value: "yes" }],
      },
      {
        ...quantity("trim_length", "Skirting / baseboard length (linear ft)", 0, 100000, 1),
        required: false,
      },
      { ...quantity("stairs_count", "Stair treads to cover", 0, 100000, 1), required: false },
      {
        ...selection("supply", "Flooring supply", "choice", [
          ["Customer supplies flooring", "customer_supplies_flooring"],
          ["Business supplies flooring", "business_supplies_flooring"],
        ]),
        required: false,
      },
      {
        ...selection("subfloor", "Subfloor condition", "choice", [
          ["Ready", "ready"],
          ["Leveling needed", "leveling_needed"],
          ["Damage / damp suspected", "damage_damp_suspected"],
        ]),
        required: false,
      },
      {
        id: "product",
        label: "Flooring product and subfloor details",
        type: "text",
        required: false,
        help: "Material supply, moisture issues and repairs are confirmed after inspection.",
      },
      {
        id: "preferred_date",
        label: "Preferred date or timeframe",
        type: "text",
        required: false,
      },
      {
        id: "notes",
        label: "Other requirements or access restrictions",
        type: "text",
        required: false,
      },
    ],
    rules: [
      { kind: "base", amount: 220 },
      { kind: "number", field: "area", perUnit: 3.4 },
      {
        kind: "multiplier",
        field: "material",
        map: { laminate: 1, vinyl: 1.05, hardwood: 1.6, tile: 1.45 },
      },
      { kind: "number", field: "removal_area", perUnit: 1.5 },
      { kind: "number", field: "trim_length", perUnit: 3 },
      { kind: "number", field: "stairs_count", perUnit: 65 },
    ],
  },
  {
    currency: "USD",
    rangePct: 0.08,
    slug: "windows",
    name: "Window estimate",
    industry: "Windows",
    minPrice: 450,
    description:
      "Window replacement estimate by count, type and stories. Budget estimate only; final scope and price are confirmed by the business.",
    questions: [
      { ...quantity("count", "Number of windows", 1, 100, 1), required: true },
      {
        ...selection("type", "Window type", "choice", [
          ["Standard", "standard"],
          ["Large/picture", "large"],
          ["Custom", "custom"],
        ]),
        required: true,
      },
      {
        ...selection("stories", "Stories", "choice", [
          ["1", "1"],
          ["2", "2"],
          ["3+", "3"],
        ]),
        required: true,
      },
      {
        id: "postcode",
        label: "ZIP / postcode",
        type: "postcode",
        required: true,
        help: "Used to check the business service area; this is not automatic travel pricing.",
      },
      {
        ...selection("frame", "Frame material", "choice", [
          ["Vinyl", "vinyl"],
          ["Aluminum", "aluminum"],
          ["Wood", "wood"],
        ]),
        required: false,
      },
      {
        ...selection("installation", "Installation scope", "choice", [
          ["Replacement in existing opening", "replacement_in_existing_opening"],
          ["New opening / structural work", "new_opening_structural_work"],
        ]),
        required: false,
      },
      {
        ...selection("glass", "Glass requirement", "choice", [
          ["Double glazing", "double_glazing"],
          ["Triple glazing", "triple_glazing"],
          ["Specialist / safety glass", "specialist_safety_glass"],
        ]),
        required: false,
      },
      {
        id: "dimensions",
        label: "Window dimensions and room locations",
        type: "text",
        required: false,
        help: "Custom sizes, structural openings and specialist glass require a measured site survey.",
      },
      {
        id: "preferred_date",
        label: "Preferred date or timeframe",
        type: "text",
        required: false,
      },
      {
        id: "notes",
        label: "Other requirements or access restrictions",
        type: "text",
        required: false,
      },
    ],
    rules: [
      { kind: "base", amount: 200 },
      { kind: "number", field: "count", perUnit: 420 },
      { kind: "multiplier", field: "type", map: { standard: 1, large: 1.35, custom: 1.7 } },
      { kind: "multiplier", field: "stories", map: { "1": 1, "2": 1.08, "3": 1.16 } },
    ],
  },
  {
    currency: "USD",
    rangePct: 0.08,
    slug: "fencing",
    name: "Fencing estimate",
    industry: "Fencing",
    minPrice: 600,
    description:
      "Fence installation by length, material and gate count. Budget estimate only; final scope and price are confirmed by the business.",
    questions: [
      { ...quantity("length", "Fence length (ft)", 5, 5000, 1), required: true },
      {
        ...selection("material", "Material", "choice", [
          ["Wood", "wood"],
          ["Vinyl", "vinyl"],
          ["Metal", "metal"],
        ]),
        required: true,
      },
      { ...quantity("gates", "Gates", 0, 20, 1), required: true },
      {
        id: "postcode",
        label: "ZIP / postcode",
        type: "postcode",
        required: true,
        help: "Used to check the business service area; this is not automatic travel pricing.",
      },
      {
        ...quantity("removal_length", "Existing fence to remove (linear ft)", 0, 100000, 1),
        required: false,
      },
      {
        ...selection("height", "Fence height", "choice", [
          ["Four feet", "four_feet"],
          ["Six feet", "six_feet"],
          ["Eight feet", "eight_feet"],
        ]),
        required: false,
      },
      {
        ...selection("terrain", "Ground conditions", "choice", [
          ["Level / easy access", "level_easy_access"],
          ["Sloped", "sloped"],
          ["Rocky / restricted access", "rocky_restricted_access"],
        ]),
        required: false,
      },
      {
        id: "gate_details",
        label: "Gate widths and requirements",
        type: "text",
        required: false,
        help: "Describe single, double or automated gates. Boundaries, utilities and permits must be checked.",
      },
      {
        id: "preferred_date",
        label: "Preferred date or timeframe",
        type: "text",
        required: false,
      },
      {
        id: "notes",
        label: "Other requirements or access restrictions",
        type: "text",
        required: false,
      },
    ],
    rules: [
      { kind: "base", amount: 300 },
      { kind: "number", field: "length", perUnit: 19 },
      { kind: "number", field: "gates", perUnit: 220 },
      { kind: "multiplier", field: "material", map: { wood: 1, vinyl: 1.3, metal: 1.45 } },
      { kind: "number", field: "removal_length", perUnit: 5 },
      {
        kind: "multiplier",
        field: "height",
        map: { four_feet: 0.85, six_feet: 1, eight_feet: 1.2 },
      },
      {
        kind: "choice",
        field: "terrain",
        map: { level_easy_access: 0, sloped: 200, rocky_restricted_access: 400 },
      },
    ],
  },
  {
    currency: "USD",
    rangePct: 0.08,
    slug: "pest-control",
    name: "Pest control estimate",
    industry: "Pest Control",
    minPrice: 95,
    description:
      "Treatment estimate by property size, pest type and severity. Budget estimate only; final scope and price are confirmed by the business.",
    questions: [
      { ...quantity("home_size", "Property floor area (sq ft)", 100, 50000, 1), required: true },
      {
        ...selection("pest", "Pest", "choice", [
          ["Ants", "ants"],
          ["Rodents", "rodents"],
          ["Bed bugs", "bedbugs"],
          ["Termites", "termites"],
        ]),
        required: true,
      },
      {
        ...selection("severity", "Severity", "choice", [
          ["Low", "low"],
          ["Medium", "medium"],
          ["High", "high"],
        ]),
        required: true,
      },
      {
        id: "postcode",
        label: "ZIP / postcode",
        type: "postcode",
        required: true,
        help: "Used to check the business service area; this is not automatic travel pricing.",
      },
      {
        ...selection("property", "Property type", "choice", [
          ["House", "house"],
          ["Apartment", "apartment"],
          ["Commercial", "commercial"],
        ]),
        required: false,
      },
      {
        ...selection("visits", "Service required", "choice", [
          ["Initial visit", "initial_visit"],
          ["Recurring prevention", "recurring_prevention"],
        ]),
        required: false,
      },
      { ...quantity("affected_rooms", "Number of affected rooms", 0, 100000, 1), required: false },
      {
        id: "activity",
        label: "Where and when have you seen pest activity?",
        type: "text",
        required: false,
        help: "Species, infestation extent and treatment suitability are confirmed at inspection; follow-up treatment is not automatically included.",
      },
      {
        id: "preferred_date",
        label: "Preferred date or timeframe",
        type: "text",
        required: false,
      },
      {
        id: "notes",
        label: "Other requirements or access restrictions",
        type: "text",
        required: false,
      },
    ],
    rules: [
      { kind: "base", amount: 70 },
      { kind: "number", field: "home_size", perUnit: 0.03 },
      {
        kind: "choice",
        field: "pest",
        map: { ants: 20, rodents: 110, bedbugs: 280, termites: 400 },
      },
      { kind: "multiplier", field: "severity", map: { low: 1, medium: 1.25, high: 1.6 } },
      { kind: "number", field: "affected_rooms", perUnit: 25 },
    ],
  },
  {
    currency: "USD",
    rangePct: 0.08,
    slug: "photography",
    name: "Photography estimate",
    industry: "Photography",
    minPrice: 200,
    description:
      "Event and commercial photography estimate by hours and deliverables. Budget estimate only; final scope and price are confirmed by the business.",
    questions: [
      {
        ...selection("type", "Shoot type", "choice", [
          ["Portrait", "portrait"],
          ["Event", "event"],
          ["Commercial", "commercial"],
        ]),
        required: true,
      },
      { ...quantity("hours", "Hours", 1, 24, 1), required: true },
      selection("extras", "Extras", "multiselect", [
        ["Second photographer", "second"],
        ["Rush delivery", "rush"],
        ["Album", "album"],
      ]),
      {
        ...selection("usage", "Intended image use", "choice", [
          ["Personal use", "personal_use"],
          ["Business website / social", "business_website_social"],
          ["Advertising campaign", "advertising_campaign"],
        ]),
        required: false,
      },
      { ...quantity("travel", "Travel distance (miles)", 0, 100000, 1), required: false },
      {
        id: "brief",
        label: "Date, location and photography brief",
        type: "text",
        required: false,
        help: "Specify edited image count, delivery deadline and usage needs. Commercial licensing, venue costs and availability require confirmation.",
      },
      {
        id: "preferred_date",
        label: "Preferred date or timeframe",
        type: "text",
        required: false,
      },
      {
        id: "notes",
        label: "Other requirements or access restrictions",
        type: "text",
        required: false,
      },
    ],
    rules: [
      { kind: "base", amount: 120 },
      { kind: "number", field: "hours", perUnit: 135 },
      { kind: "choice", field: "type", map: { portrait: 0, event: 100, commercial: 250 } },
      { kind: "multiselect", field: "extras", map: { second: 0, rush: 120, album: 180 } },
      {
        kind: "number",
        field: "hours",
        perUnit: 75,
        when: [{ field: "extras", op: "includes", value: "second" }],
      },
      { kind: "number", field: "travel", perUnit: 1 },
    ],
  },
];

export const getTemplate = (slug: string): QuoteTemplate | undefined =>
  templates.find((template) => template.slug === slug);
