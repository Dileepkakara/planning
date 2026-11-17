
/* =========================================================
   PLANWISE AI - COMPLETE JAVASCRIPT
   Keeps your existing index.html and style.css.
   ========================================================= */

"use strict";

/* ---------- APPLICATION DATA ---------- */

const PlanWise = {
    project: {},
    savedProjects: [],
    currentPage: "dashboard",
    zoom: 1
};

const STORAGE_KEY = "planwise_ai_projects";
const CURRENT_PROJECT_KEY = "planwise_ai_current_project";

const $ = (id) => document.getElementById(id);

function getValue(id, fallback = "") {
    const element = $(id);
    return element ? element.value : fallback;
}

function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
}

function showMessage(message, type = "success") {
    const box = $("projectFormMessage");

    if (box) {
        box.textContent = message;
        box.className = "form-message " + type;
        box.style.display = "block";

        setTimeout(() => {
            box.style.display = "none";
        }, 4000);
    } else {
        alert(message);
    }
}

/* ---------- UNIT CONVERSION ---------- */

function toMetres(value, unit) {
    value = Number(value) || 0;

    switch (unit) {
        case "ft":
        case "feet":
            return value * 0.3048;

        case "yd":
        case "yards":
            return value * 0.9144;

        case "cm":
            return value / 100;

        case "mm":
            return value / 1000;

        case "in":
        case "inches":
            return value * 0.0254;

        default:
            return value;
    }
}

function fromMetres(value, unit) {
    switch (unit) {
        case "ft":
        case "feet":
            return value / 0.3048;

        case "yd":
        case "yards":
            return value / 0.9144;

        case "cm":
            return value * 100;

        case "mm":
            return value * 1000;

        case "in":
        case "inches":
            return value / 0.0254;

        default:
            return value;
    }
}

function getPlotLengthMetres() {
    const unit = getValue("measurementUnit", "m");

    if (unit === "ft-in") {
        const feet = Number(getValue("plotLengthFeet", 0)) || 0;
        const inches = Number(getValue("plotLengthInches", 0)) || 0;
        return (feet * 0.3048) + (inches * 0.0254);
    }

    return toMetres(getValue("plotLength", 0), unit);
}

function getPlotWidthMetres() {
    const unit = getValue("measurementUnit", "m");

    if (unit === "ft-in") {
        const feet = Number(getValue("plotWidthFeet", 0)) || 0;
        const inches = Number(getValue("plotWidthInches", 0)) || 0;
        return (feet * 0.3048) + (inches * 0.0254);
    }

    return toMetres(getValue("plotWidth", 0), unit);
}

function formatNumber(value, digits = 2) {
    return Number(value || 0).toLocaleString("en-IN", {
        maximumFractionDigits: digits,
        minimumFractionDigits: 0
    });
}

function getDisplayArea(areaInSqMetres) {
    const unit = getValue("displayUnit", "m2");

    if (unit === "ft2" || unit === "sqft") {
        return {
            value: areaInSqMetres * 10.7639,
            label: "sq.ft"
        };
    }

    if (unit === "yd2" || unit === "sqyd") {
        return {
            value: areaInSqMetres * 1.19599,
            label: "sq.yd"
        };
    }

    return {
        value: areaInSqMetres,
        label: "m²"
    };
}

/* ---------- LIVE AREA CALCULATION ---------- */

function updateSiteArea() {
    const length = getPlotLengthMetres();
    const width = getPlotWidthMetres();

    const area = length * width;
    const display = getDisplayArea(area);

    const areaElement = $("siteAreaDisplay");

    if (areaElement) {
        areaElement.textContent =
            formatNumber(display.value) + " " + display.label;
    }

    const metricElement = $("metricDimensionsDisplay");

    if (metricElement) {
        metricElement.textContent =
            formatNumber(length) + " m × " +
            formatNumber(width) + " m";
    }

    return {
        lengthMetres: length,
        widthMetres: width,
        areaSquareMetres: area
    };
}

