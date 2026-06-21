import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from 'living-art-ui'

const tiles = ['Paleolithic', 'Minoan', 'Maya', 'Nasrid']

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 40, width: 420 }}>
      <Carousel opts={{ align: 'start' }} style={{ width: '100%' }}>
        <CarouselContent>
          {tiles.map((t) => (
            <CarouselItem key={t} className="basis-1/2">
              <div
                style={{
                  height: 120,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                }}
              >
                {t}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  )
}
