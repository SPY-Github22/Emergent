/* constants.js — Single source of truth for all tuneable values */
'use strict';

const C = {
  // Canvas dimensions
  W: 900, H: 520,

  // Actions the player (and NN) can take
  ACTIONS:    ['Feed', 'Connect', 'Guide', 'Approve', 'Correct'],
  ACTION:     { FEED: 0, CONNECT: 1, GUIDE: 2, APPROVE: 3, CORRECT: 4 },
  ACTION_ICON:['🍎',    '🤝',      '👋',    '✅',      '✏️'],

  // Agent physics
  AGENT_RADIUS:   12,    // visual + hit radius (px)
  AGENT_SPEED:    68,    // max px/sec
  ARRIVE_RADIUS:  22,    // slow-down zone (px)
  SEPARATE_DIST:  32,    // min distance between agents before separation force

  // Needs (values per *second*)
  HUNGER_RATE:    0.22,  // 0→100 takes ~7.5 min
  SOCIAL_DECAY:   0.10,
  FOOD_EAT_RATE:  28,    // hunger reduced per sec while eating
  SOCIAL_GAIN:    22,    // social gained per sec while near others
  FOOD_REPLENISH: 7,     // food amount regenerated per sec
  FOOD_CAPACITY:  100,

  // World / time
  DAY_DURATION:   180000, // 3 real minutes per full day
  MAX_DT:         80,     // clamp physics dt (ms) to avoid spiral of death

  // Relationships
  FIGHT_AFFECTION_THRESH: -0.3,
  LOVE_AFFECTION_THRESH:  0.65,
  FIGHT_PROB:             0.0006,  // chance per second when angry+stressed
  FIGHT_DURATION:         4.0,     // seconds a fight lasts
  GOSSIP_DIST:            55,
  GOSSIP_DURATION:        3.5,     // seconds gossip lasts

  // Neural network
  NN_FEATURES:          9,
  NN_ACTIONS:           5,
  NN_MIN_SAMPLES:       15,
  NN_TRAIN_INTERVAL:    22000,    // ms between training calls
  NN_INFLUENCE_RAMP:    150,      // samples needed for full influence
  NN_ACT_THRESHOLD:     0.68,

  // Colours (shared palette)
  COL: {
    FOOD:      '#4ade80',
    LOVE:      '#f9a8d4',
    FIGHT:     '#ef4444',
    SPARK:     '#fbbf24',
    SOCIAL:    '#60a5fa',
    NN:        '#818cf8',
    APPROVE:   '#34d399',
    CORRECT:   '#fb923c',
    TEXT_MAIN: '#f8fafc',
    TEXT_DIM:  '#94a3b8',
  }
};
