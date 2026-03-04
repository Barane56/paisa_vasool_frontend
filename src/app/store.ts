import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from '@/features/auth';
import disputeReducer from '@/features/disputes/slices/disputeSlice';
import { loggerMiddleware, authMiddleware } from './middleware';

export const store = configureStore({
  reducer: {
    auth:     authReducer,
    disputes: disputeReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(authMiddleware, loggerMiddleware),
  devTools: import.meta.env.DEV,
});

export type AppDispatch = typeof store.dispatch;
export type AppStore    = typeof store;
