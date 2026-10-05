import { COMMON_SQUARE_COUNT, FINAL_LANE_LENGTH } from '../board/board';
import { ROUTES_BY_FACTION } from '../board/routes';
import { getFactionIds } from '../factions/factions';
import { POSITION_TYPES, clonePosition, createFinalLanePosition, createCommonPosition, isSamePosition } from '../state/positions';
import { assertValidMovementSteps } from './validation';

export const MOVEMENT_FAILURE_REASONS = Object.freeze({
  MOVEMENT_BEYOND_FINAL_LANE_START: 'movementBeyondFinalLaneStart',
});

function assertValidFaction(factionId) {
  if (!getFactionIds().includes(factionId)) {
    throw new Error(`Invalid faction id: ${factionId}`);
  }
}

function assertValidPositionForFaction(from, factionId) {
  if (!from || !from.type) {
    throw new Error('Movement requires an initial position.');
  }

  if (from.type === POSITION_TYPES.HOME) {
    throw new Error('Cannot calculate movement from home.');
  }

  if (from.type === POSITION_TYPES.GOAL) {
    throw new Error('Cannot calculate movement from goal.');
  }

  if (from.type === POSITION_TYPES.COMMON) {
    if (!Number.isInteger(from.square) || from.square < 1 || from.square > COMMON_SQUARE_COUNT) {
      throw new Error(`Invalid common square: ${from.square}`);
    }
    return;
  }

  if (from.type === POSITION_TYPES.FINAL_LANE) {
    if (from.factionId !== factionId) {
      throw new Error('Cannot move from another faction final lane.');
    }

    if (!Number.isInteger(from.index) || from.index < 1 || from.index > FINAL_LANE_LENGTH) {
      throw new Error(`Invalid final lane index: ${from.index}`);
    }
    return;
  }

  throw new Error(`Invalid position type: ${from.type}`);
}

function findRouteIndex(route, position) {
  return route.findIndex((routePosition) => isSamePosition(routePosition, position));
}

function calculateBouncePath(factionId, stepsBeyondGoal) {
  if (stepsBeyondGoal > FINAL_LANE_LENGTH) {
    return {
      ok: false,
      reason: MOVEMENT_FAILURE_REASONS.MOVEMENT_BEYOND_FINAL_LANE_START,
    };
  }

  return {
    ok: true,
    path: Array.from({ length: stepsBeyondGoal }, (_, index) =>
      createFinalLanePosition(factionId, FINAL_LANE_LENGTH - index),
    ),
  };
}

