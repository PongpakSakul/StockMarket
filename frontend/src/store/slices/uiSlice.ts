import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// ============================================================
// Types
// ============================================================

export type CurrencyDisplay = 'USD' | 'THB';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  retryable?: boolean;
}

export interface UIState {
  currencyDisplay: CurrencyDisplay;
  isSlipUploadModalOpen: boolean;
  isConfirmationModalOpen: boolean;
  isExportDialogOpen: boolean;
  isImportDialogOpen: boolean;
  isDeleteConfirmOpen: boolean;
  deleteTargetId: string | null;
  toasts: Toast[];
  globalLoading: boolean;
}

// ============================================================
// Initial State
// ============================================================

const initialState: UIState = {
  currencyDisplay: 'USD',
  isSlipUploadModalOpen: false,
  isConfirmationModalOpen: false,
  isExportDialogOpen: false,
  isImportDialogOpen: false,
  isDeleteConfirmOpen: false,
  deleteTargetId: null,
  toasts: [],
  globalLoading: false,
};

// ============================================================
// Slice
// ============================================================

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setCurrencyDisplay(state, action: PayloadAction<CurrencyDisplay>) {
      state.currencyDisplay = action.payload;
    },
    toggleCurrency(state) {
      state.currencyDisplay = state.currencyDisplay === 'USD' ? 'THB' : 'USD';
    },
    openSlipUploadModal(state) {
      state.isSlipUploadModalOpen = true;
    },
    closeSlipUploadModal(state) {
      state.isSlipUploadModalOpen = false;
    },
    openConfirmationModal(state) {
      state.isConfirmationModalOpen = true;
    },
    closeConfirmationModal(state) {
      state.isConfirmationModalOpen = false;
    },
    openExportDialog(state) {
      state.isExportDialogOpen = true;
    },
    closeExportDialog(state) {
      state.isExportDialogOpen = false;
    },
    openImportDialog(state) {
      state.isImportDialogOpen = true;
    },
    closeImportDialog(state) {
      state.isImportDialogOpen = false;
    },
    openDeleteConfirm(state, action: PayloadAction<string>) {
      state.isDeleteConfirmOpen = true;
      state.deleteTargetId = action.payload;
    },
    closeDeleteConfirm(state) {
      state.isDeleteConfirmOpen = false;
      state.deleteTargetId = null;
    },
    addToast(state, action: PayloadAction<Omit<Toast, 'id'>>) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
      state.toasts.push({ ...action.payload, id });
    },
    removeToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    clearToasts(state) {
      state.toasts = [];
    },
    setGlobalLoading(state, action: PayloadAction<boolean>) {
      state.globalLoading = action.payload;
    },
  },
});

export const {
  setCurrencyDisplay,
  toggleCurrency,
  openSlipUploadModal,
  closeSlipUploadModal,
  openConfirmationModal,
  closeConfirmationModal,
  openExportDialog,
  closeExportDialog,
  openImportDialog,
  closeImportDialog,
  openDeleteConfirm,
  closeDeleteConfirm,
  addToast,
  removeToast,
  clearToasts,
  setGlobalLoading,
} = uiSlice.actions;
export default uiSlice.reducer;
