import { strengthAdaptationOrder, strengthAdaptations, strengthScoringDisclaimer } from "../constants/strength";
import type { StrengthScoreResult } from "../types/strength";
import { AdaptationScoreDisplay } from "./AdaptationScoreDisplay";
export function StrengthAdaptationModal(props: { onBack: () => void; result: StrengthScoreResult }) {
  return <AdaptationScoreDisplay {...props} order={strengthAdaptationOrder} presentations={strengthAdaptations}
    disclaimer={strengthScoringDisclaimer} backLabel="Back to strength session"
    fullEvidenceText="Full evidence: known movement profiles and directly entered %1RM for every exercise."
    limitedEvidenceText="Limited evidence: estimated or unavailable intensity, or unknown movement intent." />;
}
