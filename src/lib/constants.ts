// Hacker/cyber-themed avatar palette for the registration picker.
//
// IMPORTANT: avatars are stored per-player as the literal emoji string in the
// database, NOT as an index into this array. Editing this list therefore only
// changes what NEW players can pick — every already-registered player keeps the
// exact avatar they chose. Every emoji that existing players are already using
// is intentionally kept in this list so their choice stays represented.
export const AVATARS = [
  // Operators / personas
  '🕵️', '🥷', '🧑‍💻', '🐱‍💻', '👨‍💻', '👩‍💻', '🤖', '👾', '🎭',
  // Skulls / spectres
  '💀', '☠️', '👻', '👺', '👹', '🤡',
  // Creatures / mascots
  '🐉', '🦊', '🐺', '🦉', '🦇', '🐍', '🦂', '🕷️', '🐙', '🦅',
  // Mind / sight / arcane
  '🧠', '👁️', '🧿', '🔮',
  // Weapons / warfare
  '🛡️', '🗡️', '⚔️', '🏴‍☠️', '💣', '🧨',
  // Energy / hazard
  '🔥', '⚡', '🌀', '☢️', '☣️',
  // Gear / tech / net
  '💻', '🖥️', '📡', '🛰️', '🔒', '🔑', '💾', '🕹️', '⚙️', '🧬',
  // Targets / vibes
  '🎯', '🌙',
];
