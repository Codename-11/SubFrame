import type { LucideIcon } from 'lucide-react';
import {
  BriefcaseBusiness,
  Code2,
  Database,
  FlaskConical,
  FolderKanban,
  House,
  Layers3,
  Palette,
  Rocket,
  Smartphone,
  Wrench,
} from 'lucide-react';

export const WORKSPACE_ICON_OPTIONS = [
  { value: 'briefcase', label: 'Briefcase', icon: BriefcaseBusiness },
  { value: 'folder', label: 'Folder', icon: FolderKanban },
  { value: 'code', label: 'Code', icon: Code2 },
  { value: 'rocket', label: 'Rocket', icon: Rocket },
  { value: 'flask', label: 'Flask', icon: FlaskConical },
  { value: 'wrench', label: 'Wrench', icon: Wrench },
  { value: 'layers', label: 'Layers', icon: Layers3 },
  { value: 'database', label: 'Database', icon: Database },
  { value: 'palette', label: 'Palette', icon: Palette },
  { value: 'phone', label: 'Phone', icon: Smartphone },
  { value: 'home', label: 'Home', icon: House },
] as const;

export type WorkspaceIconId = (typeof WORKSPACE_ICON_OPTIONS)[number]['value'];

export interface WorkspacePillDisplaySettings {
  showIndex: boolean;
  showShortLabel: boolean;
  showIcon: boolean;
}

export const DEFAULT_WORKSPACE_PILL_DISPLAY: WorkspacePillDisplaySettings = {
  showIndex: true,
  showShortLabel: false,
  showIcon: false,
};

export const WORKSPACE_ICON_COMPONENTS: Record<WorkspaceIconId, LucideIcon> = WORKSPACE_ICON_OPTIONS.reduce(
  (icons, option) => {
    icons[option.value] = option.icon;
    return icons;
  },
  {} as Record<WorkspaceIconId, LucideIcon>
);

export function normalizeWorkspaceShortLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.trim().replace(/\s+/g, '').toUpperCase();
  const trimmed = Array.from(compact).slice(0, 4).join('');
  return trimmed || null;
}

export function normalizeWorkspaceIcon(value: unknown): WorkspaceIconId | null {
  if (typeof value !== 'string') return null;
  return (WORKSPACE_ICON_OPTIONS.find((option) => option.value === value)?.value ?? null) as WorkspaceIconId | null;
}

export function deriveWorkspaceMonogram(name: string): string {
  const parts = name
    .split(/[^A-Za-z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return 'WS';
  if (parts.length === 1) return Array.from(parts[0].toUpperCase()).slice(0, 4).join('');

  const joined = parts.slice(0, 4).map((part) => part[0]?.toUpperCase() ?? '').join('');
  return joined || 'WS';
}

export function getWorkspacePillText(name: string, shortLabel?: string | null): string {
  return normalizeWorkspaceShortLabel(shortLabel) ?? deriveWorkspaceMonogram(name);
}

function getLegacyWorkspacePillDisplay(value: unknown): WorkspacePillDisplaySettings | null {
  switch (value) {
    case 'shortLabel':
      return { showIndex: false, showShortLabel: true, showIcon: false };
    case 'icon':
      return { showIndex: false, showShortLabel: false, showIcon: true };
    case 'iconShortLabel':
      return { showIndex: false, showShortLabel: true, showIcon: true };
    case 'index':
      return { showIndex: true, showShortLabel: false, showIcon: false };
    default:
      return null;
  }
}

export function normalizeWorkspacePillDisplay(value: unknown): WorkspacePillDisplaySettings {
  const legacy = getLegacyWorkspacePillDisplay(value);
  if (legacy) return legacy;

  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_WORKSPACE_PILL_DISPLAY };
  }

  const source = value as Record<string, unknown>;
  const display: WorkspacePillDisplaySettings = {
    showIndex: source.showIndex === true,
    showShortLabel: source.showShortLabel === true,
    showIcon: source.showIcon === true,
  };

  if (!display.showIndex && !display.showShortLabel && !display.showIcon) {
    return { ...DEFAULT_WORKSPACE_PILL_DISPLAY };
  }

  return display;
}

export function getWorkspacePillPresentation({
  display,
  index,
  name,
  shortLabel,
  icon,
}: {
  display: WorkspacePillDisplaySettings;
  index: number;
  name: string;
  shortLabel?: string | null;
  icon?: string | null;
}): { indexText: string | null; text: string | null; icon: WorkspaceIconId | null } {
  const resolvedIcon = normalizeWorkspaceIcon(icon);
  const explicitShortLabel = normalizeWorkspaceShortLabel(shortLabel);
  const fallbackText = getWorkspacePillText(name, shortLabel);
  const normalizedDisplay = normalizeWorkspacePillDisplay(display);
  const shouldShowText = normalizedDisplay.showShortLabel || (normalizedDisplay.showIndex && explicitShortLabel !== null);

  return {
    indexText: normalizedDisplay.showIndex ? `#${index}` : null,
    text: shouldShowText ? (normalizedDisplay.showShortLabel ? fallbackText : explicitShortLabel) : null,
    icon: normalizedDisplay.showIcon ? resolvedIcon : null,
  };
}
