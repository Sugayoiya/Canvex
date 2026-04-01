"use client";

import { useState, useEffect, useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { Users, Search, Ban, CircleCheck, Shield, ShieldOff } from "lucide-react";
import { adminApi } from "@/lib/api";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { FilterToolbar } from "@/components/admin/filter-toolbar";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminBadge } from "@/components/admin/admin-badge";
import { RowDropdownMenu } from "@/components/admin/row-dropdown-menu";
import { ConfirmationModal } from "@/components/admin/confirmation-modal";
import { useAuthStore } from "@/stores/auth-store";
import { AdminErrorBoundary } from "@/components/admin/admin-error-boundary";

interface AdminUser {
  id: string;
  email: string;
  nickname: string;
  avatar: string | null;
  status: "active" | "banned";
  is_admin: boolean;
  teams: string[];
  last_login_at: string | null;
  created_at: string;
}

interface AdminUserListResponse {
  items: AdminUser[];
  total: number;
  limit: number;
  offset: number;
  admin_count: number;
}

type ModalAction = "ban" | "enable" | "grant" | "revoke";

interface ModalState {
  isOpen: boolean;
  action: ModalAction | null;
  user: AdminUser | null;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days <= 30) return `${days}d ago`;
  return new Date(dateStr).toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toISOString().slice(0, 10);
}

const columnHelper = createColumnHelper<AdminUser>();

const MODAL_COPY: Record<
  ModalAction,
  {
    icon: React.ReactNode;
    title: string;
    bodyFn: (email: string) => React.ReactNode;
    confirmLabel: string;
    confirmVariant: "primary" | "destructive";
    warning?: string;
  }
