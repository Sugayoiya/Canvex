import type { NodeTypes } from "@xyflow/react";
import { TextInputNode } from "./text-input-node";
import { LLMNode } from "./llm-node";
import { ExtractNode } from "./extract-node";
import { ImageGenNode } from "./image-gen-node";
import { OutputNode } from "./output-node";

export const nodeTypes: NodeTypes = {
  "text-input": TextInputNode,
  "llm-generate": LLMNode,
  extract: ExtractNode,
  "image-gen": ImageGenNode,
  output: OutputNode,
} as const;
