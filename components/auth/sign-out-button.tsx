"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { clearOfflineData } from "@/lib/offline";

export function SignOutButton() {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() =>
        authClient.signOut({
          fetchOptions: {
            onSuccess: async () => {
              await clearOfflineData();
              router.push("/");
              router.refresh();
            },
          },
        })
      }
    >
      <LogOut className="size-4" /> Sign out
    </Button>
  );
}
