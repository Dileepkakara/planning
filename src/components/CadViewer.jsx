import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { formatArea, formatDimension, resolveDimensionUnit } from "../utils/units.js";

const COLORS = {
  living: "#ffffff",
  bedroom: "#ffffff",
  masterBedroom: "#ffffff",
  kitchen: "#ffffff",
  dining: "#ffffff",
  toilet: "#ffffff",
  pooja: "#ffffff",
  staircase: "#ffffff",
  default: "#ffffff",
};

const number = (value) => Number(value.toFixed(2));

function wallPoint(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

function closestWall(point, walls) {
  let best = null;
  for (const wall of walls) {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) continue;
    const t = Math.max(0, Math.min(1, ((point.x - wall.x1) * dx + (point.y - wall.y1) * dy) / lengthSquared));
    const projected = { x: wall.x1 + t * dx, y: wall.y1 + t * dy };
    const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
    if (!best || distance < best.distance) {
      best = { wall, point: projected, distance, t };
    }
  }
  return best;
}

function Opening({ item, type, selected, onClick }) {
  const horizontal = item.orientation === "horizontal";
  const swingDirection = item.swingDirection || 1;
  const halfWidth = item.width / 2;
  const radius = item.width;
  const x1 = horizontal ? item.x - halfWidth : item.x;
  const y1 = horizontal ? item.y : item.y - halfWidth;
  const x2 = horizontal ? item.x + halfWidth : item.x;
  const y2 = horizontal ? item.y : item.y + halfWidth;
  const accent = type === "door" ? "#18314f" : "#1198b8";
  const path = horizontal
    ? swingDirection > 0
      ? `M ${x2} ${item.y} A ${radius} ${radius} 0 0 1 ${x1} ${item.y + radius}`
      : `M ${x1} ${item.y} A ${radius} ${radius} 0 0 0 ${x2} ${item.y - radius}`
    : swingDirection > 0
      ? `M ${item.x} ${y2} A ${radius} ${radius} 0 0 0 ${item.x + radius} ${y1}`
      : `M ${item.x} ${y1} A ${radius} ${radius} 0 0 1 ${item.x - radius} ${y2}`;
  const leafEnd = horizontal
    ? swingDirection > 0
      ? { x: x1, y: item.y + radius }
      : { x: x2, y: item.y - radius }
    : swingDirection > 0
      ? { x: item.x + radius, y: y1 }
      : { x: item.x - radius, y: y2 };
  const hingeStart = horizontal
    ? { x: swingDirection > 0 ? x1 : x2, y: item.y }
    : { x: item.x, y: swingDirection > 0 ? y1 : y2 };

  return (
    <g className={`cad-opening ${selected ? "is-selected" : ""}`} onClick={onClick} role="button" tabIndex="0">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="0.22" />
      {type === "door" ? (
        <>
          <path d={path} fill="none" stroke={selected ? "#2866d7" : "#718096"} strokeWidth="0.035" />
          <line x1={hingeStart.x} y1={hingeStart.y} x2={leafEnd.x} y2={leafEnd.y} stroke={selected ? "#2866d7" : accent} strokeWidth="0.055" />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={selected ? "#2866d7" : accent} strokeWidth="0.1" />
          <line
            x1={x1 + (horizontal ? 0 : 0.1)}
            y1={y1 + (horizontal ? 0.1 : 0)}
            x2={x2 + (horizontal ? 0 : 0.1)}
            y2={y2 + (horizontal ? 0.1 : 0)}
            stroke={selected ? "#2866d7" : accent}
            strokeWidth="0.045"
          />
        </>
      )}
      <title>{type === "door" ? (item.mainEntrance ? "Main entrance" : "Door") : "Window"} — {item.roomId}</title>
    </g>
  );
}

function NorthArrow({ direction, plot }) {
  const side = { top: 0, right: 90, bottom: 180, left: 270 }[direction] ?? 0;
  return (
    <g transform={`translate(${plot.width + 1.8} 1.8) rotate(${side})`}>
      <text x="0" y="-0.48" textAnchor="middle" fontSize="0.28" className="svg-north-label">N</text>
      <line x1="0" y1="0.42" x2="0" y2="-0.12" stroke="#17324f" strokeWidth="0.055" />
      <path d="M 0 -0.3 L -0.15 -0.02 L 0.15 -0.02 Z" fill="#17324f" />
    </g>
  );
}

