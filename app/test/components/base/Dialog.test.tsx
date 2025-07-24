import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Dialog } from '@/components/base';

describe('Dialog', () => {
  it('should render the dialog trigger', () => {
    render(
      <Dialog>
        <Dialog.Trigger>Open Dialog</Dialog.Trigger>
        <Dialog.Content>Dialog Content</Dialog.Content>
      </Dialog>
    );
    expect(screen.getByText('Open Dialog')).toBeInTheDocument();
  });

  it('should open the dialog when the trigger is clicked', async () => {
    render(
      <Dialog>
        <Dialog.Trigger>Open Dialog</Dialog.Trigger>
        <Dialog.Content>Dialog Content</Dialog.Content>
      </Dialog>
    );

    fireEvent.click(screen.getByText('Open Dialog'));
    expect(await screen.findByText('Dialog Content')).toBeInTheDocument();
  });

  it('should close the dialog when the close button is clicked', async () => {
    render(
      <Dialog>
        <Dialog.Trigger>Open Dialog</Dialog.Trigger>
        <Dialog.Content>
          Dialog Content
          <Dialog.Header />
        </Dialog.Content>
      </Dialog>
    );

    fireEvent.click(screen.getByText('Open Dialog'));
    expect(await screen.findByText('Dialog Content')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Close pop-up'));
    expect(screen.queryByText('Dialog Content')).not.toBeInTheDocument();
  });
});
