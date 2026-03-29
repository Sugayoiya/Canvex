"use client";

import { useState, useCallback, type DragEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, X, Type, Image, Video, Volume2 } from "lucide-react";

import { canvasApi } from "@/lib/api";
import { useCanvasStore } from "@/stores/canvas-store";

interface Asset {
  id: string;
  project_id: string;
  created_by: string;
  asset_type: string;
  name: string;
  tags: string | null;
  content_text: string | null;
  content_url: string | null;
  config_json: Record<string, unknown> | null;
  source_node_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AssetListResponse {
  items: Asset[];
  total: number;
  limit: number;
  offset: number;
}

const TABS = [
  { key: "all", label: "全部", icon: null },
  { key: "text", label: "文本", icon: Type },
  { key: "image", label: "图片", icon: Image },
  { key: "video", label: "视频", icon: Video },
  { key: "audio", label: "音频", icon: Volume2 },
] as const;

const TYPE_ICONS: Record<string, typeof Type> = {
  text: Type,
  image: Image,
  video: Video,
  audio: Volume2,
};

interface AssetPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AssetPanel({ open, onClose }: AssetPanelProps) {
  const { projectId } = useCanvasStore();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<AssetListResponse>({
    queryKey: ["canvas-assets", projectId, activeTab],
    queryFn: () =>
      canvasApi
        .listAssets(projectId!, {
          asset_type: activeTab === "all" ? undefined : activeTab,
          limit: 50,
        })
        .then((r) => r.data),
    enabled: open && !!projectId,
  });

  const deleteMutation = useMutation({
    mutationFn: (assetId: string) => canvasApi.deleteAsset(assetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas-assets"] });
      setDeletingId(null);
    },
  });

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, asset: Asset) => {
      e.dataTransfer.setData(
        "application/json",
        JSON.stringify({
          type: "canvas-asset",
          asset_type: asset.asset_type,
          name: asset.name,
          content_text: asset.content_text,
          content_url: asset.content_url,
          config_json: asset.config_json,
        }),
      );
      e.dataTransfer.effectAllowed = "copy";
    },
    [],
  );

  if (!open) return null;

  const items = data?.items ?? [];

  return (
    <div className="absolute left-20 top-4 z-20 flex h-[calc(100%-2rem)] w-80 flex-col rounded-2xl border border-[var(--cv4-border-default)] bg-[var(--cv4-surface-primary)] shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--cv4-border-subtle)]">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-[var(--cv4-text-muted)]" />
          <span className="text-sm font-medium text-[var(--cv4-text-primary)]">
            资产库
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 transition-colors hover:bg-[var(--cv4-surface-secondary)]"
        >
          <X size={14} className="text-[var(--cv4-text-disabled)]" />
        </button>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-[var(--cv4-border-subtle)]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[var(--cv4-surface-secondary)] text-[var(--cv4-text-primary)]"
                : "text-[var(--cv4-text-muted)] hover:text-[var(--cv4-text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Asset grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--cv4-text-muted)] border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Package
              size={48}
              className="text-[var(--cv4-text-disabled)]"
              strokeWidth={1}
            />
            <div>
              <p className="text-sm text-[var(--cv4-text-muted)]">
                还没有保存任何资产
              </p>
              <p className="mt-1 text-xs text-[var(--cv4-text-disabled)]">
                在节点的模板菜单中点击「保存到资产库」
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {items.map((asset) => {
              const Icon = TYPE_ICONS[asset.asset_type] ?? Package;
              return (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, asset)}
                  className="group cursor-grab rounded-lg border border-[var(--cv4-border-default)] bg-[var(--cv4-surface-elevated)] p-2.5 transition-all hover:border-[var(--cv4-border-focused)] hover:shadow-md active:cursor-grabbing"
                >
                  {/* Preview */}
                  <div className="mb-2 flex h-20 items-center justify-center overflow-hidden rounded-md bg-[var(--cv4-surface-secondary)]">
                    {asset.content_url ? (
                      <img
                        src={asset.content_url}
                        alt={asset.name}
                        className="h-full w-full object-cover"
                      />
                    ) : asset.content_text ? (
                      <p className="line-clamp-3 px-2 text-[10px] leading-tight text-[var(--cv4-text-muted)]">
                        {asset.content_text}
                      </p>
                    ) : (
                      <Icon
                        size={24}
                        className="text-[var(--cv4-text-disabled)]"
                      />
                    )}
                  </div>
                  {/* Info */}
                  <p className="truncate text-xs font-medium text-[var(--cv4-text-secondary)]">
                    {asset.name}
                  </p>
                  {asset.tags && (
                    <p className="mt-0.5 truncate text-[10px] text-[var(--cv4-text-disabled)]">
                      {asset.tags}
                    </p>
                  )}
                  {/* Delete */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingId(asset.id);
                    }}
                    className="mt-1 hidden text-[10px] text-red-400 hover:text-red-300 group-hover:block"
                  >
                    删除
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation overlay */}
      {deletingId && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-sm">
          <div className="mx-4 rounded-xl border border-[var(--cv4-border-default)] bg-[var(--cv4-surface-primary)] p-4 shadow-xl">
            <p className="text-sm text-[var(--cv4-text-primary)]">
              删除「{items.find((a) => a.id === deletingId)?.name}」？此操作不可撤销。
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="rounded-md px-3 py-1.5 text-xs text-[var(--cv4-text-secondary)] hover:bg-[var(--cv4-surface-secondary)]"
              >
                保留资产
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
                className="rounded-md px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AssetPanel;
