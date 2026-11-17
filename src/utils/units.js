export const toMetres = (value, unit) => {
  const number = Number(value) || 0;
  const factors = {
    ft: 0.3048,
    yd: 0.9144,
    cm: 0.01,
    mm: 0.001,
    in: 0.0254,
  };
  return factors[unit] ? number * factors[unit] : number;
};

export const fromMetres = (value, unit) => {
  const factors = {
    ft: 0.3048,
    yd: 0.9144,
    cm: 0.01,
    mm: 0.001,
    in: 0.0254,
  };
  return factors[unit] ? value / factors[unit] : value;
};

export const formatNumber = (value, digits = 2) =>
  Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });

export function formatLength(metres, unit) {
  if (unit === "ft-in") {
    const totalInches = metres / 0.0254;
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches - feet * 12;
    return `${feet}' ${inches.toFixed(1)}"`;
  }
  const labels = { m: "m", ft: "ft", yd: "yd", cm: "cm", in: "in" };
  return `${formatNumber(fromMetres(metres, unit))} ${labels[unit] || "m"}`;
}

export function formatArea(squareMetres, unit) {
  if (unit === "same") unit = "m";
  if (unit === "ft-in") unit = "ft";
  const options = {
    ft: [10.7639, "sq.ft"],
    yd: [1.19599, "sq.yd"],
    cm: [10000, "cm²"],
    in: [1550.003, "sq.in"],
  };
  const [factor, label] = options[unit] || [1, "m²"];
  return `${formatNumber(squareMetres * factor)} ${label}`;
}

export function displayDimension(metres, unit) {
  return formatLength(metres, unit);
}

export function resolveDimensionUnit(project) {
  return project.displayUnit === "same"
    ? project.measurementUnit || "m"
    : project.displayUnit || "m";
}

export function formatDimension(metres, unit = "m") {
  if (unit === "ft-in") return formatLength(metres, unit);
  const labels = { m: "m", ft: "ft", yd: "yd", cm: "cm", in: "in" };
  return `${fromMetres(metres, unit).toFixed(2)} ${labels[unit] || "m"}`;
}
