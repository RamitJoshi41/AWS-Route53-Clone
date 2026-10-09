"use client";

import Link from "@cloudscape-design/components/link";

import { useHelp } from "@/lib/help";
import { HELP_TOPICS, type HelpTopic } from "@/lib/helpTopics";

/** The console's "Info" link: opens the help panel on the topic next to it. */
export default function InfoLink({ topic }: { topic: HelpTopic }) {
  const { openTopic } = useHelp();
  return (
    <Link
      variant="info"
      ariaLabel={`Information about ${HELP_TOPICS[topic].header}`}
      onFollow={(event) => {
        event.preventDefault();
        openTopic(topic);
      }}
    >
      Info
    </Link>
  );
}
