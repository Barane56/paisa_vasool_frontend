import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks';
import {
  fetchDisputes, updateDisputeStatus,
  setSearch, setStatusFilter, setPriorityFilter, setSelectedDispute,
  selectDisputes, selectTotal, selectLoading, selectError, selectFilters, selectSelectedDispute,
} from '../slices/disputeSlice';
import { Dispute } from '../services/disputeService';

export const useDisputes = () => {
  const dispatch    = useAppDispatch();
  const disputes    = useAppSelector(selectDisputes);
  const total       = useAppSelector(selectTotal);
  const loading     = useAppSelector(selectLoading);
  const error       = useAppSelector(selectError);
  const filters     = useAppSelector(selectFilters);
  const selected    = useAppSelector(selectSelectedDispute);

  return {
    disputes, total, loading, error, filters, selected,
    load:              useCallback(() => dispatch(fetchDisputes()), [dispatch]),
    updateStatus:      useCallback((id: number, status: string) => dispatch(updateDisputeStatus({ disputeId: id, status })), [dispatch]),
    updateSearch:      useCallback((v: string)  => dispatch(setSearch(v)),         [dispatch]),
    updateStatus_filter: useCallback((v: string) => dispatch(setStatusFilter(v)),  [dispatch]),
    updatePriority:    useCallback((v: string)  => dispatch(setPriorityFilter(v)), [dispatch]),
    selectDispute:     useCallback((d: Dispute | null) => dispatch(setSelectedDispute(d)), [dispatch]),
  };
};
