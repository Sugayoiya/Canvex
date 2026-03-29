import { NODE_IO, type MaterialType } from "./connection-rules";

/* ------------------------------------------------------------------ */
/*  Type definitions                                                   */
/* ------------------------------------------------------------------ */

export interface TemplateDownstreamNode {
  nodeType: MaterialType;
  offsetX: number;
  offsetY: number;
  hiddenPrompt: string | null;
  config: Record<string, unknown>;
  autoExecute: boolean;
}

export interface CanvasTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  applicableNodeTypes: MaterialType[];
  applicableWhen: "has_content" | "empty" | "both";
  downstreamNodes: TemplateDownstreamNode[];
}

/* ------------------------------------------------------------------ */
/*  Graph validation — cycle detection + IO compatibility              */
/* ------------------------------------------------------------------ */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTemplateGraph(
  sourceNodeType: MaterialType,
  template: CanvasTemplate,
  existingEdges: { source: string; target: string }[],
  sourceNodeId: string,
): ValidationResult {
  const errors: string[] = [];

  const sourceIO = NODE_IO[sourceNodeType];
  if (!sourceIO) {
    errors.push(`Unknown source node type: ${sourceNodeType}`);
    return { valid: false, errors };
  }
  const sourceOutputType = sourceIO.outputs[0];

  for (const downstream of template.downstreamNodes) {
    const targetIO = NODE_IO[downstream.nodeType];
    if (!targetIO) {
      errors.push(`Unknown downstream node type: ${downstream.nodeType}`);
      continue;
    }
    if (!targetIO.inputs.includes(sourceOutputType as MaterialType)) {
      errors.push(
        `Incompatible connection: ${sourceNodeType} (outputs ${sourceOutputType}) → ${downstream.nodeType} (accepts ${targetIO.inputs.join(",")})`,
      );
    }
  }

  const adj = new Map<string, Set<string>>();
  for (const e of existingEdges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    adj.get(e.source)!.add(e.target);
  }
  const tempIds = template.downstreamNodes.map((_, i) => `__temp_${i}`);
  if (!adj.has(sourceNodeId)) adj.set(sourceNodeId, new Set());
  for (const tid of tempIds) {
    adj.get(sourceNodeId)!.add(tid);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  function hasCycle(node: string): boolean {
    if (inStack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    inStack.add(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (hasCycle(neighbor)) return true;
    }
    inStack.delete(node);
    return false;
  }
  if (hasCycle(sourceNodeId)) {
    errors.push("Template application would create a cycle in the graph");
  }

  return { valid: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ */
/*  Template application                                               */
/* ------------------------------------------------------------------ */

export interface ApplyTemplateResult {
  nodes: Array<{
    nodeType: MaterialType;
    positionX: number;
    positionY: number;
    config: Record<string, unknown>;
  }>;
  edges: Array<{ sourceId: string; targetIndex: number }>;
}

export function applyTemplate(
  sourceNodeId: string,
  sourceNodeType: MaterialType,
  sourcePosition: { x: number; y: number },
  template: CanvasTemplate,
  existingEdges: { source: string; target: string }[],
): ApplyTemplateResult | { error: string } {
  const validation = validateTemplateGraph(
    sourceNodeType,
    template,
    existingEdges,
    sourceNodeId,
  );
  if (!validation.valid) {
    return { error: validation.errors.join("; ") };
  }

  const nodes = template.downstreamNodes.map((dn) => ({
    nodeType: dn.nodeType,
    positionX: sourcePosition.x + dn.offsetX,
    positionY: sourcePosition.y + dn.offsetY,
    config: {
      ...dn.config,
      ...(dn.hiddenPrompt ? { hidden_prompt: dn.hiddenPrompt } : {}),
    },
  }));

  const edges = template.downstreamNodes.map((_, i) => ({
    sourceId: sourceNodeId,
    targetIndex: i,
  }));

  return { nodes, edges };
}

/* ------------------------------------------------------------------ */
/*  Built-in templates                                                 */
/* ------------------------------------------------------------------ */

export const BUILT_IN_TEMPLATES: CanvasTemplate[] = [
  {
    id: "grid-scene",
    name: "九宫格场景",
    description: "生成 3×3 不同角度的场景图",
    icon: "layout-grid",
    applicableNodeTypes: ["image"],
    applicableWhen: "has_content",
    downstreamNodes: [
      {
        nodeType: "image",
        offsetX: 400,
        offsetY: 0,
        hiddenPrompt:
          "Generate a 3x3 grid (9 panels) showing the same scene from 9 different camera angles and compositions. Include wide shot, medium shot, close-up, bird's eye view, low angle, dutch angle, over-the-shoulder, establishing shot, and detail shot.",
        config: {},
        autoExecute: false,
      },
    ],
  },
  {
    id: "character-triview",
    name: "角色三视图",
    description: "生成角色正面/侧面/背面三视图",
    icon: "user",
    applicableNodeTypes: ["image"],
    applicableWhen: "has_content",
    downstreamNodes: [
      {
        nodeType: "image",
        offsetX: 400,
        offsetY: 0,
        hiddenPrompt:
          "Generate a character turnaround sheet showing three views of the same character: front view, side view (3/4 angle), and back view. Maintain consistent proportions, clothing, and style across all three views. Clean white background.",
        config: {},
        autoExecute: false,
      },
    ],
  },
  {
    id: "style-transfer",
    name: "风格迁移",
    description: "应用不同画风到当前图片",
    icon: "palette",
    applicableNodeTypes: ["image"],
    applicableWhen: "has_content",
    downstreamNodes: [
      {
        nodeType: "image",
        offsetX: 400,
        offsetY: 0,
        hiddenPrompt:
          "Recreate this image in a different artistic style while preserving the composition, subjects, and scene layout.",
        config: {},
        autoExecute: false,
      },
    ],
  },
  {
    id: "img-to-video",
    name: "图生视频",
    description: "以当前图片为首帧生成视频",
    icon: "video",
    applicableNodeTypes: ["image"],
    applicableWhen: "has_content",
    downstreamNodes: [
      {
        nodeType: "video",
        offsetX: 400,
        offsetY: 0,
        hiddenPrompt: null,
        config: { mode: "image-to-video" },
        autoExecute: false,
      },
    ],
  },
  {
    id: "text-to-video",
    name: "文生视频",
    description: "根据文本描述生成视频",
    icon: "video",
    applicableNodeTypes: ["text"],
    applicableWhen: "has_content",
    downstreamNodes: [
      {
        nodeType: "video",
        offsetX: 400,
        offsetY: 0,
        hiddenPrompt: null,
        config: { mode: "text-to-video" },
        autoExecute: false,
      },
    ],
  },
];
