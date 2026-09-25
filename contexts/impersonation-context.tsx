"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type UserProfile = {
  uid: string;
  full_name: string | null;
  email: string | null;
  balance: number;
  total_referrals: number;
  total_trades: number;
};

type ImpersonationContextType = {
  impersonatedUser: UserProfile | null;
  isImpersonating: boolean;
};

const ImpersonationContext = createContext<ImpersonationContextType>({
  impersonatedUser: null,
  isImpersonating: false,
});

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [impersonatedUser, setImpersonatedUser] = useState<UserProfile | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const userId = searchParams.get("impersonate");
    if (userId) {
      (async () => {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("uid", userId)
          .single();

        if (!error && data) {
          setImpersonatedUser(data);
        }
      })();
    } else {
      setImpersonatedUser(null);
    }
  }, [searchParams]);

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUser,
        isImpersonating: !!impersonatedUser,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  return useContext(ImpersonationContext);
}
