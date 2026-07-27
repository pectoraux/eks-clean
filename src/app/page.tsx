"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/client";

export default function Home() {
  const router = useRouter();
  const { session } = useAuth();

  useEffect(() => {
    // If logged in, go to admin. Otherwise go to the default app.
    if (session) {
      router.replace("/admin");
    } else {
      router.replace("/apps/eks-clean");
    }
  }, [session]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl mx-auto mb-4">O</div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
