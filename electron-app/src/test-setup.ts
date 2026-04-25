import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// React Testing Library doesn't auto-unmount between tests under vitest's
// non-globals mode — without this, every render leaks into the next test's
// DOM and queryByText/getByRole start finding ghosts.
afterEach(() => cleanup())
