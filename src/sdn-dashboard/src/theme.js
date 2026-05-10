// Design tokens — single source of truth for colours used across the dashboard.
// If you tweak the palette, change here and every component picks it up.

export const COLORS = {
  // Surfaces
  bg: "#FAFAF7",
  sidebar: "#E5E5E0",
  white: "#FFFFFF",

  // Strokes & text
  panelBorder: "#1F1F1F",
  ink: "#1F1F1F",
  inkSoft: "#4A4A4A",

  // Status palette
  ok: "#2D8F47",
  okBg: "#D4F4DC",
  error: "#C8312E",
  errorBg: "#FCDCDC",
  warning: "#E89A2C",
  info: "#6B3FA0",

  // Metric value tints (per Figma)
  metricLatency: "#6B3FA0",
  metricThroughput: "#2563EB",
  metricLoss: "#C8312E",
  metricFaults: "#C8312E",

  // Topology
  linkColor: "#1F1F1F",
  linkFailed: "#C8312E",
  controlLink: "#9CA3AF",
};
