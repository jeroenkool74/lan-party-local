import { defaultCharacterPoses } from './shared'
import type { CharacterDefinition, CharacterPoses, FacingDirection } from './types'

export const characterGrid = {
  w: 22,
  h: 34,
} as const

export type CharacterPoseName = keyof CharacterPoses

interface RenderCharacterPoseOptions {
  ctx: CanvasRenderingContext2D
  unit: number
  character: CharacterDefinition
  poseName?: CharacterPoseName
  facing?: FacingDirection
}

export function renderCharacterPose({
  ctx,
  unit,
  character,
  poseName = 'walk1',
  facing = 1,
}: RenderCharacterPoseOptions) {
  const box = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(x * unit, y * unit, w * unit, h * unit)
  }

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.save()

  if (facing === -1) {
    ctx.translate(ctx.canvas.width, 0)
    ctx.scale(-1, 1)
  }

  character.drawCore({ box })

  const poses = character.poses ?? defaultCharacterPoses
  const limbs = poses[poseName] ?? poses.walk1
  const palette = character.limbPalette

  const drawArm = (arm: { x: number; y: number; h: number }) => {
    const gloveHeight = 2
    const armHeight = Math.max(arm.h - gloveHeight, 1)
    box(arm.x, arm.y, 3, armHeight, palette.arm)
    box(arm.x, arm.y + armHeight, 3, gloveHeight, palette.glove)
    box(arm.x, arm.y + armHeight + gloveHeight - 1, 3, 1, palette.outline)
  }

  const drawLeg = (leg: {
    x: number
    y: number
    h: number
    forward?: boolean
    tuck?: boolean
  }) => {
    const legWidth = 3
    const shoeWidth = leg.forward ? 4 : 3
    const shoeOffset = leg.forward ? -1 : 0
    const pantHeight = Math.max(leg.h - 2, 1)

    box(leg.x, leg.y, legWidth, pantHeight, palette.leg)
    box(
      leg.x + 1,
      leg.y + 1,
      1,
      Math.max(pantHeight - 2, 1),
      palette.legShadow,
    )

    const shoeY = leg.tuck ? leg.y + leg.h - 1 : leg.y + leg.h
    box(leg.x + shoeOffset, shoeY, shoeWidth, 2, palette.shoe)
    box(leg.x + shoeOffset, shoeY, shoeWidth, 1, palette.shoeShadow)
  }

  drawArm(limbs.leftArm)
  drawArm(limbs.rightArm)
  drawLeg(limbs.leftLeg)
  drawLeg(limbs.rightLeg)

  ctx.restore()

  if (character.drawOverlay) {
    character.drawOverlay({ box }, facing)
  }
}
