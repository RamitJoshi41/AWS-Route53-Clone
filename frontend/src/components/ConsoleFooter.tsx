"use client";

import Icon from "@cloudscape-design/components/icon";
import type { ReactNode } from "react";

import ComingSoonPopover from "@/components/ComingSoonPopover";

import styles from "./ConsoleFooter.module.css";

function FooterItem({ feature, icon }: { feature: string; icon?: ReactNode }) {
  return (
    <ComingSoonPopover feature={feature} position="top">
      <button type="button" className={styles.item}>
        {icon}
        {feature}
      </button>
    </ComingSoonPopover>
  );
}

/**
 * The console's bottom bar. Its tools and AWS policy links don't exist in this clone,
 * so each opens a "not available" popover. The copyright line names the clone, not AWS.
 */
export default function ConsoleFooter({ id }: { id: string }) {
  return (
    <footer id={id} className={styles.footer}>
      <div className={styles.group}>
        <FooterItem feature="CloudShell" icon={<Icon name="command-prompt" size="small" />} />
        <FooterItem feature="Feedback" />
        <span className={styles.optional}>
          <FooterItem feature="Console Mobile App" icon={<Icon name="share" size="small" />} />
        </span>
      </div>
      <div className={styles.group}>
        <span className={`${styles.copyright} ${styles.optional}`}>
          © {new Date().getFullYear()}, Route 53 Clone. Not affiliated with Amazon Web Services.
        </span>
        <FooterItem feature="Privacy" />
        <FooterItem feature="Terms" />
        <span className={styles.optional}>
          <FooterItem feature="Cookie preferences" />
        </span>
      </div>
    </footer>
  );
}
