import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { disputeService, Dispute } from '../services/disputeService';

interface DisputeState {
  disputes: Dispute[];
  selectedDispute: Dispute | null;
  total: number;
  loading: boolean;
  error: string | null;
  filters: {
    search: string;
    status: string;
    priority: string;
  };
}

const initialState: DisputeState = {
  disputes: [],
  selectedDispute: null,
  total: 0,
  loading: false,
  error: null,
  filters: { search: '', status: 'all', priority: 'all' },
};

export const fetchDisputes = createAsyncThunk(
  'disputes/fetchAll',
  async (_, { getState }) => {
    const state = getState() as { disputes: DisputeState };
    const { filters } = state.disputes;
    let res = await disputeService.myDisputes({
      search:   filters.search   || undefined,
      status:   filters.status   !== 'all' ? filters.status   : undefined,
      priority: filters.priority !== 'all' ? filters.priority : undefined,
      limit: 100, offset: 0,
    }).catch(() => null);
    if (!res || res.items.length === 0) {
      res = await disputeService.list({ limit: 100, offset: 0 });
    }
    const detailed = await Promise.all(
      res.items.map((d) => disputeService.getDetail(d.dispute_id).catch(() => d))
    );
    return { items: detailed, total: res.total };
  }
);

export const updateDisputeStatus = createAsyncThunk(
  'disputes/updateStatus',
  async ({ disputeId, status }: { disputeId: number; status: string }) => {
    await disputeService.updateStatus(disputeId, status);
    return { disputeId, status };
  }
);

const disputeSlice = createSlice({
  name: 'disputes',
  initialState,
  reducers: {
    setSearch:          (state, action: PayloadAction<string>) => { state.filters.search   = action.payload; },
    setStatusFilter:    (state, action: PayloadAction<string>) => { state.filters.status   = action.payload; },
    setPriorityFilter:  (state, action: PayloadAction<string>) => { state.filters.priority = action.payload; },
    setSelectedDispute: (state, action: PayloadAction<Dispute | null>) => { state.selectedDispute = action.payload; },
    clearError:         (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDisputes.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchDisputes.fulfilled, (state, action) => {
        state.loading = false;
        state.disputes = action.payload.items;
        state.total    = action.payload.total;
      })
      .addCase(fetchDisputes.rejected,  (state, action) => {
        state.loading = false;
        state.error   = action.error.message ?? 'Failed to load disputes';
      })
      .addCase(updateDisputeStatus.fulfilled, (state, action) => {
        const d = state.disputes.find((x) => x.dispute_id === action.payload.disputeId);
        if (d) d.status = action.payload.status;
        if (state.selectedDispute?.dispute_id === action.payload.disputeId) {
          state.selectedDispute.status = action.payload.status;
        }
      });
  },
});

export const { setSearch, setStatusFilter, setPriorityFilter, setSelectedDispute, clearError } = disputeSlice.actions;
export default disputeSlice.reducer;

export const selectDisputes       = (s: { disputes: DisputeState }) => s.disputes.disputes;
export const selectTotal          = (s: { disputes: DisputeState }) => s.disputes.total;
export const selectLoading        = (s: { disputes: DisputeState }) => s.disputes.loading;
export const selectError          = (s: { disputes: DisputeState }) => s.disputes.error;
export const selectFilters        = (s: { disputes: DisputeState }) => s.disputes.filters;
export const selectSelectedDispute= (s: { disputes: DisputeState }) => s.disputes.selectedDispute;
