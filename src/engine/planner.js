export const ROOM_STANDARDS = {
  living: { width: 3.5, height: 3.5 },
  masterBedroom: { width: 3.2, height: 3.5 },
  bedroom: { width: 3, height: 3 },
  kitchen: { width: 2.5, height: 2.5 },
  toilet: { width: 1.2, height: 2 },
  default: { width: 2.4, height: 2.4 },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value * 1000) / 1000;

export function getFloorCount(floors) {
  const match = String(floors || "G").match(/^G\+(\d+)$/i);
  return match ? 1 + Number(match[1]) : 1;
}

export function getFloorList(floors) {
  return Array.from({ length: getFloorCount(floors) }, (_, index) =>
    index === 0 ? "G" : `F${index}`,
  );
}

export function screenSideForDirection(direction, northSide = "top") {
  const sides = {
    top: { north: "top", east: "right", south: "bottom", west: "left" },
    right: { north: "right", east: "bottom", south: "left", west: "top" },
    bottom: { north: "bottom", east: "left", south: "top", west: "right" },
    left: { north: "left", east: "top", south: "right", west: "bottom" },
  };
  return sides[northSide]?.[String(direction).toLowerCase()] || "right";
}

function roomDefinitions(project, floor) {
  const rooms = project.rooms || {};
  const building = project.building || {};
  const definitions = [];
  const add = (id, name, kind) => definitions.push({ id, name, kind });

  if (rooms.living) add("living", "Living Room", "living");
  if (rooms.dining) add("dining", "Dining Room", "dining");
  if (rooms.kitchen) add("kitchen", "Kitchen", "kitchen");

  const bedroomCount = clamp(Math.floor(Number(building.bedrooms) || 0), 0, 20);
  for (let index = 0; index < bedroomCount; index += 1) {
    if (index === 0 && rooms.masterBedroom) {
      add("master-bedroom", "Master Bedroom", "masterBedroom");
    } else {
      const number = index === 0 ? 1 : index + 1;
      add(`bedroom-${number}`, `Bedroom ${number}`, "bedroom");
    }
  }

  const bathroomCount = clamp(Math.floor(Number(building.bathrooms) || 0), 0, 20);
  for (let index = 0; index < bathroomCount; index += 1) {
    add(`bathroom-${index + 1}`, `Bathroom ${index + 1}`, "toilet");
  }

  if (rooms.study) add("study", "Study Room", "default");
  if (rooms.utility) add("utility", "Utility Room", "default");
  if (rooms.pooja) add("pooja", "Pooja Gadhi", "pooja");
  if (getFloorCount(building.floors) > 1) {
    add("staircase", "Staircase", "staircase");
  }
  if (floor !== "G" && rooms.living) {
    add("family-lounge", "Family Lounge", "living");
  }

  return definitions.length ? definitions : [{ id: "open-plan", name: "Open Plan", kind: "default" }];
}

function roomOrder(definitions, mode, project, cells) {
  const vastuTarget = {
    kitchen: project.vastu?.kitchen,
    masterBedroom: project.vastu?.masterBedroom,
    pooja: project.vastu?.pooja,
    staircase: project.vastu?.staircase,
    toilet: project.vastu?.toilet,
  };

  let ordered = [...definitions];
  if (mode === "space") {
    ordered.sort((a, b) => {
      const area = (room) => {
        const standard = ROOM_STANDARDS[room.kind] || ROOM_STANDARDS.default;
        return standard.width * standard.height;
      };
      return area(b) - area(a);
    });
  } else if (mode === "ventilation") {
    const maxRow = Math.max(...cells.map((cell) => cell.row));
    const maxCol = Math.max(...cells.map((cell) => cell.col));
    const perimeter = cells.filter((cell) =>
      cell.row === 0 || cell.col === 0 || cell.row === maxRow || cell.col === maxCol,
    );
    ordered.sort((a, b) => {
      const score = (room) => ["living", "bedroom", "masterBedroom", "kitchen"].includes(room.kind) ? 0 : 1;
      return score(a) - score(b);
    });
    ordered = ordered.map((room, index) => ({
      ...room,
      preferredCells: [perimeter[index % perimeter.length]],
    }));
  } else if (mode === "cost") {
    ordered.sort((a, b) => {
      const wet = (room) => room.kind === "kitchen" || room.kind === "toilet" ? 0 : 1;
      return wet(a) - wet(b);
    });
  } else if (mode === "vastu") {
    ordered.sort((a, b) => {
      const priority = (room) => room.kind === "pooja" ? 0
        : room.kind === "kitchen" ? 1
          : room.kind === "masterBedroom" ? 2 : 3;
      return priority(a) - priority(b);
    });
  } else {
    const floorRotation = floorIndex(project, mode);
    if (floorRotation && ordered.length > 2) {
      ordered.push(...ordered.splice(0, floorRotation));
    }
  }

  return ordered.map((room) => {
    const preference = project.vastu?.enabled ? vastuTarget[room.kind] : null;
    const preferredCells = preference && preference !== "auto"
      ? preferredZoneCells(cells, preference, project)
      : undefined;
    return {
      room,
      preferredCells: room.preferredCells || preferredCells,
    };
  });
}

