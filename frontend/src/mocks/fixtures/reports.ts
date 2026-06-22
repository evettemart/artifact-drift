import type { Report } from "@/api/types";

export const reports: Report[] = [
  {
    id: "rep_001",
    runId: "run_intent_runtime",
    format: "html",
    status: "ready",
    title: "Architecture Drift — Intent vs Runtime",
    createdAt: "2026-06-22T08:05:00Z",
    uri: "/reports/rep_001.html",
    sections: [
      {
        id: "sec_exec",
        title: "Executive Summary",
        body:
          "The runtime environment has **5 active drift findings**, including **2 critical** security regressions. " +
          "Overall compliance score is **62/100**. Immediate attention is required for public SSH exposure and " +
          "disabled S3 encryption.",
        citations: ["dr_001", "dr_002"],
      },
      {
        id: "sec_tech",
        title: "Technical Detail",
        body:
          "1. `sg-web` now permits `0.0.0.0/0:22` (SSH) — not present in intent.\n" +
          "2. `s3-assets` encryption was downgraded `true → false`.\n" +
          "3. Intended CloudWatch monitoring edge is absent in runtime.\n" +
          "4. `ec2-web-1` instance type changed `t3.medium → t3.large`.",
        citations: ["dr_001", "dr_002", "dr_003", "dr_004"],
      },
      {
        id: "sec_compliance",
        title: "Compliance Mapping",
        body:
          "- CIS AWS 4.1 (no unrestricted SSH): **FAIL** — dr_001\n" +
          "- CIS AWS 2.1.1 (S3 encryption at rest): **FAIL** — dr_002\n" +
          "- Monitoring coverage: **PARTIAL** — dr_003",
        citations: ["dr_001", "dr_002", "dr_003"],
      },
    ],
  },
];
