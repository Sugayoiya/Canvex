import type { Connection } from "@xyflow/react";

type HandleType = "text" | "json" | "image" | "any";

const NODE_IO: Record<string, { inputs: HandleType[]; outputs: HandleType[] }> =
  {
    "text-input": { inputs: [], outputs: ["text"] },
    "llm-generate": { inputs: ["text"], outputs: ["text"] },
    extract: { inputs: ["text"], outputs: ["json"] },
    "image-gen": { inputs: ["text"], outputs: ["image"] },
    output: { inputs: ["text", "json", "image"], outputs: [] },
  };

export function isValidConnection(
  connection: Connection,
  nodes: { id: string; type?: string }[],
): boolean {
  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);
  if (!sourceNode || !targetNode) return false;

  const sourceIO = NODE_IO[sourceNode.type as string];
  const targetIO = NODE_IO[targetNode.type as string];
  if (!sourceIO || !targetIO) return false;
  if (sourceIO.outputs.length === 0 || targetIO.inputs.length === 0)
    return false;

  return sourceIO.outputs.some(
    (out) => targetIO.inputs.includes(out) || targetIO.inputs.includes("any"),
  );
}

export { NODE_IO };
export type { HandleType };
