import type { PolicyDefinition } from "./types";

export const DEFAULT_POLICIES: PolicyDefinition[] = [
  {
    id: "AG-101",
    name: "Indirect prompt injection containment",
    description: "Blocks tool requests influenced by hostile instructions in retrieved content.",
    effect: "block",
    priority: 100,
    enabled: true,
    category: "injection",
  },
  {
    id: "AG-102",
    name: "Destructive database operation",
    description: "Blocks destructive SQL and database administration operations.",
    effect: "block",
    priority: 95,
    enabled: true,
    category: "authorization",
  },
  {
    id: "AG-103",
    name: "Production change approval",
    description: "Requires a human decision before write or destructive production actions.",
    effect: "approval",
    priority: 80,
    enabled: true,
    category: "environment",
  },
  {
    id: "AG-104",
    name: "High-value financial approval",
    description: "Requires approval for refunds or transfers of 500 USD or more.",
    effect: "approval",
    priority: 75,
    enabled: true,
    category: "financial",
  },
  {
    id: "AG-105",
    name: "Credential egress redaction",
    description: "Removes credentials, API keys, bearer tokens, and webhook secrets before egress.",
    effect: "redact",
    priority: 60,
    enabled: true,
    category: "secrets",
  },
  {
    id: "AG-106",
    name: "Read-only tool allowlist",
    description: "Allows registered read-only tools for authenticated agent runtimes.",
    effect: "allow",
    priority: 30,
    enabled: true,
    category: "authorization",
  },
  {
    id: "AG-107",
    name: "Controlled non-production writes",
    description: "Allows validated write tools outside production when no higher-risk rule matches.",
    effect: "allow",
    priority: 20,
    enabled: true,
    category: "environment",
  },
];

export const VERDICT_WEIGHT = {
  allow: 1,
  redact: 2,
  approval: 3,
  block: 4,
} as const;
