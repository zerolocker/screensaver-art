import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from 'living-art-ui'

const data = [
  { month: 'Jan', plays: 186 },
  { month: 'Feb', plays: 305 },
  { month: 'Mar', plays: 237 },
  { month: 'Apr', plays: 273 },
  { month: 'May', plays: 209 },
  { month: 'Jun', plays: 314 },
]

const config = {
  plays: { label: 'Plays', color: 'var(--primary)' },
}

export function Bars() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, width: 420 }}>
      <ChartContainer config={config} className="h-[220px] w-full">
        <BarChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="plays" fill="var(--color-plays)" radius={6} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
