export type DefaultModelSettings = {
  default_llm_model?: string | null;
  default_image_model?: string | null;
};

type ModelType = "llm" | "image";
type ModelSource =
  | "selected"
  | "project"
  | "personal"
  | "team"
  | "system"
  | null;

interface EffectiveModelOptions {
  modelType: ModelType;
  directValue?: string | null;
  projectSettings?: DefaultModelSettings | null;
  ownerType?: string | null;
  userSettings?: DefaultModelSettings | null;
  teamSettings?: DefaultModelSettings | null;
  systemSettings?: DefaultModelSettings | null;
}

export interface EffectiveModelSelection {
  modelName: string | null;
  source: ModelSource;
  sourceLabel: string | null;
}

function getSourceLabel(source: ModelSource): string | null {
  switch (source) {
    case "project":
      return "项目默认";
    case "personal":
      return "个人默认";
    case "team":
      return "团队默认";
    case "system":
      return "系统默认";
    default:
      return null;
  }
}

export function getEffectiveModelSelection({
  modelType,
  directValue,
  projectSettings,
  ownerType,
  userSettings,
  teamSettings,
  systemSettings,
}: EffectiveModelOptions): EffectiveModelSelection {
  const settingsKey =
    modelType === "llm" ? "default_llm_model" : "default_image_model";

  if (directValue) {
    return {
      modelName: directValue,
      source: "selected",
      sourceLabel: null,
    };
  }

  const projectValue = projectSettings?.[settingsKey] ?? null;
  if (projectValue) {
    return {
      modelName: projectValue,
      source: "project",
      sourceLabel: getSourceLabel("project"),
    };
  }

  const scopedValue =
    ownerType === "team"
      ? (teamSettings?.[settingsKey] ?? null)
      : (userSettings?.[settingsKey] ?? null);
  const scopedSource = ownerType === "team" ? "team" : "personal";
  if (scopedValue) {
    return {
      modelName: scopedValue,
      source: scopedSource,
      sourceLabel: getSourceLabel(scopedSource),
    };
  }

  const systemValue = systemSettings?.[settingsKey] ?? null;
  if (systemValue) {
    return {
      modelName: systemValue,
      source: "system",
      sourceLabel: getSourceLabel("system"),
    };
  }

  return {
    modelName: null,
    source: null,
    sourceLabel: null,
  };
}
