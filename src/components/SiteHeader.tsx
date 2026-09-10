import { Link, useNavigate } from "@tanstack/react-router";
import { Leaf, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, isAdmin } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-b border-border/70 bg-leaf text-leaf-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-leaf-foreground/10">
            <Leaf className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">CropCheck</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/"
            className="rounded-lg px-3 py-2 opacity-85 transition hover:bg-leaf-foreground/10 hover:opacity-100"
          >
            Check a crop
          </Link>
          {user ? (
            <>
              <Link
                to="/portal"
                className="rounded-lg px-3 py-2 opacity-85 transition hover:bg-leaf-foreground/10 hover:opacity-100"
              >
                Contributor portal
              </Link>
              {isAdmin ? (
                <Link
                  to="/admin"
                  className="rounded-lg px-3 py-2 opacity-85 transition hover:bg-leaf-foreground/10 hover:opacity-100"
                >
                  Review desk
                </Link>
              ) : null}
              <Button variant="secondary" size="sm" className="ml-2" onClick={signOut}>
                <LogOut className="size-4" /> Sign out
              </Button>
            </>
          ) : (
            <Link to="/auth" className="ml-2">
              <Button variant="secondary" size="sm">
                Institute login
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
