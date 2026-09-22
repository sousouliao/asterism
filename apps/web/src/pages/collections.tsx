import type { CollectionWithMeta } from '@asterism/db';
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from '@asterism/ui';
import {
  FolderIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CollectionFormDialog } from '../components/collection-form-dialog';
import { ConfirmDialog } from '../components/confirm-dialog';
import { EmptyState } from '../components/empty-state';
import { LoadingRegion } from '../components/loading-region';
import { PageHeader } from '../components/page-header';
import { CollectionGridSkeleton } from '../components/page-loading-states';
import { SearchInputIcon } from '../components/search-input-icon';
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  useUpdateCollection,
} from '../data/use-collections';
import { formatRelativeTime } from '../lib/format';

export function CollectionsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: collections, isLoading } = useCollections();
  const createCollection = useCreateCollection();
  const updateCollection = useUpdateCollection();
  const deleteCollection = useDeleteCollection();

  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CollectionWithMeta | null>(null);
  const [deleting, setDeleting] = useState<CollectionWithMeta | null>(null);

  const list = collections ?? [];
  const collectionNames = list.map((item) => item.name);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter((collection) => collection.name.toLowerCase().includes(q));
  }, [list, query]);

  const subtitle = t('collections.subtitle', {
    total: new Intl.NumberFormat(i18n.language).format(list.length),
  });

  return (
    <div className="asterism-scroll-gutter -m-6 min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader
          title={t('collections.title')}
          description={isLoading ? undefined : subtitle}
          actions={
            list.length > 0 ? (
              <Button
                onClick={() => {
                  createCollection.reset();
                  setCreateOpen(true);
                }}
              >
                <PlusIcon className="size-4" />
                {t('collections.create')}
              </Button>
            ) : undefined
          }
        />

        {isLoading ? null : list.length > 0 ? (
          <div className="relative max-w-md">
            <SearchInputIcon className="left-3" />
            <Input
              className="px-9"
              placeholder={t('collections.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        ) : null}

        {isLoading ? (
          <LoadingRegion label={t('loading.collections')}>
            <CollectionGridSkeleton />
          </LoadingRegion>
        ) : list.length === 0 ? (
          <EmptyState
            icon={FolderIcon}
            title={t('collections.emptyTitle')}
            description={t('collections.emptyDescription')}
            action={
              <Button
                onClick={() => {
                  createCollection.reset();
                  setCreateOpen(true);
                }}
              >
                <PlusIcon className="size-4" />
                {t('collections.create')}
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={SearchIcon} title={t('collections.noResults')} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((collection) => (
              <Card
                key={collection.id}
                role="button"
                tabIndex={0}
                className="flex min-h-[130px] cursor-pointer flex-col gap-3 rounded-lg p-5 py-5 transition-colors hover:bg-accent/50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                onClick={() => navigate(`/collections/${collection.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/collections/${collection.id}`);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 truncate font-semibold text-drawer-title text-foreground">
                    {collection.name}
                  </h2>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge
                      variant="secondary"
                      className="rounded-[10px] bg-secondary font-normal text-caption text-muted-foreground"
                    >
                      {t('collections.repoCount', { value: collection.repoCount })}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10 text-muted-foreground hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground sm:size-7"
                          aria-label={t('common.actions')}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                        <DropdownMenuItem
                          onSelect={() => {
                            updateCollection.reset();
                            setEditing(collection);
                          }}
                        >
                          <PencilIcon className="size-4" />
                          {t('common.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => {
                            deleteCollection.reset();
                            setDeleting(collection);
                          }}
                        >
                          <Trash2Icon className="size-4" />
                          {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {collection.description ? (
                  <p className="line-clamp-2 text-body text-muted-foreground">
                    {collection.description}
                  </p>
                ) : null}
                <p className="mt-auto text-caption text-muted-foreground">
                  {t('browse.updated', {
                    time: formatRelativeTime(collection.updatedAt, i18n.language) ?? '',
                  })}
                </p>
              </Card>
            ))}
          </div>
        )}

        <CollectionFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          title={t('collections.createTitle')}
          submitLabel={t('collections.create')}
          existingNames={collectionNames}
          pending={createCollection.isPending}
          errorMessage={createCollection.isError ? t('collections.saveError') : undefined}
          onSubmit={(values) => {
            createCollection.mutate(values, { onSuccess: () => setCreateOpen(false) });
          }}
        />

        <CollectionFormDialog
          key={editing?.id ?? 'edit'}
          open={Boolean(editing)}
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null);
            }
          }}
          title={t('collections.editTitle')}
          submitLabel={t('common.save')}
          initialName={editing?.name ?? ''}
          initialDescription={editing?.description ?? ''}
          existingNames={collectionNames}
          pending={updateCollection.isPending}
          errorMessage={updateCollection.isError ? t('collections.saveError') : undefined}
          onSubmit={(values) => {
            if (!editing) {
              return;
            }
            updateCollection.mutate(
              { id: editing.id, name: values.name, description: values.description },
              { onSuccess: () => setEditing(null) },
            );
          }}
        />

        <ConfirmDialog
          open={Boolean(deleting)}
          onOpenChange={(open) => {
            if (!open) {
              setDeleting(null);
            }
          }}
          title={t('collections.deleteTitle', { name: deleting?.name ?? '' })}
          description={t('collections.deleteDescription')}
          confirmLabel={t('common.delete')}
          pending={deleteCollection.isPending}
          errorMessage={deleteCollection.isError ? t('collections.deleteError') : undefined}
          onConfirm={() => {
            if (!deleting) {
              return;
            }
            deleteCollection.mutate(deleting, { onSuccess: () => setDeleting(null) });
          }}
        />
      </div>
    </div>
  );
}
