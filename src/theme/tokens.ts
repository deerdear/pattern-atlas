// Design tokens for Pattern Atlas (and, one day, its sibling Daily Pattern).
// Pure module: no React, no app imports. The identity is paper-light only —
// ink on bible paper with multiply blending; there is no dark variant.

export const color = {
  cover: '#B4941F', // the ochre of the 1977 Oxford cover
  /** Ochre step dark enough for graphics on page (cover ochre is ~2.7:1). */
  ochreDeep: '#8A6D14',
  page: '#FBF6E8', // bible paper
  ink: '#221D14',
  // Printer's red: trails, asterisks, Therefore. Deepened from #A93315 so it
  // stays distinct from the ochre under deuteranopia (validate-colors.ts).
  red: '#93280F',
  fade: '#786E56',
  rule: '#DCD3B6',
  /** Precomputed dim state: ink flattened onto paper at 50% (3.2:1 on page). */
  nodeDim: '#8F8A7E',
} as const

export const serif =
  '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif'
