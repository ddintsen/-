import { create } from "zustand";
import {
  type ApiConfig,
  type DashboardData,
  type Source,
  parseData,
  validateEndpoint,
} from "../api/schema";
import {
  baseline,
  makeScenario,
  simulateTick,
  type Scenario,
} from "../api/scenarios";
import { loadData } from "../api/client";

const storageKey = "orbita-demo-v1",
  configKey = "orbita-config-v1";
const initialConfig: ApiConfig = {
  mode: "mock",
  url: "",
  token: "",
  pollingSec: 30,
};
let initialData = structuredClone(baseline);
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) initialData = parseData(JSON.parse(saved));
  const raw = localStorage.getItem(configKey);
  if (raw) {
    const s = JSON.parse(raw);
    if (["mock", "hybrid", "live"].includes(s.mode))
      initialConfig.mode = s.mode;
    if (typeof s.url === "string" && !validateEndpoint(s.url))
      initialConfig.url = s.url;
    if ([0, 5, 15, 30, 60].includes(s.pollingSec))
      initialConfig.pollingSec = s.pollingSec;
  }
} catch {
  /* Storage is optional. */
}
let channel: BroadcastChannel | null = null;
let sequence = 0,
  active: AbortController | null = null;
function invalidate() {
  sequence++;
  active?.abort();
  active = null;
}
function publishDemo(data: DashboardData) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    useDashboardStore.setState({
      notice:
        "Данные применены в этой вкладке. Локальное сохранение недоступно.",
    });
  }
  channel?.postMessage({ type: "demo", data });
}
interface State {
  data: DashboardData | null;
  mock: DashboardData;
  lastLive: DashboardData | null;
  source: Source;
  error: string | null;
  config: ApiConfig;
  busy: boolean;
  updatedAt: number | null;
  latency: number | null;
  compact: boolean;
  theme: "office" | "dark";
  simulation: boolean;
  revision: number;
  notice: string | null;
  refresh: () => Promise<void>;
  setConfig: (config: ApiConfig) => void;
  applyDemo: (data: DashboardData) => void;
  scenario: (scenario: Scenario) => void;
  toggleSimulation: () => void;
  tick: () => void;
}
export const useDashboardStore = create<State>((set, get) => ({
  data: initialConfig.mode === "live" ? null : initialData,
  mock: initialData,
  lastLive: null,
  source: initialConfig.mode === "live" ? "error" : "mock",
  error: null,
  config: initialConfig,
  busy: false,
  updatedAt: null,
  latency: null,
  compact: true,
  theme: "office",
  simulation: false,
  revision: 0,
  notice: null,
  refresh: async () => {
    invalidate();
    const seq = sequence;
    active = new AbortController();
    const signal = active.signal;
    set({ busy: true });
    const s = get();
    try {
      const result = await loadData(s.config, s.mock, s.lastLive, signal);
      if (seq !== sequence) return;
      set({
        ...result,
        busy: false,
        updatedAt:
          result.source === "live" || result.source === "mock"
            ? Date.now()
            : get().updatedAt,
        ...(result.source === "live" ? { lastLive: result.data } : {}),
      });
    } catch {
      if (seq === sequence) set({ busy: false });
    }
  },
  setConfig: (config) => {
    invalidate();
    try {
      const { token: _, ...safe } = config;
      localStorage.setItem(configKey, JSON.stringify(safe));
    } catch {
      set({
        notice: "Настройки действуют в этой вкладке; сохранение недоступно.",
      });
    }
    set({
      config,
      simulation: false,
      lastLive: null,
      updatedAt: null,
      data: config.mode === "live" ? null : get().mock,
      error: null,
      source: config.mode === "mock" ? "mock" : "error",
    });
    void get().refresh();
  },
  applyDemo: (data) => {
    const valid = parseData(data);
    invalidate();
    set((s) => ({
      data: valid,
      mock: valid,
      source: "mock",
      error: null,
      config: { ...s.config, mode: "mock" },
      busy: false,
      simulation: false,
      updatedAt: Date.now(),
      revision: s.revision + 1,
    }));
    try {
      const { token: _, ...safe } = get().config;
      localStorage.setItem(configKey, JSON.stringify(safe));
    } catch {
      /* Optional persistence. */
    }
    publishDemo(valid);
  },
  scenario: (scenario) => get().applyDemo(makeScenario(scenario)),
  toggleSimulation: () => {
    if (get().config.mode !== "mock") return;
    const next = !get().simulation;
    if (next) channel?.postMessage({ type: "simulation-owner" });
    set({ simulation: next, source: next ? "simulation" : "mock" });
  },
  tick: () => {
    if (!get().simulation || get().config.mode !== "mock") return;
    const d = simulateTick(get().mock);
    set((s) => ({
      data: d,
      mock: d,
      source: "simulation",
      updatedAt: Date.now(),
      revision: s.revision + 1,
    }));
    publishDemo(d);
  },
}));
export function startSync() {
  const onData = (data: unknown) => {
    try {
      const d = parseData(data);
      if (useDashboardStore.getState().config.mode !== "mock") return;
      invalidate();
      useDashboardStore.setState((s) => ({
        mock: d,
        data: d,
        source: s.simulation ? "simulation" : "mock",
        busy: false,
        error: null,
        updatedAt: Date.now(),
        revision: s.revision + 1,
      }));
    } catch {
      /* Invalid peer message ignored. */
    }
  };
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("vr_analytics_channel");
    channel.onmessage = (e) => {
      if (e.data?.type === "demo") onData(e.data.data);
      if (
        e.data?.type === "simulation-owner" &&
        useDashboardStore.getState().config.mode === "mock"
      )
        useDashboardStore.setState({ simulation: false, source: "mock" });
    };
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === storageKey && e.newValue) {
      try {
        onData(JSON.parse(e.newValue));
      } catch {
        /* Invalid storage ignored. */
      }
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    channel?.close();
    channel = null;
    invalidate();
  };
}
