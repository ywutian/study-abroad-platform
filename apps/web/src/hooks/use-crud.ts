'use client';

import { useState, useCallback } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

// ============ Types ============

interface CRUDConfig<TItem, TFormData> {
  /** React Query key for the list query */
  queryKey: QueryKey;
  /** API base path, e.g. '/profiles/me/essays' */
  basePath: string;
  /** Toast messages */
  messages?: {
    created?: string;
    updated?: string;
    deleted?: string;
    createError?: string;
    updateError?: string;
    deleteError?: string;
  };
  /** Additional query keys to invalidate on mutation */
  invalidateKeys?: QueryKey[];
  /** Custom query options */
  queryOptions?: Partial<UseQueryOptions<TItem[]>>;
  /** Transform form data before sending to API */
  transformCreate?: (data: TFormData) => unknown;
  /** Transform form data before sending update to API */
  transformUpdate?: (data: TFormData) => unknown;
  /** Whether the list query is enabled (default: true) */
  enabled?: boolean;
}

interface CRUDState<TItem> {
  /** Currently selected item for editing (null = create mode) */
  selectedItem: TItem | null;
  /** Whether the form dialog is open */
  isFormOpen: boolean;
  /** Whether the delete confirmation dialog is open */
  isDeleteOpen: boolean;
  /** ID of the item pending deletion */
  deleteId: string | null;
  /** Name of the item pending deletion (for display) */
  deleteName: string | null;
}

interface CRUDResult<TItem, TFormData> {
  // Data
  items: TItem[];
  isLoading: boolean;
  error: Error | null;

  // Dialog state
  selectedItem: TItem | null;
  isFormOpen: boolean;
  isDeleteOpen: boolean;
  deleteName: string | null;

  // Actions — open dialogs
  openCreate: () => void;
  openEdit: (item: TItem) => void;
  openDelete: (id: string, name?: string) => void;
  close: () => void;

  // Mutations
  handleCreate: (data: TFormData) => Promise<void>;
  handleUpdate: (id: string, data: TFormData) => Promise<void>;
  handleDelete: () => Promise<void>;
  isPending: boolean;
}

// ============ Hook ============

export function useCRUD<TItem extends { id: string }, TFormData = Partial<TItem>>(
  config: CRUDConfig<TItem, TFormData>
): CRUDResult<TItem, TFormData> {
  const {
    queryKey,
    basePath,
    messages = {},
    invalidateKeys = [],
    queryOptions = {},
    transformCreate,
    transformUpdate,
    enabled = true,
  } = config;

  const queryClient = useQueryClient();

  // State
  const [state, setState] = useState<CRUDState<TItem>>({
    selectedItem: null,
    isFormOpen: false,
    isDeleteOpen: false,
    deleteId: null,
    deleteName: null,
  });

  // List query
  const {
    data: items = [],
    isLoading,
    error,
  } = useQuery<TItem[]>({
    queryKey,
    queryFn: () => apiClient.get<TItem[]>(basePath),
    enabled,
    ...queryOptions,
  });

  // Invalidation helper
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
    invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  }, [queryClient, queryKey, invalidateKeys]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: TFormData) =>
      apiClient.post(basePath, transformCreate ? transformCreate(data) : data),
    onSuccess: () => {
      invalidateAll();
      setState((s) => ({ ...s, isFormOpen: false, selectedItem: null }));
      if (messages.created) toast.success(messages.created);
    },
    onError: () => {
      if (messages.createError) toast.error(messages.createError);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TFormData }) =>
      apiClient.put(`${basePath}/${id}`, transformUpdate ? transformUpdate(data) : data),
    onSuccess: () => {
      invalidateAll();
      setState((s) => ({ ...s, isFormOpen: false, selectedItem: null }));
      if (messages.updated) toast.success(messages.updated);
    },
    onError: () => {
      if (messages.updateError) toast.error(messages.updateError);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`${basePath}/${id}`),
    onSuccess: () => {
      invalidateAll();
      setState((s) => ({
        ...s,
        isDeleteOpen: false,
        deleteId: null,
        deleteName: null,
      }));
      if (messages.deleted) toast.success(messages.deleted);
    },
    onError: () => {
      if (messages.deleteError) toast.error(messages.deleteError);
    },
  });

  // Actions
  const openCreate = useCallback(() => {
    setState((s) => ({ ...s, isFormOpen: true, selectedItem: null }));
  }, []);

  const openEdit = useCallback((item: TItem) => {
    setState((s) => ({ ...s, isFormOpen: true, selectedItem: item }));
  }, []);

  const openDelete = useCallback((id: string, name?: string) => {
    setState((s) => ({
      ...s,
      isDeleteOpen: true,
      deleteId: id,
      deleteName: name ?? null,
    }));
  }, []);

  const close = useCallback(() => {
    setState({
      selectedItem: null,
      isFormOpen: false,
      isDeleteOpen: false,
      deleteId: null,
      deleteName: null,
    });
  }, []);

  const handleCreate = useCallback(
    async (data: TFormData) => {
      await createMutation.mutateAsync(data);
    },
    [createMutation]
  );

  const handleUpdate = useCallback(
    async (id: string, data: TFormData) => {
      await updateMutation.mutateAsync({ id, data });
    },
    [updateMutation]
  );

  const handleDelete = useCallback(async () => {
    if (!state.deleteId) return;
    await deleteMutation.mutateAsync(state.deleteId);
  }, [deleteMutation, state.deleteId]);

  return {
    items,
    isLoading,
    error: error as Error | null,
    selectedItem: state.selectedItem,
    isFormOpen: state.isFormOpen,
    isDeleteOpen: state.isDeleteOpen,
    deleteName: state.deleteName,
    openCreate,
    openEdit,
    openDelete,
    close,
    handleCreate,
    handleUpdate,
    handleDelete,
    isPending: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