function Road({ side, plot }) {
  const rect = side === "top"
    ? { x: 0, y: -2.35, width: plot.width, height: 1.25 }
    : side === "bottom"
      ? { x: 0, y: plot.height + 1.1, width: plot.width, height: 1.25 }
      : side === "left"
        ? { x: -2.35, y: 0, width: 1.25, height: plot.height }
        : { x: plot.width + 1.1, y: 0, width: 1.25, height: plot.height };
  const horizontal = side === "top" || side === "bottom";
  return (
    <g className="svg-road">
      <rect {...rect} rx="0.12" />
      {horizontal
        ? <line x1="0" y1={rect.y + rect.height / 2} x2={plot.width} y2={rect.y + rect.height / 2} />
        : <line x1={rect.x + rect.width / 2} y1="0" x2={rect.x + rect.width / 2} y2={plot.height} />}
      <text x={rect.x + rect.width / 2} y={rect.y + rect.height / 2 + 0.12} textAnchor="middle" fontSize="0.18">ROAD · {side.toUpperCase()}</text>
    </g>
  );
}

function Dimension({ x1, y1, x2, y2, label, vertical = false }) {
  return (
    <g className="svg-dimension">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <line x1={x1 - 0.12} y1={y1} x2={x1 + 0.12} y2={y1} />
          <line x1={x2 - 0.12} y1={y2} x2={x2 + 0.12} y2={y2} />
          <text x={x1 - 0.22} y={(y1 + y2) / 2} textAnchor="middle" fontSize="0.22" transform={`rotate(-90 ${x1 - 0.22} ${(y1 + y2) / 2})`}>{label}</text>
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - 0.12} x2={x1} y2={y1 + 0.12} />
          <line x1={x2} y1={y2 - 0.12} x2={x2} y2={y2 + 0.12} />
          <text x={(x1 + x2) / 2} y={y1 - 0.12} textAnchor="middle" fontSize="0.22">{label}</text>
        </>
      )}
    </g>
  );
}

function FurnitureShape({ item, selected, onClick }) {
  const isBed = item.name.toLowerCase().includes("bed");
  const isChair = item.name.toLowerCase().includes("chair");
  return (
    <g className={`svg-furniture ${selected ? "is-selected" : ""}`} onClick={onClick} role="button" tabIndex="0">
      <rect
        x={item.x}
        y={item.y}
        width={item.width}
        height={item.height}
        rx={isChair ? 0.08 : 0.12}
        className={isBed ? "furniture-bed" : isChair ? "furniture-chair" : "furniture-item"}
      />
      {!isChair && item.width > 0.65 && item.height > 0.45 && (
        <text x={item.x + item.width / 2} y={item.y + item.height / 2 + 0.05} textAnchor="middle" fontSize="0.16">
          {item.name}
        </text>
      )}
      <title>{item.name}</title>
    </g>
  );
}

