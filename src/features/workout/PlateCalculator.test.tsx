import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '../../db/schema'
import { PlateCalculator } from './PlateCalculator'

beforeEach(async () => {
  await db.settings.clear()
})
afterEach(cleanup)

describe('PlateCalculator', () => {
  it('answers for the weight already in the field', () => {
    render(<PlateCalculator target={100} unit="kg" />)
    expect(screen.getByTestId('plate-result').textContent).toBe('25 + 15')
  })

  it('lets you try another weight without touching the field', () => {
    render(<PlateCalculator target={100} unit="kg" />)
    fireEvent.change(screen.getByLabelText('Target (kg)'), { target: { value: '62.5' } })
    expect(screen.getByTestId('plate-result').textContent).toBe('20 + 1.25')
  })

  it('works in pounds', () => {
    render(<PlateCalculator target={225} unit="lb" />)
    expect(screen.getByTestId('plate-result').textContent).toBe('45 + 45')
  })

  it('says so when the target is lighter than the bar', () => {
    render(<PlateCalculator target={15} unit="kg" />)
    expect(screen.getByText(/lighter than the empty bar \(20 kg\)/)).toBeTruthy()
  })

  it('remembers the bar you pick, per unit, on this device', async () => {
    render(<PlateCalculator target={100} unit="kg" />)
    fireEvent.click(screen.getByRole('button', { name: '15 kg' }))
    await waitFor(() => expect(screen.getByTestId('plate-result').textContent).toBe('25 + 15 + 2.5')) // 42.5 per side
    expect((await db.settings.get('plateBar-kg'))?.value).toBe(15)
    expect(await db.settings.get('plateBar-lb')).toBeUndefined()
  })

  it('asks for a weight when there is none', () => {
    render(<PlateCalculator target={null} unit="kg" />)
    expect(screen.getByText('Enter a target weight.')).toBeTruthy()
  })
})