function floorIndex(project, mode) {
  if (mode === "balanced" || mode === "space") return 0;
  return mode === "ventilation" ? 1 : mode === "cost" ? 2 : 0;
}

function preferredZoneCells(cells, preference, project) {
  const directions = {
    north: screenSideForDirection("north", project.orientation?.northDirection),
    east: screenSideForDirection("east", project.orientation?.northDirection),
    south: screenSideForDirection("south", project.orientation?.northDirection),
    west: screenSideForDirection("west", project.orientation?.northDirection),
  };
  const vectors = {
    top: [0, -1],
    right: [1, 0],
    bottom: [0, 1],
    left: [-1, 0],
  };
  const tokens = String(preference).toLowerCase().match(/north|south|east|west/g) || [];
  const vector = tokens.reduce((sum, token) => {
    const [x, y] = vectors[directions[token]] || [0, 0];
    return [sum[0] + x, sum[1] + y];
  }, [0, 0]);
  const minX = Math.min(...cells.map((cell) => cell.x));
  const maxX = Math.max(...cells.map((cell) => cell.x + cell.width));
  const minY = Math.min(...cells.map((cell) => cell.y));
  const maxY = Math.max(...cells.map((cell) => cell.y + cell.height));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return [...cells].sort((a, b) => {
    const score = (cell) => {
      const x = cell.x + cell.width / 2;
      const y = cell.y + cell.height / 2;
      return (x - centerX) * vector[0] + (y - centerY) * vector[1];
    };
    return score(b) - score(a);
  });
}

