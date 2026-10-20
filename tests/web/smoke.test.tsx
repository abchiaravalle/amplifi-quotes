import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function Hello({ name }: { name: string }) {
  return <p>Hello {name}</p>;
}

describe('web test project', () => {
  it('renders React components in jsdom', () => {
    render(<Hello name="Quotes" />);
    expect(screen.getByText('Hello Quotes')).toBeTruthy();
  });
});
