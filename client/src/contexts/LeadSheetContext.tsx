import { createContext, useContext, useState, ReactNode } from "react";

interface LeadSheetContextType {
  selectedLeadId: string | null;
  openLeadSheet: (leadId: string) => void;
  closeLeadSheet: () => void;
}

const LeadSheetContext = createContext<LeadSheetContextType | undefined>(undefined);

export function LeadSheetProvider({ children }: { children: ReactNode }) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const openLeadSheet = (leadId: string) => {
    setSelectedLeadId(leadId);
  };

  const closeLeadSheet = () => {
    setSelectedLeadId(null);
  };

  return (
    <LeadSheetContext.Provider value={{ selectedLeadId, openLeadSheet, closeLeadSheet }}>
      {children}
    </LeadSheetContext.Provider>
  );
}

export function useLeadSheet() {
  const context = useContext(LeadSheetContext);
  if (!context) {
    throw new Error("useLeadSheet must be used within a LeadSheetProvider");
  }
  return context;
}
