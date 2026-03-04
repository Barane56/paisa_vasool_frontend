import { combineReducers } from '@reduxjs/toolkit';
import { authReducer } from '@/features/auth';
import disputeReducer from '@/features/disputes/slices/disputeSlice';

const rootReducer = combineReducers({
  auth:     authReducer,
  disputes: disputeReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
