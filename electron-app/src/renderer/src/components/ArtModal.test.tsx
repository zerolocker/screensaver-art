import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
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

const item: ArtItem = { src: 'https://r2/a.mp4', title: 'Aurora', type: 'video' }

function setup(piece: ArtItem = item) {
  const props = { selected: false, locked: false, onToggle: vi.fn(), onSubscribe: vi.fn(), onClose: vi.fn() }
  const view = render(<ArtModal item={piece} {...props} />)
  const video = view.container.querySelector('video')!
  return { ...view, video, rerenderWith: (next: ArtItem) => view.rerender(<ArtModal item={next} {...props} />) }
}

// jsdom never loads media, so stand in for the browser: the clip's size and how
// far it has loaded.
function load(video: HTMLVideoElement, width: number, height: number, readyState: number): void {
  Object.defineProperty(video, 'videoWidth', { value: width, configurable: true })
  Object.defineProperty(video, 'videoHeight', { value: height, configurable: true })
  Object.defineProperty(video, 'readyState', { value: readyState, configurable: true })
}

describe('<ArtModal /> video fit', () => {
  it('leaves a landscape clip covering the window, as before', () => {
    const { video } = setup()
    load(video, 1280, 720, 4)
    fireEvent.loadedMetadata(video)
    fireEvent.loadedData(video)
    expect(video).toHaveClass('object-cover')
    expect(video.style.objectFit).toBe('')
    expect(video.style.visibility).toBe('')
  })

  it('hangs a portrait clip whole on the dark wall, revealed at its first frame', () => {
    const { video } = setup()
    load(video, 720, 1280, 1) // metadata only: no frame yet
    fireEvent.loadedMetadata(video)
    expect(video.style.objectFit).toBe('contain')
    expect(video.style.backgroundColor).toBe('rgb(11, 11, 13)')
    expect(video.style.visibility).toBe('hidden')

    load(video, 720, 1280, 2)
    fireEvent.loadedData(video)
    expect(video.style.objectFit).toBe('contain')
    expect(video.style.visibility).toBe('')
  })

  it('treats a new clip as landscape until its own metadata loads', () => {
    const { video, rerenderWith } = setup()
    load(video, 720, 1280, 4)
    fireEvent.loadedMetadata(video)
    expect(video.style.objectFit).toBe('contain')

    load(video, 0, 0, 0)
    rerenderWith({ ...item, src: 'https://r2/b.mp4' })
    expect(video.style.objectFit).toBe('')
  })
})

describe('<ArtModal /> while the clip loads', () => {
  const withThumb: ArtItem = { ...item, thumb: 'https://r2/a_640w.webp' }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the still with a loading cue, and keeps the clip hidden until it plays', () => {
    vi.useFakeTimers()
    const { container, video } = setup(withThumb)
    expect(container.querySelector('img')).toHaveAttribute('src', withThumb.thumb)
    expect(video.style.opacity).toBe('0')
    // No cue at first, so a cached clip doesn't flash it.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByRole('status')).toHaveTextContent('Loading the animation…')

    fireEvent.playing(video)
    expect(video.style.opacity).toBe('1')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows how much of the clip has downloaded, never 100% before it plays', () => {
    vi.useFakeTimers()
    const { video } = setup(withThumb)
    act(() => vi.advanceTimersByTime(400))
    const buffered = (end: number) => ({ length: 1, start: () => 0, end: () => end })
    Object.defineProperty(video, 'duration', { value: 10, configurable: true })
    Object.defineProperty(video, 'buffered', { value: buffered(4), configurable: true })
    fireEvent.progress(video)
    expect(screen.getByRole('status')).toHaveTextContent('Loading the animation… 40%')

    Object.defineProperty(video, 'buffered', { value: buffered(10), configurable: true })
    fireEvent.progress(video)
    expect(screen.getByRole('status')).toHaveTextContent('Loading the animation… 99%')
  })

  it('says it is buffering when a playing clip stalls', () => {
    vi.useFakeTimers()
    const { video } = setup(withThumb)
    fireEvent.playing(video)
    fireEvent.waiting(video)
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByRole('status')).toHaveTextContent('Buffering…')
    // The clip stays up while it catches up.
    expect(video.style.opacity).toBe('1')

    fireEvent.playing(video)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('offers to try again when the clip fails, without closing the preview', () => {
    const onClose = vi.fn()
    const props = { selected: false, locked: false, onToggle: vi.fn(), onSubscribe: vi.fn(), onClose }
    const { container } = render(<ArtModal item={withThumb} {...props} />)
    const first = container.querySelector('video')!
    fireEvent.error(first)
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t load the animation')
    expect(first.style.opacity).toBe('0')

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // A fresh <video> fetches the clip again.
    expect(container.querySelector('video')).not.toBe(first)
  })

  it('shows only the cue on a piece without a still', () => {
    vi.useFakeTimers()
    const { container } = setup(item)
    expect(container.querySelector('img')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
