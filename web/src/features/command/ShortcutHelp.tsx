/**
 * The `?` overlay: every shortcut that works *right now*.
 *
 * It reads the live registry rather than a hand-written list, so a screen that
 * registers its own keys shows up here automatically and a list can never go
 * stale against the code. Keys are grouped by the `group` each shortcut
 * declares, global first.
 */

import { Modal } from '@/components/ui';
import { Kbd, KbdGroup } from '@/components/shadcn/kbd';
import { GLOBAL_GROUP, comboLabel, useActiveShortcuts, type Shortcut } from '@/lib/hotkeys';

// Re-exported for the screens that already import it from here.
export { GLOBAL_GROUP };

function Keys({ combo }: { combo: string }) {
  return (
    <KbdGroup className="shrink-0">
      {comboLabel(combo)
        .split(' , ')
        .map((chunk, index) => (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <span className="text-xs text-ink-subtle">apoi</span>}
            <Kbd>{chunk}</Kbd>
          </span>
        ))}
    </KbdGroup>
  );
}

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const shortcuts = useActiveShortcuts();

  const groups = new Map<string, Shortcut[]>();
  for (const shortcut of shortcuts) {
    if (shortcut.disabled) continue;
    const bucket = groups.get(shortcut.group);
    if (bucket) bucket.push(shortcut);
    else groups.set(shortcut.group, [shortcut]);
  }

  const ordered = [...groups.entries()].sort(([left], [right]) => {
    if (left === GLOBAL_GROUP) return -1;
    if (right === GLOBAL_GROUP) return 1;
    return left.localeCompare(right, 'ro');
  });

  return (
    <Modal open={open} onClose={onClose} width="md" title="Scurtături de tastatură">
      {ordered.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">
          Nicio scurtătură disponibilă pe acest ecran.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {ordered.map(([group, items]) => (
            <section key={group}>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                {group}
              </h3>
              <ul className="flex flex-col">
                {items.map((shortcut) => (
                  <li
                    key={`${group}-${shortcut.combo}`}
                    className="flex items-center justify-between gap-4 border-b border-border/70 py-1.5 last:border-0"
                  >
                    <span className="min-w-0 text-sm text-ink">{shortcut.description}</span>
                    <Keys combo={shortcut.combo} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className="mt-5 border-t border-border pt-3 text-xs text-ink-subtle">
        Scurtăturile fără tastă modificatoare nu se declanșează cât timp scrii într-un câmp.
      </p>
    </Modal>
  );
}