function boundsForPlot(project) {
  const plotWidth = Math.max(4, Number(project.plot?.width) || 12);
  const plotLength = Math.max(4, Number(project.plot?.length) || 18);
  const roadSide = screenSideForDirection(
    project.orientation?.roadDirection,
    project.orientation?.northDirection,
  );
  const setbacks = project.setbacks || {};
  let left = Math.max(0, Number(setbacks.left) || 0);
  let right = Math.max(0, Number(setbacks.right) || 0);
  let top = Math.max(0, Number(setbacks.front) || 0);
  let bottom = Math.max(0, Number(setbacks.rear) || 0);

  if (roadSide === "top") {
    top = Math.max(0, Number(setbacks.front) || 0);
    bottom = Math.max(0, Number(setbacks.rear) || 0);
  } else if (roadSide === "bottom") {
    bottom = Math.max(0, Number(setbacks.front) || 0);
    top = Math.max(0, Number(setbacks.rear) || 0);
  } else if (roadSide === "left") {
    left = Math.max(0, Number(setbacks.front) || 0);
    right = Math.max(0, Number(setbacks.rear) || 0);
  } else {
    right = Math.max(0, Number(setbacks.front) || 0);
    left = Math.max(0, Number(setbacks.rear) || 0);
  }

  const parkingSpaces = clamp(Math.floor(Number(project.building?.parkingSpaces) || 0), 0, 12);
  const insideWidth = Math.max(1, plotWidth - left - right);
  const insideLength = Math.max(1, plotLength - top - bottom);
  let parking = null;
  let parkingInset = 0;

  if (parkingSpaces > 0) {
    if (roadSide === "top" || roadSide === "bottom") {
      const perRow = Math.max(1, Math.floor(insideWidth / 2.6));
      const rows = Math.ceil(parkingSpaces / perRow);
      parkingInset = Math.min(insideLength * 0.45, rows * 4.8);
      const y = roadSide === "top" ? top : plotLength - bottom - parkingInset;
      parking = { x: left, y, width: insideWidth, height: parkingInset, side: roadSide };
      if (roadSide === "top") top += parkingInset;
      else bottom += parkingInset;
    } else {
      const perColumn = Math.max(1, Math.floor(insideLength / 5.2));
      const columns = Math.ceil(parkingSpaces / perColumn);
      parkingInset = Math.min(insideWidth * 0.45, columns * 2.8);
      const x = roadSide === "left" ? left : plotWidth - right - parkingInset;
      parking = { x, y: top, width: parkingInset, height: insideLength, side: roadSide };
      if (roadSide === "left") left += parkingInset;
      else right += parkingInset;
    }
  }

  const building = {
    x: left,
    y: top,
    width: Math.max(0.5, plotWidth - left - right),
    height: Math.max(0.5, plotLength - top - bottom),
  };
  const warnings = [];
  if (building.width < 5 || building.height < 5) {
    warnings.push("The selected plot, setbacks, and parking leave a small buildable area.");
  }
  if (parking && parkingInset < (roadSide === "top" || roadSide === "bottom" ? 4.5 : 2.5)) {
    warnings.push("There may not be enough room for every requested parking space.");
  }

  return {
    plot: { x: 0, y: 0, width: plotWidth, height: plotLength },
    building,
    parking,
    roadSide,
    setbacks: { left, right, top, bottom },
    warnings,
  };
}

function makeFurniture(room) {
  const { x, y, width, height, kind, id } = room;
  const inset = Math.min(0.2, width * 0.05, height * 0.05);
  const fit = (value, available) => Math.max(0.1, Math.min(value, Math.max(0.1, available)));
  const place = (name, dx, dy, w, h) => ({
    id: `${id}-${name.toLowerCase().replaceAll(" ", "-")}`,
    roomId: id,
    name,
    x: x + dx,
    y: y + dy,
    width: fit(w, width - dx - inset),
    height: fit(h, height - dy - inset),
  });

  if (kind === "living") {
    return [
      place("Sofa", inset, inset, Math.min(2.2, width * 0.58), 0.85),
      place("Center Table", inset, Math.min(height - 0.85, 1.35), 0.95, 0.55),
    ];
  }
  if (kind === "masterBedroom" || kind === "bedroom") {
    return [
      place("Bed", Math.max(inset, (width - 1.8) / 2), inset + 0.15, 1.8, 2.05),
      place("Wardrobe", inset, Math.max(0.3, height - 0.65), Math.min(1.2, width * 0.4), 0.42),
    ];
  }
  if (kind === "kitchen") {
    return [
      place("Kitchen Platform", inset, inset, width - inset * 2, 0.62),
      place("Sink", inset + 0.2, inset + 0.15, 0.55, 0.32),
      place("Stove", Math.max(inset + 0.3, width - 0.95), inset + 0.14, 0.55, 0.34),
    ];
  }
  if (kind === "dining") {
    return [
      place("Dining Table", Math.max(inset, (width - 1.35) / 2), Math.max(inset, (height - 0.85) / 2), 1.35, 0.85),
      place("Chair", inset, inset, 0.38, 0.38),
      place("Chair", Math.max(inset, width - 0.58), inset, 0.38, 0.38),
    ];
  }
  if (kind === "toilet") {
    return [
      place("WC", inset, inset, 0.45, 0.62),
      place("Wash Basin", Math.max(inset, width - 0.75), inset, 0.5, 0.35),
    ];
  }
  if (kind === "pooja") return [place("Pooja Unit", inset, inset, 0.65, 0.5)];
  if (kind === "staircase") return [place("Stair Flight", inset, inset, width - inset * 2, height - inset * 2)];
  return [];
}

