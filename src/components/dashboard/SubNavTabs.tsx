"use client";

import React, { useRef } from "react";
import styles from "./SubNavTabs.module.css";

export type DashboardTabKey = "dashboard" | "analisis" | "movimientos";

export interface SubNavTabsProps {
  activeTab: DashboardTabKey;
  onTabChange: (tab: DashboardTabKey) => void;
}

interface TabItem {
  key: DashboardTabKey;
  label: string;
  icon: string;
}

const TABS: TabItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "analisis", label: "Análisis", icon: "📈" },
  { key: "movimientos", label: "Movimientos", icon: "💳" },
];

export default function SubNavTabs({ activeTab, onTabChange }: SubNavTabsProps) {
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = -1;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % TABS.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = TABS.length - 1;
    }

    if (nextIndex !== -1) {
      e.preventDefault();
      const nextTab = TABS[nextIndex];
      onTabChange(nextTab.key);
      const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
      buttons?.[nextIndex]?.focus();
    }
  };

  return (
    <nav className={styles.subNavContainer} aria-label="Navegación principal del dashboard">
      <div
        className={styles.segmentedPill}
        role="tablist"
        aria-orientation="horizontal"
        ref={tabListRef}
      >
        {TABS.map((tab, index) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.key}`}
              tabIndex={isActive ? 0 : -1}
              className={`${styles.tabButton} ${isActive ? styles.tabButtonActive : ""}`}
              onClick={() => onTabChange(tab.key)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              <span className={styles.tabIcon} aria-hidden="true">{tab.icon}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
