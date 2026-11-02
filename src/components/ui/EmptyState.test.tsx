import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState title="No titles in the library" description="Import a CBZ to begin." />,
    )
    expect(screen.getByText('No titles in the library')).toBeInTheDocument()
    expect(screen.getByText('Import a CBZ to begin.')).toBeInTheDocument()
  })
})
