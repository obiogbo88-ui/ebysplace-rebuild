import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { KeyRound } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function getRecoveryToken() {
  if (typeof window === "undefined") return "";
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);
  return hashParams.get("access_token") || queryParams.get("access_token") || "";
}

export default function AdminResetPassword() {
  const [, setLocation] = useLocation();
  const recoveryToken = useMemo(getRecoveryToken, []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updatePassword = trpc.auth.updatePassword.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      setLocation("/admin/login");
    },
    onError: (error) => {
      toast.error(error.message || "Unable to update the admin password.");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recoveryToken) {
      toast.error("This reset link is missing its recovery token. Please request a new reset email.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    updatePassword.mutate({ accessToken: recoveryToken, password });
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(216,182,107,0.18),transparent_36%),linear-gradient(135deg,#140f0b_0%,#2f2418_52%,#fff7df_220%)] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <Card className="w-full border-primary/25 bg-[#fffaf0] text-[#2f2418] shadow-[0_28px_80px_rgba(0,0,0,0.32)]">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <KeyRound className="h-7 w-7" />
            </div>
            <CardTitle className="font-serif text-3xl">Reset admin password</CardTitle>
            <CardDescription className="text-[#5f5142]">
              Enter a new password for the configured Eby’s Place Supabase admin account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!recoveryToken ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                This reset link is missing its recovery token. Please request a new password reset email from the admin login page.
              </div>
            ) : null}
            <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="new-admin-password">New password</Label>
                <Input
                  id="new-admin-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-[#d8b66b]/50 bg-white text-[#2f2418]"
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-admin-password">Confirm new password</Label>
                <Input
                  id="confirm-admin-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="border-[#d8b66b]/50 bg-white text-[#2f2418]"
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" className="h-12 w-full shadow-lg" disabled={updatePassword.isPending || !recoveryToken}>
                {updatePassword.isPending ? "Updating password..." : "Update password"}
              </Button>
            </form>
            <Button type="button" variant="ghost" className="mt-5 w-full text-[#5f5142] hover:bg-primary/10" onClick={() => setLocation("/admin/login")}>
              Back to admin sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
