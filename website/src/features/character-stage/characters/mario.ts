import { createMarioCharacter } from '../shared'

export const marioCharacter = createMarioCharacter({
  id: 'mario',
  name: 'Mario',
  description: 'De klassieke allrounder met de rode pet.',
  colors: {
    cap: '#e32616',
    capShadow: '#b01914',
    capLight: '#ff6b5b',
    shirt: '#e32616',
    shirtShadow: '#b01914',
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
  },
})
