import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UpsellBanner } from './UpsellBanner'

describe('<UpsellBanner />', () => {
  it('renders the benefit-led copy', () => {
    render(<UpsellBanner onSubscribe={() => {}} />)
    expect(screen.getByText('Unlock the full gallery')).toBeInTheDocument()
    expect(screen.getByText(/stream every living artwork/i)).toBeInTheDocument()
  })

  it('shows the promo price on the subscribe button', () => {
    render(<UpsellBanner onSubscribe={() => {}} />)
    // Accessible name concatenates the split price text nodes ("$0.99" + "/month").
    expect(screen.getByRole('button', { name: /\$0\.99\/month/ })).toBeInTheDocument()
  })

  it('fires onSubscribe when the button is clicked', () => {
    const onSubscribe = vi.fn()
    render(<UpsellBanner onSubscribe={onSubscribe} />)
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }))
    expect(onSubscribe).toHaveBeenCalledTimes(1)
  })
})
