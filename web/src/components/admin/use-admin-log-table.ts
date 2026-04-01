"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AxiosResponse } from "axios";

const PAGE_SIZE = 20;

interface UseAdminLogTableOptions<T> {
  queryKeyPrefix: string;
  fetchFn: (params: Record<string, unknown>) => Promise<AxiosResponse>;
  filters: Record<string, string>;
  enabled?: boolean;
}

interface UseAdminLogTableResult<T> {
  items: T[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  page: number;
  setPage: (p: number) => void;
  search: string;
  setSearch: (s: string) => void;
  pageSize: number;
}

export function useAdminLogTable<T>({
  queryKeyPrefix,
  fetchFn,
  filters,
  enabled = true,
}: UseAdminLogTableOptions<T>): UseAdminLogTableResult<T> {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filterValues = Object.values(filters).join(",");
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filterValues]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", queryKeyPrefix, page, debouncedSearch, filters],
    queryFn: () => {
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== "")
      );
      return fetchFn({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        ...cleanFilters,
      }).then((r) => ({
        items: r.data as T[],
        total: parseInt(r.headers["x-total-count"] || "0"),
      }));
    },
    enabled,
    staleTime: 30_000,
  });

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    isError,
    refetch,
    page,
    setPage,
    search,
    setSearch,
    pageSize: PAGE_SIZE,
  };
}
