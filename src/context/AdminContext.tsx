import { createContext, useContext } from "react";

export interface MenuItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  tag: string;
  imageKey: string;
  isSoldOut: boolean;
}

export interface AdminContextType {
  menuData: MenuItem[] | undefined;
  refetchMenu: () => void;
  isLoadingMenu: boolean;
  loadError: any;
}

export const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function useAdminContext() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdminContext must be used within an AdminContext.Provider");
  }
  return context;
}
