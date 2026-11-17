export const ROOM_OPTIONS = [
  ["living", "Living Room", "Main family space"],
  ["dining", "Dining Room", "Dining area"],
  ["kitchen", "Kitchen", "Cooking area"],
  ["masterBedroom", "Master Bedroom", "Main bedroom"],
  ["bedroom2", "Bedroom 2", "Additional bedroom"],
  ["bedroom3", "Bedroom 3", "Additional bedroom"],
  ["study", "Study Room", "Work or study space"],
  ["utility", "Utility Room", "Utility/service space"],
  ["pooja", "Pooja Gadhi", "Dedicated prayer room"],
];

export const SUSTAINABILITY_OPTIONS = [
  ["naturalLight", "Natural Lighting", "Improve daylight usage", "☀"],
  ["naturalVentilation", "Natural Ventilation", "Improve airflow", "↗"],
  ["rainwater", "Rainwater Harvesting", "Reduce water demand", "◇"],
  ["solar", "Solar Energy", "Renewable electricity", "☼"],
  ["greenMaterials", "Green Materials", "Sustainable materials", "♻"],
  ["energyEfficiency", "Energy Efficiency", "Reduce energy consumption", "⚡"],
];

export function createDemoProject() {
  return {
    id: `project-${Date.now()}`,
    projectName: "Mega Residence",
    location: "Visakhapatnam",
    description: "Modern family residence with Vastu preferences.",
    measurementUnit: "m",
    displayUnit: "same",
    plot: { length: 18, width: 12, area: 216, shape: "rectangle" },
    orientation: { roadDirection: "east", northDirection: "top" },
    building: {
      type: "residential",
      floors: "G+2",
      bedrooms: 3,
      bathrooms: 2,
      parkingSpaces: 2,
      designStyle: "modern",
    },
    rooms: {
      living: true,
      dining: true,
      kitchen: true,
      masterBedroom: true,
      bedroom2: true,
      bedroom3: false,
      study: false,
      utility: false,
      pooja: true,
    },
    vastu: {
      enabled: true,
      entrance: "auto",
      kitchen: "southeast",
      masterBedroom: "southwest",
      pooja: "northeast",
      staircase: "south",
      toilet: "northwest",
    },
    budget: { amount: 4000000, quality: "standard" },
    sustainability: {
      naturalLight: true,
      naturalVentilation: true,
      rainwater: true,
      solar: false,
      greenMaterials: false,
      energyEfficiency: false,
    },
    setbacks: { front: 0.5, rear: 0.5, left: 0.5, right: 0.5 },
  };
}

const asNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function oldRoomFlags(raw) {
  const selected = Array.isArray(raw.rooms) ? raw.rooms : [];
  const has = (value) => selected.includes(value);
  return {
    living: has("living-room"),
    dining: has("dining-room"),
    kitchen: has("kitchen"),
    masterBedroom: has("master-bedroom"),
    bedroom2: has("bedroom-2"),
    bedroom3: has("bedroom-3"),
    study: has("study-room"),
    utility: has("utility-room"),
    pooja: has("pooja-gadhi"),
  };
}

export function normalizeProject(raw = {}) {
  const base = createDemoProject();
  const plot = raw.plot || {};
  const orientation = raw.orientation || {};
  const building = raw.building || {};
  const vastu = raw.vastu || {};
  const budget = raw.budget || {};
  const setbacks = raw.setbacks || {};
  const legacyRooms = oldRoomFlags(raw);
  const roomValues = raw.rooms && !Array.isArray(raw.rooms)
    ? raw.rooms
    : Array.isArray(raw.rooms)
      ? legacyRooms
      : base.rooms;

  const length = asNumber(plot.length ?? raw.plotLength, base.plot.length);
  const width = asNumber(plot.width ?? raw.plotWidth, base.plot.width);
  const selectedFloors = building.floors ?? raw.floors ?? base.building.floors;

  return {
    ...base,
    ...raw,
    id: raw.id ?? base.id,
    projectName: raw.projectName ?? base.projectName,
    location: raw.location ?? base.location,
    description: raw.description || "",
    measurementUnit: raw.measurementUnit || base.measurementUnit,
    displayUnit: raw.displayUnit || base.displayUnit,
    plot: {
      ...base.plot,
      ...plot,
      length,
      width,
      area: length * width,
      shape: plot.shape || raw.plotShape || base.plot.shape,
    },
    orientation: {
      ...base.orientation,
      ...orientation,
      roadDirection:
        orientation.roadDirection || raw.roadDirection || base.orientation.roadDirection,
      northDirection:
        orientation.northDirection || raw.northDirection || base.orientation.northDirection,
    },
    building: {
      ...base.building,
      ...building,
      type: building.type || raw.buildingType || base.building.type,
      floors: selectedFloors,
      bedrooms: asNumber(building.bedrooms ?? raw.bedrooms, base.building.bedrooms),
      bathrooms: asNumber(building.bathrooms ?? raw.bathrooms, base.building.bathrooms),
      parkingSpaces: asNumber(
        building.parkingSpaces ?? raw.parking,
        base.building.parkingSpaces,
      ),
      designStyle: building.designStyle || raw.designStyle || base.building.designStyle,
    },
    rooms: Object.fromEntries(
      Object.keys(base.rooms).map((key) => [key, roomValues[key] ?? base.rooms[key]]),
    ),
    vastu: {
      ...base.vastu,
      ...vastu,
      enabled: raw.vastuEnabled ?? vastu.enabled ?? base.vastu.enabled,
      entrance: raw.vastuEntrance || vastu.entrance || base.vastu.entrance,
      kitchen: raw.vastuKitchen || vastu.kitchen || base.vastu.kitchen,
      masterBedroom:
        raw.vastuMasterBedroom || vastu.masterBedroom || base.vastu.masterBedroom,
      pooja: raw.vastuPooja || vastu.pooja || base.vastu.pooja,
      staircase: raw.vastuStaircase || vastu.staircase || base.vastu.staircase,
      toilet: raw.vastuToilet || vastu.toilet || base.vastu.toilet,
    },
    budget: {
      ...base.budget,
      ...budget,
      amount: asNumber(budget.amount ?? raw.constructionBudget, base.budget.amount),
      quality: budget.quality || raw.constructionQuality || base.budget.quality,
    },
    sustainability: {
      ...base.sustainability,
      ...(Array.isArray(raw.sustainability)
        ? Object.fromEntries([
            ["naturalLight", raw.sustainability.includes("natural-light")],
            ["naturalVentilation", raw.sustainability.includes("natural-ventilation")],
            ["rainwater", raw.sustainability.includes("rainwater")],
            ["solar", raw.sustainability.includes("solar")],
            ["greenMaterials", raw.sustainability.includes("green-materials")],
            ["energyEfficiency", raw.sustainability.includes("energy-efficiency")],
          ])
        : raw.sustainability || {}),
    },
    setbacks: {
      front: asNumber(setbacks.front, base.setbacks.front),
      rear: asNumber(setbacks.rear, base.setbacks.rear),
      left: asNumber(setbacks.left, base.setbacks.left),
      right: asNumber(setbacks.right, base.setbacks.right),
    },
  };
}
