import { ROOM_OPTIONS, SUSTAINABILITY_OPTIONS } from "../data/defaultProject.js";
import { displayDimension, fromMetres, toMetres } from "../utils/units.js";

const SelectField = ({ id, label, value, options, onChange, required = false }) => (
  <div className="field">
    <label htmlFor={id}>{label}{required && " *"}</label>
    <select id={id} name={id} value={value} required={required} onChange={(event) => onChange(event.target.value)}>
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>{optionLabel}</option>
      ))}
    </select>
  </div>
);

const NumberField = ({ id, label, value, onChange, min = 0, step = 1, unit }) => (
  <div className="field">
    <label htmlFor={id}>{label}</label>
    <div className={`input-unit ${unit ? "has-unit" : ""}`}>
      <input
        id={id}
        name={id}
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {unit && <span>{unit}</span>}
    </div>
  </div>
);

function Card({ icon, eyebrow, title, description, children, className = "" }) {
  return (
    <section className={`form-card ${className}`}>
      <div className="form-card-heading">
        <span className="form-icon">{icon}</span>
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function CheckboxCard({ id, label, detail, checked, onChange, icon, name, value }) {
  return (
    <label className={`choice-card ${checked ? "is-selected" : ""}`} htmlFor={id}>
      <input id={id} name={name} value={value} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {icon && <span className="choice-icon">{icon}</span>}
      <span className="choice-copy">
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
      <span className="choice-check" aria-hidden="true">{checked ? "✓" : ""}</span>
    </label>
  );
}

export default function ProjectForm({ project, updateProject, onSubmit, onReset, message }) {
  const update = (path, value) => {
    updateProject((current) => {
      const next = structuredClone(current);
      const keys = path.split(".");
      let target = next;
      for (const key of keys.slice(0, -1)) target = target[key];
      target[keys.at(-1)] = value;
      if (path === "plot.length" || path === "plot.width") {
        next.plot.area = next.plot.length * next.plot.width;
      }
      return next;
    });
  };

  const unit = project.measurementUnit;
  const dimensionValue = (metres) => unit === "ft-in"
    ? undefined
    : Number(fromMetres(metres, unit).toFixed(2));
  const feetInches = (metres) => {
    const inches = metres / 0.0254;
    return { feet: Math.floor(inches / 12), inches: Number((inches % 12).toFixed(2)) };
  };
  const lengthParts = feetInches(project.plot.length);
  const widthParts = feetInches(project.plot.width);
  const setFeetInches = (axis, part, value) => {
    const current = axis === "length" ? lengthParts : widthParts;
    const feet = part === "feet" ? Number(value) || 0 : current.feet;
    const inches = part === "inches" ? Number(value) || 0 : current.inches;
    update(`plot.${axis}`, feet * 0.3048 + inches * 0.0254);
  };

  return (
    <form className="project-form" onSubmit={onSubmit}>
      {message && <div className={`form-message ${message.type}`}>{message.text}</div>}

      <Card icon="01" eyebrow="PROJECT" title="Project Information" description="Basic information about your building project.">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="projectName">Project Name *</label>
            <input id="projectName" name="projectName" value={project.projectName} required onChange={(event) => update("projectName", event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="projectLocation">Location *</label>
            <input id="projectLocation" name="projectLocation" value={project.location} required onChange={(event) => update("location", event.target.value)} />
          </div>
          <div className="field field-span">
            <label htmlFor="projectDescription">Project Description</label>
            <textarea id="projectDescription" name="projectDescription" rows="3" value={project.description} onChange={(event) => update("description", event.target.value)} />
          </div>
        </div>
      </Card>

      <Card icon="02" eyebrow="SITE" title="Site Information" description="Enter plot dimensions and site orientation.">
        <div className="form-grid">
          <SelectField id="measurementUnit" label="Measurement Unit" value={unit} onChange={(value) => update("measurementUnit", value)} options={[
            ["m", "Metres (m)"], ["ft", "Feet (ft)"], ["ft-in", "Feet + Inches"],
            ["yd", "Yards (yd)"], ["cm", "Centimetres (cm)"], ["in", "Inches (in)"],
          ]} />
          {unit === "ft-in" ? (
            <>
              <input type="hidden" id="plotLength" name="plotLength" value={project.plot.length} readOnly />
              <input type="hidden" id="plotWidth" name="plotWidth" value={project.plot.width} readOnly />
              <div className="field field-span">
                <label>Plot Length — Feet + Inches</label>
                <div className="split-inputs">
                  <input id="plotLengthFeet" aria-label="Plot length feet" type="number" min="0" step="1" value={lengthParts.feet} onChange={(event) => setFeetInches("length", "feet", event.target.value)} />
                  <input id="plotLengthInches" aria-label="Plot length inches" type="number" min="0" max="11.99" step="0.01" value={lengthParts.inches} onChange={(event) => setFeetInches("length", "inches", event.target.value)} />
                  <input id="plotWidthFeet" aria-label="Plot width feet" type="number" min="0" step="1" value={widthParts.feet} onChange={(event) => setFeetInches("width", "feet", event.target.value)} />
                  <input id="plotWidthInches" aria-label="Plot width inches" type="number" min="0" max="11.99" step="0.01" value={widthParts.inches} onChange={(event) => setFeetInches("width", "inches", event.target.value)} />
                </div>
                <small>Enter length feet/inches, then width feet/inches.</small>
              </div>
            </>
          ) : (
            <>
              <NumberField id="plotLength" label="Plot Length" value={dimensionValue(project.plot.length)} min={0.01} step={0.01} unit={unit} onChange={(value) => update("plot.length", toMetres(value, unit))} />
              <NumberField id="plotWidth" label="Plot Width" value={dimensionValue(project.plot.width)} min={0.01} step={0.01} unit={unit} onChange={(value) => update("plot.width", toMetres(value, unit))} />
            </>
          )}
          <div className="field">
            <label>Calculated Site Area</label>
            <output className="calculated-value" id="siteAreaDisplay">
              {formatAreaForForm(project.plot.area, project.displayUnit, unit)}
            </output>
          </div>
          <div className="field">
            <label>Internal CAD Dimension</label>
            <output className="calculated-value" id="metricDimensionsDisplay">
              {displayDimension(project.plot.length, "m")} × {displayDimension(project.plot.width, "m")}
            </output>
          </div>
          <SelectField id="displayUnit" label="Display Dimensions As" value={project.displayUnit} onChange={(value) => update("displayUnit", value)} options={[
            ["same", "Same as Input"], ["m", "Metres (m)"], ["ft", "Feet (ft)"],
            ["ft-in", "Feet + Inches"], ["yd", "Yards (yd)"], ["cm", "Centimetres (cm)"], ["in", "Inches (in)"],
          ]} />
          <SelectField id="plotShape" label="Plot Shape" value={project.plot.shape} onChange={(value) => update("plot.shape", value)} options={[
            ["rectangle", "Rectangle"], ["square", "Square"], ["irregular", "Irregular"],
          ]} />
          <SelectField id="roadDirection" label="Road Direction" value={project.orientation.roadDirection} onChange={(value) => update("orientation.roadDirection", value)} options={[
            ["east", "East"], ["west", "West"], ["north", "North"], ["south", "South"],
          ]} />
          <SelectField id="northDirection" label="North Direction" value={project.orientation.northDirection} onChange={(value) => update("orientation.northDirection", value)} options={[
            ["top", "Top / North"], ["right", "Right"], ["bottom", "Bottom"], ["left", "Left"],
          ]} />
          <div className="field field-span">
            <div className="subsection-title">Setbacks <span>metres</span></div>
            <div className="form-grid four-columns">
              <NumberField id="setbackFront" label="Road-side / Front" value={project.setbacks.front} step={0.1} unit="m" onChange={(value) => update("setbacks.front", Number(value))} />
              <NumberField id="setbackRear" label="Rear" value={project.setbacks.rear} step={0.1} unit="m" onChange={(value) => update("setbacks.rear", Number(value))} />
              <NumberField id="setbackLeft" label="Left" value={project.setbacks.left} step={0.1} unit="m" onChange={(value) => update("setbacks.left", Number(value))} />
              <NumberField id="setbackRight" label="Right" value={project.setbacks.right} step={0.1} unit="m" onChange={(value) => update("setbacks.right", Number(value))} />
            </div>
          </div>
        </div>
      </Card>

      <Card icon="03" eyebrow="BUILDING" title="Building Requirements" description="Define the basic building requirements.">
        <div className="form-grid">
          <SelectField id="buildingType" label="Building Type" value={project.building.type} onChange={(value) => update("building.type", value)} options={[
            ["residential", "Residential"], ["commercial", "Commercial"], ["mixed", "Mixed Use"],
          ]} />
          <SelectField id="numberOfFloors" label="Number of Floors" value={project.building.floors} onChange={(value) => update("building.floors", value)} options={[
            ["G", "Ground Floor"], ["G+1", "G + 1"], ["G+2", "G + 2"], ["G+3", "G + 3"],
          ]} />
          <NumberField id="bedrooms" label="Bedrooms" value={project.building.bedrooms} min={0} step={1} onChange={(value) => update("building.bedrooms", Number(value))} />
          <NumberField id="bathrooms" label="Bathrooms" value={project.building.bathrooms} min={0} step={1} onChange={(value) => update("building.bathrooms", Number(value))} />
          <SelectField id="parkingSpaces" label="Parking" value={String(project.building.parkingSpaces)} onChange={(value) => update("building.parkingSpaces", Number(value))} options={[
            ["0", "No Parking"], ["1", "1 Car"], ["2", "2 Cars"], ["3", "3 Cars"],
          ]} />
          <SelectField id="designStyle" label="Design Style" value={project.building.designStyle} onChange={(value) => update("building.designStyle", value)} options={[
            ["modern", "Modern"], ["contemporary", "Contemporary"], ["traditional", "Traditional"], ["luxury", "Luxury"],
          ]} />
        </div>
      </Card>

      <Card icon="04" eyebrow="ROOMS" title="Room Requirements" description="Select the spaces required in your building.">
        <div className="choice-grid room-choice-grid">
          {ROOM_OPTIONS.map(([key, label, detail]) => (
            <CheckboxCard
              key={key}
              id={`room-${key}`}
              label={label}
              detail={detail}
              checked={project.rooms[key]}
              onChange={(value) => update(`rooms.${key}`, value)}
              icon={key === "pooja" ? "✦" : undefined}
              name="rooms"
              value={{
                living: "living-room", dining: "dining-room", kitchen: "kitchen",
                masterBedroom: "master-bedroom", bedroom2: "bedroom-2",
                bedroom3: "bedroom-3", study: "study-room", utility: "utility-room",
                pooja: "pooja-gadhi",
              }[key]}
            />
          ))}
        </div>
        <p className="field-note">The Bedrooms and Bathrooms counts control how many of those spaces are generated.</p>
      </Card>

      <Card icon="05" eyebrow="VASTU" title="Vastu Planning" description="Use directional preferences as layout heuristics.">
        <label className="toggle-row" htmlFor="vastuEnabled">
          <span><strong>Enable Vastu Planning</strong><small>Influence room and main entrance placement.</small></span>
          <input id="vastuEnabled" name="vastuEnabled" type="checkbox" checked={project.vastu.enabled} onChange={(event) => update("vastu.enabled", event.target.checked)} />
        </label>
        {project.vastu.enabled && (
          <div className="form-grid vastu-grid">
            <SelectField id="vastuEntrance" label="Main Entrance" value={project.vastu.entrance} onChange={(value) => update("vastu.entrance", value)} options={[
              ["auto", "Auto according to Vastu"], ["north", "North"], ["east", "East"], ["west", "West"], ["south", "South"],
            ]} />
            <SelectField id="vastuKitchen" label="Kitchen" value={project.vastu.kitchen} onChange={(value) => update("vastu.kitchen", value)} options={[
              ["auto", "Auto according to Vastu"], ["southeast", "South-East"], ["northwest", "North-West"],
            ]} />
            <SelectField id="vastuMasterBedroom" label="Master Bedroom" value={project.vastu.masterBedroom} onChange={(value) => update("vastu.masterBedroom", value)} options={[
              ["auto", "Auto according to Vastu"], ["southwest", "South-West"], ["west", "West"],
            ]} />
            <SelectField id="vastuPooja" label="Pooja Gadhi" value={project.vastu.pooja} onChange={(value) => update("vastu.pooja", value)} options={[
              ["auto", "Auto according to Vastu"], ["northeast", "North-East"], ["north", "North"], ["east", "East"],
            ]} />
            <SelectField id="vastuStaircase" label="Staircase" value={project.vastu.staircase} onChange={(value) => update("vastu.staircase", value)} options={[
              ["auto", "Auto according to Vastu"], ["south", "South"], ["west", "West"], ["southwest", "South-West"],
            ]} />
            <SelectField id="vastuToilet" label="Toilet" value={project.vastu.toilet} onChange={(value) => update("vastu.toilet", value)} options={[
              ["auto", "Auto according to Vastu"], ["northwest", "North-West"], ["west", "West"], ["southeast", "South-East"],
            ]} />
          </div>
        )}
        <p className="field-note">Vastu placement is a prototype heuristic, not architectural or regulatory certification.</p>
      </Card>

      <Card icon="06" eyebrow="COST" title="Construction Budget" description="Set an approximate construction budget and quality.">
        <div className="form-grid">
          <NumberField id="constructionBudget" label="Budget" value={project.budget.amount} min={0} step={10000} unit="₹" onChange={(value) => update("budget.amount", Number(value))} />
          <SelectField id="constructionQuality" label="Construction Quality" value={project.budget.quality} onChange={(value) => update("budget.quality", value)} options={[
            ["economy", "Economy"], ["standard", "Standard"], ["premium", "Premium"], ["luxury", "Luxury"],
          ]} />
        </div>
      </Card>

      <Card icon="07" eyebrow="SUSTAINABILITY" title="Environmental Requirements" description="Select sustainable building features.">
        <div className="choice-grid sustainability-grid">
          {SUSTAINABILITY_OPTIONS.map(([key, label, detail, icon]) => (
            <CheckboxCard key={key} id={`sustainability-${key}`} name="sustainability" value={{
              naturalLight: "natural-light", naturalVentilation: "natural-ventilation",
              rainwater: "rainwater", solar: "solar", greenMaterials: "green-materials",
              energyEfficiency: "energy-efficiency",
            }[key]} label={label} detail={detail} icon={icon} checked={project.sustainability[key]} onChange={(value) => update(`sustainability.${key}`, value)} />
          ))}
        </div>
      </Card>

      <div className="form-actions">
        <button type="button" className="button button-secondary" onClick={onReset}>Reset</button>
        <button type="submit" className="button button-primary">Continue to CAD Floor Plan <span aria-hidden="true">→</span></button>
      </div>
    </form>
  );
}

function formatAreaForForm(area, displayUnit, inputUnit) {
  const unit = displayUnit === "same" ? inputUnit : displayUnit;
  if (unit === "ft-in") return `${(area * 10.7639).toLocaleString("en-IN", { maximumFractionDigits: 2 })} sq.ft`;
  if (unit === "ft") return `${(area * 10.7639).toLocaleString("en-IN", { maximumFractionDigits: 2 })} sq.ft`;
  if (unit === "yd") return `${(area * 1.19599).toLocaleString("en-IN", { maximumFractionDigits: 2 })} sq.yd`;
  if (unit === "cm") return `${(area * 10000).toLocaleString("en-IN", { maximumFractionDigits: 0 })} cm²`;
  if (unit === "in") return `${(area * 1550.003).toLocaleString("en-IN", { maximumFractionDigits: 0 })} sq.in`;
  return `${area.toLocaleString("en-IN", { maximumFractionDigits: 2 })} m²`;
}
