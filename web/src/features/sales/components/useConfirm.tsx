/**
 * Promise-based confirmation dialog, built on the UI kit Modal.
 *
 *     const { confirm, confirmDialog } = useConfirm();
 *     if (!(await confirm({ title: 'Șterge comanda?', destructive: true }))) return;
 *     ...
 *     return <>{confirmDialog}</>;
 */

import { useCallback, useState, type ReactNode } from 'react';
import { Button, Modal, type ConfirmOptions } from '@/components/ui';

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

export interface UseConfirmResult {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmDialog: ReactNode;
}

export function useConfirm(): UseConfirmResult {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ options, resolve });
      }),
    [],
  );

  const settle = (confirmed: boolean) => {
    if (!pending) return;
    pending.resolve(confirmed);
    setPending(null);
  };

  const confirmDialog = pending ? (
    <Modal
      open
      onClose={() => settle(false)}
      title={pending.options.title}
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => settle(false)}>
            {pending.options.cancelLabel ?? 'Anulează'}
          </Button>
          <Button
            variant={pending.options.destructive ? 'danger' : 'primary'}
            onClick={() => settle(true)}
          >
            {pending.options.confirmLabel ?? 'Confirmă'}
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink-muted">{pending.options.body}</div>
    </Modal>
  ) : null;

  return { confirm, confirmDialog };
}
