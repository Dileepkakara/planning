import { useEffect, useMemo, useState } from "react";
import { createDemoProject } from "./data/defaultProject.js";
import {
  calculateCost,
  calculateEnvironmental,
  calculateOptimization,
  calculateQuantities,
  generateAlternatives,
} from "./engine/analysis.js";
import { generateFloorPlan, getFloorList } from "./engine/planner.js";
import { useProjectStore } from "./store/projectStore.js";
import { formatDimension, formatNumber, resolveDimensionUnit } from "./utils/units.js";
import CadViewer from "./components/CadViewer.jsx";
import ProjectForm from "./components/ProjectForm.jsx";

const NAV_GROUPS = [
  ["WORKSPACE", [
    ["dashboard", "⌂", "Dashboard"],
    ["project-input", "＋", "Project Input"],
  ]],
  ["DESIGN", [
    ["cad-floor-plan", "▦", "CAD Floor Plan"],
    ["elevation", "◇", "3D Elevation"],
    ["alternative-plans", "◫", "Alternative Plans"],
  ]],
  ["ANALYSIS", [
    ["cost", "₹", "Cost Estimation"],
    ["environment", "♧", "Environmental Impact"],
    ["optimization", "⚙", "Optimization"],
  ]],
  ["OUTPUT", [
    ["results", "▥", "Results"],
    ["reports", "▤", "Reports"],
  ]],
  ["PROJECT", [
    ["saved-projects", "▣", "Saved Projects"],
    ["settings", "⚙", "Settings"],
  ]],
];

const PAGE_TITLES = Object.fromEntries(NAV_GROUPS.flatMap(([, items]) => items.map(([id, , label]) => [id, label])));
const money = (value) => `₹${Math.round(value || 0).toLocaleString("en-IN")}`;

function PageHeading({ eyebrow, title, description, actions }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}

function MetricCard({ label, value, detail, icon, tone = "blue" }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <span className="metric-icon">{icon}</span>
      <div><small>{label}</small><strong>{value}</strong>{detail && <span>{detail}</span>}</div>
    </article>
  );
}

function PanelHeading({ eyebrow, title, action }) {
  return (
    <div className="panel-heading">
      <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
      {action}
    </div>
  );
}

function DashboardPage({ project, plan, cost, environment, onPage, onNewProject, onSave }) {
  return (
    <div className="page-stack">
      <section className="welcome-banner">
        <div>
          <span className="eyebrow">PLANWISE AI · BUILDING PLANNER</span>
          <h1>Plan with clarity.<br /><span>Build with confidence.</span></h1>
          <p>Explore your building layout, review indicative cost and environmental metrics, and keep project decisions in one workspace.</p>
          <div className="banner-actions">
            <button className="button button-light" onClick={() => onPage("project-input")}>Edit project details <span>→</span></button>
            <button className="button button-glass" onClick={() => onPage("cad-floor-plan")}>Open CAD plan</button>
          </div>
        </div>
        <div className="welcome-mark" aria-hidden="true">
          <div className="blueprint-grid" />
          <span className="plan-square square-one" />
          <span className="plan-square square-two" />
          <span className="plan-square square-three" />
          <span className="plan-dimension">12.00 m</span>
        </div>
      </section>

      <div className="metric-grid">
        <MetricCard label="Plot Area" value={`${formatNumber(project.plot.area)} m²`} detail={`${project.plot.width} × ${project.plot.length} m`} icon="▱" />
        <MetricCard label="Buildable Area / Floor" value={`${formatNumber(plan.building.width * plan.building.height)} m²`} detail={`${plan.rooms.length} spaces on this floor`} icon="⌂" tone="cyan" />
        <MetricCard label="Indicative Cost" value={money(cost.estimatedCost)} detail={`${project.budget.quality} finish rate`} icon="₹" tone="violet" />
        <MetricCard label="Daylight Indicator" value={`${environment.daylightScore}/100`} detail="Prototype heuristic" icon="☼" tone="green" />
      </div>

      <div className="dashboard-columns">
        <section className="surface-card">
          <PanelHeading eyebrow="PROJECT SNAPSHOT" title={project.projectName} action={<button className="text-button" onClick={() => onPage("project-input")}>Edit details ↗</button>} />
          <div className="snapshot-grid">
            <div><span>Location</span><strong>{project.location || "—"}</strong></div>
            <div><span>Building</span><strong>{project.building.type}</strong></div>
            <div><span>Floors</span><strong>{project.building.floors}</strong></div>
            <div><span>Rooms on ground</span><strong>{plan.rooms.length}</strong></div>
            <div><span>Road</span><strong>{project.orientation.roadDirection}</strong></div>
            <div><span>North shown</span><strong>{project.orientation.northDirection}</strong></div>
          </div>
          <div className="snapshot-actions">
            <button className="button button-primary" onClick={() => onPage("cad-floor-plan")}>View generated plan</button>
            <button className="button button-outline" onClick={onSave}>Save Project</button>
            <button className="button button-outline" onClick={onNewProject}>New Project</button>
          </div>
        </section>
        <section className="surface-card workflow-card">
          <PanelHeading eyebrow="WORKFLOW" title="Planning workspace" />
          {[
            ["01", "Project input", "Site and building requirements", "project-input"],
            ["02", "CAD floor plan", "Generated from current data", "cad-floor-plan"],
            ["03", "Review alternatives", "Compare layout approaches", "alternative-plans"],
            ["04", "Analysis", "Cost and environment indicators", "cost"],
          ].map(([number, title, detail, page], index) => (
            <button key={number} className="workflow-row" onClick={() => onPage(page)}>
              <span className={`workflow-number ${index < 2 ? "complete" : ""}`}>{number}</span>
              <span><strong>{title}</strong><small>{detail}</small></span>
              <span className="workflow-arrow">→</span>
            </button>
          ))}
        </section>
      </div>
      <section className="surface-card feature-row">
        <span><i className="feature-mark blue" /> SVG CAD generation</span>
        <span><i className="feature-mark teal" /> Data-driven room layouts</span>
        <span><i className="feature-mark violet" /> Vastu preferences</span>
        <span><i className="feature-mark green" /> Local project storage</span>
      </section>
    </div>
  );
}

