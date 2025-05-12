import { create } from "zustand";

type Store = {
  selected: string[];
  toggleSelected: (id: string, enabled: boolean) => void;
  clear: () => void;
  selectMany: (ids: string[]) => void;
};

export const useSelectedOrders = create<Store>((set) => ({
  selected: [],
  toggleSelected: (id: string, enabled: boolean) =>
    set((state: Store) => {
      if (!enabled) return state;
      return state.selected.includes(id)
        ? { selected: state.selected.filter((x: string) => x !== id) }
        : { selected: [...state.selected, id] };
    }),
  clear: () => set({ selected: [] }),
  selectMany: (ids: string[]) => set({ selected: ids }),
}));
