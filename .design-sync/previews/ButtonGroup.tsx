import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText, Button } from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 28,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  alignItems: 'flex-start',
}

export function Default() {
  return (
    <div style={frame}>
      <ButtonGroup>
        <Button variant="outline">Day</Button>
        <Button variant="outline">Week</Button>
        <Button variant="outline">Month</Button>
      </ButtonGroup>
      <ButtonGroup>
        <Button variant="outline">Previous</Button>
        <ButtonGroupSeparator />
        <Button variant="outline">Next</Button>
      </ButtonGroup>
    </div>
  )
}
