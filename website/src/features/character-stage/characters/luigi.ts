import { defaultCharacterPoses } from '../shared'
import type { CharacterDefinition } from '../types'

const colors = {
  cap: '#2daa33',
  capShadow: '#237d27',
  capLight: '#7ad86a',
  shirt: '#2daa33',
  shirtShadow: '#237d27',
  overalls: '#2455d0',
  overallsShadow: '#14327f',
  skin: '#ffd7b1',
  skinShadow: '#f1b88c',
  accent: '#f4c542',
  hair: '#7a3b16',
  hairShadow: '#4b2200',
  gloves: '#f9f9f9',
  shoe: '#7a3b16',
  shoeShadow: '#4b2200',
  white: '#f9f9f9',
  outline: '#000000',
}

export const luigiCharacter: CharacterDefinition = {
  id: 'luigi',
  name: 'Luigi',
  description: 'Groener, langer en veel slanker dan Mario.',
  poses: defaultCharacterPoses,
  movement: {
    jumpVelocity: -372,
  },
  drawCore: ({ box }) => {
    box(8, 1, 6, 1, colors.cap)
    box(7, 2, 8, 3, colors.cap)
    box(6, 3, 1, 2, colors.cap)
    box(15, 3, 1, 2, colors.cap)
    box(7, 5, 8, 1, colors.capShadow)
    box(5, 6, 12, 1, colors.capShadow)
    box(8, 2, 3, 1, colors.capLight)

    box(6, 8, 1, 8, colors.hair)
    box(15, 8, 1, 8, colors.hair)
    box(7, 8, 8, 11, colors.skin)
    box(7, 18, 8, 1, colors.skinShadow)
    box(6, 11, 1, 2, colors.skinShadow)
    box(15, 11, 1, 2, colors.skinShadow)
    box(6, 14, 1, 2, colors.hairShadow)
    box(15, 14, 1, 2, colors.hairShadow)
    box(11, 12, 1, 2, colors.skinShadow)

    box(9, 10, 2, 3, colors.white)
    box(12, 10, 2, 3, colors.white)
    box(10, 11, 1, 2, colors.outline)
    box(13, 11, 1, 2, colors.outline)
    box(9, 9, 2, 1, colors.hairShadow)
    box(12, 9, 2, 1, colors.hairShadow)

    box(8, 14, 1, 1, colors.hairShadow)
    box(13, 14, 1, 1, colors.hairShadow)
    box(8, 15, 2, 1, colors.hairShadow)
    box(12, 15, 2, 1, colors.hairShadow)
    box(8, 16, 6, 1, colors.hairShadow)
    box(9, 17, 4, 1, colors.hairShadow)

    box(10, 20, 2, 1, colors.skinShadow)
    box(8, 19, 6, 1, colors.skinShadow)

    box(5, 20, 12, 2, colors.shirt)
    box(5, 22, 12, 1, colors.shirtShadow)
    box(7, 20, 2, 7, colors.overalls)
    box(13, 20, 2, 7, colors.overalls)
    box(7, 23, 2, 1, colors.overallsShadow)
    box(13, 23, 2, 1, colors.overallsShadow)
    box(8, 22, 1, 1, colors.accent)
    box(14, 22, 1, 1, colors.accent)
    box(7, 23, 8, 6, colors.overalls)
    box(9, 24, 4, 4, colors.overallsShadow)
    box(7, 28, 3, 2, colors.overalls)
    box(12, 28, 3, 2, colors.overalls)
    box(8, 28, 1, 1, colors.overallsShadow)
    box(13, 28, 1, 1, colors.overallsShadow)

    box(8, 0, 6, 1, colors.outline)
    box(7, 1, 2, 1, colors.outline)
    box(13, 1, 2, 1, colors.outline)
    box(6, 2, 1, 4, colors.outline)
    box(15, 2, 1, 4, colors.outline)
    box(5, 7, 12, 1, colors.outline)
  },
  drawOverlay: ({ box }) => {
    box(10, 2, 1, 4, colors.white)
    box(10, 5, 2, 1, colors.white)
  },
  limbPalette: {
    arm: colors.shirt,
    glove: colors.gloves,
    leg: colors.overalls,
    legShadow: colors.overallsShadow,
    shoe: colors.shoe,
    shoeShadow: colors.shoeShadow,
    outline: colors.outline,
  },
}