function calculateMovementGeometry({ factionId, from, steps, reverse = false }) {
  assertValidFaction(factionId);
  assertValidMovementSteps(steps);
  assertValidPositionForFaction(from, factionId);

  const route = ROUTES_BY_FACTION[factionId];
  const currentIndex = findRouteIndex(route, from);

  if (currentIndex === -1) {
    throw new Error('Initial position does not belong to faction route.');
  }

  if (reverse) {
    // Find key indices in the route
    const finalLaneStartIndex = route.findIndex(pos => pos.type === 'finalLane');
    const goalIndex = route.length - 1;
    const homeIndex = 0;

    const isInFinalLane = currentIndex >= finalLaneStartIndex && currentIndex < route.length - 1;

    if (isInFinalLane) {
      // In FINAL_LANE: move towards entrance (lower indices)
      const finalLaneStartIndexAbs = finalLaneStartIndex;
      const finalLaneIndex = currentIndex - finalLaneStartIndex + 1; // 1-based within FINAL_LANE

      const stepsToEntrance = finalLaneIndex - 1; // steps to reach FINAL_LANE entrance (index 1 of FINAL_LANE)

      if (steps <= stepsToEntrance) {
        // Stays within FINAL_LANE
        const destinationIndex = currentIndex - steps;
        const path = route.slice(destinationIndex, currentIndex).reverse();

        return {
          ok: true,
          path,
          destination: path[path.length - 1],
        };
      }

      // Exit FINAL_LANE, enter COMMON track backwards
      const stepsInFinalLane = stepsToEntrance;
      const remainingSteps = steps - stepsInFinalLane;

      // Path within FINAL_LANE (down to entrance)
      const finalLanePath = route.slice(finalLaneStartIndex, currentIndex).reverse();

      // Continue into COMMON track backwards
      const commonEndIndex = finalLaneStartIndex - 1; // last COMMON square before FINAL_LANE
      const commonStartIndex = 1; // first COMMON square after HOME

      // Build path backwards through COMMON
      const commonPath = [];
      let currentCommonIdx = commonEndIndex;
      for (let i = 0; i < steps - stepsInFinalLane; i++) {
        commonPath.push(route[currentCommonIdx]);
        currentCommonIdx--;
        if (currentCommonIdx < 1) {
          // Wrap around COMMON track (circular) - go to last COMMON square
          const finalLaneStartIdx = route.findIndex(pos => pos.type === 'finalLane');
          currentCommonIdx = finalLaneStartIndex - 1; // last COMMON index
        }
      }

      const path = [...finalLanePath, ...commonPath];
      return {
        ok: true,
        path,
        destination: path[path.length - 1],
      };
    }

    // In COMMON track (HOME already validated as invalid start)
    const destinationIndex = currentIndex - steps;

    if (destinationIndex >= 1) {
      // Stays in COMMON track
      const path = route.slice(destinationIndex, currentIndex).reverse();

      return {
        ok: true,
        path,
        destination: path[path.length - 1],
      };
    }

    // Would go past HOME - wrap around COMMON track
    const stepsInCommonToHome = currentIndex - 1; // steps from current to first COMMON square
    const stepsInCommon = stepsInCommonToHome;

    if (steps <= stepsInCommon) {
      // Shouldn't happen due to check above, but safety
      const path = route.slice(destinationIndex, currentIndex).reverse();
      return { ok: true, path, destination: path[path.length - 1] };
    }

    // Wrap around COMMON track
    const remainingSteps = steps - stepsInCommonToHome;

    // Path from current to first COMMON square
    const pathToHome = route.slice(1, currentIndex).reverse();

    // Continue from last COMMON square backwards (circular)
    const lastCommonIndex = route.findIndex(pos => pos.type === 'finalLane') - 1;
    const commonPath = [];
    let currentCommonIdx = lastCommonIndex;
    for (let i = 0; i < steps - stepsInCommonToHome; i++) {
      commonPath.push(route[currentCommonIdx]);
      currentCommonIdx--;
      if (currentCommonIdx < 1) {
        currentCommonIdx = lastCommonIndex;
      }
    }

    const path = [...pathToHome, ...commonPath];
    return {
      ok: true,
      path,
      destination: path[path.length - 1],
    };
  }

  const goalIndex = route.length - 1;
  const destinationIndex = currentIndex + steps;

  if (destinationIndex <= goalIndex) {
    const path = route.slice(currentIndex + 1, destinationIndex + 1);

    return {
      ok: true,
      path,
      destination: path[path.length - 1],
    };
  }

  const bounceResult = calculateBouncePath(factionId, destinationIndex - goalIndex);

  if (!bounceResult.ok) {
    return bounceResult;
  }

  const path = [...route.slice(currentIndex + 1, goalIndex + 1), ...bounceResult.path];

  return {
    ok: true,
    path,
    destination: path[path.length - 1],
  };
}

export function calculateDestination(input) {
  const { reverse = false, ...rest } = input;
  const result = calculateMovementGeometry({ ...rest, reverse });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    destination: clonePosition(result.destination),
  };
}

export function calculateMovementPath(input) {
  const { reverse = false, ...rest } = input;
  const result = calculateMovementGeometry({ ...rest, reverse });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    path: result.path.map(clonePosition),
  };
}
