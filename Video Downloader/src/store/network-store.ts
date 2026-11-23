import { create } from 'zustand';
import type { NetworkState } from 'expo-network';

export type AppNetworkType = 'WIFI' | 'CELLULAR' | 'NONE';

type NetworkStore = {
  type: AppNetworkType;
  isConnected: boolean;
  isInternetReachable: boolean | null;
  error: string | null;
  setNetworkState: (state: NetworkState) => void;
  setError: (message: string) => void;
};

export const useNetworkStore = create<NetworkStore>((set) => ({
  type: 'NONE',
  isConnected: false,
  isInternetReachable: false,
  error: null,
  setNetworkState: (state) => {
    const type: AppNetworkType =
      state.type === 'WIFI'
        ? 'WIFI'
        : state.type === 'CELLULAR'
          ? 'CELLULAR'
          : 'NONE';
    set({
      type,
      isConnected: state.isConnected === true,
      isInternetReachable: state.isInternetReachable ?? null,
      error: null,
    });
  },
  setError: (error) => set({ error }),
}));
