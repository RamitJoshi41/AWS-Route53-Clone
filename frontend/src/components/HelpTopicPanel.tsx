"use client";

import HelpPanel from "@cloudscape-design/components/help-panel";
import Icon from "@cloudscape-design/components/icon";

import { HELP_TOPICS, type HelpTopic, type HelpTopicContent } from "@/lib/helpTopics";

import styles from "./HelpTopicPanel.module.css";

/** One help topic in Cloudscape's HelpPanel, with the console's "Learn more" footer. */
export default function HelpTopicPanel({ topic }: { topic: HelpTopic }) {
  const { header, content, links }: HelpTopicContent = HELP_TOPICS[topic];
  return (
    <HelpPanel
      header={<h2>{header}</h2>}
      footer={
        links && (
          <div>
            <h3>
              Learn more <Icon name="external" />
            </h3>
            <ul>
              {links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )
      }
    >
      <div className={styles.content}>{content}</div>
    </HelpPanel>
  );
}