function updateUnitLabels() {
    const unit = getValue("measurementUnit", "m");

    let label = "m";

    if (unit === "ft") label = "ft";
    if (unit === "yd") label = "yd";
    if (unit === "cm") label = "cm";
    if (unit === "mm") label = "mm";
    if (unit === "in") label = "in";
    if (unit === "ft-in") label = "ft / in";

    setText("plotLengthUnit", label);
    setText("plotWidthUnit", label);

    document.querySelectorAll("[data-unit-label]").forEach(element => {
        element.textContent = label;
    });

    updateSiteArea();
}

/* ---------- PROJECT INPUT ---------- */

function collectProjectData() {
    const dimensions = updateSiteArea();

    const project = {
        id: Date.now(),
        projectName: getValue("projectName", "My Building Project"),
        location: getValue("projectLocation"),
        description: getValue("projectDescription"),

        measurementUnit: getValue("measurementUnit", "m"),
        displayUnit: getValue("displayUnit", "m2"),

        plotLength: dimensions.lengthMetres,
        plotWidth: dimensions.widthMetres,
        plotArea: dimensions.areaSquareMetres,

        plotShape: getValue("plotShape", "rectangle"),
        buildingType: getValue("buildingType", "Residential"),
        floors: getValue("numberOfFloors", "G+1"),

        bedrooms: Number(getValue("bedrooms", 2)) || 0,
        bathrooms: Number(getValue("bathrooms", 2)) || 0,
        parking: getValue("parkingSpaces", "1"),

        designStyle: getValue("designStyle", "Modern"),

        vastuEnabled: $("vastuEnabled")
            ? $("vastuEnabled").checked
            : false,

        vastuEntrance: getValue("vastuEntrance"),
        vastuKitchen: getValue("vastuKitchen"),
        vastuMasterBedroom: getValue("vastuMasterBedroom"),
        vastuPooja: getValue("vastuPooja"),
        vastuStaircase: getValue("vastuStaircase"),
        vastuToilet: getValue("vastuToilet"),

        updatedAt: new Date().toISOString()
    };

    return project;
}

function validateProject(project) {
    if (!project.projectName.trim()) {
        showMessage("Please enter your project name.", "error");
        $("projectName")?.focus();
        return false;
    }

    if (project.plotLength <= 0 || project.plotWidth <= 0) {
        showMessage("Please enter valid plot length and width.", "error");
        return false;
    }

    if (project.bedrooms < 0 || project.bathrooms < 0) {
        showMessage("Please enter valid bedroom and bathroom numbers.", "error");
        return false;
    }

    return true;
}

function saveCurrentProject() {
    if (!PlanWise.project || !PlanWise.project.projectName) {
        return;
    }

    localStorage.setItem(
        CURRENT_PROJECT_KEY,
        JSON.stringify(PlanWise.project)
    );

    const existingIndex = PlanWise.savedProjects.findIndex(
        item => item.id === PlanWise.project.id
    );

    if (existingIndex >= 0) {
        PlanWise.savedProjects[existingIndex] = PlanWise.project;
    } else {
        PlanWise.savedProjects.push(PlanWise.project);
    }

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(PlanWise.savedProjects)
    );
}

