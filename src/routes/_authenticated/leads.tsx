import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  Trash2,
  LogOut,
  Plus,
  MessageCircle,
  X,
  Check,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  verified: boolean;
  archived: boolean;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Leads Dashboard — LeadVault" },
      {
        name: "description",
        content: "Save Facebook lead links with auto serial numbers, archive and filter by date.",
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
  const [view, setView] = useState<"active" | "archived">("active");
  const [selected, setSelected] = useState<string[]>([]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async (): Promise<Lead[]> => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, serial, phone, facebook_link, verified, archived, created_at")
        .order("serial", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addLead = useMutation({
    mutationFn: async () => {
      const trimmedLink = link.trim();
      const trimmedPhone = phone.trim().slice(0, 30) || null;
      if (!/^https?:\/\/.+/i.test(trimmedLink)) throw new Error("Ekta valid link din (https://...)");
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session shesh hoye geche, abar login korun.");

      const linkLower = trimmedLink.toLowerCase();
      const duplicateLink = leads.find((l) => l.facebook_link.toLowerCase() === linkLower);
      if (duplicateLink) throw new Error("Ei Facebook link already add kora ache.");

      if (trimmedPhone) {
        const phoneDigits = trimmedPhone.replace(/\D/g, "");
        const duplicatePhone = leads.find(
          (l) => l.phone && l.phone.replace(/\D/g, "") === phoneDigits,
        );
        if (duplicatePhone) throw new Error("Ei phone number already add kora ache.");
      }

      const { error } = await supabase.from("leads").insert({
        user_id: uid,
        facebook_link: trimmedLink.slice(0, 500),
        phone: trimmedPhone,
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
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("leads").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelected([]);
      toast.success("Lead delete hoyeche");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setArchived = useMutation({
    mutationFn: async ({ ids, archived }: { ids: string[]; archived: boolean }) => {
      const { error } = await supabase.from("leads").update({ archived }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      setSelected([]);
      toast.success(v.archived ? "Archive kora hoyeche" : "Unarchive kora hoyeche");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleVerified = useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      const { error } = await supabase.from("leads").update({ verified }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (l.archived !== (view === "archived")) return false;
      const d = new Date(l.created_at);
      if (from && d < new Date(`${from}T00:00:00`)) return false;
      if (to && d > new Date(`${to}T23:59:59`)) return false;
      return true;
    });
  }, [leads, from, to, view]);

  useEffect(() => {
    setSelected([]);
  }, [view]);

  const visibleIds = filtered.map((l) => l.id);
  const selectedVisible = selected.filter((id) => visibleIds.includes(id));
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

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
              Facebook lead links — auto serial number, archive & date filter
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
            <div className="space-y-3">
              <CardTitle className="text-lg">
                {view === "active" ? "Leads" : "Archive"}{" "}
                <span className="text-muted-foreground">({filtered.length})</span>
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={view === "active" ? "default" : "outline"}
                  onClick={() => setView("active")}
                >
                  Active
                </Button>
                <Button
                  size="sm"
                  variant={view === "archived" ? "default" : "outline"}
                  onClick={() => setView("archived")}
                >
                  <Archive className="mr-2 size-4" /> Archive
                </Button>
              </div>
            </div>
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
            {selectedVisible.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                <span className="text-sm font-medium">{selectedVisible.length} selected</span>
                <div className="ml-auto flex flex-wrap gap-2">
                  {view === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={setArchived.isPending}
                      onClick={() => setArchived.mutate({ ids: selectedVisible, archived: true })}
                    >
                      <Archive className="mr-2 size-4" /> Archive
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={setArchived.isPending}
                      onClick={() => setArchived.mutate({ ids: selectedVisible, archived: false })}
                    >
                      <ArchiveRestore className="mr-2 size-4" /> Unarchive
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={removeLead.isPending}
                    onClick={() => removeLead.mutate(selectedVisible)}
                  >
                    <Trash2 className="mr-2 size-4" /> Remove
                  </Button>
                </div>
              </div>
            )}

            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {view === "active"
                  ? "Kono lead nei. Upore link add korun."
                  : "Archive khali ache."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(c) => setSelected(c ? visibleIds : [])}
                        aria-label="Select all leads"
                      />
                    </TableHead>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead className="w-20 text-center">Status</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Facebook link</TableHead>
                    <TableHead className="w-32">Date</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lead) => (
                    <TableRow key={lead.id} data-state={selected.includes(lead.id) && "selected"}>
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(lead.id)}
                          onCheckedChange={(c) =>
                            setSelected((prev) =>
                              c ? [...prev, lead.id] : prev.filter((id) => id !== lead.id),
                            )
                          }
                          aria-label={`Select lead ${lead.serial}`}
                        />
                      </TableCell>
                      <TableCell className="font-semibold">{lead.serial}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8"
                          onClick={() =>
                            toggleVerified.mutate({ id: lead.id, verified: !lead.verified })
                          }
                          aria-label={lead.verified ? "Mark as not verified" : "Mark as verified"}
                        >
                          {lead.verified ? (
                            <Check className="size-4 text-blue-500" />
                          ) : (
                            <X className="size-4 text-red-500" />
                          )}
                        </Button>
                      </TableCell>
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
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setArchived.mutate({ ids: [lead.id], archived: !lead.archived })
                            }
                            aria-label={lead.archived ? "Unarchive lead" : "Archive lead"}
                          >
                            {lead.archived ? (
                              <ArchiveRestore className="size-4" />
                            ) : (
                              <Archive className="size-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLead.mutate([lead.id])}
                            aria-label="Delete lead"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
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
