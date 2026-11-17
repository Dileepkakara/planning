import { create } from "zustand";
import { createDemoProject, normalizeProject } from "../data/defaultProject.js";

const PROJECTS_KEY = "planwise_ai_projects";
const CURRENT_KEY = "planwise_ai_current_project";

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error(`Unable to read ${key} from local storage.`, error);
    return fallback;
  }
}

export function persistProjects(project, projects) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(project));
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function loadPersistedProjects() {
  const rawProjects = readJSON(PROJECTS_KEY, []);
  return Array.isArray(rawProjects) ? rawProjects.map(normalizeProject) : [];
}

export function loadCurrentProject() {
  const raw = readJSON(CURRENT_KEY, null);
  return raw ? normalizeProject(raw) : null;
}

export const useProjectStore = create((set, get) => ({
  project: createDemoProject(),
  projects: [],
  activePage: "dashboard",
  selectedFloor: "G",
  selectedAlternative: "balanced",
  sidebarOpen: false,
  initialize: () => {
    const projects = loadPersistedProjects();
    const persistedProject = loadCurrentProject();
    const project = persistedProject || createDemoProject();
    set({ projects, project });
    if (!persistedProject) get().saveProject(project);
  },
  updateProject: (updater) =>
    set((state) => ({
      project: normalizeProject(
        typeof updater === "function" ? updater(state.project) : updater,
      ),
    })),
  setProject: (project) => set({ project: normalizeProject(project) }),
  setPage: (activePage) => set({ activePage, sidebarOpen: false }),
  setFloor: (selectedFloor) => set({ selectedFloor }),
  setAlternative: (selectedAlternative) => set({ selectedAlternative }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  saveProject: (project = get().project) => {
    const normalized = normalizeProject(project);
    const existing = get().projects.filter((item) => item.id !== normalized.id);
    const projects = [normalized, ...existing];
    persistProjects(normalized, projects);
    set({ project: normalized, projects });
    return normalized;
  },
  deleteProject: (id) => {
    const projects = get().projects.filter((item) => item.id !== id);
    set({ projects });
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  },
  createProject: () => {
    const project = createDemoProject();
    set({ project, selectedFloor: "G", activePage: "project-input" });
    return project;
  },
}));
