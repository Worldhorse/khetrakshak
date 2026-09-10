import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Institute Login | KhetRakshak Crop Disease Detection" },
      {
        name: "description",
        content:
          "Sign in or register as a medical institute, plant doctor or government body to contribute verified crop disease images to the KhetRakshak dataset.",
      },
      { property: "og:title", content: "Institute Login | KhetRakshak" },
      {
        property: "og:description",
        content: "Registered institutes and government bodies sign in here to submit crop disease images.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/portal", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          toast.success("Check your inbox to confirm your email address.");
          return;
        }
        navigate({ to: "/portal" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/portal" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Please try email instead.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/portal" });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto grid max-w-md gap-6 px-4 py-14">
        <Card className="shadow-field">
          <CardHeader>
            <CardTitle className="text-2xl">
              {mode === "signin" ? "Institute sign in" : "Register your institute"}
            </CardTitle>
            <CardDescription>
              For medical institutes, plant doctors and government bodies. Your registration code is
              checked by the database manager after you sign in.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {sent ? (
              <p className="rounded-lg bg-accent p-4 text-sm text-accent-foreground">
                We sent a confirmation link to <strong>{email}</strong>. Open it, then come back and sign
                in.
              </p>
            ) : null}
            <form onSubmit={handleSubmit} className="grid gap-4">
              {mode === "signup" ? (
                <div className="grid gap-2">
                  <Label htmlFor="fullName">Your name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. A. Sharma"
                    required
                  />
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
            <Button type="button" variant="outline" onClick={handleGoogle}>
              Continue with Google
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin"
                ? "New here? Register your institute"
                : "Already registered? Sign in instead"}
            </button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
