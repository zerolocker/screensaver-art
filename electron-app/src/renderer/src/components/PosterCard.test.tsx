import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// The poster engine touches IntersectionObserver / <canvas> / <video>, none of
// which jsdom implements — stub it so the card renders as a plain DOM subtree.
vi.mock('../lib/poster-engine', () => ({
  observePoster: () => () => {},
  spawnPreview: () => ({ video: document.createElement('video'), destroy: () => {} }),
}))

import { PosterCard } from './PosterCard'
import type { ArtItem } from '@screensaver-art/constants'

const item: ArtItem = { src: 'https://r2/a.mp4', title: 'Aurora', type: 'video' }

function setup(props: Partial<React.ComponentProps<typeof PosterCard>> = {}) {
  const onToggle = vi.fn()
  const onSubscribe = vi.fn()
  const onOpen = vi.fn()
  render(
    <PosterCard
      item={item}
      selected={false}
      locked={false}
      hidden={false}
      onToggle={onToggle}
      onSubscribe={onSubscribe}
      onOpen={onOpen}
      {...props}
    />,
  )
  return { onToggle, onSubscribe, onOpen }
}

describe('<PosterCard />', () => {
  it('unlocked: the tick toggles selection (not subscribe) and does not open the modal', () => {
    const { onToggle, onSubscribe, onOpen } = setup()
    fireEvent.click(screen.getByTitle('Add to your screensaver'))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onSubscribe).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled() // stopPropagation guards the card click
  })

  it('unlocked + selected: reflects the playing state in the tooltip', () => {
    setup({ selected: true })
    expect(screen.getByTitle('Playing — click to remove')).toBeInTheDocument()
  })

  it('locked: shows a lock that prompts to subscribe and never toggles', () => {
    const { onToggle, onSubscribe } = setup({ locked: true })
    fireEvent.click(screen.getByTitle('Subscribe to unlock'))
    expect(onSubscribe).toHaveBeenCalledTimes(1)
    expect(onToggle).not.toHaveBeenCalled()
    // The add tick is gone — there's no way to add a locked piece.
    expect(screen.queryByTitle('Add to your screensaver')).not.toBeInTheDocument()
  })

  it('opens the detail modal when the card body is clicked', () => {
    const { onOpen } = setup()
    fireEvent.click(screen.getByText('Aurora'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
