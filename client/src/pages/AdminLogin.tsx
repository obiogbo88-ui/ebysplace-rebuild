import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStoredAuthToken, setStoredAuthSession } from "@/const";
import { CANONICAL_SITE_ORIGIN } from "@/lib/canonicalUrl";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const PASSWORD_RESET_COOLDOWN_SECONDS = 60;

function getReturnTarget() {
  if (typeof window === "undefined") return "/admin";
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo") || "/admin";
  return returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/admin";
}

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("info@ebysplace.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [resetCooldownSeconds, setResetCooldownSeconds] = useState(0);
  const returnTo = useMemo(getReturnTarget, []);

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: (result) => {
      setResetRequested(true);
      setResetCooldownSeconds(PASSWORD_RESET_COOLDOWN_SECONDS);
      toast.success(result.message);
    },
    onError: (error) => {
      const message = error.message || "Unable to send the password reset email.";
      if (message.toLowerCase().includes("rate limit")) {
        setResetCooldownSeconds(PASSWORD_RESET_COOLDOWN_SECONDS);
      }
      toast.error(message);
    },
  });

  const login = trpc.auth.login.useMutation({
    onSuccess: async (session) => {
      setStoredAuthSession(session.accessToken, session.expiresAt);
      utils.auth.me.setData(undefined, session.user as any);
      await utils.auth.me.invalidate();
      toast.success("Signed in to Eby’s Place admin.");
      setLocation(returnTo);
    },
    onError: (error) => {
      toast.error(error.message || "Unable to sign in. Please check the email and password.");
    },
  });

  useEffect(() => {
    if (getStoredAuthToken()) {
      setLocation(returnTo);
    }
  }, [returnTo, setLocation]);

  useEffect(() => {
    if (resetCooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setResetCooldownSeconds((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resetCooldownSeconds]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate({ email, password });
  };

  const handleResetRequest = () => {
    if (resetCooldownSeconds > 0) {
      toast.error(`Please wait ${resetCooldownSeconds} seconds before requesting another reset email.`);
      return;
    }
    if (!email.trim()) {
      toast.error("Enter the admin email address first.");
      return;
    }
    requestReset.mutate({ email, origin: CANONICAL_SITE_ORIGIN });
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(216,182,107,0.18),transparent_36%),linear-gradient(135deg,#140f0b_0%,#2f2418_52%,#fff7df_220%)] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <section className="hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 shadow-2xl backdrop-blur lg:block">
            <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary">
              <ShieldCheck className="h-4 w-4" />
              Supabase-secured admin access
            </div>
            <h1 className="font-serif text-5xl leading-tight text-primary">Eby’s Place Admin</h1>
            <p className="mt-5 max-w-md text-base leading-8 text-white/72">
              Sign in with the configured Supabase administrator account to manage services, products, gallery images, reviews, bookings, and website content without any Manus OAuth environment variables.
            </p>
          </section>

          <Card className="mx-auto w-full max-w-md border-primary/25 bg-[#fffaf0] text-[#2f2418] shadow-[0_28px_80px_rgba(0,0,0,0.32)]">
            <CardHeader className="space-y-3 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <LockKeyhole className="h-7 w-7" />
              </div>
              <CardTitle className="font-serif text-3xl">Admin sign in</CardTitle>
              <CardDescription className="text-[#5f5142]">
                Use the Eby’s Place Supabase email and password to continue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email address</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="border-[#d8b66b]/50 bg-white text-[#2f2418]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="admin-password">Password</Label>
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-sm text-primary"
                      disabled={requestReset.isPending || resetCooldownSeconds > 0}
                      onClick={handleResetRequest}
                    >
                      {requestReset.isPending
                        ? "Sending..."
                        : resetCooldownSeconds > 0
                          ? `Retry in ${resetCooldownSeconds}s`
                          : "Forgot password?"}
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="border-[#d8b66b]/50 bg-white pr-12 text-[#2f2418]"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-[#6f5f4b] hover:bg-primary/10 hover:text-primary"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {resetRequested ? (
                    <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs leading-5 text-[#5f5142]">
                      Check the configured admin inbox for a password reset link, then return here to sign in with the new password.
                    </p>
                  ) : null}
                </div>
                <Button type="submit" className="h-12 w-full shadow-lg" disabled={login.isPending}>
                  {login.isPending ? "Signing in..." : "Sign in"}
                </Button>
              </form>
              <Button type="button" variant="ghost" className="mt-5 w-full text-[#5f5142] hover:bg-primary/10" onClick={() => setLocation("/")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to website
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
