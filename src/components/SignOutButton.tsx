"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function SignOutButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleSignOut() {
    // POST to the server route — clears the HTTP cookie properly
    await fetch("/api/auth/signout", { method: "POST" });
    startTransition(() => {
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <button onClick={handleSignOut} disabled={isPending} className={className}>
      {isPending ? "Signing out…" : (children ?? "Sign out")}
    </button>
  );
}
