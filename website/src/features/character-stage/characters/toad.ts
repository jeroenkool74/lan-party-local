import type { CharacterDefinition } from '../types'

const colors = {
  cap: '#f8f7f1',
  capShadow: '#dcd9d2',
  capSpot: '#e23328',
  vest: '#2455d0',
  vestShadow: '#14327f',
  trim: '#f6d463',
  face: '#ffd7b1',
  faceShadow: '#f1b88c',
  pants: '#f8f7f1',
  pantsShadow: '#d5d8dd',
  shoe: '#7a3b16',
  shoeShadow: '#4b2200',
  gloves: '#f9f9f9',
  outline: '#000000',
}

export const toadCharacter: CharacterDefinition = {
  id: 'toad',
  name: 'Toad',
  description: 'Een grote paddenstoelkap, klein lijf en meteen herkenbaar.',
  movement: {
    autopilotSpeed: 42,
    manualSpeed: 116,
    frameDuration: 0.11,
  },
  poses: {
    walk1: {
      leftArm: { x: 5, y: 20, h: 6 },
      rightArm: { x: 14, y: 19, h: 7 },
      leftLeg: { x: 8, y: 25, h: 5, forward: true },
      rightLeg: { x: 11, y: 24, h: 5, forward: false },
    },
    walk2: {
      leftArm: { x: 5, y: 19, h: 7 },
      rightArm: { x: 14, y: 20, h: 6 },
      leftLeg: { x: 8, y: 24, h: 5, forward: false },
      rightLeg: { x: 11, y: 25, h: 5, forward: true },
    },
    jump: {
      leftArm: { x: 5, y: 18, h: 6 },
      rightArm: { x: 14, y: 18, h: 6 },
      leftLeg: { x: 9, y: 24, h: 4, tuck: true },
      rightLeg: { x: 10, y: 24, h: 4, tuck: true },
    },
  },
  drawCore: ({ box }) => {
    box(8, 0, 6, 1, colors.outline)
    box(6, 1, 1, 5, colors.outline)
    box(15, 1, 1, 5, colors.outline)
    box(5, 2, 1, 5, colors.outline)
    box(16, 2, 1, 5, colors.outline)
    box(4, 4, 1, 3, colors.outline)
    box(17, 4, 1, 3, colors.outline)
    box(5, 7, 12, 1, colors.outline)
    box(6, 1, 10, 6, colors.cap)
    box(5, 2, 1, 5, colors.cap)
    box(16, 2, 1, 5, colors.cap)
    box(4, 4, 1, 3, colors.cap)
    box(17, 4, 1, 3, colors.cap)
    box(6, 6, 10, 1, colors.capShadow)
    box(5, 6, 1, 1, colors.capShadow)
    box(16, 6, 1, 1, colors.capShadow)
    box(9, 2, 4, 3, colors.capSpot)
    box(6, 4, 2, 2, colors.capSpot)
    box(14, 4, 2, 2, colors.capSpot)
    box(10, 5, 2, 1, colors.capSpot)

    box(8, 8, 6, 9, colors.face)
    box(8, 16, 6, 1, colors.faceShadow)
    box(7, 11, 1, 2, colors.faceShadow)
    box(14, 11, 1, 2, colors.faceShadow)
    box(9, 10, 1, 3, colors.outline)
    box(12, 10, 1, 3, colors.outline)
    box(10, 14, 2, 1, colors.faceShadow)

    box(6, 18, 3, 6, colors.vest)
    box(13, 18, 3, 6, colors.vest)
    box(6, 23, 3, 1, colors.vestShadow)
    box(13, 23, 3, 1, colors.vestShadow)
    box(8, 18, 1, 5, colors.trim)
    box(13, 18, 1, 5, colors.trim)
    box(9, 18, 4, 6, colors.pants)
    box(10, 19, 2, 4, colors.pantsShadow)
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
