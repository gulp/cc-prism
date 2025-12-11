/**
 * Interactive form for cast generation options
 * Provides a TUI for configuring all cast options before generation
 */

import React, { useState, useMemo, useEffect } from "react";
import { render, Box, Text, useApp, useInput, useStdout } from "ink";
import { loadProfile, saveProfile, type ProfileConfig } from "./sessions.js";

// Types
export interface CastFormConfig {
  output: string;
  upload: boolean;
  theme: string;
  cols: number;
  rows: number;
  title: string;
  preset: string;
  maxWait: number | null;
  thinkingPause: number | null;
  typingEffect: boolean;
  statusSpinner: boolean;
  spinnerDuration: number;
  markers: string;
}

interface InteractiveFormProps {
  sessionPath: string;
  defaultOutput: string;
  defaultTitle: string;
  onSubmit: (config: CastFormConfig) => void;
  onCancel: () => void;
}

// Constants
const THEMES = ["tokyo-night", "dracula", "nord", "catppuccin-mocha"] as const;
const PRESETS = ["speedrun", "default", "realtime"] as const;
const MARKERS = ["all", "user", "tools", "none"] as const;

// Field definitions for navigation
type SectionName = "output" | "appearance" | "timing" | "features";
type FieldName =
  | `section:${SectionName}`
  | "output" | "upload" | "theme" | "cols" | "rows" | "title"
  | "preset" | "maxWait" | "thinkingPause" | "typingEffect"
  | "statusSpinner" | "spinnerDuration" | "markers"
  | "generate" | "saveProfile" | "cancel";

// Section to fields mapping
const SECTION_FIELDS: Record<SectionName, FieldName[]> = {
  output: ["output", "upload"],
  appearance: ["theme", "cols", "rows", "title"],
  timing: ["preset", "maxWait", "thinkingPause"],
  features: ["typingEffect", "statusSpinner", "spinnerDuration", "markers"],
};

// Build dynamic field order based on expanded sections
function getVisibleFields(expanded: Set<SectionName>): FieldName[] {
  const fields: FieldName[] = [];
  for (const section of ["output", "appearance", "timing", "features"] as SectionName[]) {
    fields.push(`section:${section}`);
    if (expanded.has(section)) {
      fields.push(...SECTION_FIELDS[section]);
    }
  }
  fields.push("generate", "saveProfile", "cancel");
  return fields;
}

// Default values
function getDefaultConfig(defaultOutput: string): CastFormConfig {
  return {
    output: defaultOutput,
    upload: false,
    theme: "tokyo-night",
    cols: 100,
    rows: 40,
    title: "",  // Empty = show placeholder, CLI uses defaultTitle if empty
    preset: "default",
    maxWait: null,
    thinkingPause: null,
    typingEffect: true,
    statusSpinner: false,
    spinnerDuration: 3.0,
    markers: "all",
  };
}

// Validation
interface ValidationErrors {
  cols?: string;
  rows?: string;
  spinnerDuration?: string;
  maxWait?: string;
  thinkingPause?: string;
}

function validateConfig(config: CastFormConfig): ValidationErrors {
  const errors: ValidationErrors = {};

  if (config.cols <= 0 || config.cols > 500) {
    errors.cols = "Must be 1-500";
  }
  if (config.rows <= 0 || config.rows > 200) {
    errors.rows = "Must be 1-200";
  }
  if (config.spinnerDuration <= 0 || config.spinnerDuration > 60) {
    errors.spinnerDuration = "Must be 0.1-60";
  }
  if (config.maxWait !== null && config.maxWait < 0) {
    errors.maxWait = "Must be >= 0";
  }
  if (config.thinkingPause !== null && config.thinkingPause < 0) {
    errors.thinkingPause = "Must be >= 0";
  }

  return errors;
}

// Profile conversion helpers
function formToProfile(config: CastFormConfig): ProfileConfig {
  return {
    output: config.output,
    upload: config.upload,
    theme: config.theme,
    cols: config.cols,
    rows: config.rows,
    title: config.title,
    preset: config.preset,
    max_wait: config.maxWait,
    thinking_pause: config.thinkingPause,
    typing_effect: config.typingEffect,
    status_spinner: config.statusSpinner,
    spinner_duration: config.spinnerDuration,
    markers: config.markers,
  };
}

function profileToForm(profile: ProfileConfig, defaults: CastFormConfig): CastFormConfig {
  return {
    output: profile.output ?? defaults.output,
    upload: profile.upload ?? defaults.upload,
    theme: profile.theme ?? defaults.theme,
    cols: profile.cols ?? defaults.cols,
    rows: profile.rows ?? defaults.rows,
    title: profile.title ?? defaults.title,
    preset: profile.preset ?? defaults.preset,
    maxWait: profile.max_wait !== undefined ? profile.max_wait : defaults.maxWait,
    thinkingPause: profile.thinking_pause !== undefined ? profile.thinking_pause : defaults.thinkingPause,
    typingEffect: profile.typing_effect ?? defaults.typingEffect,
    statusSpinner: profile.status_spinner ?? defaults.statusSpinner,
    spinnerDuration: profile.spinner_duration ?? defaults.spinnerDuration,
    markers: profile.markers ?? defaults.markers,
  };
}

