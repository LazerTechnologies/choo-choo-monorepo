import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Dialog } from '@/components/base';

describe('Dialog', () => {
  it('should render the dialog trigger', () => {
    render(
      <Dialog>
        <Dialog.Trigger>Open Dialog</Dialog.Trigger>
        <Dialog.Content>Dialog Content</Dialog.Content>
      </Dialog>,
    );
    const trigger = screen.getByText('Open Dialog');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toBeEnabled();
  });

  it('should open the dialog when the trigger is clicked', async () => {
    render(
      <Dialog>
        <Dialog.Trigger>Open Dialog</Dialog.Trigger>
        <Dialog.Content>Dialog Content</Dialog.Content>
      </Dialog>,
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
      </Dialog>,
    );

    fireEvent.click(screen.getByText('Open Dialog'));
    expect(await screen.findByText('Dialog Content')).toBeInTheDocument();

    const closeButton = screen.getByTitle('Close pop-up');
    fireEvent.click(closeButton);
    expect(screen.queryByText('Dialog Content')).not.toBeInTheDocument();
  });

  it('should manage focus when the dialog opens and closes', async () => {
    render(
      <Dialog>
        <Dialog.Trigger>Open Dialog</Dialog.Trigger>
        <Dialog.Content>
          Dialog Content
          <button>Focusable Element</button>
          <Dialog.Header />
        </Dialog.Content>
      </Dialog>,
    );

    const trigger = screen.getByText('Open Dialog');
    fireEvent.click(trigger);

    const dialogContent = await screen.findByText('Dialog Content');
    expect(dialogContent).toBeInTheDocument();

    const focusableElement = screen.getByText('Focusable Element');
    expect(focusableElement).toHaveFocus();

    fireEvent.click(screen.getByTitle('Close pop-up'));
    await waitFor(() => expect(screen.queryByText('Dialog Content')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('should close the dialog when pressing Escape', async () => {
    render(
      <div>
        <p>Outside Content</p>
        <Dialog>
          <Dialog.Trigger>Open Dialog</Dialog.Trigger>
          <Dialog.Content>Dialog Content</Dialog.Content>
        </Dialog>
      </div>,
    );

    fireEvent.click(screen.getByText('Open Dialog'));
    expect(await screen.findByText('Dialog Content')).toBeInTheDocument();

    // Use Escape key as a reliable way to close dialog in jsdom
    // (equivalent to outside click behavior in real browsers)
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Dialog Content')).not.toBeInTheDocument());
  });

  it('should have correct accessibility attributes', async () => {
    render(
      <Dialog>
        <Dialog.Trigger>Open Dialog</Dialog.Trigger>
        <Dialog.Content title="Dialog Title" description="Dialog Description">
          <Dialog.Header />
          Dialog Content
        </Dialog.Content>
      </Dialog>,
    );

    fireEvent.click(screen.getByText('Open Dialog'));
    const dialog = await screen.findByRole('dialog');

    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'dialog-description');
  });
});
