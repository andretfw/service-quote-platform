import type { Option, Question, QuoteTemplate } from "./types";

const defaults = {
  currency: "USD",
  rangePct: 0.08,
} as const;

const options = (entries: Array<[label: string, value: string]>): Option[] =>
  entries.map(([label, value]) => ({ label, value }));

const choice = (
  id: string,
  label: string,
  entries: Array<[label: string, value: string]>,
): Question => ({
  id,
  label,
  type: "choice",
  required: true,
  options: options(entries),
});

const multiselect = (
  id: string,
  label: string,
  entries: Array<[label: string, value: string]>,
): Question => ({
  id,
  label,
  type: "multiselect",
  options: options(entries),
});

const numberQuestion = (
  id: string,
  label: string,
  min: number,
  max: number,
  step = 1,
): Question => ({
  id,
  label,
  type: "number",
  required: true,
  min,
  max,
  step,
});

const areaQuestion = numberQuestion("area", "Approximate project size", 1, 100_000);
const postcodeQuestion: Question = {
  id: "postcode",
  label: "ZIP / postcode",
  type: "postcode",
  required: true,
};

export const templates: QuoteTemplate[] = [
  {
    ...defaults,
    slug: "painting",
    name: "Painting estimate",
    industry: "Painting",
    minPrice: 450,
    description: "Residential interior/exterior painting with prep, stories and scope adjustments.",
    questions: [
      choice("scope", "What are you painting?", [
        ["Interior", "interior"],
        ["Exterior", "exterior"],
        ["Both", "both"],
      ]),
      areaQuestion,
      choice("stories", "Number of stories", [
        ["1", "1"],
        ["2", "2"],
        ["3+", "3"],
      ]),
      choice("condition", "Current condition", [
        ["Good", "good"],
        ["Average", "average"],
        ["Heavy prep", "heavy"],
      ]),
      multiselect("extras", "Include", [
        ["Ceilings", "ceilings"],
        ["Trim", "trim"],
        ["Doors", "doors"],
      ]),
      postcodeQuestion,
    ],
    rules: [
      { kind: "base", amount: 250 },
      { kind: "number", field: "area", perUnit: 1.85 },
      { kind: "choice", field: "scope", map: { interior: 0, exterior: 300, both: 650 } },
      { kind: "choice", field: "condition", map: { good: 0, average: 250, heavy: 650 } },
      { kind: "multiselect", field: "extras", map: { ceilings: 300, trim: 250, doors: 180 } },
      { kind: "multiplier", field: "stories", map: { "1": 1, "2": 1.12, "3": 1.25 } },
    ],
  },
  {
    ...defaults,
    slug: "cleaning",
    name: "Cleaning estimate",
    industry: "Cleaning",
    minPrice: 90,
    description: "Standard, deep and move-out cleaning with room-level pricing.",
    questions: [
      choice("service", "Cleaning type", [
        ["Standard", "standard"],
        ["Deep", "deep"],
        ["Move out", "moveout"],
      ]),
      numberQuestion("bedrooms", "Bedrooms", 0, 20),
      numberQuestion("bathrooms", "Bathrooms", 0, 20),
      choice("frequency", "Frequency", [
        ["One time", "once"],
        ["Weekly", "weekly"],
        ["Biweekly", "biweekly"],
      ]),
      multiselect("extras", "Extras", [
        ["Inside oven", "oven"],
        ["Inside fridge", "fridge"],
        ["Windows", "windows"],
      ]),
      postcodeQuestion,
    ],
    rules: [
      { kind: "base", amount: 65 },
      { kind: "number", field: "bedrooms", perUnit: 28 },
      { kind: "number", field: "bathrooms", perUnit: 35 },
      { kind: "choice", field: "service", map: { standard: 0, deep: 90, moveout: 140 } },
      { kind: "multiselect", field: "extras", map: { oven: 30, fridge: 30, windows: 55 } },
      { kind: "multiplier", field: "frequency", map: { once: 1, weekly: 0.82, biweekly: 0.9 } },
    ],
  },
  {
    ...defaults,
    slug: "tiling",
    name: "Tiling estimate",
    industry: "Tiling",
    minPrice: 550,
    description: "Tile installation quote with demolition, prep and tile-size complexity.",
    questions: [
      areaQuestion,
      choice("surface", "Surface", [
        ["Floor", "floor"],
        ["Wall", "wall"],
        ["Both", "both"],
      ]),
      choice("remove", "Existing tile removal?", [
        ["No", "no"],
        ["Yes", "yes"],
      ]),
      choice("tile", "Tile format", [
        ["Standard", "standard"],
        ["Large format", "large"],
        ["Mosaic", "mosaic"],
      ]),
      postcodeQuestion,
    ],
    rules: [
      { kind: "base", amount: 300 },
      { kind: "number", field: "area", perUnit: 11 },
      { kind: "choice", field: "surface", map: { floor: 0, wall: 180, both: 320 } },
      { kind: "choice", field: "remove", map: { no: 0, yes: 350 } },
      { kind: "multiplier", field: "tile", map: { standard: 1, large: 1.18, mosaic: 1.35 } },
    ],
  },
  {
    ...defaults,
    slug: "landscaping",
    name: "Landscaping estimate",
    industry: "Landscaping",
    minPrice: 250,
    description: "Yard projects priced by area, service and access.",
    questions: [
      areaQuestion,
      choice("service", "Service", [
        ["Maintenance", "maintenance"],
        ["New planting", "planting"],
        ["Full redesign", "redesign"],
      ]),
      choice("access", "Site access", [
        ["Easy", "easy"],
        ["Restricted", "restricted"],
      ]),
      postcodeQuestion,
    ],
    rules: [
      { kind: "base", amount: 120 },
      { kind: "number", field: "area", perUnit: 0.55 },
      { kind: "choice", field: "service", map: { maintenance: 0, planting: 350, redesign: 1200 } },
      { kind: "multiplier", field: "access", map: { easy: 1, restricted: 1.18 } },
    ],
  },
  {
    ...defaults,
    slug: "roofing",
    name: "Roofing estimate",
    industry: "Roofing",
    minPrice: 1200,
    description: "Roof replacement/repair estimator with pitch and material adjustments.",
    questions: [
      areaQuestion,
      choice("job", "Job type", [
        ["Repair", "repair"],
        ["Replacement", "replace"],
      ]),
      choice("material", "Material", [
        ["Asphalt", "asphalt"],
        ["Metal", "metal"],
        ["Tile", "tile"],
      ]),
      choice("pitch", "Roof pitch", [
        ["Low", "low"],
        ["Medium", "medium"],
        ["Steep", "steep"],
      ]),
      postcodeQuestion,
    ],
    rules: [
      { kind: "base", amount: 700 },
      { kind: "number", field: "area", perUnit: 4.8 },
      { kind: "choice", field: "job", map: { repair: -300, replace: 0 } },
      { kind: "multiplier", field: "material", map: { asphalt: 1, metal: 1.55, tile: 1.8 } },
      { kind: "multiplier", field: "pitch", map: { low: 1, medium: 1.12, steep: 1.3 } },
    ],
  },
  {
    ...defaults,
    slug: "hvac",
    name: "HVAC estimate",
    industry: "HVAC",
    minPrice: 900,
    description: "HVAC repair/replacement pre-qualification and budget estimate.",
    questions: [
      choice("job", "What do you need?", [
        ["Repair", "repair"],
        ["Replace system", "replace"],
        ["New install", "new"],
      ]),
      numberQuestion("home_size", "Home size", 100, 20_000),
      choice("system", "System", [
        ["AC", "ac"],
        ["Heat pump", "heatpump"],
        ["Furnace + AC", "furnace"],
      ]),
      postcodeQuestion,
    ],
    rules: [
      { kind: "base", amount: 350 },
      { kind: "number", field: "home_size", perUnit: 1.4 },
      { kind: "choice", field: "job", map: { repair: -900, replace: 1800, new: 2600 } },
      { kind: "choice", field: "system", map: { ac: 0, heatpump: 1200, furnace: 1600 } },
    ],
  },
  {
    ...defaults,
    slug: "moving",
    name: "Moving estimate",
    industry: "Moving",
    minPrice: 250,
    description: "Local moving estimate by home size, distance and access.",
    questions: [
      numberQuestion("rooms", "Rooms", 1, 30),
      numberQuestion("distance", "Distance (miles)", 1, 3000),
      choice("stairs", "Stairs?", [
        ["No", "no"],
        ["Yes", "yes"],
      ]),
      choice("packing", "Packing help?", [
        ["No", "no"],
        ["Yes", "yes"],
      ]),
      postcodeQuestion,
    ],
    rules: [
      { kind: "base", amount: 150 },
      { kind: "number", field: "rooms", perUnit: 95 },
      { kind: "number", field: "distance", perUnit: 2.1 },
      { kind: "choice", field: "stairs", map: { no: 0, yes: 120 } },
      { kind: "choice", field: "packing", map: { no: 0, yes: 250 } },
    ],
  },
  {
    ...defaults,
    slug: "pressure-washing",
    name: "Pressure washing estimate",
    industry: "Pressure Washing",
    minPrice: 120,
    description: "Driveway, siding, deck and patio instant estimate.",
    questions: [
      areaQuestion,
      choice("surface", "Surface", [
        ["Driveway", "driveway"],
        ["Siding", "siding"],
        ["Deck/patio", "deck"],
      ]),
      choice("condition", "Condition", [
        ["Normal", "normal"],
        ["Heavy staining", "heavy"],
      ]),
      postcodeQuestion,
    ],
    rules: [
      { kind: "base", amount: 60 },
      { kind: "number", field: "area", perUnit: 0.22 },
      { kind: "choice", field: "surface", map: { driveway: 0, siding: 80, deck: 40 } },
      { kind: "multiplier", field: "condition", map: { normal: 1, heavy: 1.3 } },
    ],
  },
  {
    ...defaults,
    slug: "auto-detailing",
    name: "Auto detailing estimate",
    industry: "Auto Detailing",
    minPrice: 80,
    description: "Vehicle detailing estimate by vehicle size, package and condition.",
    questions: [
      choice("vehicle", "Vehicle", [
        ["Sedan", "sedan"],
        ["SUV", "suv"],
        ["Truck/van", "large"],
      ]),
      choice("package", "Package", [
        ["Exterior", "exterior"],
        ["Interior", "interior"],
        ["Full detail", "full"],
      ]),
      choice("condition", "Condition", [
        ["Normal", "normal"],
        ["Heavy", "heavy"],
      ]),
      multiselect("extras", "Extras", [
        ["Pet hair", "pet"],
        ["Engine bay", "engine"],
        ["Headlights", "lights"],
      ]),
    ],
    rules: [
      { kind: "base", amount: 45 },
      { kind: "choice", field: "vehicle", map: { sedan: 30, suv: 55, large: 75 } },
      { kind: "choice", field: "package", map: { exterior: 20, interior: 35, full: 90 } },
      { kind: "multiplier", field: "condition", map: { normal: 1, heavy: 1.35 } },
      { kind: "multiselect", field: "extras", map: { pet: 35, engine: 40, lights: 25 } },
    ],
  },
  {
    ...defaults,
    slug: "handyman",
    name: "Handyman estimate",
    industry: "Handyman",
    minPrice: 95,
    description: "Small-job estimate using expected hours and materials.",
    questions: [
      numberQuestion("hours", "Estimated labor hours", 1, 40),
      choice("materials", "Materials allowance", [
        ["None", "none"],
        ["Small", "small"],
        ["Medium", "medium"],
        ["Large", "large"],
      ]),
      choice("urgent", "Urgent / same-day?", [
        ["No", "no"],
        ["Yes", "yes"],
      ]),
      postcodeQuestion,
    ],
    rules: [
      { kind: "base", amount: 45 },
      { kind: "number", field: "hours", perUnit: 75 },
      { kind: "choice", field: "materials", map: { none: 0, small: 50, medium: 150, large: 350 } },
      { kind: "multiplier", field: "urgent", map: { no: 1, yes: 1.25 } },
    ],
  },
  {
    ...defaults,
    slug: "flooring",
    name: "Flooring estimate",
    industry: "Flooring",
    minPrice: 500,
    description: "Floor installation with removal and material complexity.",
    questions: [
      areaQuestion,
      choice("material", "Flooring", [
        ["Laminate", "laminate"],
        ["Vinyl", "vinyl"],
        ["Hardwood", "hardwood"],
        ["Tile", "tile"],
      ]),
      choice("remove", "Remove old floor?", [
        ["No", "no"],
        ["Yes", "yes"],
      ]),
      postcodeQuestion,
    ],
    rules: [
      { kind: "base", amount: 220 },
      { kind: "number", field: "area", perUnit: 3.4 },
      { kind: "multiplier", field: "material", map: { laminate: 1, vinyl: 1.05, hardwood: 1.6, tile: 1.45 } },
      { kind: "choice", field: "remove", map: { no: 0, yes: 350 } },
    ],
  },
  {
    ...defaults,
    slug: "windows",
    name: "Window estimate",
    industry: "Windows",
    minPrice: 450,
    description: "Window replacement estimate by count, type and stories.",
    questions: [
      numberQuestion("count", "Number of windows", 1, 100),
      choice("type", "Window type", [
        ["Standard", "standard"],
        ["Large/picture", "large"],
        ["Custom", "custom"],
      ]),
      choice("stories", "Stories", [
        ["1", "1"],
        ["2", "2"],
        ["3+", "3"],
      ]),
      postcodeQuestion,
    ],
    rules: [
      { kind: "base", amount: 200 },
      { kind: "number", field: "count", perUnit: 420 },
      { kind: "multiplier", field: "type", map: { standard: 1, large: 1.35, custom: 1.7 } },
      { kind: "multiplier", field: "stories", map: { "1": 1, "2": 1.08, "3": 1.16 } },
    ],
  },
  {
    ...defaults,
    slug: "fencing",
    name: "Fencing estimate",
    industry: "Fencing",
    minPrice: 600,
    description: "Fence installation by length, material and gate count.",
    questions: [
      numberQuestion("length", "Fence length (ft)", 5, 5000),
      choice("material", "Material", [
        ["Wood", "wood"],
        ["Vinyl", "vinyl"],
        ["Metal", "metal"],
      ]),
      numberQuestion("gates", "Gates", 0, 20),
      postcodeQuestion,
    ],
    rules: [
      { kind: "base", amount: 300 },
      { kind: "number", field: "length", perUnit: 19 },
      { kind: "number", field: "gates", perUnit: 220 },
      { kind: "multiplier", field: "material", map: { wood: 1, vinyl: 1.3, metal: 1.45 } },
    ],
  },
  {
    ...defaults,
    slug: "pest-control",
    name: "Pest control estimate",
    industry: "Pest Control",
    minPrice: 95,
    description: "Treatment estimate by property size, pest type and severity.",
    questions: [
      numberQuestion("home_size", "Property size", 100, 50_000),
      choice("pest", "Pest", [
        ["Ants", "ants"],
        ["Rodents", "rodents"],
        ["Bed bugs", "bedbugs"],
        ["Termites", "termites"],
      ]),
      choice("severity", "Severity", [
        ["Low", "low"],
        ["Medium", "medium"],
        ["High", "high"],
      ]),
      postcodeQuestion,
    ],
    rules: [
      { kind: "base", amount: 70 },
      { kind: "number", field: "home_size", perUnit: 0.03 },
      { kind: "choice", field: "pest", map: { ants: 20, rodents: 110, bedbugs: 280, termites: 400 } },
      { kind: "multiplier", field: "severity", map: { low: 1, medium: 1.25, high: 1.6 } },
    ],
  },
  {
    ...defaults,
    slug: "photography",
    name: "Photography estimate",
    industry: "Photography",
    minPrice: 200,
    description: "Event and commercial photography estimate by hours and deliverables.",
    questions: [
      choice("type", "Shoot type", [
        ["Portrait", "portrait"],
        ["Event", "event"],
        ["Commercial", "commercial"],
      ]),
      numberQuestion("hours", "Hours", 1, 24),
      multiselect("extras", "Extras", [
        ["Second photographer", "second"],
        ["Rush delivery", "rush"],
        ["Album", "album"],
      ]),
    ],
    rules: [
      { kind: "base", amount: 120 },
      { kind: "number", field: "hours", perUnit: 135 },
      { kind: "choice", field: "type", map: { portrait: 0, event: 100, commercial: 250 } },
      { kind: "multiselect", field: "extras", map: { second: 300, rush: 120, album: 180 } },
    ],
  },
];

export const getTemplate = (slug: string): QuoteTemplate | undefined =>
  templates.find((template) => template.slug === slug);
