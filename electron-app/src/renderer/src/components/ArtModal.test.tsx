import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ArtItem } from '@screensaver-art/constants'
import { ArtModal } from './ArtModal'

const ai: ArtItem = {
  src: 'https://r2/a.mp4',
  title: 'Woman and Flora - Art Nouveau (AI Animated)',
  type: 'video',
  tags: ['19th Century'],
}

const real: ArtItem = {
  src: 'https://r2/paris_street_rainy_day_animated.mp4',
  title: 'Paris Street; Rainy Day - Gustave Caillebotte (AI Animated)',
  type: 'video',
  tags: ['19th Century'],
  source: 'real_artwork',
  artist: 'Gustave Caillebotte',
  artist_dates: '1848–1894',
  original_title: 'Paris Street; Rainy Day',
  original_date: '1877',
  museum: 'Art Institute of Chicago',
  source_url: 'https://www.artic.edu/artworks/20684',
  license: 'Public Domain',
}

function open(item: ArtItem) {
  render(
    <ArtModal
      item={item}
      selected={false}
      locked={false}
      onToggle={vi.fn()}
      onSubscribe={vi.fn()}
      onClose={vi.fn()}
    />,
  )
}

describe('<ArtModal /> provenance credit', () => {
  it('credits a real artwork: artist, date, museum, licence, and that the motion is AI', () => {
    open(real)
    expect(screen.getByText(real.title)).toBeInTheDocument()
    expect(
      screen.getByText(
        'Original by Gustave Caillebotte, 1877 · Art Institute of Chicago · Public domain · Motion by AI',
      ),
    ).toBeInTheDocument()
  })

  it('shows no credit line on an AI-generated piece (no source)', () => {
    open(ai)
    expect(screen.queryByText(/Original by|Motion by AI/)).not.toBeInTheDocument()
  })
})