// Main form component
function InteractiveForm({ sessionPath, defaultOutput, defaultTitle, onSubmit, onCancel }: InteractiveFormProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Form state
  const [config, setConfig] = useState<CastFormConfig>(() => getDefaultConfig(defaultOutput));
  const [focusedField, setFocusedField] = useState<FieldName>("section:output");
  const [editMode, setEditMode] = useState(false);
  const [editBuffer, setEditBuffer] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<SectionName>>(() => new Set(["output", "appearance"]));

  // Load profile on mount
  useEffect(() => {
    loadProfile().then((profile) => {
      if (profile) {
        const defaults = getDefaultConfig(defaultOutput);
        setConfig(profileToForm(profile, defaults));
        setProfileLoaded(true);
        setStatusMessage("Loaded: cc-prism.profile");
        setTimeout(() => setStatusMessage(null), 2000);
      }
    });
  }, [defaultOutput]);

  // Validation
  const errors = useMemo(() => validateConfig(config), [config]);
  const hasErrors = Object.keys(errors).length > 0;

  // Navigation helpers
  const visibleFields = useMemo(() => getVisibleFields(expandedSections), [expandedSections]);
  const focusIndex = visibleFields.indexOf(focusedField);

  const moveFocus = (delta: number) => {
    const newIndex = Math.max(0, Math.min(visibleFields.length - 1, focusIndex + delta));
    setFocusedField(visibleFields[newIndex]!);
  };

  const isSection = (field: FieldName) => field.startsWith("section:");
  const getSectionName = (field: FieldName): SectionName | null =>
    isSection(field) ? (field.replace("section:", "") as SectionName) : null;

  // Field type helpers
  const isTextField = (field: FieldName) =>
    ["output", "title"].includes(field);
  const isNumberField = (field: FieldName) =>
    ["cols", "rows", "maxWait", "thinkingPause", "spinnerDuration"].includes(field);
  const isSelectField = (field: FieldName) =>
    ["theme", "preset", "markers"].includes(field);
  const isCheckbox = (field: FieldName) =>
    ["upload", "typingEffect", "statusSpinner"].includes(field);
  const isButton = (field: FieldName) =>
    ["generate", "saveProfile", "cancel"].includes(field);

  // Get select options for a field
  const getSelectOptions = (field: FieldName): readonly string[] => {
    if (field === "theme") return THEMES;
    if (field === "preset") return PRESETS;
    if (field === "markers") return MARKERS;
    return [];
  };

  // Input handling
  useInput((input, key) => {
    // Cancel on Ctrl+C
    if (key.ctrl && input === "c") {
      onCancel();
      exit();
      return;
    }

    // Edit mode handling for text/number fields
    if (editMode) {
      if (key.escape) {
        setEditMode(false);
        setEditBuffer("");
        return;
      }

      if (key.return) {
        // Apply edit buffer to config
        if (isTextField(focusedField)) {
          setConfig(c => ({ ...c, [focusedField]: editBuffer }));
        } else if (isNumberField(focusedField)) {
          const num = parseFloat(editBuffer);
          if (editBuffer === "" && ["maxWait", "thinkingPause"].includes(focusedField)) {
            setConfig(c => ({ ...c, [focusedField]: null }));
          } else if (!isNaN(num)) {
            setConfig(c => ({ ...c, [focusedField]: num }));
          }
        }
        setEditMode(false);
        setEditBuffer("");
        return;
      }

      if (key.backspace || key.delete) {
        setEditBuffer(b => b.slice(0, -1));
        return;
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta && input.length === 1) {
        setEditBuffer(b => b + input);
        return;
      }
      return;
    }

    // Navigation mode
    if (key.downArrow || input === "j") {
      moveFocus(1);
      return;
    }
    if (key.upArrow || input === "k") {
      moveFocus(-1);
      return;
    }
    if (key.tab && !key.shift) {
      moveFocus(1);
      return;
    }
    if (key.tab && key.shift) {
      moveFocus(-1);
      return;
    }

    // Jump to start/end
    if (input === "g") {
      setFocusedField(visibleFields[0]!);
      return;
    }
    if (input === "G") {
      setFocusedField(visibleFields[visibleFields.length - 1]!);
      return;
    }

    // Field-specific actions
    if (key.return || input === " ") {
      // Section headers: toggle expand/collapse
      const sectionName = getSectionName(focusedField);
      if (sectionName) {
        setExpandedSections(s => {
          const next = new Set(s);
          if (next.has(sectionName)) next.delete(sectionName);
          else next.add(sectionName);
          return next;
        });
        return;
      }

      // Checkboxes: toggle
      if (isCheckbox(focusedField)) {
        setConfig(c => ({ ...c, [focusedField]: !c[focusedField as keyof CastFormConfig] }));
        return;
      }

      // Select fields: cycle options
      if (isSelectField(focusedField)) {
        const options = getSelectOptions(focusedField);
        const current = config[focusedField as keyof CastFormConfig] as string;
        const idx = options.indexOf(current);
        const next = options[(idx + 1) % options.length];
        setConfig(c => ({ ...c, [focusedField]: next }));
        return;
      }

      // Text/number fields: enter edit mode
      if (isTextField(focusedField) || isNumberField(focusedField)) {
        const currentValue = config[focusedField as keyof CastFormConfig];
        setEditBuffer(currentValue === null ? "" : String(currentValue));
        setEditMode(true);
        return;
      }

      // Buttons
      if (focusedField === "generate") {
        if (hasErrors) {
          setStatusMessage("Fix validation errors first");
          setTimeout(() => setStatusMessage(null), 2000);
          return;
        }
        onSubmit(config);
        exit();
        return;
      }

      if (focusedField === "saveProfile") {
        saveProfile(formToProfile(config))
          .then(() => {
            setStatusMessage("Profile saved: cc-prism.profile");
            setTimeout(() => setStatusMessage(null), 2000);
          })
          .catch((err) => {
            setStatusMessage(`Save failed: ${err.message}`);
            setTimeout(() => setStatusMessage(null), 3000);
          });
        return;
      }

      if (focusedField === "cancel") {
        onCancel();
        exit();
        return;
      }
    }

    // Select fields: h/l to cycle
    if (isSelectField(focusedField) && (input === "h" || input === "l")) {
      const options = getSelectOptions(focusedField);
      const current = config[focusedField as keyof CastFormConfig] as string;
      const idx = options.indexOf(current);
      const delta = input === "l" ? 1 : -1;
      const next = options[(idx + delta + options.length) % options.length];
      setConfig(c => ({ ...c, [focusedField]: next }));
      return;
    }
  });

  // Render helpers
  const renderTextField = (field: FieldName, label: string, width = 40, placeholder?: string) => {
    const value = config[field as keyof CastFormConfig] as string;
    const isFocused = focusedField === field;
    const isEditing = isFocused && editMode;
    const displayValue = isEditing ? editBuffer : value;
    const showPlaceholder = !displayValue && placeholder && !isEditing;
    const content = (showPlaceholder ? placeholder : displayValue).padEnd(width - 2).slice(0, width - 2);

    return (
      <Box>
        <Text color={isFocused ? "cyan" : undefined}>{isFocused ? "▸ " : "  "}</Text>
        <Text>{label}: </Text>
        <Text backgroundColor={isEditing ? "blue" : isFocused ? "gray" : undefined}>[</Text>
        <Text
          backgroundColor={isEditing ? "blue" : isFocused ? "gray" : undefined}
          color={isEditing ? "white" : showPlaceholder ? "gray" : undefined}
        >
          {content}
        </Text>
        <Text backgroundColor={isEditing ? "blue" : isFocused ? "gray" : undefined}>]</Text>
        {isEditing && <Text color="gray">█</Text>}
      </Box>
    );
  };

  const renderNumberField = (field: FieldName, label: string, defaultVal?: number, width = 8, labelWidth = 12) => {
    const value = config[field as keyof CastFormConfig];
    const isFocused = focusedField === field;
    const isEditing = isFocused && editMode;
    const displayValue = isEditing ? editBuffer : (value === null ? "" : String(value));
    const error = errors[field as keyof ValidationErrors];
    const hint = defaultVal !== undefined ? `(default: ${defaultVal})` : "";

    return (
      <Box>
        <Text color={isFocused ? "cyan" : undefined}>{isFocused ? "▸ " : "  "}</Text>
        <Text>{label.padEnd(labelWidth)}: </Text>
        <Text
          backgroundColor={isEditing ? "blue" : isFocused ? "gray" : undefined}
          color={isEditing ? "white" : undefined}
        >
          [{displayValue.padEnd(width - 2).slice(0, width - 2)}]
        </Text>
        {isEditing && <Text color="gray">█</Text>}
        {hint && <Text dimColor> {hint}</Text>}
        {error && <Text color="red"> {error}</Text>}
      </Box>
    );
  };

  const renderSelectField = (field: FieldName, label: string, labelWidth = 0) => {
    const value = config[field as keyof CastFormConfig] as string;
    const options = getSelectOptions(field);
    const isFocused = focusedField === field;
    const displayLabel = labelWidth > 0 ? label.padEnd(labelWidth) : label;

    return (
      <Box>
        <Text color={isFocused ? "cyan" : undefined}>{isFocused ? "▸ " : "  "}</Text>
        <Text>{displayLabel}: </Text>
        <Text backgroundColor={isFocused ? "gray" : undefined}>
          [{value}]
        </Text>
        {isFocused && <Text dimColor> (h/l or Space to cycle)</Text>}
      </Box>
    );
  };

  const renderCheckbox = (field: FieldName, label: string) => {
    const value = config[field as keyof CastFormConfig] as boolean;
    const isFocused = focusedField === field;

    return (
      <Box>
        <Text color={isFocused ? "cyan" : undefined}>{isFocused ? "▸ " : "  "}</Text>
        <Text>({value ? "●" : " "}) {label}</Text>
      </Box>
    );
  };

  const renderSectionHeader = (section: SectionName, label: string) => {
    const isFocused = focusedField === `section:${section}`;
    const isExpanded = expandedSections.has(section);

    return (
      <Box>
        <Text color={isFocused ? "cyan" : undefined}>{isFocused ? "▸ " : "  "}</Text>
        <Text bold={isExpanded} color={isFocused ? "yellow" : isExpanded ? "yellow" : "gray"}>
          {label}
        </Text>
        {isFocused && <Text color="gray">  {isExpanded ? "collapse" : "expand"}</Text>}
      </Box>
    );
  };

  const renderButton = (field: FieldName, label: string, color?: string) => {
    const isFocused = focusedField === field;

    return (
      <Box marginRight={2}>
        <Text
          backgroundColor={isFocused ? (color || "cyan") : undefined}
          color={isFocused ? "black" : (color || "cyan")}
          bold={isFocused}
        >
          [{label}]
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">Cast Options</Text>
        <Text dimColor> - {sessionPath.split("/").pop()}</Text>
      </Box>

      {/* Output Section */}
      <Box flexDirection="column">
        {renderSectionHeader("output", "Output")}
        {expandedSections.has("output") && (
          <Box flexDirection="column" marginLeft={2}>
            {renderTextField("output", "File", 45)}
            {renderCheckbox("upload", "Upload to asciinema.org")}
          </Box>
        )}
      </Box>

      {/* Appearance Section */}
      <Box flexDirection="column">
        {renderSectionHeader("appearance", "Appearance")}
        {expandedSections.has("appearance") && (
          <Box flexDirection="column" marginLeft={2}>
            {renderSelectField("theme", "Theme")}
            {renderNumberField("cols", "Cols", 100, 6, 5)}
            {renderNumberField("rows", "Rows", 40, 6, 5)}
            {renderTextField("title", "Title", 45, defaultTitle)}
          </Box>
        )}
      </Box>

      {/* Timing Section */}
      <Box flexDirection="column">
        {renderSectionHeader("timing", "Timing")}
        {expandedSections.has("timing") && (
          <Box flexDirection="column" marginLeft={2}>
            {renderSelectField("preset", "Preset")}
            {renderNumberField("maxWait", "Max wait", 3, 8, 12)}
            {renderNumberField("thinkingPause", "Think pause", 0.8, 8, 12)}
          </Box>
        )}
      </Box>

      {/* Features Section */}
      <Box flexDirection="column">
        {renderSectionHeader("features", "Features")}
        {expandedSections.has("features") && (
          <Box flexDirection="column" marginLeft={2}>
            {renderCheckbox("typingEffect", "Typing effect")}
            {renderCheckbox("statusSpinner", "Status spinner")}
            {renderNumberField("spinnerDuration", "Duration", 3.0, 6, 8)}
            {renderSelectField("markers", "Markers", 8)}
          </Box>
        )}
      </Box>

      {/* Action Buttons */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Box>
          {renderButton("generate", "Generate", hasErrors ? "gray" : "green")}
          {renderButton("saveProfile", "Save Profile", "blue")}
          {renderButton("cancel", "Cancel", "red")}
        </Box>
      </Box>

      {/* Status */}
      {statusMessage && (
        <Box marginTop={1}>
          <Text color="yellow">{statusMessage}</Text>
        </Box>
      )}
    </Box>
  );
}

// Export runner function
export async function runInteractiveForm(
  sessionPath: string,
  defaultOutput: string,
  defaultTitle: string
): Promise<CastFormConfig | null> {
  return new Promise((resolve) => {
    const { unmount, waitUntilExit } = render(
      <InteractiveForm
        sessionPath={sessionPath}
        defaultOutput={defaultOutput}
        defaultTitle={defaultTitle}
        onSubmit={(config) => resolve(config)}
        onCancel={() => resolve(null)}
      />
    );

    waitUntilExit().then(() => {
      unmount();
    });
  });
}
