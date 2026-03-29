import type { NodeTypes } from "@xyflow/react";
import { TextNode } from "./text-node";
import { ImageNode } from "./image-node";
import { VideoNode } from "./video-node";
import { AudioNode } from "./audio-node";

export const nodeTypes: NodeTypes = {
  text: TextNode,
  image: ImageNode,
  video: VideoNode,
  audio: AudioNode,
} as const;