function loadSavedProjects() {
    try {
        PlanWise.savedProjects =
            JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (error) {
        PlanWise.savedProjects = [];
    }
}

function loadCurrentProject() {
    try {
        const data = JSON.parse(
            localStorage.getItem(CURRENT_PROJECT_KEY)
        );

        if (data) {
            PlanWise.project = data;
        }
    } catch (error) {
        PlanWise.project = {};
    }
}

function fillProjectForm(project) {
    if (!project) return;

    const fields = {
        projectName: project.projectName,
        projectLocation: project.location,
        projectDescription: project.description,
        plotShape: project.plotShape,
        buildingType: project.buildingType,
        numberOfFloors: project.floors,
        bedrooms: project.bedrooms,
        bathrooms: project.bathrooms,
        parkingSpaces: project.parking,
        designStyle: project.designStyle,
        vastuEntrance: project.vastuEntrance,
        vastuKitchen: project.vastuKitchen,
        vastuMasterBedroom: project.vastuMasterBedroom,
        vastuPooja: project.vastuPooja,
        vastuStaircase: project.vastuStaircase,
        vastuToilet: project.vastuToilet
    };

    Object.entries(fields).forEach(([id, value]) => {
        const element = $(id);

        if (element && value !== undefined && value !== null) {
            element.value = value;
        }
    });

    if ($("vastuEnabled")) {
        $("vastuEnabled").checked = Boolean(project.vastuEnabled);
    }

    const unit = $("measurementUnit");

    if (unit && project.measurementUnit) {
        unit.value = project.measurementUnit;
    }

    const length = Number(project.plotLength) || 0;
    const width = Number(project.plotWidth) || 0;

    if (getValue("measurementUnit") === "ft-in") {
        setFeetInches("plotLength", length);
        setFeetInches("plotWidth", width);
    } else {
        const selectedUnit = getValue("measurementUnit", "m");

        if ($("plotLength")) {
            $("plotLength").value = fromMetres(length, selectedUnit).toFixed(2);
        }

        if ($("plotWidth")) {
            $("plotWidth").value = fromMetres(width, selectedUnit).toFixed(2);
        }
    }

    updateUnitLabels();
    updateSiteArea();
}

function setFeetInches(prefix, metres) {
    const totalInches = metres / 0.0254;
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches - (feet * 12);

    const feetInput = $(prefix + "Feet");
    const inchesInput = $(prefix + "Inches");

    if (feetInput) feetInput.value = feet;
    if (inchesInput) inchesInput.value = inches.toFixed(1);
}

/* ---------- PAGE NAVIGATION ---------- */

const PAGE_NAMES = {
    dashboard: "Dashboard",
    "project-input": "Project Input",
    "cad-floor-plan": "CAD Floor Plan",
    elevation: "3D Elevation",
    "alternative-plans": "Alternative Plans",
    cost: "Cost Estimation",
    environment: "Environmental Impact",
    optimization: "Optimization",
    results: "Results",
    reports: "Reports",
    "saved-projects": "Saved Projects",
    settings: "Settings"
};

function showPage(pageName) {
    const page = $("page-" + pageName);

    if (!page) {
        console.warn("PlanWise AI: Page not found:", pageName);
        return;
    }

    document.querySelectorAll(".page").forEach(section => {
        section.classList.remove("active");
    });

    page.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(button => {
        button.classList.remove("active");

        if (button.dataset.page === pageName) {
            button.classList.add("active");
        }
    });

    PlanWise.currentPage = pageName;

    if ($("pageTitle")) {
        $("pageTitle").textContent = PAGE_NAMES[pageName] || pageName;
    }

    closeSidebar();

    if (pageName === "cad-floor-plan") {
        updateCADInformation();
    }

    if (pageName === "saved-projects") {
        renderSavedProjects();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function initializeNavigation() {
    document.querySelectorAll(".nav-item").forEach(button => {
        button.addEventListener("click", () => {
            const page = button.dataset.page;

            if (page) showPage(page);
        });
    });
}

/* ---------- SIDEBAR ---------- */

function openSidebar() {
    document.querySelector(".sidebar")?.classList.add("active");
    $("sidebarOverlay")?.classList.add("active");
}

function closeSidebar() {
    document.querySelector(".sidebar")?.classList.remove("active");
    $("sidebarOverlay")?.classList.remove("active");
}

function initializeSidebar() {
    $("sidebarOverlay")?.addEventListener("click", closeSidebar);

    document.querySelectorAll(
        ".menu-toggle, .sidebar-toggle, #menuToggle"
    ).forEach(button => {
        button.addEventListener("click", openSidebar);
    });
}

/* ---------- PROJECT FORM ---------- */

function initializeProjectInput() {
    const form = $("projectForm");

    if (form) {
        form.addEventListener("submit", event => {
            event.preventDefault();

            const project = collectProjectData();

            if (!validateProject(project)) return;

            PlanWise.project = project;
            saveCurrentProject();

            updateCADInformation();
            showMessage("Project details saved successfully!");

            showPage("cad-floor-plan");
        });
    }

    [
        "plotLength",
        "plotWidth",
        "plotLengthFeet",
        "plotLengthInches",
        "plotWidthFeet",
        "plotWidthInches"
    ].forEach(id => {
        $(id)?.addEventListener("input", updateSiteArea);
    });

    $("measurementUnit")?.addEventListener("change", () => {
        updateUnitLabels();
    });

    $("displayUnit")?.addEventListener("change", updateSiteArea);

    $("vastuEnabled")?.addEventListener("change", event => {
        const options = $("vastuOptions");

        if (options) {
            options.style.display = event.target.checked ? "block" : "none";
        }
    });

    $("resetProjectForm")?.addEventListener("click", resetProjectForm);
    $("resetProjectFormSecondary")?.addEventListener(
        "click",
        resetProjectForm
    );

    updateUnitLabels();
}

function resetProjectForm() {
    const form = $("projectForm");

    if (form) form.reset();

    updateUnitLabels();

    const options = $("vastuOptions");

    if (options) options.style.display = "none";

    showMessage("Project form has been reset.");
}

/* ---------- CAD INFORMATION ---------- */

function updateCADInformation() {
    const project = PlanWise.project;

    if (!project || !project.projectName) return;

    const length = Number(project.plotLength) || 0;
    const width = Number(project.plotWidth) || 0;
    const area = length * width;

    const floors = String(project.floors || "G+1");
    const floorCount = getFloorCount(floors);
    const builtArea = area * floorCount;

    setText("cadProjectName", project.projectName);
    setText(
        "cadPlotSize",
        formatNumber(length) + " m × " + formatNumber(width) + " m"
    );
    setText("cadUnit", "Metres");
    setText("cadBedrooms", project.bedrooms || 0);
    setText("cadFloors", floors);

    setText("cadPlotLength", formatNumber(length) + " m");
    setText("cadPlotWidth", formatNumber(width) + " m");
    setText("cadPlotArea", formatNumber(area) + " m²");
    setText("cadBuiltArea", formatNumber(builtArea) + " m²");
    setText("cadBedroomsSecondary", project.bedrooms || 0);
    setText("cadParking", project.parking || "0");

    updateCADSummary();
}

function getFloorCount(floorValue) {
    const value = String(floorValue).toUpperCase();

    if (value.includes("G+")) {
        const extraFloors = Number(value.split("G+")[1]) || 0;
        return 1 + extraFloors;
    }

    const number = Number(value.replace(/\D/g, ""));

    return number > 0 ? number : 1;
}

function updateCADSummary() {
    if (!PlanWise.project || !PlanWise.project.projectName) return;

    updateCADInformationWithoutSummary();
}

function updateCADInformationWithoutSummary() {
    const project = PlanWise.project;

    const length = Number(project.plotLength) || 0;
    const width = Number(project.plotWidth) || 0;
    const area = length * width;

    setText("cadPlotArea", formatNumber(area) + " m²");
}

/* ---------- CAD ZOOM AND PRINT ---------- */

function applyCADZoom() {
    const drawing = $("cadPlan");

    if (!drawing) return;

    drawing.style.transform = "scale(" + PlanWise.zoom + ")";
    drawing.style.transformOrigin = "center center";
}

function initializeCAD() {
    $("cadZoomIn")?.addEventListener("click", () => {
        PlanWise.zoom = Math.min(PlanWise.zoom + 0.1, 2);
        applyCADZoom();
    });

    $("cadZoomOut")?.addEventListener("click", () => {
        PlanWise.zoom = Math.max(PlanWise.zoom - 0.1, 0.5);
        applyCADZoom();
    });

    $("cadZoomReset")?.addEventListener("click", () => {
        PlanWise.zoom = 1;
        applyCADZoom();
    });

    $("fitCadPlan")?.addEventListener("click", () => {
        PlanWise.zoom = 1;
        applyCADZoom();
    });

    $("resetCadPlan")?.addEventListener("click", () => {
        PlanWise.zoom = 1;
        applyCADZoom();
    });

    $("cadPrintBtn")?.addEventListener("click", () => {
        window.print();
    });
}

/* ---------- DASHBOARD BUTTON ---------- */

function openCADFromProjectInput() {
    const project = collectProjectData();

    if (!validateProject(project)) {
        showPage("project-input");
        return;
    }

    PlanWise.project = project;
    saveCurrentProject();
    updateCADInformation();
    showPage("cad-floor-plan");
}

/* Make the inline HTML onclick function available. */
window.openCADFromProjectInput = openCADFromProjectInput;

/* ---------- SAVED PROJECTS ---------- */

function renderSavedProjects() {
    const container =
        $("savedProjectsList") ||
        $("savedProjectsContainer") ||
        $("savedProjectsTableBody");

    if (!container) return;

    loadSavedProjects();

    if (PlanWise.savedProjects.length === 0) {
        container.innerHTML =
            '<p class="empty-message">No saved projects yet.</p>';
        return;
    }

    container.innerHTML = "";

    PlanWise.savedProjects.forEach(project => {
        const item = document.createElement("div");
        item.className = "saved-project-item";

        const title = document.createElement("h3");
        title.textContent = project.projectName || "Untitled Project";

        const details = document.createElement("p");
        details.textContent =
            formatNumber(project.plotLength) + " m × " +
            formatNumber(project.plotWidth) + " m · " +
            formatNumber(project.plotArea) + " m²";

        const openButton = document.createElement("button");
        openButton.type = "button";
        openButton.textContent = "Open Project";
        openButton.addEventListener("click", () => {
            PlanWise.project = project;
            fillProjectForm(project);
            updateCADInformation();
            showPage("project-input");
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => {
            deleteSavedProject(project.id);
        });

        item.append(title, details, openButton, deleteButton);
        container.appendChild(item);
    });
}

function deleteSavedProject(projectId) {
    const confirmed = confirm("Delete this saved project?");

    if (!confirmed) return;

    PlanWise.savedProjects = PlanWise.savedProjects.filter(
        project => project.id !== projectId
    );

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(PlanWise.savedProjects)
    );

    renderSavedProjects();
}

/* ---------- OTHER PAGE INITIALIZERS ---------- */

function initializeElevation() {
    // Elevation page is kept as designed in your HTML.
    // A real 3D elevation generator requires a separate drawing engine.
}

function initializeCostEstimation() {
    // Cost estimation page remains available.
}

function initializeEnvironmentalImpact() {
    // Environmental impact page remains available.
}

function initializeOptimization() {
    // Optimization page remains available.
}

function initializeReports() {
    // Reports page remains available.
}

function initializeSavedProjects() {
    renderSavedProjects();
}

function initializeSettings() {
    // Settings page remains available.
}

/* ---------- START APPLICATION ---------- */

function initializeApplication() {
    loadSavedProjects();
    loadCurrentProject();

    initializeNavigation();
    initializeSidebar();
    initializeProjectInput();
    initializeCAD();

    initializeElevation();
    initializeCostEstimation();
    initializeEnvironmentalImpact();
    initializeOptimization();
    initializeReports();
    initializeSavedProjects();
    initializeSettings();

    if (PlanWise.project && PlanWise.project.projectName) {
        updateCADInformation();
    }

    console.log("PlanWise AI JavaScript loaded successfully.");
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeApplication
    );
} else {
    initializeApplication();
}



/* =========================================================
   PLANWISE AI - VASTU MAIN ENTRANCE
   Supports East, West, North and South road directions.
   ========================================================= */

(function () {
    "use strict";

    function applyVastuDoorPlacement() {
        const outerWall = document.querySelector(".cad-outer-wall");
        if (!outerWall) return;

        const roadDirection =
            (document.getElementById("roadDirection")?.value || "east")
                .toLowerCase();

        const northDirection =
            (document.getElementById("northDirection")?.value || "top")
                .toLowerCase();

        const directionMap = {
            top: {
                north: "top",
                east: "right",
                south: "bottom",
                west: "left"
            },
            right: {
                north: "right",
                east: "bottom",
                south: "left",
                west: "top"
            },
            bottom: {
                north: "bottom",
                east: "left",
                south: "top",
                west: "right"
            },
            left: {
                north: "left",
                east: "top",
                south: "right",
                west: "bottom"
            }
        };

        const directions =
            directionMap[northDirection] || directionMap.top;

        const roadSide =
            directions[roadDirection] || "right";

        // Remove old Vastu entrance.
        outerWall
            .querySelectorAll(".vastu-main-entry, .vastu-entry-label")
            .forEach(element => element.remove());

        // Keep the entrance inside the clipped outer wall.
        const positions = {
            top: {
                left: "72%",
                top: "0px",
                rotation: "0deg",
                labelLeft: "65%",
                labelTop: "35px"
            },
            right: {
                left: "calc(100% - 72px)",
                top: "12%",
                rotation: "90deg",
                labelLeft: "calc(100% - 145px)",
                labelTop: "12%"
            },
            bottom: {
                left: "12%",
                top: "calc(100% - 72px)",
                rotation: "180deg",
                labelLeft: "10%",
                labelTop: "calc(100% - 45px)"
            },
            left: {
                left: "0px",
                top: "12%",
                rotation: "270deg",
                labelLeft: "38px",
                labelTop: "12%"
            }
        };

        const position = positions[roadSide];

        const door = document.createElement("div");
        door.className = "vastu-main-entry";
        door.setAttribute("aria-label", "Vastu main entrance");
        door.title =
            "Main entrance - " + roadDirection.toUpperCase() + " road";

        door.innerHTML = `
            <svg viewBox="0 0 64 64"
                 width="64" height="64"
                 xmlns="http://www.w3.org/2000/svg">
                <path d="M6 8 L58 8"
                      stroke="white"
                      stroke-width="13"/>
                <path d="M6 8 L6 56"
                      stroke="#111827"
                      stroke-width="2.5"
                      fill="none"/>
                <path d="M6 56 A48 48 0 0 1 54 8"
                      stroke="#555"
                      stroke-width="1.5"
                      fill="none"/>
            </svg>
        `;

        Object.assign(door.style, {
            position: "absolute",
            left: position.left,
            top: position.top,
            width: "64px",
            height: "64px",
            zIndex: "100",
            transform: "rotate(" + position.rotation + ")",
            pointerEvents: "none"
        });

        const label = document.createElement("span");
        label.className = "vastu-entry-label";
        label.textContent = "MAIN ENTRY";

        Object.assign(label.style, {
            position: "absolute",
            left: position.labelLeft,
            top: position.labelTop,
            zIndex: "101",
            padding: "3px 6px",
            background: "#e8f3ff",
            color: "#0756a5",
            border: "1px solid #1976d2",
            borderRadius: "4px",
            fontSize: "10px",
            fontWeight: "700",
            whiteSpace: "nowrap",
            pointerEvents: "none"
        });

        outerWall.appendChild(door);
        outerWall.appendChild(label);

        // Update the North arrow.
        const northArrow = document.querySelector(".north-arrow");

        if (northArrow) {
            const rotations = {
                top: "0deg",
                right: "90deg",
                bottom: "180deg",
                left: "270deg"
            };

            northArrow.style.transform =
                "rotate(" + (rotations[northDirection] || "0deg") + ")";
        }

        // Save road and orientation in the current project.
        if (typeof PlanWise !== "undefined" && PlanWise.project) {
            PlanWise.project.roadDirection = roadDirection;
            PlanWise.project.northDirection = northDirection;

            if (typeof saveCurrentProject === "function") {
                saveCurrentProject();
            }
        }

        console.log(
            "PlanWise Vastu entrance:",
            roadDirection,
            "road, drawing side:",
            roadSide
        );
    }

    // Make the function available to the rest of the application.
    window.applyVastuDoorPlacement = applyVastuDoorPlacement;

    function initializeVastuDoorPlacement() {
        document.getElementById("roadDirection")
            ?.addEventListener("change", applyVastuDoorPlacement);

        document.getElementById("northDirection")
            ?.addEventListener("change", applyVastuDoorPlacement);

        // Reapply when the user opens the CAD page.
        document.querySelectorAll(".nav-item").forEach(button => {
            button.addEventListener("click", () => {
                if (button.dataset.page === "cad-floor-plan") {
                    requestAnimationFrame(applyVastuDoorPlacement);
                }
            });
        });

        // Reapply when either Continue button is used.
        document.getElementById("continueToCADBtn")
            ?.addEventListener("click", () => {
                setTimeout(applyVastuDoorPlacement, 100);
            });

        document.getElementById("projectForm")
            ?.addEventListener("submit", () => {
                setTimeout(applyVastuDoorPlacement, 100);
            });

        applyVastuDoorPlacement();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeVastuDoorPlacement
        );
    } else {
        initializeVastuDoorPlacement();
    }
})();
