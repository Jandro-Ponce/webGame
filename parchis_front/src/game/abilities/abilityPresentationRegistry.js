import { Target, Snowflake, Sprout, FlaskConical } from 'lucide-react';
import { ABILITY_IDS, OPTIONAL_ABILITY_ACTION_TYPES } from '../engine';

export const ABILITY_PRESENTATION_REGISTRY = Object.freeze({
  [ABILITY_IDS.DRUID_VINES]: Object.freeze({
    title: 'Enredaderas',
    description: 'Cubre esta casilla con enredaderas para detener al próximo enemigo que la atraviese.',
    Icon: Sprout,
    visualTheme: 'nature',
    actionLabels: Object.freeze({
      [OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE]: 'Crear enredaderas',
      [OPTIONAL_ABILITY_ACTION_TYPES.SKIP]: 'Omitir',
    }),
  }),
  [ABILITY_IDS.ICE_MAGE_FREEZING]: Object.freeze({
    title: 'Congelación',
    description: 'Congela la casilla que acabas de dejar o al enemigo que permanezca en ella.',
    Icon: Snowflake,
    visualTheme: 'frost',
    actionLabels: Object.freeze({
      [OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE]: 'Congelar',
      [OPTIONAL_ABILITY_ACTION_TYPES.SKIP]: 'Omitir',
    }),
  }),
  [ABILITY_IDS.HUNTER_TRAP]: Object.freeze({
    title: 'Trampa',
    description: 'Coloca una trampa en tu casilla final para detener y sangrar al próximo enemigo.',
    Icon: Target,
    visualTheme: 'metal',
    actionLabels: Object.freeze({
      [OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE]: 'Colocar trampa',
      [OPTIONAL_ABILITY_ACTION_TYPES.SKIP]: 'Omitir',
    }),
  }),
  [ABILITY_IDS.ALCHEMIST_DIZZY]: Object.freeze({
    title: 'Mareo',
    description: 'Aplica Mareo a un enemigo adyacente para que su próximo movimiento normal sea el doble de pasos hacia atrás.',
    Icon: FlaskConical,
    visualTheme: 'arcane',
    actionLabels: Object.freeze({
      [OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE]: 'Aplicar Mareo',
      [OPTIONAL_ABILITY_ACTION_TYPES.SKIP]: 'Omitir',
    }),
  }),
});

function humanizeAbilityId(abilityId) {
  const label = String(abilityId || 'habilidad')
    .split('.')
    .pop()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ');

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function getAbilityPresentation(abilityId) {
  return ABILITY_PRESENTATION_REGISTRY[abilityId] || {
    title: humanizeAbilityId(abilityId),
    description: 'Puedes activar esta habilidad antes de continuar.',
    Icon: null,
    visualTheme: 'neutral',
    actionLabels: {
      [OPTIONAL_ABILITY_ACTION_TYPES.ACTIVATE]: 'Activar habilidad',
      [OPTIONAL_ABILITY_ACTION_TYPES.SKIP]: 'Omitir',
    },
  };
}
