/**
 * Produse — inline-editable table.
 *
 * The mobile app opens a modal per product; on desktop the row itself becomes
 * editable and saves optimistically, which is the whole point of the rewrite.
 */

import { useMemo, useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  TextInput,
  type Column,
} from '@/components/ui';
import { formatMoney } from '@/components/domain';
import type { Product } from '@/types/domain';
import { includesFolded } from '@/lib/search';
import { ErrorNotice, FilterBar, FilterField, SearchInput } from './components/FilterBar';
import { Toaster, errorMessage, toast } from './components/Toaster';
import { useConfirm } from './components/useConfirm';
import {
  useCreateProduct,
  useDeleteProduct,
  useProducts,
  useUpdateProduct,
  type ProductInput,
} from './queries';
import {
  focusFirstInvalidField,
  parseDecimal,
  validatePositiveNumber,
  validateRequired,
} from './validation';

interface Draft {
  name: string;
  description: string;
  price: string;
}

const EMPTY_DRAFT: Draft = { name: '', description: '', price: '' };

/** Field-keyed so each box gets its own inline message instead of one toast. */
interface DraftErrors {
  name?: string;
  price?: string;
}

function draftFrom(product: Product): Draft {
  return {
    name: product.name,
    description: product.description ?? '',
    price: String(product.price),
  };
}

function validateDraft(draft: Draft): DraftErrors {
  const errors: DraftErrors = {};
  const nameError = validateRequired(draft.name, 'Numele produsului');
  if (nameError) errors.name = nameError;
  const priceError = validatePositiveNumber(draft.price, 'Prețul');
  if (priceError) errors.price = priceError;
  return errors;
}

function toInput(draft: Draft): ProductInput {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    price: parseDecimal(draft.price),
    // The form never edits this — retiring is the Delete button (a soft delete,
    // TODO-38), and `useProducts` only ever hands this form an active product.
    // Sending true unconditionally would UN-retire one if that ever changed, so
    // it is not written here; PUT is a full replace, hence the explicit value.
    isActive: true,
  };
}

