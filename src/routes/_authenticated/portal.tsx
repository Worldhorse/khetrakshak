import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CONDITION_LABELS, CONDITIONS, type Condition } from "@/lib/detect.functions";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "Contributor Portal | KhetRakshak" },
      {
        name: "description",
        content:
          "Registered institutes, plant doctors and government bodies submit labelled crop disease images to the KhetRakshak dataset for review.",
      },
      { property: "og:title", content: "Contributor Portal | KhetRakshak" },
      {
        property: "og:description",
        content: "Submit labelled crop disease images to the KhetRakshak dataset.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Portal,
});

function Portal() {
  const { user, isContributor, isAdmin, loading } = useSession();
  const queryClient = useQueryClient();

  const request = useQuery({
    queryKey: ["my-request", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributor_requests")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const entries = useQuery({
    queryKey: ["my-entries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dataset_entries")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-10">
        <div>
          <h1 className="text-3xl font-semibold">Contributor portal</h1>
          <p className="mt-1 text-muted-foreground">
            Signed in as {user?.email}
            {isAdmin ? " · database manager" : isContributor ? " · verified contributor" : ""}
          </p>
        </div>

        {loading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : isContributor || isAdmin ? (
          <UploadCard
            userId={user!.id}
            onDone={() => queryClient.invalidateQueries({ queryKey: ["my-entries", user!.id] })}
          />
        ) : (
          <ApplicationCard
            userId={user!.id}
            existing={request.data}
            onDone={() => queryClient.invalidateQueries({ queryKey: ["my-request", user!.id] })}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>My submissions</CardTitle>
            <CardDescription>Each image is reviewed by the database manager.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {entries.data?.length ? (
              entries.data.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {e.crop} — {e.disease}
                    </p>
                    <p className="text-muted-foreground">
                      {CONDITION_LABELS[e.condition as Condition]}
                    </p>
                  </div>
                  <Badge variant={e.status === "approved" ? "default" : "secondary"}>{e.status}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function ApplicationCard({
  userId,
  existing,
  onDone,
}: {
  userId: string;
  existing: { status: string; organisation: string; reviewer_notes: string | null } | null | undefined;
  onDone: () => void;
}) {
  const [organisation, setOrganisation] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [instituteType, setInstituteType] = useState("Medical / research institute");

  const apply = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contributor_requests").insert({
        user_id: userId,
        organisation,
        registration_code: registrationCode,
        institute_type: instituteType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application sent for verification.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (existing) {
    return (
      <Card className="shadow-field">
        <CardHeader>
          <CardTitle>Verification {existing.status}</CardTitle>
          <CardDescription>
            {existing.status === "pending"
              ? "The database manager is checking your registration code. You can upload images once approved."
              : existing.status === "rejected"
                ? "Your application was not approved."
                : "You are approved."}
          </CardDescription>
        </CardHeader>
        {existing.reviewer_notes ? (
          <CardContent className="text-sm text-muted-foreground">
            Note from reviewer: {existing.reviewer_notes}
          </CardContent>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="shadow-field">
      <CardHeader>
        <CardTitle>Apply to contribute images</CardTitle>
        <CardDescription>
          Give your official registration code so the database manager can verify you.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="org">Institute / department name</Label>
          <Input id="org" value={organisation} onChange={(e) => setOrganisation(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="code">Registration code</Label>
          <Input
            id="code"
            value={registrationCode}
            onChange={(e) => setRegistrationCode(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="type">Type</Label>
          <Select value={instituteType} onValueChange={setInstituteType}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Medical / research institute">Medical / research institute</SelectItem>
              <SelectItem value="Plant doctor / agronomist">Plant doctor / agronomist</SelectItem>
              <SelectItem value="Government body">Government body</SelectItem>
              <SelectItem value="Agricultural university">Agricultural university</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => apply.mutate()}
          disabled={!organisation || !registrationCode || apply.isPending}
        >
          {apply.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Send for verification
        </Button>
      </CardContent>
    </Card>
  );
}

function UploadCard({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [crop, setCrop] = useState("");
  const [disease, setDisease] = useState("");
  const [condition, setCondition] = useState<Condition>("moderate");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function submit() {
    if (!file || !crop || !disease) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("dataset-images").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("dataset_entries").insert({
        user_id: userId,
        image_path: path,
        crop,
        disease,
        condition,
        notes: notes || null,
        source: source || null,
      });
      if (error) throw error;
      toast.success("Image submitted for review.");
      setFile(null);
      setCrop("");
      setDisease("");
      setNotes("");
      setSource("");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="shadow-field">
      <CardHeader>
        <CardTitle>Add a labelled image to the dataset</CardTitle>
        <CardDescription>
          Images go live for detection only after the database manager approves them.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="grid aspect-4/3 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/50 hover:border-primary"
          >
            {preview ? (
              <img src={preview} alt="Selected sample" className="size-full object-cover" />
            ) : (
              <span className="grid justify-items-center gap-2 p-6 text-sm text-muted-foreground">
                <Upload className="size-6" /> Choose an image
              </span>
            )}
          </button>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="dcrop">Crop</Label>
            <Input id="dcrop" value={crop} onChange={(e) => setCrop(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ddisease">Disease / class label</Label>
            <Input id="ddisease" value={disease} onChange={(e) => setDisease(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dcond">Condition</Label>
            <Select value={condition} onValueChange={(v) => setCondition(v as Condition)}>
              <SelectTrigger id="dcond">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CONDITION_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dsource">Source (optional)</Label>
            <Input
              id="dsource"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Field survey, PlantVillage, lab sample…"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dnotes">Notes (optional)</Label>
            <Textarea id="dnotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <Button onClick={submit} disabled={!file || !crop || !disease || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null} Submit for review
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
