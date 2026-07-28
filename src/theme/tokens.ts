// Design tokens for Pattern Atlas (and, one day, its sibling Daily Pattern).
// Pure module: no React, no app imports. The identity is paper-light only —
// ink on bible paper with multiply blending; there is no dark variant.

export const color = {
  cover: '#B4941F', // the ochre of the 1977 Oxford cover
  page: '#FBF6E8', // bible paper
  ink: '#221D14',
  red: '#A93315', // printer's red: trails, asterisks, Therefore
  fade: '#7D735A',
  rule: '#DCD3B6',
  /** Precomputed dim state: ink flattened onto paper at ~40% (>=3:1 on page). */
  nodeDim: '#A79B85',
} as const

export const serif =
  '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif'