export function ProductsPage() {
  const productsQuery = useProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const { confirm, confirmDialog } = useConfirm();

  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editErrors, setEditErrors] = useState<DraftErrors>({});
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT);
  const [newErrors, setNewErrors] = useState<DraftErrors>({});

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);

  const rows = useMemo(() => {
    const needle = search.trim();
    if (!needle) return products;
    // Diacritic-insensitive: "toaleta" has to find "Toaletă".
    return products.filter((product) =>
      includesFolded(`${product.name} ${product.description ?? ''}`, needle),
    );
  }, [products, search]);

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setEditDraft(draftFrom(product));
    setEditErrors({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
    setEditErrors({});
  };

  const saveEdit = async (product: Product) => {
    const found = validateDraft(editDraft);
    setEditErrors(found);
    if (found.name || found.price) {
      toast.error('Verificați câmpurile marcate.');
      focusFirstInvalidField({ 'product-edit-name': found.name, 'product-edit-price': found.price });
      return;
    }
    cancelEdit();
    try {
      await updateProduct.mutateAsync({ id: product.id, input: toInput(editDraft) });
      toast.success('Produsul a fost actualizat.');
    } catch (mutationError) {
      toast.error(errorMessage(mutationError, 'Nu s-a putut actualiza produsul'));
    }
  };

  const create = async () => {
    const found = validateDraft(newDraft);
    setNewErrors(found);
    if (found.name || found.price) {
      toast.error('Verificați câmpurile marcate.');
      focusFirstInvalidField({ 'product-new-name': found.name, 'product-new-price': found.price });
      return;
    }
    try {
      await createProduct.mutateAsync(toInput(newDraft));
      setNewDraft(EMPTY_DRAFT);
      setNewErrors({});
      toast.success('Produsul a fost adăugat.');
    } catch (mutationError) {
      toast.error(errorMessage(mutationError, 'Nu s-a putut adăuga produsul'));
    }
  };

  const remove = async (product: Product) => {
    const confirmed = await confirm({
      title: 'Șterge produsul?',
      body: `„${product.name}” va fi șters. Comenzile existente nu sunt modificate.`,
      confirmLabel: 'Șterge',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteProduct.mutateAsync(product.id);
      toast.success('Produsul a fost șters.');
    } catch (error) {
      toast.error(errorMessage(error, 'Nu s-a putut șterge produsul'));
    }
  };

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Nume',
      width: '20rem',
      sortValue: (product) => product.name.toLowerCase(),
      render: (product) =>
        product.id === editingId ? (
          <TextInput
            id="product-edit-name"
            value={editDraft.name}
            error={editErrors.name}
            autoFocus
            onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
          />
        ) : (
          <span className="font-medium">{product.name}</span>
        ),
    },
    {
      key: 'description',
      header: 'Descriere',
      sortValue: (product) => (product.description ?? '').toLowerCase(),
      render: (product) =>
        product.id === editingId ? (
          <TextInput
            value={editDraft.description}
            onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })}
          />
        ) : (
          <span className="block max-w-[32rem] truncate text-ink-muted">
            {product.description ?? '—'}
          </span>
        ),
    },
    {
      key: 'price',
      header: 'Preț',
      width: '9rem',
      align: 'right',
      sortValue: (product) => product.price,
      render: (product) =>
        product.id === editingId ? (
          <TextInput
            id="product-edit-price"
            value={editDraft.price}
            error={editErrors.price}
            inputMode="decimal"
            onChange={(event) =>
              setEditDraft({ ...editDraft, price: event.target.value.replace(/[^\d.,]/g, '') })
            }
          />
        ) : (
          <span className="tabular">{formatMoney(product.price)}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '11rem',
      align: 'right',
      render: (product) => (
        <span
          className="flex justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
          role="presentation"
        >
          {product.id === editingId ? (
            <>
              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                Anulează
              </Button>
              <Button size="sm" variant="primary" onClick={() => void saveEdit(product)}>
                Salvează
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => startEdit(product)}>
                Editează
              </Button>
              <button
                type="button"
                className="px-1.5 text-xs font-medium text-red-600 hover:underline"
                onClick={() => void remove(product)}
              >
                Șterge
              </button>
            </>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Produse"
        subtitle={
          productsQuery.isLoading ? 'Se încarcă…' : `${rows.length} din ${products.length} produse`
        }
        actions={
          <Button
            variant="secondary"
            loading={productsQuery.isFetching}
            onClick={() => void productsQuery.refetch()}
          >
            Reîmprospătează
          </Button>
        }
      />

      <FilterBar>
        <FilterField label="Căutare">
          <SearchInput value={search} onChange={setSearch} placeholder="Nume sau descriere" />
        </FilterField>
        <div className="ml-auto flex items-end gap-2">
          <div className="w-52">
            <TextInput
              id="product-new-name"
              label="Produs nou"
              placeholder="Nume"
              value={newDraft.name}
              error={newErrors.name}
              onChange={(event) => setNewDraft({ ...newDraft, name: event.target.value })}
            />
          </div>
          <div className="w-64">
            <TextInput
              label="Descriere"
              placeholder="Opțional"
              value={newDraft.description}
              onChange={(event) => setNewDraft({ ...newDraft, description: event.target.value })}
            />
          </div>
          <div className="w-28">
            <TextInput
              id="product-new-price"
              label="Preț (RON)"
              placeholder="0"
              inputMode="decimal"
              value={newDraft.price}
              error={newErrors.price}
              onChange={(event) =>
                setNewDraft({ ...newDraft, price: event.target.value.replace(/[^\d.,]/g, '') })
              }
            />
          </div>
          <Button variant="primary" loading={createProduct.isPending} onClick={() => void create()}>
            + Adaugă
          </Button>
        </div>
      </FilterBar>

      {productsQuery.isError ? (
        <ErrorNotice
          message="Nu s-au putut prelua produsele."
          onRetry={() => void productsQuery.refetch()}
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(product) => product.id}
          initialSort={{ key: 'name', dir: 'asc' }}
          loading={productsQuery.isLoading}
          activeKey={editingId}
          onRowClick={(product) => {
            if (product.id !== editingId) startEdit(product);
          }}
          empty={
            <EmptyState
              title={search ? 'Niciun produs pentru căutarea curentă' : 'Nu există produse'}
              body={
                search
                  ? 'Ajustează căutarea sau golește câmpul.'
                  : 'Adăugați primul produs din bara de sus.'
              }
              action={
                search ? (
                  <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                    Golește căutarea
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}

      {confirmDialog}
      <Toaster />
    </>
  );
}