function buildWalls(rooms) {
  const edges = new Map();
  for (const room of rooms) {
    const roomEdges = [
      ["top", room.x, room.y, room.x + room.width, room.y],
      ["right", room.x + room.width, room.y, room.x + room.width, room.y + room.height],
      ["bottom", room.x, room.y + room.height, room.x + room.width, room.y + room.height],
      ["left", room.x, room.y, room.x, room.y + room.height],
    ];
    for (const [side, x1, y1, x2, y2] of roomEdges) {
      const key = [round(x1), round(y1), round(x2), round(y2)]
        .sort()
        .join(":");
      const reverseKey = [round(x2), round(y2), round(x1), round(y1)]
        .join(":");
      const existing = edges.get(key) || edges.get(reverseKey);
      if (existing) {
        existing.roomIds.push(room.id);
      } else {
        edges.set(key, {
          id: `wall-${edges.size + 1}`,
          x1: round(x1),
          y1: round(y1),
          x2: round(x2),
          y2: round(y2),
          roomIds: [room.id],
          roomSide: side,
        });
      }
    }
  }
  return [...edges.values()];
}

function getRoomOnSide(rooms, side) {
  const candidates = rooms.filter((room) => {
    if (side === "top") return Math.abs(room.y - Math.min(...rooms.map((r) => r.y))) < 0.001;
    if (side === "bottom") return Math.abs(room.y + room.height - Math.max(...rooms.map((r) => r.y + r.height))) < 0.001;
    if (side === "left") return Math.abs(room.x - Math.min(...rooms.map((r) => r.x))) < 0.001;
    return Math.abs(room.x + room.width - Math.max(...rooms.map((r) => r.x + r.width))) < 0.001;
  });
  return candidates.sort((a, b) => {
    const centerA = side === "top" || side === "bottom" ? a.x + a.width / 2 : a.y + a.height / 2;
    const centerB = side === "top" || side === "bottom" ? b.x + b.width / 2 : b.y + b.height / 2;
    return centerA - centerB;
  })[Math.floor(candidates.length / 2)];
}

function buildDoors(rooms, walls, roadSide, project) {
  const doors = [];
  for (const wall of walls) {
    if (wall.roomIds.length < 2) continue;
    const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
    if (length < 0.9) continue;
    const midpoint = { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 };
    doors.push({
      id: `door-${doors.length + 1}`,
      roomId: wall.roomIds[0],
      connectsTo: wall.roomIds[1],
      wallId: wall.id,
      x: midpoint.x,
      y: midpoint.y,
      width: Math.min(0.85, length * 0.38),
      orientation: Math.abs(wall.y2 - wall.y1) < 0.001 ? "horizontal" : "vertical",
      swing: "INWARD",
      swingDirection: wall.roomSide === "top" || wall.roomSide === "left" ? 1 : -1,
      mainEntrance: false,
    });
  }

  const entranceRoom = getRoomOnSide(rooms, roadSide);
  if (entranceRoom) {
    let position = 0.5;
    const preference = project.vastu?.enabled ? project.vastu.entrance : "auto";
    if (preference && preference !== "auto") {
      const preferredSide = screenSideForDirection(preference, project.orientation?.northDirection);
      if (roadSide === "top" || roadSide === "bottom") {
        if (preferredSide === "left") position = 0.25;
        if (preferredSide === "right") position = 0.75;
      } else {
        if (preferredSide === "top") position = 0.25;
        if (preferredSide === "bottom") position = 0.75;
      }
    }
    let x = entranceRoom.x + entranceRoom.width / 2;
    let y = entranceRoom.y + entranceRoom.height / 2;
    if (roadSide === "top" || roadSide === "bottom") {
      x = entranceRoom.x + entranceRoom.width * position;
    } else {
      y = entranceRoom.y + entranceRoom.height * position;
    }
    if (roadSide === "top") y = entranceRoom.y;
    if (roadSide === "bottom") y = entranceRoom.y + entranceRoom.height;
    if (roadSide === "left") x = entranceRoom.x;
    if (roadSide === "right") x = entranceRoom.x + entranceRoom.width;
    doors.push({
      id: "main-entrance",
      roomId: entranceRoom.id,
      connectsTo: "outside",
      wallId: `external-${roadSide}`,
      x,
      y,
      width: 0.95,
      orientation: roadSide === "top" || roadSide === "bottom" ? "horizontal" : "vertical",
      swing: "INWARD",
      swingDirection: roadSide === "top" || roadSide === "left" ? 1 : -1,
      mainEntrance: true,
    });
  }
  return doors;
}

