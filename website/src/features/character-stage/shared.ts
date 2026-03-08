import type { CharacterDefinition, CharacterPoses, DrawContext } from './types'

export const defaultCharacterPoses: CharacterPoses = {
  walk1: {
    leftArm: { x: 4, y: 20, h: 9 },
    rightArm: { x: 15, y: 19, h: 10 },
    leftLeg: { x: 7, y: 26, h: 6, forward: true },
    rightLeg: { x: 12, y: 25, h: 6, forward: false },
  },
  walk2: {
    leftArm: { x: 4, y: 19, h: 10 },
    rightArm: { x: 15, y: 20, h: 9 },
    leftLeg: { x: 7, y: 25, h: 6, forward: false },
    rightLeg: { x: 12, y: 26, h: 6, forward: true },
  },
  jump: {
    leftArm: { x: 4, y: 17, h: 9 },
    rightArm: { x: 15, y: 17, h: 9 },
    leftLeg: { x: 7, y: 25, h: 5, tuck: true },
    rightLeg: { x: 12, y: 25, h: 5, tuck: true },
  },
}

interface PlumberColors {
  cap: string
  capShadow: string
  capLight: string
  shirt: string
  shirtShadow: string
  overalls: string
  overallsShadow: string
  skin: string
  skinShadow: string
  accent: string
  hair: string
  hairShadow: string
  gloves: string
  shoe: string
  shoeShadow: string
  white: string
  outline: string
}

interface PlumberConfig {
  id: string
  name: string
  description: string
  colors: PlumberColors
}

