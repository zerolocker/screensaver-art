import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  Badge,
} from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, maxWidth: 560 }}>
      <Table>
        <TableCaption>Recent collections in your gallery.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Collection</TableHead>
            <TableHead>Era</TableHead>
            <TableHead style={{ textAlign: 'right' }}>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Paleolithic Cave Painting</TableCell>
            <TableCell>~17,000 BCE</TableCell>
            <TableCell style={{ textAlign: 'right' }}><Badge variant="secondary">Free</Badge></TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Minoan Fresco</TableCell>
            <TableCell>~1600 BCE</TableCell>
            <TableCell style={{ textAlign: 'right' }}><Badge>Subscriber</Badge></TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Nasrid Alhambra Ornament</TableCell>
            <TableCell>~1350 CE</TableCell>
            <TableCell style={{ textAlign: 'right' }}><Badge>Subscriber</Badge></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
