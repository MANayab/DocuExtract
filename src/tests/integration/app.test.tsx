import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';

describe('app', () => {
  it('renders the upload screen with the page structure crawlers and users rely on', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: /PDF Invoice to Excel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose PDF/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Choose invoice PDFs/i)).toHaveAttribute('multiple');
    expect(screen.getByRole('heading', { name: /How it works/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Frequently asked questions/i })).toBeInTheDocument();
  });

  it('shows no results or export section before any file is added', () => {
    render(<App />);

    expect(screen.queryByRole('heading', { name: /^Invoices$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download Excel/i })).not.toBeInTheDocument();
  });

  it('has a single level-one heading', () => {
    render(<App />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
