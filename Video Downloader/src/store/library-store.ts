import { create } from 'zustand';

import type { Video } from '@/src/types';

type LibraryStore = {
  videos: Video[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
  setVideos: (videos: Video[]) => void;
  upsertVideo: (video: Video) => void;
  removeVideo: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
};

export const useLibraryStore = create<LibraryStore>((set) => ({
  videos: [],
  loading: false,
  initialized: false,
  error: null,
  setVideos: (videos) => set({ videos, initialized: true, error: null }),
  upsertVideo: (video) =>
    set((state) => ({
      videos: [video, ...state.videos.filter((item) => item.id !== video.id)]
        .sort((a, b) => b.savedAt - a.savedAt),
    })),
  removeVideo: (id) =>
    set((state) => ({
      videos: state.videos.filter((video) => video.id !== id),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
