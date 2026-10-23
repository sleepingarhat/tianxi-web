import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type AuthState = {
  /** null = 未載入完成 */
  signedIn: boolean | null;
  isAdmin: boolean;
  userId: string | null;
};

/** 全站共用登入狀態：signedIn 用嚟切換註冊／會員按鈕，isAdmin 決定監控台入口。 */
export function useAuthState(): AuthState {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function refresh() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      const session = data.session;
      setUserId(session?.user.id ?? null);
      setSignedIn(!!session);
      if (!session) {
        setIsAdmin(false);
        return;
      }
      const { data: admin } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      if (alive) setIsAdmin(admin === true);
    }

    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { signedIn, isAdmin, userId };
}