export function createMarioCharacter({
  id,
  name,
  description,
  colors,
}: PlumberConfig): CharacterDefinition {
  return {
    id,
    name,
    description,
    drawCore: ({ box }: DrawContext) => {
      box(7, 0, 8, 1, colors.outline)
      box(5, 2, 1, 4, colors.outline)
      box(16, 2, 1, 4, colors.outline)
      box(7, 7, 8, 1, colors.outline)
      box(6, 6, 1, 1, colors.outline)
      box(15, 6, 1, 1, colors.outline)
      box(6, 2, 10, 1, colors.capShadow)
      box(6, 6, 10, 1, colors.capShadow)
      box(6, 1, 10, 3, colors.cap)
      box(6, 4, 10, 2, colors.capShadow)
      box(7, 3, 3, 1, colors.capLight)
      box(9, 3, 5, 3, colors.white)
      box(10, 4, 1, 2, colors.capShadow)
      box(12, 4, 1, 2, colors.capShadow)
      box(6, 1, 1, 1, colors.outline)
      box(15, 1, 1, 1, colors.outline)
      box(6, 6, 1, 1, colors.outline)
      box(15, 6, 1, 1, colors.outline)
      box(5, 8, 2, 6, colors.hair)
      box(15, 8, 2, 6, colors.hair)
      box(7, 8, 8, 10, colors.skin)
      box(7, 16, 8, 1, colors.skinShadow)
      box(6, 11, 1, 2, colors.skinShadow)
      box(15, 11, 1, 2, colors.skinShadow)
      box(6, 14, 1, 2, colors.hairShadow)
      box(15, 14, 1, 2, colors.hairShadow)
      box(11, 12, 1, 2, colors.skinShadow)
      box(9, 10, 2, 2, colors.white)
      box(12, 10, 2, 2, colors.white)
      box(10, 11, 1, 1, colors.outline)
      box(13, 11, 1, 1, colors.outline)
      box(9, 9, 2, 1, colors.hairShadow)
      box(12, 9, 2, 1, colors.hairShadow)
      box(8, 13, 1, 1, colors.hairShadow)
      box(13, 13, 1, 1, colors.hairShadow)
      box(8, 14, 2, 1, colors.hairShadow)
      box(12, 14, 2, 1, colors.hairShadow)
      box(8, 15, 6, 1, colors.hairShadow)
      box(9, 16, 4, 1, colors.hairShadow)
      box(10, 19, 2, 1, colors.skinShadow)
      box(8, 18, 6, 1, colors.skinShadow)
      box(5, 19, 12, 2, colors.shirt)
      box(5, 21, 12, 1, colors.shirtShadow)
      box(7, 19, 2, 6, colors.overalls)
      box(13, 19, 2, 6, colors.overalls)
      box(7, 22, 2, 1, colors.overallsShadow)
      box(13, 22, 2, 1, colors.overallsShadow)
      box(8, 21, 1, 1, colors.accent)
      box(14, 21, 1, 1, colors.accent)
      box(7, 22, 8, 6, colors.overalls)
      box(9, 23, 4, 4, colors.overallsShadow)
      box(7, 26, 3, 4, colors.overalls)
      box(12, 26, 3, 4, colors.overalls)
      box(8, 27, 1, 2, colors.overallsShadow)
      box(13, 27, 1, 2, colors.overallsShadow)
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
}

export function createLuigiCharacter({
  id,
  name,
  description,
  colors,
}: PlumberConfig): CharacterDefinition {
  return {
    id,
    name,
    description,
    drawCore: ({ box }: DrawContext) => {
      box(7, 0, 8, 1, colors.outline)
      box(5, 2, 1, 4, colors.outline)
      box(16, 2, 1, 4, colors.outline)
      box(7, 7, 8, 1, colors.outline)
      box(6, 6, 1, 1, colors.outline)
      box(15, 6, 1, 1, colors.outline)
      box(6, 2, 10, 1, colors.capShadow)
      box(6, 6, 10, 1, colors.capShadow)
      box(6, 1, 10, 3, colors.cap)
      box(6, 4, 10, 2, colors.capShadow)
      box(7, 3, 3, 1, colors.capLight)
      box(9, 3, 5, 3, colors.white)
      box(10, 4, 1, 2, colors.capShadow)
      box(12, 4, 1, 2, colors.capShadow)
      box(6, 1, 1, 1, colors.outline)
      box(15, 1, 1, 1, colors.outline)
      box(6, 6, 1, 1, colors.outline)
      box(15, 6, 1, 1, colors.outline)
      box(5, 8, 2, 6, colors.hair)
      box(15, 8, 2, 6, colors.hair)
      box(7, 8, 8, 10, colors.skin)
      box(7, 16, 8, 1, colors.skinShadow)
      box(6, 11, 1, 2, colors.skinShadow)
      box(15, 11, 1, 2, colors.skinShadow)
      box(6, 14, 1, 2, colors.hairShadow)
      box(15, 14, 1, 2, colors.hairShadow)
      box(11, 12, 1, 2, colors.skinShadow)
      box(9, 10, 2, 2, colors.white)
      box(12, 10, 2, 2, colors.white)
      box(10, 11, 1, 1, colors.outline)
      box(13, 11, 1, 1, colors.outline)
      box(9, 9, 2, 1, colors.hairShadow)
      box(12, 9, 2, 1, colors.hairShadow)
      box(8, 13, 1, 1, colors.hairShadow)
      box(13, 13, 1, 1, colors.hairShadow)
      box(8, 14, 2, 1, colors.hairShadow)
      box(12, 14, 2, 1, colors.hairShadow)
      box(8, 15, 6, 1, colors.hairShadow)
      box(9, 16, 4, 1, colors.hairShadow)
      box(10, 19, 2, 1, colors.skinShadow)
      box(8, 18, 6, 1, colors.skinShadow)
      box(5, 19, 12, 2, colors.shirt)
      box(5, 21, 12, 1, colors.shirtShadow)
      box(7, 19, 2, 6, colors.overalls)
      box(13, 19, 2, 6, colors.overalls)
      box(7, 22, 2, 1, colors.overallsShadow)
      box(13, 22, 2, 1, colors.overallsShadow)
      box(8, 21, 1, 1, colors.accent)
      box(14, 21, 1, 1, colors.accent)
      box(7, 22, 8, 6, colors.overalls)
      box(9, 23, 4, 4, colors.overallsShadow)
      box(7, 26, 3, 4, colors.overalls)
      box(12, 26, 3, 4, colors.overalls)
      box(8, 27, 1, 2, colors.overallsShadow)
      box(13, 27, 1, 2, colors.overallsShadow)
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
}

interface ToadColors {
  cap: string
  capShadow: string
  capSpot: string
  vest: string
  vestShadow: string
  trim: string
  face: string
  faceShadow: string
  pants: string
  pantsShadow: string
  shoe: string
  shoeShadow: string
  gloves: string
  outline: string
}

interface ToadConfig {
  id: string
  name: string
  description: string
  colors: ToadColors
}

export function createToadCharacter({
  id,
  name,
  description,
  colors,
}: ToadConfig): CharacterDefinition {
  return {
    id,
    name,
    description,
    drawCore: ({ box }: DrawContext) => {
      box(6, 0, 10, 1, colors.outline)
      box(4, 2, 1, 5, colors.outline)
      box(17, 2, 1, 5, colors.outline)
      box(5, 7, 12, 1, colors.outline)
      box(5, 1, 12, 6, colors.cap)
      box(7, 1, 4, 4, colors.capSpot)
      box(11, 2, 3, 3, colors.capSpot)
      box(5, 4, 2, 2, colors.capSpot)
      box(14, 4, 2, 2, colors.capSpot)
      box(6, 6, 10, 1, colors.capShadow)
      box(7, 8, 8, 9, colors.face)
      box(7, 16, 8, 1, colors.faceShadow)
      box(9, 10, 2, 2, colors.gloves)
      box(12, 10, 2, 2, colors.gloves)
      box(10, 11, 1, 1, colors.outline)
      box(13, 11, 1, 1, colors.outline)
      box(10, 13, 2, 1, colors.faceShadow)
      box(6, 18, 3, 6, colors.vest)
      box(13, 18, 3, 6, colors.vest)
      box(6, 23, 3, 1, colors.vestShadow)
      box(13, 23, 3, 1, colors.vestShadow)
      box(9, 18, 4, 7, colors.trim)
      box(8, 19, 1, 5, colors.trim)
      box(13, 19, 1, 5, colors.trim)
      box(8, 24, 6, 4, colors.pants)
      box(9, 25, 4, 2, colors.pantsShadow)
    },
    limbPalette: {
      arm: colors.face,
      glove: colors.gloves,
      leg: colors.pants,
      legShadow: colors.pantsShadow,
      shoe: colors.shoe,
      shoeShadow: colors.shoeShadow,
      outline: colors.outline,
    },
  }
}
