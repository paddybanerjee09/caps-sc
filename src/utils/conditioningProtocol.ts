import { conditioningValidationLimits } from "../constants/conditioning";
import type {
  CircuitProtocol,
  ConditioningProtocol,
  ConditioningProtocolDraft,
  ConditioningProtocolResult,
  ConditioningValidationIssue,
} from "../types/conditioning";

type ParseResult =
  | { ok: true; value: number }
  | { ok: false; issue: ConditioningValidationIssue };

function parseNumber(
  input: string,
  field: string,
  label: string,
  options: {
    allowBlank?: boolean;
    integer?: boolean;
    minimum?: number;
    maximum: number;
  },
): ParseResult | { ok: true; value: null } {
  const trimmedInput = input.trim();

  if (trimmedInput.length === 0 && options.allowBlank) {
    return { ok: true, value: null };
  }

  const value = Number(trimmedInput);
  const minimum = options.minimum ?? 1;

  if (
    !Number.isFinite(value) ||
    (options.integer && !Number.isInteger(value)) ||
    value < minimum ||
    value > options.maximum
  ) {
    const numberDescription = options.integer ? "whole number" : "number";

    return {
      ok: false,
      issue: {
        field,
        message: `${label} must be a ${numberDescription} from ${minimum} to ${options.maximum}.`,
      },
    };
  }

  return { ok: true, value };
}

function collectParsedNumber(
  result: ParseResult | { ok: true; value: null },
  issues: ConditioningValidationIssue[],
) {
  if (!result.ok) {
    issues.push(result.issue);
    return null;
  }

  return result.value;
}

