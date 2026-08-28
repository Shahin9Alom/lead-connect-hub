import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LeadVault — Facebook Lead Management" },
      {
        name: "description",
        content:
          "Save Facebook lead links with auto serial numbers, then filter your whole lead list by date.",
      },
      { property: "og:title", content: "LeadVault — Facebook Lead Management" },
      {
        property: "og:description",
        content: "Facebook lead links, auto serial numbers and date filtering in one dashboard.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/leads" });
    });
  }, [navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div
        className="mb-8 rounded-3xl px-10 py-14 text-primary-foreground shadow-[var(--shadow-panel)]"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        <h1 className="text-4xl font-bold sm:text-5xl">LeadVault</h1>
        <p className="mx-auto mt-4 max-w-md text-base opacity-90">
          Facebook lead links ek jaygay rakhun — protita lead-e auto serial number, ar date filter
          diye jekono somoyer leads dekhun.
        </p>
        <Button asChild size="lg" variant="secondary" className="mt-8">
          <Link to="/auth">Shuru korun</Link>
        </Button>
      </div>
      <p className="max-w-md text-sm text-muted-foreground">
        Apnar leads shudhu apnar account-e save thake — nirapod, sob device theke access kora jay.
      </p>
    </main>
  );
}
