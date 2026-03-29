"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Save, Type, Image, Video, Volume2 } from "lucide-react";

import { canvasApi } from "@/lib/api";
import { useCanvasStore } from "@/stores/canvas-store";

const TYPE_LABELS: Record<string, string> = {
  text: "文本",
  image: "图片",
  video: "视频",
  audio: "音频",
};

const TYPE_ICONS: Record<string, typeof Type> = {
  text: Type,
  image: Image,
  video: Video,
  audio: Volume2,
};

export interface SaveAssetDialogProps {
  open: boolean;
  onClose: () => void;
  nodeId: string;
  nodeType: string;
  nodeData: Record<string, unknown>;
}

export function SaveAssetDialog({
  open,
  onClose,
  nodeId,
  nodeType,
  nodeData,
}: SaveAssetDialogProps) {
  const { projectId } = useCanvasStore();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");

  const assetType = nodeType;
  const contentText = (nodeData.result_text as string) || (nodeData.text as string) || null;
  const contentUrl = (nodeData.result_url as string) || null;
  const Icon = TYPE_ICONS[assetType] ?? Type;

  const createMutation = useMutation({
    mutationFn: () =>
      canvasApi.createAsset({
        project_id: projectId!,
        asset_type: assetType,
        name: name.trim(),
        tags: tags.trim() || undefined,
        content_text: contentText || undefined,
        content_url: contentUrl || undefined,
        config_json: (nodeData.config as Record<string, unknown>) || undefined,
        source_node_id: nodeId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas-assets"] });
      setName("");
      setTags("");
      onClose();
    },
  });

  if (!open) return null;

  const canSave = name.trim().length > 0 && name.trim().length <= 255 && !!projectId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-96 rounded-2xl border border-[var(--cv4-border-default)] bg-[var(--cv4-surface-primary)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--cv4-border-subtle)] px-5 py-3">
          <div className="flex items-center gap-2">
            <Save size={15} className="text-[var(--cv4-text-muted)]" />
            <span className="text-sm font-medium text-[var(--cv4-text-primary)]">
              保存到资产库
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-[var(--cv4-surface-secondary)]"
          >
            <X size={14} className="text-[var(--cv4-text-disabled)]" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Asset type badge */}
          <div className="flex items-center gap-2">
            <Icon size={14} className="text-[var(--cv4-text-muted)]" />
            <span className="text-xs text-[var(--cv4-text-muted)]">
              {TYPE_LABELS[assetType] ?? assetType}
            </span>
          </div>

          {/* Preview */}
          <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg border border-[var(--cv4-border-default)] bg-[var(--cv4-surface-secondary)]">
            {contentUrl ? (
              <img
                src={contentUrl}
                alt="preview"
                className="h-full w-full object-cover"
              />
            ) : contentText ? (
              <p className="line-clamp-4 px-3 text-xs leading-relaxed text-[var(--cv4-text-muted)]">
                {contentText}
              </p>
            ) : (
              <p className="text-xs text-[var(--cv4-text-disabled)]">无预览</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="mb-1 block text-xs text-[var(--cv4-text-muted)]">
              名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              placeholder="为资产命名..."
              className="w-full rounded-lg border border-[var(--cv4-border-default)] bg-[var(--cv4-surface-elevated)] px-3 py-2 text-sm text-[var(--cv4-text-primary)] outline-none placeholder:text-[var(--cv4-text-placeholder)] focus:border-[var(--cv4-border-focused)]"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1 block text-xs text-[var(--cv4-text-muted)]">
              标签 <span className="text-[var(--cv4-text-disabled)]">(逗号分隔)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="角色, 场景, 风格..."
              className="w-full rounded-lg border border-[var(--cv4-border-default)] bg-[var(--cv4-surface-elevated)] px-3 py-2 text-sm text-[var(--cv4-text-primary)] outline-none placeholder:text-[var(--cv4-text-placeholder)] focus:border-[var(--cv4-border-focused)]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[var(--cv4-border-subtle)] px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-sm text-[var(--cv4-text-secondary)] transition-colors hover:bg-[var(--cv4-surface-secondary)]"
          >
            取消
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!canSave || createMutation.isPending}
            className="rounded-lg bg-[var(--cv4-interactive-buttonPrimary)] px-4 py-1.5 text-sm text-[var(--cv4-interactive-buttonPrimaryText)] transition-opacity disabled:opacity-40"
          >
            {createMutation.isPending ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SaveAssetDialog;
