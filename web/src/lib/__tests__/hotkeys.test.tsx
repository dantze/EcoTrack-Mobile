/**
 * The shortcut registry — what `useShortcuts` promises every screen.
 *
 * Three properties, and they are the ones a refactor of the registration
 * plumbing can break silently, because nothing in the UI shows a shortcut that
 * quietly stopped firing:
 *
 *   1. a registered combo runs while the component is mounted;
 *   2. it runs the CURRENT handler, not the closure captured at registration —
 *      the shape of a screen's shortcut list rarely changes, so re-registering
 *      on every render is avoided on purpose and a stale closure would mean a
 *      key acting on last render's state;
 *   3. unmounting takes the combo with it, so a key does not keep firing into
 *      a screen the operator has left.
 *
 * Plus the escape hatch every screen test relies on: outside a provider the
 * hook is a no-op rather than a crash.
 */

import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShortcutProvider, useActiveShortcuts, useShortcuts } from '../hotkeys';

function Counter() {
  const [count, setCount] = useState(0);
  // Deliberately NOT a functional update: this only counts past 1 if the
  // registry calls the handler from the latest render.
  useShortcuts([{ combo: 'n', description: 'Incrementează', group: 'Test', run: () => setCount(count + 1) }]);
  return <p>count: {count}</p>;
}

function ActiveList() {
  return <p>active: {useActiveShortcuts().map((item) => item.combo).join(',') || 'none'}</p>;
}

describe('useShortcuts', () => {
  it('runs a registered combo and lists it for the help overlay', async () => {
    const run = vi.fn();
    function Screen() {
      useShortcuts([{ combo: 'n', description: 'Comandă nouă', group: 'Test', run }]);
      return null;
    }

    const user = userEvent.setup();
    render(
      <ShortcutProvider>
        <Screen />
        <ActiveList />
      </ShortcutProvider>,
    );

    expect(screen.getByText('active: n')).toBeInTheDocument();
    await user.keyboard('n');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('calls the handler from the latest render, without re-registering', async () => {
    const user = userEvent.setup();
    render(
      <ShortcutProvider>
        <Counter />
      </ShortcutProvider>,
    );

    await user.keyboard('n');
    expect(screen.getByText('count: 1')).toBeInTheDocument();
    await user.keyboard('n');
    expect(screen.getByText('count: 2')).toBeInTheDocument();
  });

  it('unregisters when the caller unmounts', async () => {
    const run = vi.fn();
    function Screen() {
      useShortcuts([{ combo: 'n', description: 'Comandă nouă', group: 'Test', run }]);
      return null;
    }

    const user = userEvent.setup();
    const view = render(
      <ShortcutProvider>
        <Screen />
      </ShortcutProvider>,
    );

    await user.keyboard('n');
    expect(run).toHaveBeenCalledTimes(1);

    view.rerender(
      <ShortcutProvider>
        <ActiveList />
      </ShortcutProvider>,
    );
    expect(screen.getByText('active: none')).toBeInTheDocument();

    await user.keyboard('n');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('is a no-op outside a provider, so a screen renders in isolation', async () => {
    const run = vi.fn();
    function Screen() {
      useShortcuts([{ combo: 'n', description: 'Comandă nouă', group: 'Test', run }]);
      return <p>fără provider</p>;
    }

    const user = userEvent.setup();
    render(<Screen />);

    expect(screen.getByText('fără provider')).toBeInTheDocument();
    await user.keyboard('n');
    expect(run).not.toHaveBeenCalled();
  });
});
