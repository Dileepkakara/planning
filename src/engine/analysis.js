import { getFloorCount, generateFloorPlan } from "./planner.js";

const RATE_BY_QUALITY = {
  economy: 22000,
  standard: 28000,
  premium: 36000,
  luxury: 48000,
};

const round = (number, places = 1) => Number(number.toFixed(places));

export function calculateQuantities(plans) {
  const floorArea = plans.reduce((sum, plan) => sum + plan.building.width * plan.building.height, 0);
  const wallLength = plans.reduce(
    (sum, plan) => sum + plan.walls.reduce(
      (wallSum, wall) => wallSum + Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1),
      0,
    ),
    0,
  );
  const grossWallArea = wallLength * 3;
  const openingDeduction = plans.reduce(
    (sum, plan) => sum + plan.doors.reduce((value, door) => value + door.width * 2.1, 0)
      + plan.windows.reduce((value, window) => value + window.width * 1.2, 0),
    0,
  );
  const netWallArea = Math.max(0, grossWallArea - openingDeduction);
  return {
    floorArea: round(floorArea, 2),
    wallLength: round(wallLength, 2),
    grossWallArea: round(grossWallArea, 2),
    plasterArea: round(netWallArea * 2, 2),
    flooringArea: round(floorArea, 2),
    concreteVolume: round(floorArea * 0.12, 2),
    masonryVolume: round(netWallArea * 0.15, 2),
    steelWeight: round(floorArea * 4, 0),
  };
}

export function calculateCost(project, quantities) {
  const rate = RATE_BY_QUALITY[project.budget.quality] || RATE_BY_QUALITY.standard;
  const estimatedCost = Math.round(quantities.flooringArea * rate);
  const share = (percentage) => Math.round(estimatedCost * percentage);
  return {
    rate,
    estimatedCost,
    quality: project.budget.quality,
    budget: Number(project.budget.amount) || 0,
    withinBudget: !project.budget.amount || estimatedCost <= project.budget.amount,
    breakdown: [
      { name: "Structure and foundation", amount: share(0.32) },
      { name: "Masonry and plaster", amount: share(0.22) },
      { name: "Flooring and finishes", amount: share(0.2) },
      { name: "Doors, windows and services", amount: share(0.18) },
      { name: "Contingency", amount: share(0.08) },
    ],
    note: "Indicative academic prototype estimate; not a contractor quotation.",
  };
}

export function calculateEnvironmental(project, plans, quantities) {
  const rooms = plans.flatMap((plan) => plan.rooms);
  const windowCount = plans.reduce((sum, plan) => sum + plan.windows.length, 0);
  const roomCount = Math.max(1, rooms.length);
  const options = project.sustainability;
  const daylightScore = Math.min(100, Math.round((windowCount / roomCount) * 55 + (options.naturalLight ? 30 : 0)));
  const ventilationScore = Math.min(100, Math.round((windowCount / roomCount) * 48 + (options.naturalVentilation ? 35 : 0)));
  const solarPotential = options.solar ? Math.round(Math.min(100, plans[0].plot.width * plans[0].plot.height * 0.45)) : 0;
  const rainwaterPotential = options.rainwater
    ? Math.round(Math.min(100, plans[0].plot.width * plans[0].plot.height * 0.18))
    : 0;
  const efficiencyScore = Math.min(100, (options.energyEfficiency ? 60 : 25) + (options.greenMaterials ? 20 : 0));
  const sustainabilityScore = Math.round(
    [options.naturalLight, options.naturalVentilation, options.rainwater, options.solar, options.greenMaterials, options.energyEfficiency]
      .filter(Boolean).length / 6 * 100,
  );
  return {
    daylightScore,
    ventilationScore,
    solarPotential,
    rainwaterPotential,
    efficiencyScore,
    sustainabilityScore,
    greenMaterials: options.greenMaterials,
    estimatedCo2Tonnes: round(quantities.flooringArea * 0.25, 1),
    estimatedWaterLitresPerDay: Math.round(Math.max(1, project.building.bedrooms) * 135),
    windowCount,
    note: "Environmental values are heuristic indicators, not certified assessments.",
  };
}

export function calculateOptimization(project, cost, environment, quantities) {
  const weights = {
    cost: 0.25,
    space: 0.15,
    material: 0.1,
    time: 0.1,
    energy: 0.1,
    co2: 0.1,
    lighting: 0.1,
    ventilation: 0.1,
  };
  const budgetScore = cost.budget ? Math.max(0, Math.min(100, (cost.budget / Math.max(1, cost.estimatedCost)) * 70)) : 70;
  const spaceScore = Math.min(100, Math.round((quantities.flooringArea / Math.max(1, project.plot.area)) * 100));
  const materialScore = project.sustainability.greenMaterials ? 85 : 60;
  const timeScore = Math.max(35, 90 - project.building.bedrooms * 4 - getFloorCount(project.building.floors) * 5);
  const co2Score = Math.max(0, 100 - environment.estimatedCo2Tonnes / Math.max(1, quantities.flooringArea) * 100);
  const scores = {
    cost: Math.round(budgetScore),
    space: spaceScore,
    material: materialScore,
    time: timeScore,
    energy: environment.efficiencyScore,
    co2: Math.round(co2Score),
    lighting: environment.daylightScore,
    ventilation: environment.ventilationScore,
  };
  const overall = Math.round(Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + scores[key] * weight,
    0,
  ));
  return { scores, weights, overall };
}

export function generateAlternatives(project, floor = "G") {
  const variants = [
    { id: "space", name: "Plan A — Space Optimized", description: "Prioritizes a compact room arrangement." },
    { id: "ventilation", name: "Plan B — Ventilation Optimized", description: "Places habitable rooms toward exterior walls." },
    { id: "vastu", name: "Plan C — Vastu Optimized", description: "Uses selected Vastu directions as placement preferences." },
    { id: "cost", name: "Plan D — Cost Optimized", description: "Groups kitchen and bathroom areas." },
    { id: "balanced", name: "Plan E — Balanced", description: "Balances the current project requirements." },
  ];
  return variants.map((variant) => {
    const plan = generateFloorPlan(project, floor, variant.id);
    const usableArea = plan.rooms.reduce((sum, room) => sum + room.width * room.height, 0);
    return {
      ...variant,
      floorPlans: [plan],
      metrics: {
        usableArea: round(usableArea, 2),
        roomCount: plan.rooms.length,
        windowCount: plan.windows.length,
        doorCount: plan.doors.length,
        geometryKey: plan.rooms.map((room) => `${room.id}:${room.x.toFixed(2)},${room.y.toFixed(2)}`).join("|"),
      },
    };
  });
}
