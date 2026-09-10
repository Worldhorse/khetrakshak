import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, ShieldCheck, Sprout, Upload } from "lucide-react";
import { toast } from "sonner";
import heroLeaf from "@/assets/hero-leaf.jpg";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CONDITION_LABELS,
  detectCropDisease,
  type Condition,
  type DetectionResult,
} from "@/lib/detect.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KhetRakshak — Crop Disease Detection for Farmers" },
      {
        name: "description",
        content:
          "Photograph a leaf and KhetRakshak sorts your crop into Healthy, Mild, Moderate or Severe/Rotten with treatment steps, using public crop disease datasets.",
      },
      { property: "og:title", content: "KhetRakshak — Crop Disease Detection for Farmers" },
      {
        property: "og:description",
        content: "Instant crop disease checks in four condition grades, plus a verified image dataset.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const CONDITION_STYLES: Record<Condition, { bar: string; chip: string; step: number }> = {
  healthy: { bar: "bg-healthy", chip: "bg-healthy/15 text-foreground", step: 1 },
  mild: { bar: "bg-mild", chip: "bg-mild/25 text-foreground", step: 2 },
  moderate: { bar: "bg-moderate", chip: "bg-moderate/25 text-foreground", step: 3 },
  severe_rotten: { bar: "bg-severe", chip: "bg-severe/20 text-foreground", step: 4 },
};

const ORDER: Condition[] = ["healthy", "mild", "moderate", "severe_rotten"];

function Home() {
  const detect = useServerFn(detectCropDisease);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropHint, setCropHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Please choose a photo smaller than 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  }

  async function runCheck() {
    if (!preview) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await detect({
        data: { imageDataUrl: preview, ...(cropHint ? { cropHint } : {}) },
      });
      setResult(res);
      if (!res.isPlant) toast.warning("That photo doesn't look like a crop. Try a clear leaf close-up.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The check failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="relative overflow-hidden bg-leaf text-leaf-foreground">
        <img
          src={heroLeaf}
          alt="Dew on a green crop leaf at sunrise"
          width={1408}
          height={912}
          className="absolute inset-0 size-full object-cover opacity-35"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="text-sm uppercase tracking-[0.2em] opacity-80">KhetRakshak</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold sm:text-5xl">
            Photograph a leaf. Know the disease and how bad it is.
          </h1>
          <p className="mt-4 max-w-xl text-base opacity-90">
            Every check sorts your crop into one of four conditions — Healthy, Mild, Moderate or
            Severe/Rotten — with the likely disease and what to do next.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Camera className="size-4" /> Check my crop
            </Button>
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-12 lg:grid-cols-[1fr_1.1fr]">
        <Card className="shadow-field">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sprout className="size-5 text-primary" /> Your crop photo
            </CardTitle>
            <CardDescription>
              A close, well-lit photo of one affected leaf or fruit works best.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid aspect-4/3 w-full place-items-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/50 transition hover:border-primary"
            >
              {preview ? (
                <img src={preview} alt="Selected crop" className="size-full object-cover" />
              ) : (
                <span className="grid justify-items-center gap-2 p-6 text-sm text-muted-foreground">
                  <Upload className="size-6" />
                  Tap to take or upload a photo
                </span>
              )}
            </button>
            <div className="grid gap-2">
              <Label htmlFor="crop">Which crop is it? (optional)</Label>
              <Input
                id="crop"
                value={cropHint}
                onChange={(e) => setCropHint(e.target.value)}
                placeholder="Tomato, rice, cotton…"
              />
            </div>
            <Button onClick={runCheck} disabled={!preview || busy} size="lg">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              {busy ? "Checking the leaf…" : "Detect disease"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card className="shadow-field">
            <CardHeader>
              <CardTitle className="text-xl">Condition grades</CardTitle>
              <CardDescription>Every photo lands in exactly one of these four.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {ORDER.map((c) => (
                <div
                  key={c}
                  className={`rounded-xl px-4 py-3 text-sm font-medium ${CONDITION_STYLES[c].chip} ${
                    result?.condition === c ? "ring-2 ring-primary" : ""
                  }`}
                >
                  {CONDITION_LABELS[c]}
                </div>
              ))}
            </CardContent>
          </Card>

          {result ? (
            <Card className="shadow-field">
              <CardHeader>
                <div className={`h-2 w-full rounded-full ${CONDITION_STYLES[result.condition].bar}`} />
                <CardTitle className="pt-3 text-2xl">{CONDITION_LABELS[result.condition]}</CardTitle>
                <CardDescription>
                  {result.crop} · {result.disease} · {Math.round(result.confidence * 100)}% confidence
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm">
                <p>{result.summary}</p>
                {result.symptoms.length ? (
                  <div>
                    <h3 className="mb-1 text-base font-semibold">What we can see</h3>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {result.symptoms.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {result.advice.length ? (
                  <div>
                    <h3 className="mb-1 text-base font-semibold">What to do</h3>
                    <ol className="list-decimal pl-5">
                      {result.advice.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                {result.referenceDatasets.length ? (
                  <p className="text-xs text-muted-foreground">
                    Reference datasets: {result.referenceDatasets.join(", ")}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Results appear here. Diagnoses draw on public crop disease image collections such as
                PlantVillage, PlantDoc and the Rice Leaf Diseases set, plus images approved by
                registered institutes on KhetRakshak.
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