export function parseConditioningProtocolDraft(
  draft: ConditioningProtocolDraft,
): ConditioningProtocolResult {
  const issues: ConditioningValidationIssue[] = [];
  const maximumDuration = conditioningValidationLimits.durationSeconds;

  if (draft.type === "continuous") {
    const durationSeconds = collectParsedNumber(
      parseNumber(
        draft.durationSecondsInput,
        "durationSeconds",
        "Duration",
        { integer: true, maximum: maximumDuration },
      ),
      issues,
    );
    const distanceMeters = collectParsedNumber(
      parseNumber(
        draft.distanceMetersInput,
        "distanceMeters",
        "Distance",
        {
          allowBlank: true,
          maximum: conditioningValidationLimits.distanceMeters,
        },
      ),
      issues,
    );

    if (issues.length > 0 || durationSeconds === null) {
      return { ok: false, issues };
    }

    return evaluateConditioningProtocol({
      type: "continuous",
      durationSeconds,
      distanceMeters,
    });
  }

  if (draft.type === "time_intervals") {
    const workSeconds = collectParsedNumber(
      parseNumber(draft.workSecondsInput, "workSeconds", "Work duration", {
        integer: true,
        maximum: maximumDuration,
      }),
      issues,
    );
    const restBetweenRepetitionsSeconds = collectParsedNumber(
      parseNumber(
        draft.restBetweenRepetitionsSecondsInput,
        "restBetweenRepetitionsSeconds",
        "Rest between repetitions",
        { integer: true, minimum: 0, maximum: maximumDuration },
      ),
      issues,
    );
    const repetitionsPerSet = collectParsedNumber(
      parseNumber(
        draft.repetitionsPerSetInput,
        "repetitionsPerSet",
        "Repetitions per set",
        {
          integer: true,
          maximum: conditioningValidationLimits.repetitions,
        },
      ),
      issues,
    );
    const setCount = collectParsedNumber(
      parseNumber(draft.setCountInput, "setCount", "Sets", {
        integer: true,
        maximum: conditioningValidationLimits.sets,
      }),
      issues,
    );
    const restBetweenSetsSeconds = collectParsedNumber(
      parseNumber(
        draft.restBetweenSetsSecondsInput,
        "restBetweenSetsSeconds",
        "Rest between sets",
        { integer: true, minimum: 0, maximum: maximumDuration },
      ),
      issues,
    );

    if (
      issues.length > 0 ||
      workSeconds === null ||
      restBetweenRepetitionsSeconds === null ||
      repetitionsPerSet === null ||
      setCount === null ||
      restBetweenSetsSeconds === null
    ) {
      return { ok: false, issues };
    }

    return evaluateConditioningProtocol({
      type: "time_intervals",
      workSeconds,
      restBetweenRepetitionsSeconds,
      repetitionsPerSet,
      setCount,
      restBetweenSetsSeconds,
    });
  }

  if (draft.type === "distance_intervals") {
    const workDistanceMeters = collectParsedNumber(
      parseNumber(
        draft.workDistanceMetersInput,
        "workDistanceMeters",
        "Distance per repetition",
        { maximum: conditioningValidationLimits.distanceMeters },
      ),
      issues,
    );
    const elapsedDurationSeconds = collectParsedNumber(
      parseNumber(
        draft.elapsedDurationSecondsInput,
        "elapsedDurationSeconds",
        "Elapsed duration",
        { integer: true, maximum: maximumDuration },
      ),
      issues,
    );
    const restBetweenRepetitionsSeconds = collectParsedNumber(
      parseNumber(
        draft.restBetweenRepetitionsSecondsInput,
        "restBetweenRepetitionsSeconds",
        "Rest between repetitions",
        { integer: true, minimum: 0, maximum: maximumDuration },
      ),
      issues,
    );
    const repetitionsPerSet = collectParsedNumber(
      parseNumber(
        draft.repetitionsPerSetInput,
        "repetitionsPerSet",
        "Repetitions per set",
        {
          integer: true,
          maximum: conditioningValidationLimits.repetitions,
        },
      ),
      issues,
    );
    const setCount = collectParsedNumber(
      parseNumber(draft.setCountInput, "setCount", "Sets", {
        integer: true,
        maximum: conditioningValidationLimits.sets,
      }),
      issues,
    );
    const restBetweenSetsSeconds = collectParsedNumber(
      parseNumber(
        draft.restBetweenSetsSecondsInput,
        "restBetweenSetsSeconds",
        "Rest between sets",
        { integer: true, minimum: 0, maximum: maximumDuration },
      ),
      issues,
    );

    if (
      issues.length > 0 ||
      workDistanceMeters === null ||
      elapsedDurationSeconds === null ||
      restBetweenRepetitionsSeconds === null ||
      repetitionsPerSet === null ||
      setCount === null ||
      restBetweenSetsSeconds === null
    ) {
      return { ok: false, issues };
    }

    return evaluateConditioningProtocol({
      type: "distance_intervals",
      workDistanceMeters,
      elapsedDurationSeconds,
      restBetweenRepetitionsSeconds,
      repetitionsPerSet,
      setCount,
      restBetweenSetsSeconds,
    });
  }

  const stations = draft.stations.map((station, position) => {
    const name = station.nameInput.trim();
    const workSeconds = collectParsedNumber(
      parseNumber(
        station.workSecondsInput,
        `stations.${position}.workSeconds`,
        `Station ${position + 1} work duration`,
        { integer: true, maximum: maximumDuration },
      ),
      issues,
    );

    if (
      name.length === 0 ||
      name.length > conditioningValidationLimits.stationNameLength
    ) {
      issues.push({
        field: `stations.${position}.name`,
        message: `Station ${position + 1} needs a name no longer than ${conditioningValidationLimits.stationNameLength} characters.`,
      });
    }

    return { name, position, workSeconds };
  });
  const restBetweenStationsSeconds = collectParsedNumber(
    parseNumber(
      draft.restBetweenStationsSecondsInput,
      "restBetweenStationsSeconds",
      "Rest between stations",
      { integer: true, minimum: 0, maximum: maximumDuration },
    ),
    issues,
  );
  const roundCount = collectParsedNumber(
    parseNumber(draft.roundCountInput, "roundCount", "Rounds", {
      integer: true,
      maximum: conditioningValidationLimits.sets,
    }),
    issues,
  );
  const restBetweenRoundsSeconds = collectParsedNumber(
    parseNumber(
      draft.restBetweenRoundsSecondsInput,
      "restBetweenRoundsSeconds",
      "Rest between rounds",
      { integer: true, minimum: 0, maximum: maximumDuration },
    ),
    issues,
  );

  if (
    issues.length > 0 ||
    stations.some((station) => station.workSeconds === null) ||
    restBetweenStationsSeconds === null ||
    roundCount === null ||
    restBetweenRoundsSeconds === null
  ) {
    return { ok: false, issues };
  }

  return evaluateConditioningProtocol({
    type: "circuit",
    stations: stations.map((station) => ({
      ...station,
      workSeconds: station.workSeconds!,
    })),
    restBetweenStationsSeconds,
    roundCount,
    restBetweenRoundsSeconds,
  });
}

