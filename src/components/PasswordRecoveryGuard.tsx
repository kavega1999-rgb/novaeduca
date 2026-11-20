import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { initialRecoveryLink, isPasswordRecoveryLink } from "@/lib/password-recovery";

export function PasswordRecoveryGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [recovering, setRecovering] = useState(initialRecoveryLink);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (location.pathname === "/reset-password") setRecovering(false);
  }, [location.pathname]);

  if ((recovering || isPasswordRecoveryLink(location.hash)) && location.pathname !== "/reset-password") {
    return <Navigate to={`/reset-password${location.search}${location.hash}`} replace />;
  }
  return <>{children}</>;
}