import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CONDITION_LABELS, type Condition } from "@/lib/detect.functions";
import { adminExists, claimFirstAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Review Desk | KhetRakshak" },
      {
        name: "description",
        content:
          "Database manager desk: verify institute registration codes and approve crop disease images submitted to the KhetRakshak dataset.",
      },
      { property: "og:title", content: "Review Desk | KhetRakshak" },
      {
        property: "og:description",
        content: "Verify institutes and approve crop disease dataset images.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminDesk,
});

function AdminDesk() {
  const { isAdmin, loading } = useSession();
  const queryClient = useQueryClient();
  const checkAdmin = useServerFn(adminExists);
  const claim = useServerFn(claimFirstAdmin);
  const [anyAdmin, setAnyAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    checkAdmin().then((r) => setAnyAdmin(r.exists));
  }, [checkAdmin]);

  const requests = useQuery({
    queryKey: ["all-requests"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributor_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submissions = useQuery({
    queryKey: ["all-entries"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dataset_entries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const decideRequest = useMutation({
    mutationFn: async ({
      id,
      userId,
      approve,
    }: {
      id: string;
      userId: string;
      approve: boolean;
    }) => {
      const { error } = await supabase
        .from("contributor_requests")
        .update({ status: approve ? "approved" : "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      if (approve) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "contributor" });
        if (roleError && !roleError.message.includes("duplicate")) throw roleError;
      }
    },
    onSuccess: () => {
      toast.success("Decision saved.");
      queryClient.invalidateQueries({ queryKey: ["all-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideEntry = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase
        .from("dataset_entries")
        .update({ status: approve ? "approved" : "rejected" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Image reviewed.");
      queryClient.invalidateQueries({ queryKey: ["all-entries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="grid place-items-center py-20">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-xl px-4 py-16">
          <Card>
            <CardHeader>
              <CardTitle>Database manager access only</CardTitle>
              <CardDescription>
                {anyAdmin === false
                  ? "No database manager has been set up yet. You can claim that role now."
                  : "Ask the current database manager to give you access."}
              </CardDescription>
            </CardHeader>
            {anyAdmin === false ? (
              <CardContent>
                <Button
                  onClick={async () => {
                    try {
                      await claim();
                      toast.success("You are now the database manager. Reloading…");
                      window.location.reload();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not claim the role");
                    }
                  }}
                >
                  Become the database manager
                </Button>
              </CardContent>
            ) : null}
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-10">
        <h1 className="text-3xl font-semibold">Review desk</h1>

        <Card>
          <CardHeader>
            <CardTitle>Institute verification</CardTitle>
            <CardDescription>Check registration codes before granting upload rights.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {requests.data?.length ? (
              requests.data.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{r.organisation}</p>
                    <p className="text-muted-foreground">
                      {r.institute_type} · code {r.registration_code}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === "approved" ? "default" : "secondary"}>{r.status}</Badge>
                    {r.status === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            decideRequest.mutate({ id: r.id, userId: r.user_id, approve: true })
                          }
                        >
                          <Check className="size-4" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            decideRequest.mutate({ id: r.id, userId: r.user_id, approve: false })
                          }
                        >
                          <X className="size-4" /> Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dataset images</CardTitle>
            <CardDescription>Approve images to add them to the shared library.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {submissions.data?.length ? (
              submissions.data.map((e) => (
                <div key={e.id} className="grid gap-3 rounded-lg border border-border p-3 text-sm">
                  <SignedImage path={e.image_path} />
                  <div>
                    <p className="font-medium">
                      {e.crop} — {e.disease}
                    </p>
                    <p className="text-muted-foreground">
                      {CONDITION_LABELS[e.condition as Condition]}
                      {e.source ? ` · ${e.source}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={e.status === "approved" ? "default" : "secondary"}>{e.status}</Badge>
                    {e.status === "pending" ? (
                      <>
                        <Button size="sm" onClick={() => decideEntry.mutate({ id: e.id, approve: true })}>
                          <Check className="size-4" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decideEntry.mutate({ id: e.id, approve: false })}
                        >
                          <X className="size-4" /> Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No images submitted yet.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function SignedImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage
      .from("dataset-images")
      .createSignedUrl(path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  return (
    <div className="aspect-4/3 overflow-hidden rounded-lg bg-muted">
      {url ? <img src={url} alt="Submitted crop sample" className="size-full object-cover" /> : null}
    </div>
  );
}