function buildWindows(rooms, walls, roadSide, enabled) {
  if (!enabled) return [];
  const windows = [];
  for (const room of rooms) {
    const sides = [];
    if (Math.abs(room.y - Math.min(...rooms.map((r) => r.y))) < 0.001) sides.push("top");
    if (Math.abs(room.y + room.height - Math.max(...rooms.map((r) => r.y + r.height))) < 0.001) sides.push("bottom");
    if (Math.abs(room.x - Math.min(...rooms.map((r) => r.x))) < 0.001) sides.push("left");
    if (Math.abs(room.x + room.width - Math.max(...rooms.map((r) => r.x + r.width))) < 0.001) sides.push("right");

    for (const side of sides) {
      if (side === roadSide) continue;
      const horizontal = side === "top" || side === "bottom";
      const length = horizontal ? room.width : room.height;
      if (length < 2.2) continue;
      const x = horizontal ? room.x + room.width / 2 : side === "left" ? room.x : room.x + room.width;
      const y = horizontal ? side === "top" ? room.y : room.y + room.height : room.y + room.height / 2;
      const width = Math.min(1.2, length * 0.34);
      const wall = walls.find((candidate) =>
        candidate.roomIds.includes(room.id) &&
        (horizontal
          ? Math.abs(candidate.y1 - y) < 0.001 && Math.abs(candidate.y2 - y) < 0.001 &&
            x - width / 2 >= Math.min(candidate.x1, candidate.x2) - 0.001 &&
            x + width / 2 <= Math.max(candidate.x1, candidate.x2) + 0.001
          : Math.abs(candidate.x1 - x) < 0.001 && Math.abs(candidate.x2 - x) < 0.001 &&
            y - width / 2 >= Math.min(candidate.y1, candidate.y2) - 0.001 &&
            y + width / 2 <= Math.max(candidate.y1, candidate.y2) + 0.001),
      );
      if (!wall) continue;
      windows.push({
        id: `window-${windows.length + 1}`,
        roomId: room.id,
        wallId: wall.id,
        wall: side,
        x,
        y,
        width,
        orientation: horizontal ? "horizontal" : "vertical",
      });
    }
  }
  return windows;
}

function buildParking(project, parkingBounds) {
  if (!parkingBounds) return [];
  const count = clamp(Math.floor(Number(project.building?.parkingSpaces) || 0), 0, 12);
  const cars = [];
  const horizontal = parkingBounds.side === "top" || parkingBounds.side === "bottom";
  const slotW = horizontal ? 2.6 : 2.8;
  const slotH = horizontal ? 4.8 : 5.2;
  const slotsPerRow = horizontal
    ? Math.max(1, Math.floor(parkingBounds.width / slotW))
    : Math.max(1, Math.floor(parkingBounds.height / slotH));

  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / slotsPerRow);
    const col = index % slotsPerRow;
    const x = horizontal
      ? parkingBounds.x + col * slotW + (slotW - 2.1) / 2
      : parkingBounds.x + row * slotW + (slotW - 2.1) / 2;
    const y = horizontal
      ? parkingBounds.y + row * slotH + (slotH - 4.2) / 2
      : parkingBounds.y + col * slotH + (slotH - 4.2) / 2;
    cars.push({
      id: `car-${index + 1}`,
      x,
      y,
      width: 2.1,
      height: 4.2,
      label: `Parking ${index + 1}`,
    });
  }
  return cars;
}

export function checkRoomCollision(roomA, roomB) {
  return (
    roomA.x < roomB.x + roomB.width - 0.001 &&
    roomA.x + roomA.width > roomB.x + 0.001 &&
    roomA.y < roomB.y + roomB.height - 0.001 &&
    roomA.y + roomA.height > roomB.y + 0.001
  );
}