function PlanPreview({ plan }) {
  return (
    <svg className="plan-preview" viewBox={`-0.8 -0.8 ${plan.plot.width + 1.6} ${plan.plot.height + 1.6}`} aria-label="Alternative floor plan preview">
      <rect x="0" y="0" width={plan.plot.width} height={plan.plot.height} fill="#f3f7fb" stroke="#1c3554" strokeWidth=".12" />
      <rect x={plan.building.x} y={plan.building.y} width={plan.building.width} height={plan.building.height} fill="white" stroke="#7790a9" strokeWidth=".08" strokeDasharray=".22 .16" />
      {plan.rooms.map((room) => (
        <g key={room.id}>
          <rect x={room.x} y={room.y} width={room.width} height={room.height} fill="#eaf2fa" stroke="#244363" strokeWidth=".08" />
          <text x={room.x + room.width / 2} y={room.y + room.height / 2} textAnchor="middle" fontSize=".35" fill="#334d68">{room.name.split(" ")[0]}</text>
        </g>
      ))}
    </svg>
  );
}

function AlternativePlansPage({ alternatives, selected, onSelect, onOpenCAD }) {
  return (
    <div className="page-stack">
      <PageHeading eyebrow="DESIGN" title="Alternative Plans" description="Compare generated layout approaches. Each option changes room placement in the CAD geometry." />
      <div className="alternatives-grid">
        {alternatives.map((alternative, index) => {
          const plan = alternative.floorPlans[0];
          return (
            <article key={alternative.id} className={`alternative-card ${selected === alternative.id ? "is-selected" : ""}`}>
              <div className="alternative-card-head">
                <span className="plan-letter">PLAN {String.fromCharCode(65 + index)}</span>
                {selected === alternative.id && <span className="selected-pill">Selected</span>}
              </div>
              <PlanPreview plan={plan} />
              <h2>{alternative.name.replace(/^Plan [A-E] — /, "")}</h2>
              <p>{alternative.description}</p>
              <div className="alternative-metrics">
                <span><small>Usable area</small><strong>{formatNumber(alternative.metrics.usableArea)} m²</strong></span>
                <span><small>Windows</small><strong>{alternative.metrics.windowCount}</strong></span>
                <span><small>Spaces</small><strong>{alternative.metrics.roomCount}</strong></span>
              </div>
              <div className="card-actions">
                <button className={`button ${selected === alternative.id ? "button-primary" : "button-outline"}`} onClick={() => onSelect(alternative.id)}>
                  {selected === alternative.id ? "Selected plan" : "Use this plan"}
                </button>
                <button className="text-button" onClick={() => { onSelect(alternative.id); onOpenCAD(); }}>Open in CAD →</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function CostPage({ quantities, cost }) {
  const max = Math.max(...cost.breakdown.map((item) => item.amount), 1);
  return (
    <div className="page-stack">
      <PageHeading eyebrow="ANALYSIS" title="Cost Estimation" description="Transparent area-rate estimate based on the selected quality level. Values are indicative, not a quotation." />
      <div className="metric-grid three">
        <MetricCard label="Estimated Construction Cost" value={money(cost.estimatedCost)} detail={`${money(cost.rate)} / m²`} icon="₹" tone="violet" />
        <MetricCard label="Calculated Floor Area" value={`${formatNumber(quantities.flooringArea)} m²`} detail="Sum of generated floor footprints" icon="▱" />
        <MetricCard label="Budget Status" value={cost.budget ? cost.withinBudget ? "Within budget" : "Over budget" : "Budget not set"} detail={cost.budget ? `Budget: ${money(cost.budget)}` : "Enter a budget in Project Input"} icon="◷" tone={cost.withinBudget ? "green" : "orange"} />
      </div>
      <div className="analysis-columns">
        <section className="surface-card">
          <PanelHeading eyebrow="COST MODEL" title="Indicative cost breakdown" />
          <div className="cost-breakdown">
            {cost.breakdown.map((item) => (
              <div className="cost-line" key={item.name}>
                <div><span>{item.name}</span><strong>{money(item.amount)}</strong></div>
                <div className="bar-track"><i style={{ width: `${item.amount / max * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <p className="disclaimer">{cost.note}</p>
        </section>
        <section className="surface-card">
          <PanelHeading eyebrow="RATE BASIS" title="Quality rates" />
          <div className="rate-list">
            {[
              ["Economy", 22000], ["Standard", 28000], ["Premium", 36000], ["Luxury", 48000],
            ].map(([name, rate]) => <div key={name} className={cost.quality === name.toLowerCase() ? "current-rate" : ""}><span>{name}</span><strong>{money(rate)} / m²</strong></div>)}
          </div>
        </section>
      </div>
    </div>
  );
}

function EnvironmentPage({ environment, project }) {
  const metrics = [
    ["Natural lighting", environment.daylightScore, "score"],
    ["Ventilation", environment.ventilationScore, "score"],
    ["Solar potential", environment.solarPotential, "indicator"],
    ["Rainwater potential", environment.rainwaterPotential, "indicator"],
    ["Energy efficiency", environment.efficiencyScore, "score"],
    ["Sustainability settings", environment.sustainabilityScore, "score"],
  ];
  return (
    <div className="page-stack">
      <PageHeading eyebrow="ANALYSIS" title="Environmental Impact" description="Prototype indicators respond to the selected sustainability options and generated windows." />
      <div className="metric-grid three">
        <MetricCard label="Daylight Indicator" value={`${environment.daylightScore}/100`} detail="Window and preference heuristic" icon="☼" tone="green" />
        <MetricCard label="Ventilation Indicator" value={`${environment.ventilationScore}/100`} detail={`${environment.windowCount} generated windows`} icon="↗" tone="cyan" />
        <MetricCard label="Estimated Embodied CO₂" value={`${environment.estimatedCo2Tonnes} t`} detail="Approximation from generated floor area" icon="♧" tone="violet" />
      </div>
      <div className="analysis-columns">
        <section className="surface-card">
          <PanelHeading eyebrow="INDICATORS" title="Environmental profile" />
          <div className="score-list">
            {metrics.map(([label, value, suffix]) => (
              <div className="score-row" key={label}>
                <div><span>{label}</span><strong>{value}{suffix === "score" ? "/100" : ""}</strong></div>
                <div className="bar-track"><i style={{ width: `${Math.min(100, value)}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
        <section className="surface-card">
          <PanelHeading eyebrow="PROJECT SETTINGS" title="Selected features" />
          <div className="feature-status-list">
            {[
              ["Natural lighting", project.sustainability.naturalLight],
              ["Natural ventilation", project.sustainability.naturalVentilation],
              ["Rainwater harvesting", project.sustainability.rainwater],
              ["Solar energy", project.sustainability.solar],
              ["Green materials", project.sustainability.greenMaterials],
              ["Energy efficiency", project.sustainability.energyEfficiency],
            ].map(([name, enabled]) => <div key={name}><span>{name}</span><strong className={enabled ? "status-enabled" : "status-disabled"}>{enabled ? "Enabled" : "Not selected"}</strong></div>)}
          </div>
          <div className="environment-footnote">
            <span>Water use proxy</span><strong>{environment.estimatedWaterLitresPerDay.toLocaleString("en-IN")} L / day</strong>
          </div>
          <p className="disclaimer">{environment.note}</p>
        </section>
      </div>
    </div>
  );
}

function OptimizationPage({ optimization, onWeightsChange }) {
  return (
    <div className="page-stack">
      <PageHeading eyebrow="ANALYSIS" title="Optimization" description="A transparent weighted heuristic—not a scientific NSGA-II implementation." />
      <section className="optimization-hero">
        <div><span>WEIGHTED PROJECT SCORE</span><strong>{optimization.overall}<small>/100</small></strong></div>
        <p>Scores update from current geometry, cost assumptions, and sustainability preferences.</p>
      </section>
      <section className="surface-card">
        <PanelHeading eyebrow="OBJECTIVES" title="Prototype objective scores" />
        <div className="objective-grid">
          {Object.entries(optimization.scores).map(([key, score]) => (
            <label key={key} className="objective-card">
              <span className="objective-title">{key.replace(/([A-Z])/g, " $1")}</span>
              <strong>{score}<small>/100</small></strong>
              <span className="bar-track"><i style={{ width: `${score}%` }} /></span>
              <span className="weight-control">Weight <input type="number" min="0" max="100" value={Math.round(optimization.weights[key] * 100)} onChange={(event) => onWeightsChange(key, Number(event.target.value))} />%</span>
            </label>
          ))}
        </div>
        <p className="disclaimer">Changing weights updates the combined score. The individual prototype score formulas are heuristic.</p>
      </section>
    </div>
  );
}

function ResultsPage({ project, plan, cost, environment, optimization, onOpenCAD }) {
  return (
    <div className="page-stack">
      <PageHeading eyebrow="OUTPUT" title="Project Results" description="Current plan summary and prototype analysis indicators." actions={<button className="button button-primary" onClick={onOpenCAD}>Open CAD plan</button>} />
      <section className="results-recommendation">
        <span className="result-rosette">PW</span>
        <div><span className="eyebrow">CURRENT RECOMMENDATION</span><h2>{project.projectName}</h2><p>Balanced plan · {plan.rooms.length} spaces · {project.building.floors}</p></div>
        <div className="result-score"><strong>{optimization.overall}</strong><span>Overall score</span></div>
      </section>
      <div className="metric-grid three">
        <MetricCard label="Estimated Cost" value={money(cost.estimatedCost)} detail={cost.withinBudget ? "Within entered budget" : "Above entered budget"} icon="₹" tone="violet" />
        <MetricCard label="Buildable Area" value={`${formatNumber(plan.building.width * plan.building.height)} m²`} detail="Current floor" icon="▱" />
        <MetricCard label="Rooms" value={`${plan.rooms.length}`} detail={`${project.building.bedrooms} bedrooms · ${project.building.bathrooms} bathrooms`} icon="⌂" tone="cyan" />
        <MetricCard label="Parking" value={`${plan.parking.length}`} detail="Generated vehicles" icon="▰" tone="orange" />
        <MetricCard label="Ventilation" value={`${environment.ventilationScore}/100`} detail="Heuristic score" icon="↗" tone="green" />
        <MetricCard label="Sustainability" value={`${environment.sustainabilityScore}/100`} detail="Selected preferences" icon="♧" tone="green" />
      </div>
      <section className="surface-card">
        <PanelHeading eyebrow="WHY THIS PLAN" title="Current input summary" />
        <p className="result-explanation">This view reflects the selected plot, room counts, orientation, setback values, and sustainability settings. The estimate and scores are prototype calculations and are not certified architectural or engineering advice.</p>
      </section>
    </div>
  );
}

function SavedProjectsPage({ projects, currentId, onOpen, onDelete, onNewProject }) {
  return (
    <div className="page-stack">
      <PageHeading eyebrow="PROJECT" title="Saved Projects" description="Projects are stored in this browser using localStorage." actions={<button className="button button-primary" onClick={onNewProject}>＋ New Project</button>} />
      {projects.length === 0 ? (
        <section className="empty-state surface-card"><span>▣</span><h2>No saved projects</h2><p>Save a project to make it available here.</p><button className="button button-primary" onClick={onNewProject}>Create Project</button></section>
      ) : (
        <div className="saved-project-grid">
          {projects.map((project) => (
            <article className="saved-project-card" key={project.id}>
              <div className="saved-project-icon">⌂</div>
              <div className="saved-project-title"><div><h2>{project.projectName}</h2>{project.id === currentId && <span className="selected-pill">Current</span>}</div><p>{project.location}</p></div>
              <div className="saved-project-meta"><span>{project.plot.width} × {project.plot.length} m</span><span>{project.building.bedrooms} bedrooms · {project.building.floors}</span></div>
              <div className="card-actions"><button className="button button-outline" onClick={() => onOpen(project)}>Open</button><button className="text-button danger-text" onClick={() => onDelete(project.id)}>Delete</button></div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportsPage({ project, plans, cost, quantities, environment }) {
  const download = () => {
    const report = { project, plans, cost, quantities, environment, generatedAt: new Date().toISOString() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.projectName || "planwise"}-report.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="page-stack">
      <PageHeading eyebrow="OUTPUT" title="Reports" description="Download a JSON snapshot of the current project and prototype analysis." actions={<button className="button button-primary" onClick={download}>Download project report</button>} />
      <section className="surface-card report-preview">
        <span className="report-icon">▤</span><div><h2>{project.projectName} — Planning Summary</h2><p>{project.location} · {project.plot.width} × {project.plot.length} m · {plans.length} floor plan(s)</p></div>
        <button className="button button-outline" onClick={() => window.print()}>Print page</button>
      </section>
    </div>
  );
}

function PlaceholderPage({ name, description, icon }) {
  return (
    <div className="page-stack">
      <PageHeading eyebrow="DESIGN" title={name} description={description} />
      <section className="empty-state surface-card"><span>{icon}</span><h2>{name}</h2><p>This module is not implemented in the current React conversion.</p></section>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="page-stack">
      <PageHeading eyebrow="SYSTEM" title="Settings" description="Application and project storage information." />
      <section className="surface-card settings-info"><span className="settings-badge">LOCAL</span><div><h2>Browser storage</h2><p>Project records are saved in localStorage for this browser. No server or account sync is configured.</p></div></section>
      <section className="surface-card"><PanelHeading eyebrow="ABOUT" title="PlanWise AI" /><p className="result-explanation">Building planning prototype with data-driven SVG floor plans. Cost, environmental, and optimization outputs are explicitly labeled as indicative heuristics.</p></section>
    </div>
  );
}

export default function App() {
  const project = useProjectStore((state) => state.project);
  const projects = useProjectStore((state) => state.projects);
  const activePage = useProjectStore((state) => state.activePage);
  const selectedFloor = useProjectStore((state) => state.selectedFloor);
  const selectedAlternative = useProjectStore((state) => state.selectedAlternative);
  const sidebarOpen = useProjectStore((state) => state.sidebarOpen);
  const updateProject = useProjectStore((state) => state.updateProject);
  const setProject = useProjectStore((state) => state.setProject);
  const setPage = useProjectStore((state) => state.setPage);
  const setFloor = useProjectStore((state) => state.setFloor);
  const setAlternative = useProjectStore((state) => state.setAlternative);
  const setSidebarOpen = useProjectStore((state) => state.setSidebarOpen);
  const saveProject = useProjectStore((state) => state.saveProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const createProject = useProjectStore((state) => state.createProject);
  const [formMessage, setFormMessage] = useState(null);
  const [notification, setNotification] = useState(false);
  const [weights, setWeights] = useState(null);

  useEffect(() => {
    useProjectStore.getState().initialize();
  }, []);

  const floors = useMemo(() => getFloorList(project.building.floors), [project.building.floors]);
  const floor = floors.includes(selectedFloor) ? selectedFloor : floors[0];
  const plan = useMemo(
    () => generateFloorPlan(project, floor, selectedAlternative),
    [project, floor, selectedAlternative],
  );
  const plans = useMemo(
    () => floors.map((item) => generateFloorPlan(project, item, selectedAlternative)),
    [project, floors, selectedAlternative],
  );
  const alternatives = useMemo(() => generateAlternatives(project, floor), [project, floor]);
  const quantities = useMemo(() => calculateQuantities(plans), [plans]);
  const cost = useMemo(() => calculateCost(project, quantities), [project, quantities]);
  const environment = useMemo(() => calculateEnvironmental(project, plans, quantities), [project, plans, quantities]);
  const baseOptimization = useMemo(
    () => calculateOptimization(project, cost, environment, quantities),
    [project, cost, environment, quantities],
  );
  const optimization = useMemo(() => {
    if (!weights) return baseOptimization;
    const normalized = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
    const normalizedWeights = Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, value / normalized]));
    const overall = Math.round(Object.entries(baseOptimization.scores).reduce(
      (sum, [key, score]) => sum + score * (normalizedWeights[key] || 0),
      0,
    ));
    return { ...baseOptimization, weights: normalizedWeights, overall };
  }, [baseOptimization, weights]);

  const showMessage = (text, type = "success") => {
    setFormMessage({ text, type });
    window.setTimeout(() => setFormMessage(null), 4500);
  };
  const onSubmit = (event) => {
    event.preventDefault();
    if (!project.projectName.trim()) {
      showMessage("Please enter your project name.", "error");
      document.getElementById("projectName")?.focus();
      return;
    }
    if (project.plot.length <= 0 || project.plot.width <= 0) {
      showMessage("Please enter positive plot length and width.", "error");
      return;
    }
    const saved = saveProject({ ...project, updatedAt: new Date().toISOString() });
    setAlternative("balanced");
    setFloor("G");
    setPage("cad-floor-plan");
    showMessage(`${saved.projectName} saved. CAD plan generated from the current inputs.`);
  };
  const onReset = () => {
    setProject(createDemoProject());
    setAlternative("balanced");
    setFloor("G");
    showMessage("Project form reset to the demo project.");
  };
  const onNewProject = () => {
    createProject();
    setAlternative("balanced");
    setFloor("G");
    setFormMessage(null);
  };
  const onSave = () => {
    const saved = saveProject({ ...project, updatedAt: new Date().toISOString() });
    showMessage(`${saved.projectName} saved.`);
  };
  const onOpenProject = (saved) => {
    setProject(saved);
    setAlternative("balanced");
    setFloor("G");
    setPage("project-input");
  };
  const onDeleteProject = (id) => {
    if (window.confirm("Delete this saved project?")) deleteProject(id);
  };
  const onWeightsChange = (key, value) => {
    setWeights((current) => ({ ...(current || baseOptimization.weights), [key]: Math.max(0, value) }));
  };

  let pageContent;
  switch (activePage) {
    case "project-input":
      pageContent = (
        <div className="page-stack">
          <PageHeading eyebrow="PROJECT WORKSPACE" title="Project Input" description="Enter site, building, room, Vastu, budget, and sustainability requirements." actions={<button className="button button-outline" onClick={onSave}>Save Project</button>} />
          <ProjectForm project={project} updateProject={updateProject} onSubmit={onSubmit} onReset={onReset} message={formMessage} />
        </div>
      );
      break;
    case "cad-floor-plan":
      pageContent = (
        <div className="page-stack cad-page">
          <PageHeading eyebrow="DESIGN WORKSPACE" title="CAD Floor Plan" description="A generated, metre-based SVG plan. Select an element or use the tools to place openings and wall segments." actions={<button className="button button-outline" onClick={onSave}>Save Project</button>} />
          <div className="cad-project-strip">
            <div><span>PROJECT</span><strong>{project.projectName}</strong></div>
            <div><span>PLOT SIZE</span><strong>{formatDimension(project.plot.width, resolveDimensionUnit(project))} × {formatDimension(project.plot.length, resolveDimensionUnit(project))}</strong></div>
            <div><span>UNIT</span><strong>{resolveDimensionUnit(project)}</strong></div>
            <div><span>BEDROOMS</span><strong>{project.building.bedrooms}</strong></div>
            <div><span>FLOORS</span><strong>{project.building.floors}</strong></div>
            <button className="button button-primary" onClick={onSave}>Save plan</button>
          </div>
          <CadViewer plan={plan} project={project} floor={floor} floors={floors} onFloorChange={setFloor} onReset={() => setAlternative("balanced")} />
        </div>
      );
      break;
    case "alternative-plans":
      pageContent = <AlternativePlansPage alternatives={alternatives} selected={selectedAlternative} onSelect={setAlternative} onOpenCAD={() => setPage("cad-floor-plan")} />;
      break;
    case "cost":
      pageContent = <CostPage quantities={quantities} cost={cost} />;
      break;
    case "environment":
      pageContent = <EnvironmentPage environment={environment} project={project} />;
      break;
    case "optimization":
      pageContent = <OptimizationPage optimization={optimization} onWeightsChange={onWeightsChange} />;
      break;
    case "results":
      pageContent = <ResultsPage project={project} plan={plan} cost={cost} environment={environment} optimization={optimization} onOpenCAD={() => setPage("cad-floor-plan")} />;
      break;
    case "reports":
      pageContent = <ReportsPage project={project} plans={plans} cost={cost} quantities={quantities} environment={environment} />;
      break;
    case "saved-projects":
      pageContent = <SavedProjectsPage projects={projects} currentId={project.id} onOpen={onOpenProject} onDelete={onDeleteProject} onNewProject={onNewProject} />;
      break;
    case "settings":
      pageContent = <SettingsPage />;
      break;
    case "elevation":
      pageContent = <PlaceholderPage name="3D Elevation" description="Architectural visualization workspace." icon="◇" />;
      break;
    default:
      pageContent = (
        <DashboardPage
          project={project}
          plan={plan}
          cost={cost}
          environment={environment}
          onPage={setPage}
          onNewProject={onNewProject}
          onSave={onSave}
        />
      );
  }

  return (
    <div className={`app-shell ${sidebarOpen ? "sidebar-open" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">P<span>W</span></span>
          <div><strong>PlanWise <em>AI</em></strong><small>BUILDING PLANNER</small></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-navigation" aria-label="Main navigation">
          {NAV_GROUPS.map(([group, items]) => (
            <div className="nav-group" key={group}>
              <span className="nav-group-title">{group}</span>
              {items.map(([id, icon, label]) => (
                <button key={id} className={`nav-item ${activePage === id ? "active" : ""}`} onClick={() => setPage(id)}>
                  <span className="nav-icon">{icon}</span><span>{label}</span>
                  {id === "saved-projects" && projects.length > 0 && <small className="nav-count">{projects.length}</small>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="storage-status"><span className="status-dot" /><span><strong>Local workspace</strong><small>Projects saved in browser</small></span></div>
          <div className="profile-row"><span className="profile-avatar">M</span><span><strong>PlanWise User</strong><small>Building Planner</small></span><button aria-label="Settings" onClick={() => setPage("settings")}>···</button></div>
        </div>
      </aside>
      <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
            <div className="breadcrumb"><span>PlanWise AI</span><b>/</b><strong>{PAGE_TITLES[activePage] || "Dashboard"}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="project-indicator"><i className="status-dot" /><span>{project.projectName}</span></div>
            <div className="notification-wrap">
              <button className="notification-button" aria-label="Notifications" onClick={() => setNotification(!notification)}>♧</button>
              {notification && <div className="notification-popover"><strong>Workspace status</strong><p>Your project is stored locally in this browser.</p></div>}
            </div>
            <button className="topbar-user" onClick={() => setPage("settings")}><span className="profile-avatar small">M</span><span><strong>Planner</strong><small>Personal workspace</small></span></button>
          </div>
        </header>
        <div className="page-container">
          {formMessage && activePage !== "project-input" && <div className={`toast-message ${formMessage.type}`} role="status">{formMessage.text}<button aria-label="Dismiss" onClick={() => setFormMessage(null)}>×</button></div>}
          {pageContent}
          <footer className="app-footer"><span>PlanWise AI <b>·</b> Smart Building Planning</span><span>Indicative planning prototype</span></footer>
        </div>
      </main>
    </div>
  );
}
