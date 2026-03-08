export interface DrawContext {
  box: (x: number, y: number, w: number, h: number, color: string) => void
}

export type FacingDirection = 1 | -1

export interface ArmPose {
  x: number
  y: number
  h: number
}

export interface LegPose {
  x: number
  y: number
  h: number
  forward?: boolean
  tuck?: boolean
}

export interface CharacterPoses {
  walk1: {
    leftArm: ArmPose
    rightArm: ArmPose
    leftLeg: LegPose
    rightLeg: LegPose
  }
  walk2: {
    leftArm: ArmPose
    rightArm: ArmPose
    leftLeg: LegPose
    rightLeg: LegPose
  }
  jump: {
    leftArm: ArmPose
    rightArm: ArmPose
    leftLeg: LegPose
    rightLeg: LegPose
  }
}

export interface CharacterLimbPalette {
  arm: string
  glove: string
  leg: string
  legShadow: string
  shoe: string
  shoeShadow: string
  outline: string
}

export interface CharacterMovement {
  autopilotSpeed?: number
  manualSpeed?: number
  jumpVelocity?: number
  frameDuration?: number
}

export interface CharacterDefinition {
  id: string
  name: string
  description: string
  drawCore: (context: DrawContext) => void
  drawOverlay?: (context: DrawContext, facing: FacingDirection) => void
  limbPalette: CharacterLimbPalette
  poses?: CharacterPoses
  movement?: CharacterMovement
}