export function validateFloorPlan(plan) {
  const issues = [];
  const isPositiveGeometry = (item) =>
    [item.x, item.y, item.width, item.height].every(Number.isFinite) &&
    item.width > 0 && item.height > 0;
  const segmentForDoor = (door) => {
    const wall = plan.walls.find((item) => item.id === door.wallId);
    if (wall) return wall;
    if (!door.mainEntrance) return null;
    const room = plan.rooms.find((item) => item.id === door.roomId);
    if (!room) return null;
    if (plan.roadSide === "top") return { x1: room.x, y1: room.y, x2: room.x + room.width, y2: room.y };
    if (plan.roadSide === "bottom") return { x1: room.x, y1: room.y + room.height, x2: room.x + room.width, y2: room.y + room.height };
    if (plan.roadSide === "left") return { x1: room.x, y1: room.y, x2: room.x, y2: room.y + room.height };
    return { x1: room.x + room.width, y1: room.y, x2: room.x + room.width, y2: room.y + room.height };
  };
  const openings = [...plan.doors, ...plan.windows];
  for (let index = 0; index < plan.rooms.length; index += 1) {
    const room = plan.rooms[index];
    if (!isPositiveGeometry(room)) issues.push(`${room.name} has invalid geometry.`);
    if (room.x < plan.building.x - 0.001 || room.y < plan.building.y - 0.001 ||
        room.x + room.width > plan.building.x + plan.building.width + 0.001 ||
        room.y + room.height > plan.building.y + plan.building.height + 0.001) {
      issues.push(`${room.name} is outside the buildable boundary.`);
    }
    for (let otherIndex = index + 1; otherIndex < plan.rooms.length; otherIndex += 1) {
      if (checkRoomCollision(room, plan.rooms[otherIndex])) {
        issues.push(`${room.name} overlaps ${plan.rooms[otherIndex].name}.`);
      }
    }
  }
  for (const opening of openings) {
    const wall = segmentForDoor(opening);
    if (!wall) {
      issues.push(`${opening.id} is not attached to a wall.`);
      continue;
    }
    const horizontal = Math.abs(wall.y2 - wall.y1) < 0.001;
    const along = horizontal ? opening.x : opening.y;
    const start = horizontal ? Math.min(wall.x1, wall.x2) : Math.min(wall.y1, wall.y2);
    const end = horizontal ? Math.max(wall.x1, wall.x2) : Math.max(wall.y1, wall.y2);
    const fixedCoordinate = horizontal ? wall.y1 : wall.x1;
    const actualFixedCoordinate = horizontal ? opening.y : opening.x;
    if (Math.abs(fixedCoordinate - actualFixedCoordinate) > 0.001 ||
        along - opening.width / 2 < start - 0.001 ||
        along + opening.width / 2 > end + 0.001) {
      issues.push(`${opening.id} extends beyond its wall.`);
    }
    if (!Number.isFinite(opening.width) || opening.width <= 0) {
      issues.push(`${opening.id} has invalid dimensions.`);
    }
  }
  for (let index = 0; index < openings.length; index += 1) {
    const first = openings[index];
    for (let otherIndex = index + 1; otherIndex < openings.length; otherIndex += 1) {
      const second = openings[otherIndex];
      if (first.wallId !== second.wallId) continue;
      const horizontal = first.orientation === "horizontal";
      const firstPosition = horizontal ? first.x : first.y;
      const secondPosition = horizontal ? second.x : second.y;
      if (Math.abs(firstPosition - secondPosition) < (first.width + second.width) / 2 - 0.001) {
        issues.push(`${first.id} overlaps ${second.id}.`);
      }
    }
  }
  for (const item of plan.furniture) {
    const room = plan.rooms.find((candidate) => candidate.id === item.roomId);
    if (!room || !isPositiveGeometry(item) ||
        item.x < room.x - 0.001 || item.y < room.y - 0.001 ||
        item.x + item.width > room.x + room.width + 0.001 ||
        item.y + item.height > room.y + room.height + 0.001) {
      issues.push(`${item.name} is outside its room or has invalid geometry.`);
    }
  }
  for (const car of plan.parking) {
    const bounds = plan.parkingBounds;
    if (!bounds || !isPositiveGeometry(car) ||
        car.x < bounds.x - 0.001 || car.y < bounds.y - 0.001 ||
        car.x + car.width > bounds.x + bounds.width + 0.001 ||
        car.y + car.height > bounds.y + bounds.height + 0.001) {
      issues.push(`${car.label} is outside the parking boundary.`);
    }
  }
  if (!Number.isFinite(plan.dimensions.area) || plan.dimensions.area <= 0) {
    issues.push("Plot dimensions are invalid.");
  }
  return issues;
}

