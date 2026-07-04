import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LinkedWholesaler {
  id: number;
  shopName: string | null;
  uniqueVendorId: string | null;
  name: string;
}

interface WholesalerStore {
  selectedWholesalerId: number | null;
  selectedWholesaler: LinkedWholesaler | null;
  setSelectedWholesaler: (wholesaler: LinkedWholesaler) => void;
  clearSelectedWholesaler: () => void;
}

export const useWholesalerStore = create<WholesalerStore>()(
  persist(
    (set) => ({
      selectedWholesalerId: null,
      selectedWholesaler: null,
      setSelectedWholesaler: (wholesaler) =>
        set({ selectedWholesalerId: wholesaler.id, selectedWholesaler: wholesaler }),
      clearSelectedWholesaler: () =>
        set({ selectedWholesalerId: null, selectedWholesaler: null }),
    }),
    {
      name: "sg_selected_wholesaler",
    }
  )
);
