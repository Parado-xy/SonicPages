import Link from "next/link";
import { ArrowRight, BookOpenText, Headphones, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const capabilities = [
  {
    icon: BookOpenText,
    title: "Your reading library",
    description: "A calm home for documents, collections, progress, and bookmarks.",
  },
  {
    icon: Headphones,
    title: "Listen your way",
    description: "Natural playback controls, voice preferences, and continuous reading.",
  },
  {
    icon: Sparkles,
    title: "Built for focus",
    description: "A distraction-free reader designed for long documents and study sessions.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <section className="relative overflow-hidden rounded-[2rem] border bg-card px-6 py-10 shadow-[0_24px_80px_-48px_rgba(20,92,62,0.45)] sm:px-10 sm:py-14">
        <div className="absolute -right-20 -top-24 size-72 rounded-full bg-accent blur-3xl" />
        <div className="relative max-w-3xl">
          <Badge>Rebuild in progress</Badge>
          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">
            Read deeply. Listen naturally.
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            SonicPages is becoming a private, accessible workspace that turns your
            documents into a seamless reading and listening experience.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/library" className={buttonVariants({ size: "lg" })}>
              Open your library <ArrowRight className="size-4" />
            </Link>
            <Link href="/reader" className={buttonVariants({ size: "lg", variant: "secondary" })}>
              Preview the reader
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="foundation-heading">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Foundation</p>
            <h2 id="foundation-heading" className="mt-1 text-2xl font-semibold tracking-tight">
              Designed around the way you learn
            </h2>
          </div>
          <span className="hidden text-sm text-muted-foreground sm:block">PR 2</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {capabilities.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="group p-6">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground transition-transform group-hover:-translate-y-0.5">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
