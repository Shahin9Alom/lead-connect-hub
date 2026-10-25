import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Check the locally stored session first — it needs no network call. Calling
    // the auth server on every page load made /leads hang or bounce to /auth
    // whenever the internet was slow or flaky.
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) return { user: sessionData.session.user };
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
