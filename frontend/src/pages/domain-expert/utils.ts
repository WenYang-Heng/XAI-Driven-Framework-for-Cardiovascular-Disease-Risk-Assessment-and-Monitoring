import { featureLabels, featureMeta } from "./constants";
import type { FeatureContribution, FeatureKey } from "./types";

export function riskLabel(level?: string | null) {
  if (!level) {
    return "Pending";
  }
  return `${level.charAt(0).toUpperCase()}${level.slice(1)}`;
}

export function riskTone(level?: string | null): "green" | "amber" | "red" | "slate" {
  if (level === "high") {
    return "red";
  }
  if (level === "moderate") {
    return "amber";
  }
  if (level === "low") {
    return "green";
  }
  return "slate";
}

export function percent(value?: number | null, digits = 0) {
  return value === null || value === undefined ? "–" : `${(value * 100).toFixed(digits)}%`;
}

export function sortedByMagnitude(contributions: FeatureContribution[] = []) {
  return [...contributions].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

export function displayContributions(contributions: FeatureContribution[] = []) {
  return contributions.map((item) => ({
    ...item,
    featureLabel: featureLabels[item.feature] ?? item.feature,
  }));
}

export function formatFeatureValue(feature: string, value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Not recorded";
  }
  const meta = featureMeta[feature as FeatureKey];
  if (!meta) {
    return String(value);
  }
  if (meta.kind === "binary") {
    return value === 1 ? (meta.yes ?? "Yes") : (meta.no ?? "No");
  }
  return meta.unit ? `${value} ${meta.unit}` : String(value);
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "–";
  }
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function ageLabel(days: number | null | undefined) {
  if (days === null || days === undefined) {
    return null;
  }
  if (days < 1) {
    return "today";
  }
  if (days < 60) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  const months = Math.round(days / 30);
  return months < 24 ? `${months} months ago` : `${Math.round(days / 365)} years ago`;
}
