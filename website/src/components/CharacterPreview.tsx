import { useEffect, useRef } from 'react'
import { characterGrid, renderCharacterPose } from '../features/character-stage/render'
import type { CharacterDefinition } from '../features/character-stage/types'

interface CharacterPreviewProps {
  character: CharacterDefinition
}

export function CharacterPreview({ character }: CharacterPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')

    if (!ctx) {
      return
    }

    const unit = 2
    canvas.width = characterGrid.w * unit
    canvas.height = characterGrid.h * unit
    renderCharacterPose({ ctx, unit, character, poseName: 'walk1' })
  }, [character])

  return <canvas ref={canvasRef} className="character-preview" aria-hidden="true" />
}
