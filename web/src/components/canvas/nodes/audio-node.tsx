"use client";
import { memo, useState, useRef, useCallback, useEffect } from "react";
import type { NodeProps } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import dynamic from "next/dynamic";
import type WaveSurfer from "wavesurfer.js";
import { Play, Pause, ArrowUpFromLine, Loader2 } from "lucide-react";
import { NodeShell } from "./shared/node-shell";
import { useNodeFocus } from "../hooks/use-node-focus";
import { useNodeExecution } from "../hooks/use-node-execution";
import { canvasApi, API_BASE_URL } from "@/lib/api";

const WavesurferPlayer = dynamic(() => import("@wavesurfer/react"), {
  ssr: false,
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function AudioNodeInner({ id, data }: NodeProps) {
  const d = data as Record<string, unknown>;
  const audioUrl =
    (d.result_audio_url as string) || (d.result_url as string) || "";
  const hasContent = audioUrl.length > 0;
  const status = (d.status as string) || "idle";
  const errorMessage = (d.error_message as string) || "";
  const { focusedNodeId, handleNodeClick } = useNodeFocus();
  const { status: execStatus } = useNodeExecution(id);
  const { setNodes } = useReactFlow();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    return () => {
      wavesurferRef.current?.destroy();
      wavesurferRef.current = null;
    };
  }, []);

  const resolveUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http") || url.startsWith("blob:")) return url;
    return `${API_BASE_URL}${url}`;
  };

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const localUrl = URL.createObjectURL(file);
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  result_url: localUrl,
                  result_audio_url: localUrl,
                  status: "completed",
                },
              }
            : n,
        ),
      );
      canvasApi
        .updateNode(id, { result_url: localUrl, status: "completed" })
        .catch(() => {});
      e.target.value = "";
    },
    [id, setNodes],
  );

  const handlePlayPause = useCallback(() => {
    wavesurferRef.current?.playPause();
  }, []);

  const isExecuting = execStatus === "queued" || execStatus === "running";
  const resolvedUrl = hasContent ? resolveUrl(audioUrl) : "";

  return (
    <div onClick={() => handleNodeClick(id, "audio", hasContent)}>
      <NodeShell
        nodeId={id}
        nodeType="audio"
        hasContent={hasContent}
        status={
          status as
            | "idle"
            | "queued"
            | "running"
            | "completed"
            | "failed"
            | "timeout"
            | "blocked"
        }
        isFocused={focusedNodeId === id}
      >
        {hasContent ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: 16,
            }}
          >
            {/* Waveform area */}
            <div
              className="nodrag nowheel"
              style={{
                height: 100,
                background: "var(--cv4-surface-secondary)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {resolvedUrl && (
                <WavesurferPlayer
                  height={100}
                  waveColor="var(--cv4-text-disabled)"
                  progressColor="var(--cv4-text-muted)"
                  cursorColor="#FF3B30"
                  cursorWidth={2}
                  url={resolvedUrl}
                  onReady={(ws: WaveSurfer) => {
                    wavesurferRef.current = ws;
                    setDuration(ws.getDuration());
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeupdate={(ws: WaveSurfer) =>
                    setCurrentTime(ws.getCurrentTime())
                  }
                />
              )}
            </div>

            {/* Controls */}
            <div
              className="flex items-center justify-center nodrag"
              style={{ gap: 16 }}
            >
              <span
                style={{
                  fontFamily: "Space Grotesk, sans-serif",
                  fontSize: 13,
                  color: "var(--cv4-text-muted)",
                }}
              >
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPause();
                }}
                aria-label={isPlaying ? "暂停" : "播放"}
                className="flex items-center justify-center cursor-pointer"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: "var(--cv4-surface-secondary)",
                  border: "none",
                }}
              >
                {isPlaying ? (
                  <Pause
                    size={16}
                    style={{ color: "var(--cv4-text-primary)" }}
                  />
                ) : (
                  <Play
                    size={16}
                    style={{ color: "var(--cv4-text-primary)" }}
                  />
                )}
              </button>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center"
            style={{
              height: 148,
              gap: 12,
              background: "var(--cv4-surface-secondary)",
            }}
          >
            {isExecuting ? (
              <>
                <Loader2
                  size={28}
                  className="animate-spin"
                  style={{ color: "var(--cv4-text-muted)" }}
                />
                <span
                  style={{
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 11,
                    color: "var(--cv4-text-muted)",
                  }}
                >
                  AI 生成音频中...
                </span>
              </>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleUpload}
                  className="hidden"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  aria-label="上传音频文件"
                  title="上传音频文件"
                  className="flex items-center justify-center cursor-pointer"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    border: "1px solid var(--cv4-text-disabled)",
                    background: "transparent",
                  }}
                >
                  <ArrowUpFromLine
                    size={14}
                    style={{ color: "var(--cv4-text-muted)" }}
                  />
                </button>
                <span
                  style={{
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 10,
                    color: "var(--cv4-text-disabled)",
                  }}
                >
                  或用下方 AI 生成
                </span>
              </>
            )}
          </div>
        )}
        {status === "failed" && errorMessage && (
          <div style={{ padding: "8px 16px" }}>
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 11,
                color: "#EF4444",
              }}
            >
              {errorMessage}
            </span>
          </div>
        )}
      </NodeShell>
    </div>
  );
}

export const AudioNode = memo(AudioNodeInner);
