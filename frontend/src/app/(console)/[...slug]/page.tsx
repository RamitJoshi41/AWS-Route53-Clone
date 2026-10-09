import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ComingSoon from "@/components/ComingSoon";
import { findPlaceholderLink } from "@/lib/navigation";

// Catches every console URL without a page of its own. Side-nav sections that
// aren't built yet get a "Coming soon" page; any other URL is a 404.

async function linkFor(params: PageProps<"/[...slug]">["params"]) {
  const { slug } = await params;
  return findPlaceholderLink("/" + slug.join("/"));
}

export async function generateMetadata({ params }: PageProps<"/[...slug]">): Promise<Metadata> {
  const link = await linkFor(params);
  return link ? { title: link.text } : {};
}

export default async function PlaceholderPage({ params }: PageProps<"/[...slug]">) {
  const link = await linkFor(params);
  if (!link) notFound();
  return <ComingSoon title={link.text} />;
}
