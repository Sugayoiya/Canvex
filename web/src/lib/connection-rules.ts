import type { Connection, Edge } from "@xyflow/react";

type MaterialType = "text" | "image" | "video" | "audio";

const NODE_IO: Record<MaterialType, { inputs: MaterialType[]; outputs: MaterialType[] }> = {
  text:  { inputs: ["text", "image"],           outputs: ["text"] },
  image: { inputs: ["text", "image"],           outputs: ["image"] },
  video: { inputs: ["text", "image", "video"],  outputs: ["video"] },
  audio: { inputs: ["text", "audio"],           outputs: ["audio"] },
};

export function isValidConnection(
  connection: Connection | Edge,
  nodes: { id: string; type?: string }[],
): boolean {
  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);
  if (!sourceNode || !targetNode) return false;

  const sourceIO = NODE_IO[sourceNode.type as MaterialType];
  const targetIO = NODE_IO[targetNode.type as MaterialType];
  if (!sourceIO || !targetIO) return false;
  if (sourceIO.outputs.length === 0 || targetIO.inputs.length === 0) return false;

  return sourceIO.outputs.some((out) => targetIO.inputs.includes(out));
}

export function getCompatibleTargetTypes(sourceType: MaterialType): MaterialType[] {
  const sourceIO = NODE_IO[sourceType];
  if (!sourceIO) return [];
  const outputType = sourceIO.outputs[0];
  return (Object.entries(NODE_IO) as [MaterialType, { inputs: MaterialType[] }][])
    .filter(([, io]) => io.inputs.includes(outputType))
    .map(([type]) => type);
}

export { NODE_IO };
export type { MaterialType };
