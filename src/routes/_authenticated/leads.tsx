import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Trash2, LogOut, Plus, MessageCircle, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Lead = {
  id: string;
  serial: number;
  phone: string | null;
  facebook_link: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Leads Dashboard — LeadVault" },
      {
        name: "description",
        content: "Save Facebook lead links with auto serial numbers and filter them by date.",
      },
      { property: "og:title", content: "Leads Dashboard — LeadVault" },
      { property: "og:description", content: "Your Facebook leads, organised and date-filtered." },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [link, setLink] = useState("");
  const [phone, setPhone] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async (): Promise<Lead[]> => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, serial, phone, facebook_link, created_at")
        .order("serial", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addLead = useMutation({
    mutationFn: async () => {
      const trimmed = link.trim();
      if (!/^https?:\/\/.+/i.test(trimmed)) throw new Error("Ekta valid link din (https://...)");
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session shesh hoye geche, abar login korun.");
      const { error } = await supabase.from("leads").insert({
        user_id: uid,
        facebook_link: trimmed.slice(0, 500),
        phone: phone.trim().slice(0, 30) || null,
        serial: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setLink("");
      setPhone("");
      toast.success("Lead add hoyeche");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead delete hoyeche");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const d = new Date(l.created_at);
      if (from && d < new Date(`${from}T00:00:00`)) return false;
      if (to && d > new Date(`${to}T23:59:59`)) return false;
      return true;
    });
  }, [leads, from, to]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <main className="min-h-screen">
      <header
        className="px-6 py-10 text-primary-foreground"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">LeadVault</h1>
            <p className="text-sm opacity-90">
              Facebook lead links — auto serial number & date filter
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={signOut}>
            <LogOut className="mr-2 size-4" /> Logout
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <Card className="shadow-[var(--shadow-panel)]">
          <CardHeader>
            <CardTitle className="text-lg">Notun lead add korun</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                addLead.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="link">Facebook link</Label>
                <Input
                  id="link"
                  required
                  maxLength={500}
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://facebook.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number (optional)</Label>
                <Input
                  id="phone"
                  maxLength={30}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="8801XXXXXXXXX"
                />
              </div>
              <Button type="submit" className="sm:self-end" disabled={addLead.isPending}>
                <Plus className="mr-2 size-4" /> Add
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <CardTitle className="text-lg">
              Leads <span className="text-muted-foreground">({filtered.length})</span>
            </CardTitle>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="from" className="text-xs">
                  From
                </Label>
                <Input
                  id="from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="to" className="text-xs">
                  To
                </Label>
                <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
              >
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Kono lead nei. Upore link add korun.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Facebook link</TableHead>
                    <TableHead className="w-32">Date</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-semibold">{lead.serial}</TableCell>
                      <TableCell>
                        {lead.phone ? (
                          <a
                            href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                          >
                            <MessageCircle className="size-3" />
                            {lead.phone}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">No number</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate">
                        <a
                          href={lead.facebook_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {lead.facebook_link}
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLead.mutate(lead.id)}
                          aria-label="Delete lead"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