> = {
  ban: {
    icon: <Ban size={20} />,
    title: "Ban User",
    bodyFn: (email) => (
      <>
        Are you sure you want to ban <strong>{email}</strong>? They will be
        immediately logged out and unable to access the platform.
      </>
    ),
    confirmLabel: "Ban User",
    confirmVariant: "destructive",
  },
  enable: {
    icon: <CircleCheck size={20} />,
    title: "Enable User",
    bodyFn: (email) => (
      <>
        Re-enable access for <strong>{email}</strong>? They will be able to
        log in again.
      </>
    ),
    confirmLabel: "Enable User",
    confirmVariant: "primary",
  },
  grant: {
    icon: <Shield size={20} />,
    title: "Grant Admin",
    bodyFn: (email) => (
      <>
        Grant admin privileges to <strong>{email}</strong>? They will have
        full access to the admin console.
      </>
    ),
    confirmLabel: "Grant Admin",
    confirmVariant: "primary",
  },
  revoke: {
    icon: <ShieldOff size={20} />,
    title: "Revoke Admin",
    bodyFn: (email) => (
      <>
        Revoke admin privileges from <strong>{email}</strong>? They will lose
        access to the admin console.
      </>
    ),
    confirmLabel: "Revoke Admin",
    confirmVariant: "primary",
    warning:
      "This action cannot be undone from the admin console if you are also removed as admin.",
  },
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [adminFilter, setAdminFilter] = useState("all");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    action: null,
    user: null,
  });

  // 300ms debounce on search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue), 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // Reset pagination on filter/search change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, statusFilter, adminFilter]);

  const queryParams = {
    q: debouncedSearch || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    is_admin: adminFilter !== "all" ? adminFilter === "true" : undefined,
    sort_by: sorting[0]?.id ?? "created_at",
    sort_order: sorting[0]?.desc ? "desc" : "asc",
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "users", queryParams],
    queryFn: () =>
      adminApi
        .listUsers(queryParams)
        .then((r) => r.data as AdminUserListResponse),
  });

  const toggleStatus = useMutation({
    mutationFn: ({
      userId,
      status,
    }: {
      userId: string;
      status: "active" | "banned";
    }) => adminApi.toggleUserStatus(userId, { status }),
    onSuccess: (_, { userId, status }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      const email = data?.items.find((u) => u.id === userId)?.email ?? userId;
      toast.success(status === "banned" ? `已封禁 ${email}` : `已启用 ${email}`);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`操作失败: ${message}`);
    },
  });

  const toggleAdmin = useMutation({
    mutationFn: ({
      userId,
      is_admin,
    }: {
      userId: string;
      is_admin: boolean;
    }) => adminApi.toggleUserAdmin(userId, { is_admin }),
    onSuccess: (_, { userId, is_admin }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      const email = data?.items.find((u) => u.id === userId)?.email ?? userId;
      toast.success(
        is_admin
          ? `已授予 ${email} 管理员权限`
          : `已撤销 ${email} 管理员权限`
      );
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`操作失败: ${message}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("nickname", {
        header: "NAME",
        enableSorting: false,
        cell: (info) => (
          <span
            style={{
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--cv4-text-primary)",
            }}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("email", {
        header: "EMAIL",
        enableSorting: true,
        cell: (info) => (
          <span
            style={{
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-secondary)",
            }}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("status", {
        header: "STATUS",
        enableSorting: false,
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor("is_admin", {
        header: "ADMIN",
        enableSorting: false,
        cell: (info) => <AdminBadge isAdmin={info.getValue()} />,
      }),
      columnHelper.accessor("teams", {
        header: "TEAMS",
        enableSorting: false,
        cell: (info) => {
          const teams = info.getValue();
          if (!teams || teams.length === 0) {
            return (
              <span style={{ color: "var(--cv4-text-muted)", fontSize: 12 }}>
                —
              </span>
            );
          }
          const display =
            teams.length <= 2
              ? teams.join(", ")
              : `${teams[0]}, +${teams.length - 1} more`;
          return (
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--cv4-text-secondary)",
              }}
              title={teams.join(", ")}
            >
              {display}
            </span>
          );
        },
      }),
      columnHelper.accessor("last_login_at", {
        header: "LAST LOGIN",
        enableSorting: true,
        cell: (info) => {
          const val = info.getValue();
          const isNever = !val;
          return (
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: isNever
                  ? "var(--cv4-text-muted)"
                  : "var(--cv4-text-secondary)",
              }}
            >
              {formatRelativeTime(val)}
            </span>
          );
        },
      }),
      columnHelper.accessor("created_at", {
        header: "CREATED",
        enableSorting: true,
        cell: (info) => (
          <span
            style={{
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-secondary)",
            }}
          >
            {formatDate(info.getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        size: 48,
        cell: (info) => {
          const user = info.row.original;
          const isSelf = user.id === currentUserId;
          const adminCount = data?.admin_count ?? 0;

          const statusItem: Parameters<typeof RowDropdownMenu>[0]["items"][0] =
            user.status === "active"
              ? {
                  icon: <Ban size={14} />,
                  label: "Ban User",
                  variant: "destructive" as const,
                  disabled: isSelf,
                  disabledTooltip: isSelf ? "Cannot ban yourself" : undefined,
                  onClick: () =>
                    setModalState({ isOpen: true, action: "ban", user }),
                }
              : {
                  icon: <CircleCheck size={14} />,
                  label: "Enable User",
                  variant: "default" as const,
                  onClick: () =>
                    setModalState({ isOpen: true, action: "enable", user }),
                };

          let adminItem: Parameters<typeof RowDropdownMenu>[0]["items"][0];
          if (!user.is_admin) {
            adminItem = {
              icon: <Shield size={14} />,
              label: "Grant Admin",
              onClick: () =>
                setModalState({ isOpen: true, action: "grant", user }),
            };
          } else if (isSelf) {
            adminItem = {
              icon: <ShieldOff size={14} />,
              label: "Revoke Admin",
              disabled: true,
              disabledTooltip: "Cannot revoke your own admin role",
              onClick: () => {},
            };
          } else if (adminCount <= 1) {
            adminItem = {
              icon: <ShieldOff size={14} />,
              label: "Revoke Admin",
              disabled: true,
              disabledTooltip: "Cannot revoke — last admin",
              onClick: () => {},
            };
          } else {
            adminItem = {
              icon: <ShieldOff size={14} />,
              label: "Revoke Admin",
              onClick: () =>
                setModalState({ isOpen: true, action: "revoke", user }),
            };
          }

          return (
            <RowDropdownMenu
              triggerLabel={`User actions for ${user.email}`}
              items={[statusItem, adminItem]}
            />
          );
        },
      }),
    ],
    [currentUserId, data?.admin_count]
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    pageCount: Math.ceil((data?.total ?? 0) / pagination.pageSize),
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const hasActiveFilters =
    !!debouncedSearch || statusFilter !== "all" || adminFilter !== "all";

  const clearAllFilters = () => {
    setSearchValue("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setAdminFilter("all");
  };

  const handleModalConfirm = () => {
    if (!modalState.user || !modalState.action) return;
    const { id } = modalState.user;

    switch (modalState.action) {
      case "ban":
        toggleStatus.mutate({ userId: id, status: "banned" });
        break;
      case "enable":
        toggleStatus.mutate({ userId: id, status: "active" });
        break;
      case "grant":
        toggleAdmin.mutate({ userId: id, is_admin: true });
        break;
      case "revoke":
        toggleAdmin.mutate({ userId: id, is_admin: false });
        break;
    }

    setModalState({ isOpen: false, action: null, user: null });
  };

  const closeModal = () =>
    setModalState({ isOpen: false, action: null, user: null });

  const modalCopy = modalState.action ? MODAL_COPY[modalState.action] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* PageHeader */}
      <div>
        <h1
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: 24,
            fontWeight: 700,
            color: "var(--cv4-text-primary)",
            lineHeight: 1.2,
            margin: 0,
            letterSpacing: "-0.5px",
          }}
        >
          Users
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 400,
            color: "var(--cv4-text-muted)",
            lineHeight: 1.5,
            margin: "4px 0 0",
          }}
        >
          Manage user accounts and permissions
        </p>
      </div>

      <AdminErrorBoundary>
      {/* FilterToolbar */}
      <FilterToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search by name or email..."
        filters={[
          {
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "all", label: "All Status" },
              { value: "active", label: "Active" },
              { value: "banned", label: "Banned" },
            ],
          },
          {
            value: adminFilter,
            onChange: setAdminFilter,
            options: [
              { value: "all", label: "All Roles" },
              { value: "true", label: "Admin" },
              { value: "false", label: "Non-admin" },
            ],
          },
        ]}
      />

      {/* DataTable */}
      <AdminDataTable
        table={table}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyIcon={hasActiveFilters ? <Search size={48} /> : <Users size={48} />}
        emptyHeading={hasActiveFilters ? "No users found" : "No users yet"}
        emptyBody={
          hasActiveFilters
            ? "Try adjusting your search or filters."
            : "Users will appear here once they register."
        }
        onClearFilters={hasActiveFilters ? clearAllFilters : undefined}
      />

      {/* Pagination */}
      {!isLoading && !isError && (data?.total ?? 0) > 0 && (
        <AdminPagination
          currentPage={pagination.pageIndex}
          pageCount={table.getPageCount()}
          totalItems={data?.total ?? 0}
          pageSize={pagination.pageSize}
          onPageChange={(p) =>
            setPagination((prev) => ({ ...prev, pageIndex: p }))
          }
          entityName="users"
        />
      )}

      {/* Confirmation Modal */}
      {modalCopy && modalState.user && (
        <ConfirmationModal
          isOpen={modalState.isOpen}
          onClose={closeModal}
          onConfirm={handleModalConfirm}
          title={modalCopy.title}
          body={modalCopy.bodyFn(modalState.user.email)}
          warning={modalCopy.warning}
          confirmLabel={modalCopy.confirmLabel}
          confirmVariant={modalCopy.confirmVariant}
          icon={modalCopy.icon}
          isLoading={toggleStatus.isPending || toggleAdmin.isPending}
        />
      )}
      </AdminErrorBoundary>
    </div>
  );
}
