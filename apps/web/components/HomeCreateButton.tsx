"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../lib/config";
import type { AuthUser } from "../lib/access";
import AuthModal from "./AuthModal";
import ErrorToast from "./ErrorToast";
import { useLanguage } from "./LanguageProvider";

type HomeCreateButtonProps = {
  children: ReactNode;
  className: string;
};

export default function HomeCreateButton({ children, className }: HomeCreateButtonProps) {
  const { t } = useLanguage();
  const [authOpen, setAuthOpen] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();

  const openAuth = () => {
    setAuthOpen(true);
    requestAnimationFrame(() => setAuthVisible(true));
  };

  const closeAuth = () => {
    setAuthVisible(false);
    setTimeout(() => setAuthOpen(false), 200);
  };

  const handleClick = async () => {
    if (checking) {
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const meResponse = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
      if (!meResponse.ok) {
        openAuth();
        return;
      }
      const user = (await meResponse.json()) as AuthUser;
      const limitResponse = await fetch(
        `${apiUrl}/pets/create-limit/${encodeURIComponent(user.id)}`,
        { credentials: "include" }
      );
      if (limitResponse.ok) {
        const limit = (await limitResponse.json()) as {
          maxMemorials?: number;
          canCreate?: boolean;
        };
        if (limit.canCreate === false) {
          const maxMemorials =
            typeof limit.maxMemorials === "number" ? limit.maxMemorials : user.maxMemorials ?? 5;
          setError(t("home.limitMessage", { count: maxMemorials }));
          return;
        }
      }
      router.push("/create");
    } catch {
      openAuth();
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={handleClick} disabled={checking}>
        {checking ? t("home.checking") : children}
      </button>
      <AuthModal
        open={authOpen}
        visible={authVisible}
        title={t("home.createAuthTitle")}
        helperText={t("home.createAuthHelper")}
        showGuestCreate
        successRedirect="/create"
        onClose={closeAuth}
        onGuestCreate={() => {
          closeAuth();
          router.push("/create?guest=1");
        }}
        onSuccess={() => {
          closeAuth();
        }}
      />
      <ErrorToast message={error} onClose={() => setError(null)} />
    </>
  );
}