function isIntegerInRange(value: number, minimum: number, maximum: number) {
  return (
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isNumberInRange(value: number, minimum: number, maximum: number) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function validateCircuitStations(
  protocol: CircuitProtocol,
  issues: ConditioningValidationIssue[],
) {
  if (
    protocol.stations.length < 1 ||
    protocol.stations.length > conditioningValidationLimits.stations
  ) {
    issues.push({
      field: "stations",
      message: `A circuit needs 1 to ${conditioningValidationLimits.stations} stations.`,
    });
  }

  protocol.stations.forEach((station, index) => {
    const name = station.name.trim();

    if (
      name.length < 1 ||
      name.length > conditioningValidationLimits.stationNameLength
    ) {
      issues.push({
        field: `stations.${index}.name`,
        message: `Station ${index + 1} needs a valid name.`,
      });
    }

    if (station.position !== index) {
      issues.push({
        field: `stations.${index}.position`,
        message: "Circuit station positions must be continuous and ordered.",
      });
    }

    if (
      !isIntegerInRange(
        station.workSeconds,
        1,
        conditioningValidationLimits.durationSeconds,
      )
    ) {
      issues.push({
        field: `stations.${index}.workSeconds`,
        message: `Station ${index + 1} needs a valid work duration.`,
      });
    }
  });
}

export function evaluateConditioningProtocol(
  protocol: ConditioningProtocol,
): ConditioningProtocolResult {
  const issues: ConditioningValidationIssue[] = [];
  const maximumDuration = conditioningValidationLimits.durationSeconds;

  if (protocol.type === "continuous") {
    if (!isIntegerInRange(protocol.durationSeconds, 1, maximumDuration)) {
      issues.push({ field: "durationSeconds", message: "Duration is invalid." });
    }

    if (
      protocol.distanceMeters !== null &&
      !isNumberInRange(
        protocol.distanceMeters,
        Number.EPSILON,
        conditioningValidationLimits.distanceMeters,
      )
    ) {
      issues.push({ field: "distanceMeters", message: "Distance is invalid." });
    }

    if (issues.length > 0) {
      return { ok: false, issues };
    }

    return {
      ok: true,
      protocol,
      metrics: {
        protocolType: protocol.type,
        totalBouts: 1,
        workBoutSeconds: [protocol.durationSeconds],
        totalWorkSeconds: protocol.durationSeconds,
        totalRestSeconds: 0,
        totalSessionSeconds: protocol.durationSeconds,
        totalDistanceMeters: protocol.distanceMeters,
        averageWorkBoutSeconds: protocol.durationSeconds,
        workToRestRatio: null,
        estimatedWorkDuration: false,
      },
    };
  }

  if (protocol.type === "time_intervals") {
    if (!isIntegerInRange(protocol.workSeconds, 1, maximumDuration)) {
      issues.push({ field: "workSeconds", message: "Work duration is invalid." });
    }
    if (
      !isIntegerInRange(
        protocol.restBetweenRepetitionsSeconds,
        0,
        maximumDuration,
      )
    ) {
      issues.push({
        field: "restBetweenRepetitionsSeconds",
        message: "Rest between repetitions is invalid.",
      });
    }
    if (
      !isIntegerInRange(
        protocol.repetitionsPerSet,
        1,
        conditioningValidationLimits.repetitions,
      )
    ) {
      issues.push({
        field: "repetitionsPerSet",
        message: "Repetitions per set is invalid.",
      });
    }
    if (
      !isIntegerInRange(
        protocol.setCount,
        1,
        conditioningValidationLimits.sets,
      )
    ) {
      issues.push({ field: "setCount", message: "Set count is invalid." });
    }
    if (
      !isIntegerInRange(protocol.restBetweenSetsSeconds, 0, maximumDuration)
    ) {
      issues.push({
        field: "restBetweenSetsSeconds",
        message: "Rest between sets is invalid.",
      });
    }

    if (issues.length > 0) {
      return { ok: false, issues };
    }

    const totalBouts = protocol.repetitionsPerSet * protocol.setCount;
    const totalWorkSeconds = protocol.workSeconds * totalBouts;
    const repetitionRestSeconds =
      protocol.restBetweenRepetitionsSeconds *
      (protocol.repetitionsPerSet - 1) *
      protocol.setCount;
    const setRestSeconds =
      protocol.restBetweenSetsSeconds * (protocol.setCount - 1);
    const totalRestSeconds = repetitionRestSeconds + setRestSeconds;
    const totalSessionSeconds = totalWorkSeconds + totalRestSeconds;

    if (totalSessionSeconds > maximumDuration) {
      return {
        ok: false,
        issues: [
          {
            field: "totalSessionSeconds",
            message: "The complete session cannot be longer than 24 hours.",
          },
        ],
      };
    }

    return {
      ok: true,
      protocol,
      metrics: {
        protocolType: protocol.type,
        totalBouts,
        workBoutSeconds: Array(totalBouts).fill(protocol.workSeconds),
        totalWorkSeconds,
        totalRestSeconds,
        totalSessionSeconds,
        totalDistanceMeters: null,
        averageWorkBoutSeconds: protocol.workSeconds,
        workToRestRatio:
          totalRestSeconds > 0 ? totalWorkSeconds / totalRestSeconds : null,
        estimatedWorkDuration: false,
      },
    };
  }

  if (protocol.type === "distance_intervals") {
    if (
      !isNumberInRange(
        protocol.workDistanceMeters,
        Number.EPSILON,
        conditioningValidationLimits.distanceMeters,
      )
    ) {
      issues.push({
        field: "workDistanceMeters",
        message: "Distance per repetition is invalid.",
      });
    }
    if (
      !isIntegerInRange(protocol.elapsedDurationSeconds, 1, maximumDuration)
    ) {
      issues.push({
        field: "elapsedDurationSeconds",
        message: "Elapsed duration is invalid.",
      });
    }
    if (
      !isIntegerInRange(
        protocol.restBetweenRepetitionsSeconds,
        0,
        maximumDuration,
      )
    ) {
      issues.push({
        field: "restBetweenRepetitionsSeconds",
        message: "Rest between repetitions is invalid.",
      });
    }
    if (
      !isIntegerInRange(
        protocol.repetitionsPerSet,
        1,
        conditioningValidationLimits.repetitions,
      )
    ) {
      issues.push({
        field: "repetitionsPerSet",
        message: "Repetitions per set is invalid.",
      });
    }
    if (
      !isIntegerInRange(
        protocol.setCount,
        1,
        conditioningValidationLimits.sets,
      )
    ) {
      issues.push({ field: "setCount", message: "Set count is invalid." });
    }
    if (
      !isIntegerInRange(protocol.restBetweenSetsSeconds, 0, maximumDuration)
    ) {
      issues.push({
        field: "restBetweenSetsSeconds",
        message: "Rest between sets is invalid.",
      });
    }

    if (issues.length > 0) {
      return { ok: false, issues };
    }

    const totalBouts = protocol.repetitionsPerSet * protocol.setCount;
    const repetitionRestSeconds =
      protocol.restBetweenRepetitionsSeconds *
      (protocol.repetitionsPerSet - 1) *
      protocol.setCount;
    const setRestSeconds =
      protocol.restBetweenSetsSeconds * (protocol.setCount - 1);
    const totalRestSeconds = repetitionRestSeconds + setRestSeconds;
    const totalWorkSeconds = protocol.elapsedDurationSeconds - totalRestSeconds;

    if (totalWorkSeconds <= 0) {
      return {
        ok: false,
        issues: [
          {
            field: "elapsedDurationSeconds",
            message: "Elapsed duration must be longer than all scheduled rest.",
          },
        ],
      };
    }

    const averageWorkBoutSeconds = totalWorkSeconds / totalBouts;

    return {
      ok: true,
      protocol,
      metrics: {
        protocolType: protocol.type,
        totalBouts,
        workBoutSeconds: Array(totalBouts).fill(averageWorkBoutSeconds),
        totalWorkSeconds,
        totalRestSeconds,
        totalSessionSeconds: protocol.elapsedDurationSeconds,
        totalDistanceMeters: protocol.workDistanceMeters * totalBouts,
        averageWorkBoutSeconds,
        workToRestRatio:
          totalRestSeconds > 0 ? totalWorkSeconds / totalRestSeconds : null,
        estimatedWorkDuration: true,
      },
    };
  }

  validateCircuitStations(protocol, issues);

  if (
    !isIntegerInRange(
      protocol.restBetweenStationsSeconds,
      0,
      maximumDuration,
    )
  ) {
    issues.push({
      field: "restBetweenStationsSeconds",
      message: "Rest between stations is invalid.",
    });
  }
  if (
    !isIntegerInRange(
      protocol.roundCount,
      1,
      conditioningValidationLimits.sets,
    )
  ) {
    issues.push({ field: "roundCount", message: "Round count is invalid." });
  }
  if (
    !isIntegerInRange(protocol.restBetweenRoundsSeconds, 0, maximumDuration)
  ) {
    issues.push({
      field: "restBetweenRoundsSeconds",
      message: "Rest between rounds is invalid.",
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const workSecondsPerRound = protocol.stations.reduce(
    (sum, station) => sum + station.workSeconds,
    0,
  );
  const totalWorkSeconds = workSecondsPerRound * protocol.roundCount;
  const stationRestSeconds =
    protocol.restBetweenStationsSeconds *
    (protocol.stations.length - 1) *
    protocol.roundCount;
  const roundRestSeconds =
    protocol.restBetweenRoundsSeconds * (protocol.roundCount - 1);
  const totalRestSeconds = stationRestSeconds + roundRestSeconds;
  const totalSessionSeconds = totalWorkSeconds + totalRestSeconds;

  if (totalSessionSeconds > maximumDuration) {
    return {
      ok: false,
      issues: [
        {
          field: "totalSessionSeconds",
          message: "The complete session cannot be longer than 24 hours.",
        },
      ],
    };
  }

  const workBoutSeconds = Array.from(
    { length: protocol.roundCount },
    () => protocol.stations.map((station) => station.workSeconds),
  ).flat();
  const totalBouts = workBoutSeconds.length;

  return {
    ok: true,
    protocol,
    metrics: {
      protocolType: protocol.type,
      totalBouts,
      workBoutSeconds,
      totalWorkSeconds,
      totalRestSeconds,
      totalSessionSeconds,
      totalDistanceMeters: null,
      averageWorkBoutSeconds: totalWorkSeconds / totalBouts,
      workToRestRatio:
        totalRestSeconds > 0 ? totalWorkSeconds / totalRestSeconds : null,
      estimatedWorkDuration: false,
    },
  };
}

export function getConditioningEndAt(
  startAt: number,
  totalSessionSeconds: number,
) {
  if (
    !Number.isFinite(startAt) ||
    !Number.isFinite(totalSessionSeconds) ||
    totalSessionSeconds <= 0
  ) {
    return null;
  }

  const endAt = startAt + totalSessionSeconds * 1000;
  return Number.isFinite(endAt) ? endAt : null;
}