export function repairDoorPlacement(plan) {
  return plan.doors.map((door) => {
    const wall = plan.walls.find((item) => item.id === door.wallId);
    if (!wall || door.mainEntrance) return door;
    return {
      ...door,
      x: (wall.x1 + wall.x2) / 2,
      y: (wall.y1 + wall.y2) / 2,
    };
  });
}

export function generateFloorPlan(project, floor = "G", mode = "balanced") {
  const bounds = boundsForPlot(project);
  const definitions = roomDefinitions(project, floor);
  const availableWidth = bounds.building.width;
  const availableHeight = bounds.building.height;
  const desiredColumns = Math.round(Math.sqrt(definitions.length * availableWidth / availableHeight));
  const columns = clamp(desiredColumns, 1, Math.min(4, definitions.length));
  const rows = Math.ceil(definitions.length / columns);
  const cellWidth = availableWidth / columns;
  const cellHeight = availableHeight / rows;
  const cells = definitions.map((_, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    return {
      row,
      col,
      x: bounds.building.x + col * cellWidth,
      y: bounds.building.y + row * cellHeight,
      width: cellWidth,
      height: cellHeight,
    };
  });
  const ordered = roomOrder(definitions, mode, project, cells);
  const remaining = [...cells];
  const rooms = ordered.map(({ room, preferredCells }) => {
    let cellIndex = preferredCells
      ? preferredCells.findIndex((preferredCell) => remaining.includes(preferredCell))
      : 0;
    if (cellIndex >= 0 && preferredCells) {
      cellIndex = remaining.indexOf(preferredCells[cellIndex]);
    } else {
      cellIndex = 0;
    }
    const cell = remaining.splice(cellIndex, 1)[0] || cells[0];
    const standardsForRoom = ROOM_STANDARDS[room.kind] || ROOM_STANDARDS.default;
    return {
      ...room,
      floor,
      x: round(cell.x),
      y: round(cell.y),
      width: round(cell.width),
      height: round(cell.height),
      minimum: standardsForRoom,
      label: `${formatM(cell.width)} × ${formatM(cell.height)} m`,
    };
  });

  const walls = buildWalls(rooms);
  const doors = repairDoorPlacement({
    walls,
    doors: buildDoors(rooms, walls, bounds.roadSide, project),
  });
  const windows = buildWindows(
    rooms,
    walls,
    bounds.roadSide,
    project.sustainability?.naturalLight || project.sustainability?.naturalVentilation,
  );
  const furniture = rooms.filter((room) => room.kind !== "staircase").flatMap(makeFurniture);
  const parking = floor === "G" ? buildParking(project, bounds.parking) : [];
  const plan = {
    id: `${floor}-${mode}`,
    floor,
    mode,
    plot: bounds.plot,
    building: bounds.building,
    parkingBounds: floor === "G" ? bounds.parking : null,
    setbacks: bounds.setbacks,
    roadSide: bounds.roadSide,
    rooms,
    walls,
    doors,
    windows,
    furniture,
    parking,
    dimensions: {
      width: bounds.plot.width,
      length: bounds.plot.height,
      area: bounds.plot.width * bounds.plot.height,
      builtArea: bounds.building.width * bounds.building.height,
    },
    warnings: [...bounds.warnings],
  };

  if (cellWidth < 2.4 || cellHeight < 2.4) {
    plan.warnings.push("Some generated room cells are smaller than the prototype minimum-room heuristic.");
  }
  plan.warnings.push(...validateFloorPlan(plan));
  return plan;
}

function formatM(value) {
  return Number(value).toFixed(2);
}
