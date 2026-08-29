import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
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
  RotateCcw,
  Search,
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
  deleted_at: string | null;
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
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"active" | "archived" | "trash">("active");
  const [selected, setSelected] = useState<string[]>([]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async (): Promise<Lead[]> => {
      // 30 din er purono trash auto delete
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("leads").delete().lt("deleted_at", cutoff);

      const { data, error } = await supabase
        .from("leads")
        .select("id, serial, phone, facebook_link, verified, archived, deleted_at, created_at")
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

  const addBulk = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session shesh hoye geche, abar login korun.");

      const existingLinks = new Set(leads.map((l) => l.facebook_link.toLowerCase()));
      const rows: { user_id: string; facebook_link: string; serial: number }[] = [];
      const seen = new Set<string>();
      let skipped = 0;

      for (const line of bulkText.split("\n")) {
        const match = line.match(/https?:\/\/\S+/i);
        if (!match) continue;
        const url = match[0].replace(/[),.;]+$/, "").slice(0, 500);
        const key = url.toLowerCase();
        if (seen.has(key) || existingLinks.has(key)) {
          skipped++;
          continue;
        }
        seen.add(key);
        rows.push({ user_id: uid, facebook_link: url, serial: 0 });
      }

      if (rows.length === 0)
        throw new Error(skipped > 0 ? "Shob link already add kora ache." : "Kono valid link pawa jayni.");
      const { error } = await supabase.from("leads").insert(rows);
      if (error) throw error;
      return { added: rows.length, skipped };
    },
    onSuccess: ({ added, skipped }) => {
      setBulkText("");
      setShowBulk(false);
      toast.success(
        skipped > 0 ? `${added} ta lead add hoyeche (${skipped} ta duplicate skip)` : `${added} ta lead add hoyeche`,
      );
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeLead = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("leads")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelected([]);
      toast.success("Trash-e pathano hoyeche (30 din thakbe)");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreLead = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("leads").update({ deleted_at: null }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelected([]);
      toast.success("Restore kora hoyeche");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const purgeLead = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("leads").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelected([]);
      toast.success("Permanently delete hoyeche");
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
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (view === "trash") {
        if (!l.deleted_at) return false;
      } else {
        if (l.deleted_at) return false;
        if (l.archived !== (view === "archived")) return false;
      }
      if (q) {
        const match =
          String(l.serial) === q ||
          String(l.serial).includes(q) ||
          l.facebook_link.toLowerCase().includes(q) ||
          (l.phone ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }
      const d = new Date(l.created_at);
      if (from && d < new Date(`${from}T00:00:00`)) return false;
      if (to && d > new Date(`${to}T23:59:59`)) return false;
      return true;
    });
  }, [leads, from, to, view, search]);

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

        {!showBulk ? (
          <Button variant="outline" onClick={() => setShowBulk(true)}>
            <Plus className="mr-2 size-4" /> Ek sathe onek lead add korun (Bulk Add)
          </Button>
        ) : (
          <Card className="shadow-[var(--shadow-panel)]">
            <CardHeader>
              <CardTitle className="text-lg">Bulk Add — onek lead ek sathe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Prottek line-e ekta kore Facebook link din (number/serial thakleo hobe — shudhu link
                niya hobe). Duplicate link auto skip hobe.
              </p>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={8}
                placeholder={
                  "429. https://www.facebook.com/example1\n430. https://www.facebook.com/example2\nhttps://www.facebook.com/example3"
                }
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => addBulk.mutate()}
                  disabled={addBulk.isPending || !bulkText.trim()}
                >
                  <Plus className="mr-2 size-4" />
                  {addBulk.isPending ? "Adding…" : "Shob add korun"}
                </Button>
                <Button variant="ghost" onClick={() => setShowBulk(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <CardTitle className="text-lg">
                {view === "active" ? "Leads" : view === "archived" ? "Archive" : "Trash"}{" "}
                <span className="text-muted-foreground">({filtered.length})</span>
              </CardTitle>
              <div className="flex flex-wrap gap-2">
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
                <Button
                  size="sm"
                  variant={view === "trash" ? "default" : "outline"}
                  onClick={() => setView("trash")}
                >
                  <Trash2 className="mr-2 size-4" /> Trash
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="search" className="text-xs">
                  Search (serial / link / number)
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="search"
                    className="w-48 pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="429"
                  />
                </div>
              </div>
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
                  setSearch("");
                }}
              >
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {view === "trash" && (
              <p className="mb-4 text-sm text-muted-foreground">
                Trash-er lead gulo 30 din por automatic permanently delete hoye jabe. Chaile ekhoni
                permanently delete ba restore korte paren.
              </p>
            )}
            {selectedVisible.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                <span className="text-sm font-medium">{selectedVisible.length} selected</span>
                <div className="ml-auto flex flex-wrap gap-2">
                  {view === "trash" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={restoreLead.isPending}
                        onClick={() => restoreLead.mutate(selectedVisible)}
                      >
                        <RotateCcw className="mr-2 size-4" /> Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={purgeLead.isPending}
                        onClick={() => purgeLead.mutate(selectedVisible)}
                      >
                        <Trash2 className="mr-2 size-4" /> Delete forever
                      </Button>
                    </>
                  ) : (
                    <>
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
                          onClick={() =>
                            setArchived.mutate({ ids: selectedVisible, archived: false })
                          }
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
                    </>
                  )}
                </div>
              </div>
            )}

            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {view === "active"
                  ? "Kono lead nei. Upore link add korun."
                  : view === "archived"
                    ? "Archive khali ache."
                    : "Trash khali ache."}
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
                          {view === "trash" ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => restoreLead.mutate([lead.id])}
                                aria-label="Restore lead"
                              >
                                <RotateCcw className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => purgeLead.mutate([lead.id])}
                                aria-label="Delete lead forever"
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </>
                          ) : (
                            <>
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
                                aria-label="Move lead to trash"
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </>
                          )}
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
