import { conditioningAdaptationOrder, conditioningAdaptations, conditioningScoringDisclaimer } from "../constants/conditioning";
import type { ConditioningScoreResult } from "../types/conditioning";
import { AdaptationScoreDisplay } from "./AdaptationScoreDisplay";
export type ConditioningAdaptationModalProps = { onBack: () => void; result: ConditioningScoreResult };
export function ConditioningAdaptationModal(props: ConditioningAdaptationModalProps) {
  return <AdaptationScoreDisplay {...props} order={conditioningAdaptationOrder} presentations={conditioningAdaptations}
    disclaimer={conditioningScoringDisclaimer} backLabel="Back to conditioning session"
    fullEvidenceText="Full evidence from the selected protocol and intensity."
    limitedEvidenceText="Limited evidence: some optional inputs were unavailable." />;
}