export default function CadViewer({ plan, project, floor, floors, onFloorChange, onReset }) {
  const svgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState("select");
  const [selected, setSelected] = useState(null);
  const [customDoors, setCustomDoors] = useState([]);
  const [customWindows, setCustomWindows] = useState([]);
  const [customWalls, setCustomWalls] = useState([]);
  const [wallStart, setWallStart] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setCustomDoors([]);
    setCustomWindows([]);
    setCustomWalls([]);
    setSelected(null);
    setWallStart(null);
    setZoom(1);
  }, [plan]);

  const allWalls = useMemo(() => [...plan.walls, ...customWalls], [plan.walls, customWalls]);
  const openings = useMemo(() => [
    ...plan.doors.map((item) => ({ ...item, type: "door" })),
    ...customDoors.map((item) => ({ ...item, type: "door" })),
    ...plan.windows.map((item) => ({ ...item, type: "window" })),
    ...customWindows.map((item) => ({ ...item, type: "window" })),
  ], [plan.doors, plan.windows, customDoors, customWindows]);

  const padding = 3;
  const baseWidth = plan.plot.width + padding * 2;
  const baseHeight = plan.plot.height + padding * 2;
  const viewWidth = baseWidth / zoom;
  const viewHeight = baseHeight / zoom;
  const viewX = (plan.plot.width - viewWidth) / 2;
  const viewY = (plan.plot.height - viewHeight) / 2;
  const viewBox = `${viewX} ${viewY} ${viewWidth} ${viewHeight}`;

  const selectElement = (event, item, kind) => {
    event.stopPropagation();
    if (["door", "window", "wall"].includes(tool) &&
        ["room", "wall", "door", "window"].includes(kind)) {
      handleCanvasClick(event);
      return;
    }
    setSelected({ ...item, kind });
    if (tool === "room") setNotice(`${item.name} · ${item.label || `${item.width.toFixed(2)} × ${item.height.toFixed(2)} m`}`);
  };

  const handleCanvasClick = (event) => {
    if (tool === "dimension") {
      setNotice("Room dimensions are calculated from the generated geometry.");
      return;
    }
    if (!["door", "window", "wall"].includes(tool)) return;
    const point = wallPoint(svgRef.current, event);
    if (!point) return;
    if (tool === "wall") {
      if (!wallStart) {
        setWallStart(point);
        setNotice("Click a second point to finish the wall segment.");
        return;
      }
      const end = point;
      const inside = (p) => p.x >= plan.building.x && p.x <= plan.building.x + plan.building.width &&
        p.y >= plan.building.y && p.y <= plan.building.y + plan.building.height;
      if (!inside(wallStart) || !inside(end) || Math.hypot(end.x - wallStart.x, end.y - wallStart.y) < 0.6) {
        setNotice("Wall segment must be at least 0.6 m and stay inside the building boundary.");
      } else {
        setCustomWalls((current) => [...current, {
          id: `custom-wall-${Date.now()}`,
          x1: wallStart.x,
          y1: wallStart.y,
          x2: end.x,
          y2: end.y,
          roomIds: [],
        }]);
        setNotice("Wall segment added.");
      }
      setWallStart(null);
      return;
    }

    const nearest = closestWall(point, allWalls);
    if (!nearest || nearest.distance > 0.4) {
      setNotice(`Click within 0.4 m of a wall to place a ${tool}.`);
      return;
    }
    const width = tool === "door" ? 0.85 : 1.2;
    const wallLength = Math.hypot(nearest.wall.x2 - nearest.wall.x1, nearest.wall.y2 - nearest.wall.y1);
    if (nearest.t * wallLength < width / 2 || (1 - nearest.t) * wallLength < width / 2) {
      setNotice(`Placement rejected: the ${tool} does not fit within this wall segment.`);
      return;
    }
    const orientation = Math.abs(nearest.wall.y2 - nearest.wall.y1) < 0.001 ? "horizontal" : "vertical";
    const candidate = {
      id: `custom-${tool}-${Date.now()}`,
      roomId: nearest.wall.roomIds?.[0] || "custom",
      wallId: nearest.wall.id,
      x: nearest.point.x,
      y: nearest.point.y,
      width,
      orientation,
      mainEntrance: false,
    };
    const collision = openings.some((opening) =>
      opening.wallId === candidate.wallId &&
      Math.hypot(opening.x - candidate.x, opening.y - candidate.y) <
        (opening.width + candidate.width) / 2 + 0.15,
    );
    if (collision) {
      setNotice(`Placement rejected: the ${tool} would overlap an existing door or window.`);
      return;
    }
    if (tool === "door") setCustomDoors((current) => [...current, candidate]);
    else setCustomWindows((current) => [...current, candidate]);
    setNotice(`${tool === "door" ? "Door" : "Window"} placed on ${candidate.roomId}'s wall.`);
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const handleWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((current) => Math.min(2.5, Math.max(0.55, current + (event.deltaY < 0 ? 0.1 : -0.1))));
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []);

  const serializeSvg = () => {
    const styles = `
      .svg-plot-boundary{fill:none;stroke:#485563;stroke-width:.055}
      .svg-building-boundary{fill:none;stroke:#a4afb9;stroke-width:.045;stroke-dasharray:.25 .18}
      .svg-room rect{fill:#fff;stroke:none}
      .svg-room.is-selected rect{fill:#d6eaff}
      .svg-wall{stroke:#20262c;stroke-width:.115}
      .svg-wall.external-wall{stroke-width:.21}
      .svg-wall.internal-wall{stroke-width:.12}
      .custom-wall{stroke:#d06c43;stroke-dasharray:.12 .1}
      .svg-room-label text{fill:#20262c;font-family:Arial,sans-serif;paint-order:stroke;stroke:#fff;stroke-width:.07;stroke-linejoin:round}
      .svg-room-label text.svg-room-size{fill:#65717d}
      .furniture-item,.furniture-bed,.furniture-chair{fill:#fff;stroke:#596570;stroke-width:.055}
      .svg-stairs line{stroke:#73879b;stroke-width:.045}
      .svg-parking-area rect{fill:none;stroke:#596570;stroke-width:.07;stroke-dasharray:.18 .12}
      .svg-car rect{fill:#fff;stroke:#3f4a54;stroke-width:.07}
      .svg-dimension line{stroke:#89939d;stroke-width:.035}
      .svg-dimension text,.svg-area-label,.svg-road text{fill:#4f5963;font-family:Arial,sans-serif}
      .svg-road rect{fill:#f0f2f4;stroke:#c6cdd3;stroke-width:.04}
    `;
    return new XMLSerializer()
      .serializeToString(svgRef.current)
      .replace("<defs>", `<defs><style><![CDATA[${styles}]]></style>`);
  };

  const downloadSvg = () => {
    if (!svgRef.current) return;
    const markup = serializeSvg();
    const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.projectName || "planwise-plan"}-${floor}.svg`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadPng = () => {
    if (!svgRef.current) return;
    const markup = serializeSvg();
    const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const viewBox = svgRef.current.viewBox.baseVal;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1800;
      canvas.height = Math.round(canvas.width * viewBox.height / viewBox.width);
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        setNotice("PNG export failed: the browser could not create a drawing context.");
        return;
      }
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (!png) {
          setNotice("PNG export failed: the browser could not create an image.");
          return;
        }
        const pngUrl = URL.createObjectURL(png);
        const anchor = document.createElement("a");
        anchor.href = pngUrl;
        anchor.download = `${project.projectName || "planwise-plan"}-${floor}.png`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setNotice("PNG export failed while loading the SVG drawing.");
    };
    image.src = url;
  };

  const dimensionsVisible = tool === "dimension" || tool === "select";
  const plot = plan.plot;
  const roadSide = plan.roadSide;
  const dimensionUnit = resolveDimensionUnit(project);

  return (
    <div className="cad-layout">
      <aside className="cad-tools-panel">
        <div className="panel-title"><span>DRAWING TOOLS</span><strong>CAD tools</strong></div>
        {[
          ["select", "↖", "Select"],
          ["wall", "／", "Wall"],
          ["door", "▱", "Door"],
          ["window", "▤", "Window"],
          ["room", "□", "Room"],
          ["dimension", "↔", "Dimension"],
          ["furniture", "▦", "Furniture"],
        ].map(([value, icon, label]) => (
          <button key={value} className={`tool-button ${tool === value ? "active" : ""}`} onClick={() => { setTool(value); setWallStart(null); }}>
            <span>{icon}</span>{label}
          </button>
        ))}
        <div className="tool-divider" />
        <button className="tool-button" onClick={() => setZoom(1)}><span>⤢</span>Fit Plan</button>
        <button className="tool-button" onClick={() => { setZoom(1); setCustomDoors([]); setCustomWindows([]); setCustomWalls([]); setWallStart(null); setSelected(null); onReset?.(); }}><span>↻</span>Reset</button>
        <p className="tool-tip">
          {tool === "door" || tool === "window" ? `Click near a wall to place a ${tool}.` :
            tool === "wall" ? "Click twice inside the building to add a wall segment." :
              tool === "dimension" ? "Room dimensions are generated from geometry." : "Use Ctrl/⌘ + mouse wheel to zoom."}
        </p>
        <div className="export-actions">
          <button className="button button-outline" onClick={() => window.print()}>Print</button>
          <button className="button button-outline" onClick={downloadSvg}>SVG</button>
          <button className="button button-outline" onClick={downloadPng}>PNG</button>
        </div>
      </aside>

      <section className="cad-workspace-main">
        <div className="cad-toolbar-top">
          <div>
            <span className="eyebrow">GENERATED FLOOR PLAN</span>
            <h2>{project.projectName} <span className="floor-chip">{floor === "G" ? "Ground Floor" : `Floor ${floor.slice(1)}`}</span></h2>
          </div>
          <div className="zoom-controls">
            <button aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.55, value - 0.1))}>−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(2.5, value + 0.1))}>+</button>
            <button aria-label="Reset zoom" onClick={() => setZoom(1)}>Reset</button>
          </div>
        </div>
        <div className="floor-tabs" role="tablist" aria-label="Floor selector">
          {floors.map((item, index) => (
            <button key={item} role="tab" aria-selected={item === floor} className={item === floor ? "active" : ""} onClick={() => onFloorChange(item)}>
              {index === 0 ? "Ground Floor" : `Floor ${index}`}
            </button>
          ))}
        </div>
        <div className="cad-canvas-scroll">
          <svg
            ref={svgRef}
            className="cad-svg"
            viewBox={viewBox}
            role="img"
            aria-label={`${project.projectName} ${floor} generated floor plan`}
            onClick={handleCanvasClick}
          >
            <defs>
              <pattern id="cad-grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
                <path d="M 0.5 0 L 0 0 0 0.5" fill="none" stroke="#e9eef4" strokeWidth="0.012" />
              </pattern>
            </defs>
            <rect x={viewX} y={viewY} width={viewWidth} height={viewHeight} fill="#fbfcfe" />
            <rect x={viewX} y={viewY} width={viewWidth} height={viewHeight} fill="url(#cad-grid)" />
            <Road side={roadSide} plot={plot} />
            <rect className="svg-plot-boundary" x={plot.x} y={plot.y} width={plot.width} height={plot.height} />
            <rect className="svg-building-boundary" x={plan.building.x} y={plan.building.y} width={plan.building.width} height={plan.building.height} />

            {project.vastu.enabled && (
              <g className="vastu-zone-grid">
                {[1, 2].map((third) => (
                  <Fragment key={third}>
                    <line x1={plot.width * third / 3} y1="0" x2={plot.width * third / 3} y2={plot.height} />
                    <line x1="0" y1={plot.height * third / 3} x2={plot.width} y2={plot.height * third / 3} />
                  </Fragment>
                ))}
              </g>
            )}

            {plan.parkingBounds && (
              <g className="svg-parking-area">
                <rect x={plan.parkingBounds.x} y={plan.parkingBounds.y} width={plan.parkingBounds.width} height={plan.parkingBounds.height} />
                <text x={plan.parkingBounds.x + plan.parkingBounds.width / 2} y={plan.parkingBounds.y + 0.25} textAnchor="middle" fontSize="0.2">PARKING · {plan.parking.length}</text>
              </g>
            )}

            {plan.rooms.map((room) => (
              <g key={room.id} onClick={(event) => selectElement(event, room, "room")} className={`svg-room ${selected?.id === room.id ? "is-selected" : ""}`} role="button" tabIndex="0">
                <rect x={room.x} y={room.y} width={room.width} height={room.height} fill={COLORS[room.kind] || COLORS.default} />
              </g>
            ))}

            {allWalls.map((wall) => (
              <line
                key={wall.id}
                x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2}
                className={`svg-wall ${wall.roomIds.length === 1 ? "external-wall" : "internal-wall"} ${selected?.id === wall.id ? "is-selected" : ""}`}
                onClick={(event) => selectElement(event, wall, "wall")}
              />
            ))}

            {plan.furniture.map((item) => (
              <FurnitureShape key={item.id} item={item} selected={selected?.id === item.id || tool === "furniture" && selected?.roomId === item.roomId} onClick={(event) => selectElement(event, item, "furniture")} />
            ))}

            {plan.rooms.filter((room) => room.kind === "staircase").map((room) => (
              <g key={`${room.id}-steps`} className="svg-stairs">
                {Array.from({ length: 7 }, (_, index) => (
                  <line key={index} x1={room.x + 0.25} y1={room.y + room.height * (index + 1) / 8} x2={room.x + room.width - 0.25} y2={room.y + room.height * (index + 1) / 8} />
                ))}
                <text x={room.x + room.width / 2} y={room.y + room.height / 2} textAnchor="middle" fontSize="0.18">UP ↑</text>
              </g>
            ))}

            {plan.parking.map((car) => (
              <g key={car.id} className="svg-car" onClick={(event) => selectElement(event, car, "parking")} role="button" tabIndex="0">
                <rect x={car.x} y={car.y} width={car.width} height={car.height} rx="0.45" />
                <rect x={car.x + 0.28} y={car.y + 0.8} width={car.width - 0.56} height={car.height * 0.38} rx="0.18" />
                <title>{car.label}</title>
              </g>
            ))}

            {openings.map((item) => (
              <Opening
                key={item.id}
                item={item}
                type={item.type}
                selected={selected?.id === item.id}
                onClick={(event) => selectElement(event, item, item.type)}
              />
            ))}

            {customWalls.map((wall) => (
              <line key={wall.id} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} className="svg-wall custom-wall" onClick={(event) => selectElement(event, wall, "wall")} />
            ))}

            {plan.rooms.map((room) => {
              const hasTopDoor = openings.some((door) =>
                (door.roomId === room.id || door.connectsTo === room.id) &&
                door.orientation === "horizontal" &&
                Math.abs(door.y - room.y) < 0.05,
              );
              const labelY = room.y + (hasTopDoor ? 0.82 : 0.35);
              return (
                <g key={`${room.id}-label`} className="svg-room-label" pointerEvents="none">
                  <text x={room.x + room.width / 2} y={labelY} textAnchor="middle" fontSize="0.28">{room.name.toUpperCase()}</text>
                  {dimensionsVisible && (
                    <text x={room.x + room.width / 2} y={labelY + 0.27} textAnchor="middle" fontSize="0.22" className="svg-room-size">
                      {`${formatDimension(number(room.width), dimensionUnit)} × ${formatDimension(number(room.height), dimensionUnit)}`}
                    </text>
                  )}
                </g>
              );
            })}

            <Dimension x1={0} y1={-0.65} x2={plot.width} y2={-0.65} label={formatDimension(plot.width, dimensionUnit)} />
            <Dimension x1={-0.72} y1={0} x2={-0.72} y2={plot.height} label={formatDimension(plot.height, dimensionUnit)} vertical />
            <NorthArrow direction={project.orientation.northDirection} plot={plot} />
            <text x={plot.width / 2} y={plot.height + 0.72} textAnchor="middle" fontSize="0.22" className="svg-area-label">
              Plot area {formatDimension(plot.width, dimensionUnit)} × {formatDimension(plot.height, dimensionUnit)} · {formatArea(plot.width * plot.height, dimensionUnit)}
            </text>
            {wallStart && <circle cx={wallStart.x} cy={wallStart.y} r="0.12" className="wall-start-marker" />}
          </svg>
        </div>
        <div className="cad-status">
          <span><i className={`status-dot ${plan.validationIssues.length ? "validation-error" : ""}`} /> {plan.validationIssues.length ? "Validation issues" : "Geometry validated"}</span>
          <span>{plan.rooms.length} rooms</span>
          <span>{plan.doors.length + customDoors.length} doors</span>
          <span>{plan.windows.length + customWindows.length} windows</span>
          <span>Units: metres</span>
        </div>
        {notice && <div className="cad-notice" role="status">{notice}</div>}
        {plan.warnings.length > 0 && (
          <details className="plan-warnings">
            <summary>{plan.warnings.length} planning notice{plan.warnings.length === 1 ? "" : "s"}</summary>
            <ul>{plan.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
          </details>
        )}
      </section>

      <aside className="cad-info-panel">
        <div className="panel-title"><span>PLAN SUMMARY</span><strong>Plan information</strong></div>
        <dl className="summary-list">
          <div><dt>Plot length</dt><dd>{formatDimension(plot.height, dimensionUnit)}</dd></div>
          <div><dt>Plot width</dt><dd>{formatDimension(plot.width, dimensionUnit)}</dd></div>
          <div><dt>Plot area</dt><dd>{formatArea(plot.width * plot.height, dimensionUnit)}</dd></div>
          <div><dt>Buildable area</dt><dd>{formatArea(plan.building.width * plan.building.height, dimensionUnit)}</dd></div>
          <div><dt>Bedrooms</dt><dd>{plan.rooms.filter((room) => room.kind === "bedroom" || room.kind === "masterBedroom").length}</dd></div>
          <div><dt>Bathrooms</dt><dd>{plan.rooms.filter((room) => room.kind === "toilet").length}</dd></div>
          <div><dt>Parking</dt><dd>{plan.parking.length} cars</dd></div>
          <div><dt>Road</dt><dd>{project.orientation.roadDirection}</dd></div>
        </dl>
        <div className="selected-detail">
          <span className="panel-label">SELECTION</span>
          {selected ? (
            <>
              <strong>{selected.name || (selected.mainEntrance ? "Main Entrance" : selected.kind)}</strong>
              <small>{selected.roomId ? `Room: ${selected.roomId}` : selected.kind}</small>
              {selected.width && selected.height && <small>{selected.width.toFixed(2)} × {selected.height.toFixed(2)} m</small>}
            </>
          ) : <p>Select a room, wall, opening, or furniture item.</p>}
        </div>
        <div className="legend">
          <span><i className="legend-wall" /> Wall</span>
          <span><i className="legend-door" /> Door</span>
          <span><i className="legend-window" /> Window</span>
          <span><i className="legend-setback" /> Setback boundary</span>
        </div>
      </aside>
    </div>
  );
}
