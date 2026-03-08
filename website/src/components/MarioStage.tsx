import { useEffect, useMemo, useRef, useState } from 'react'
import { CharacterPreview } from './CharacterPreview'
import { stageCharacters } from '../features/character-stage/characters'
import {
  characterGrid,
  renderCharacterPose,
  type CharacterPoseName,
} from '../features/character-stage/render'
import type { FacingDirection } from '../features/character-stage/types'

export function MarioStage() {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [activeCharacterId, setActiveCharacterId] = useState('mario')

  const activeCharacter = useMemo(() => {
    return (
      stageCharacters.find((character) => character.id === activeCharacterId) ??
      stageCharacters[0]
    )
  }, [activeCharacterId])

  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current

    if (!stage || !canvas) {
      return undefined
    }

    const ctx = canvas.getContext('2d')

    if (!ctx) {
      return undefined
    }

    const unit = 4
    canvas.width = characterGrid.w * unit
    canvas.height = characterGrid.h * unit

    const drawPose = (poseName: CharacterPoseName) => {
      renderCharacterPose({
        ctx,
        unit,
        character: activeCharacter,
        poseName,
        facing,
      })
    }

    const movement = activeCharacter.movement ?? {}
    const autopilotSpeed = movement.autopilotSpeed ?? 32
    const manualSpeed = movement.manualSpeed ?? 90
    const jumpImpulse = movement.jumpVelocity ?? -320
    const animationFrameDuration = movement.frameDuration ?? 0.14

    let stageWidth = stage.clientWidth
    let x = stageWidth / 2 - canvas.offsetWidth / 2
    let velocityX = 28
    let facing: FacingDirection = Math.random() > 0.5 ? 1 : -1
    let autopilot = true
    let wanderTimer = 2.2
    let lastTime = performance.now()
    let frameTimer = 0
    let currentWalk = 0
    let jumpVelocity = 0
    let vertical = 0
    let jumping = false
    const gravity = 900
    const walkFrames: CharacterPoseName[] = ['walk1', 'walk2']
    const keys = new Set<string>()
    let rafId = 0

    const clampX = () => {
      stageWidth = stage.clientWidth
      const maxX = stageWidth - canvas.offsetWidth
      x = Math.min(Math.max(x, 0), maxX)
    }

    const startJump = () => {
      if (jumping) {
        return
      }

      jumping = true
      jumpVelocity = jumpImpulse
    }

    const pickFrame = (moving: boolean) => {
      if (jumping) {
        return 'jump'
      }

      if (!moving) {
        return 'walk1'
      }

      return walkFrames[currentWalk]
    }

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      let moveDir = 0

      if (autopilot) {
        wanderTimer -= dt

        if (wanderTimer <= 0) {
          facing = Math.random() > 0.5 ? 1 : -1
          wanderTimer = 1.8 + Math.random() * 2.4
        }

        velocityX = autopilotSpeed * facing

        if (x <= 0) {
          facing = 1
        }

        if (x >= stageWidth - canvas.offsetWidth) {
          facing = -1
        }

        moveDir = facing
      } else {
        if (keys.has('ArrowLeft')) {
          moveDir -= 1
        }

        if (keys.has('ArrowRight')) {
          moveDir += 1
        }

        if (moveDir !== 0) {
          facing = moveDir as FacingDirection
        }

        velocityX = moveDir * manualSpeed
      }

      x += velocityX * dt
      clampX()

      if (jumping) {
        vertical += jumpVelocity * dt
        jumpVelocity += gravity * dt

        if (vertical > 0) {
          vertical = 0
          jumpVelocity = 0
          jumping = false
        }
      }

      if (!jumping && keys.has('ArrowUp')) {
        startJump()
      }

      const moving = Math.abs(moveDir) > 0.01 || autopilot

      if (!jumping && moving) {
        frameTimer += dt

        if (frameTimer > animationFrameDuration) {
          currentWalk = (currentWalk + 1) % walkFrames.length
          frameTimer = 0
        }
      } else {
        currentWalk = 0
        frameTimer = 0
      }

      const frameName = pickFrame(moving)
      drawPose(frameName)
      canvas.style.left = `${x}px`
      canvas.style.bottom = `${Math.max(0, -vertical)}px`
      rafId = window.requestAnimationFrame(loop)
    }

    const stopAutopilot = () => {
      if (!autopilot) {
        return
      }

      autopilot = false
      wanderTimer = 0
    }

    const handleResize = () => clampX()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(event.key)) {
        return
      }

      stopAutopilot()
      keys.add(event.key)
      event.preventDefault()

      if (event.key === 'ArrowUp') {
        startJump()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.key)
    }

    rafId = window.requestAnimationFrame(loop)
    window.addEventListener('resize', handleResize)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [activeCharacter])

  return (
    <section className="mario-panel">
      <div className="mario-panel__copy">
        <p className="section-kicker">Bonus stage</p>
        <h2>Kies Mario, Luigi of Toad</h2>
        <p>
          Selecteer links je figuur. Gebruik daarna de pijltjes links en rechts om te
          lopen en pijltje omhoog om te springen.
        </p>

        <div className="character-picker" role="tablist" aria-label="Kies een figuur">
          {stageCharacters.map((character) => {
            const isActive = character.id === activeCharacter.id

            return (
              <button
                key={character.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={character.name}
                title={character.name}
                className={`character-picker__button${
                  isActive ? ' character-picker__button--active' : ''
                }`}
                onClick={() => setActiveCharacterId(character.id)}
              >
                <CharacterPreview character={character} />
              </button>
            )
          })}
        </div>
      </div>

      <div className="mario-panel__stage" ref={stageRef}>
        <canvas id="character-stage-canvas" ref={canvasRef} />
      </div>
    </section>
  )
}
