import type { DriftFinding, NormalizedResource, ScanResult } from '../types/shared';
interface AnalysisArtifacts {
    intentResources: NormalizedResource[];
    terraformResources: NormalizedResource[];
    awsResources: NormalizedResource[];
    findings: DriftFinding[];
    scan: ScanResult;
}
export declare function runFullAnalysis(): AnalysisArtifacts;
export {};
//# sourceMappingURL=analysis.d.ts.map