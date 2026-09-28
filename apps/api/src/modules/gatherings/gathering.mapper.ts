import type { Prisma } from '@prisma/client';
import type {
  Gathering,
  GatheringAttendee,
  GatheringDetail,
  GatheringItem,
  GatheringNote,
} from '@maanslogen/contracts';
import { publicUrlFor } from '../media/media.mapper';

/**
 * De `include`-former servicen skal hente for at kortlægningen har alt den
 * mangler. Samlet her, så en ændring i formen kun sker ét sted.
 */
export const gatheringListInclude = {
  host: { select: { id: true, displayName: true } },
  _count: { select: { items: true, attendees: true } },
} satisfies Prisma.GatheringInclude;

export const gatheringDetailInclude = {
  host: { select: { id: true, displayName: true } },
  _count: { select: { items: true, attendees: true } },
  attendees: {
    orderBy: { invitedAt: 'asc' },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          avatar: { select: { renditions: { select: { variant: true, storageKey: true } } } },
        },
      },
    },
  },
  items: {
    orderBy: { sortOrder: 'asc' },
    include: {
      beverage: {
        select: {
          id: true,
          name: true,
          slug: true,
          brand: { select: { name: true } },
          media: { select: { renditions: { select: { variant: true, storageKey: true } } } },
        },
      },
      notes: {
        orderBy: { createdAt: 'asc' },
        include: { attendee: { include: { user: { select: { displayName: true } } } } },
      },
    },
  },
} satisfies Prisma.GatheringInclude;

type ListRow = Prisma.GatheringGetPayload<{ include: typeof gatheringListInclude }>;
type DetailRow = Prisma.GatheringGetPayload<{ include: typeof gatheringDetailInclude }>;
type AttendeeRow = DetailRow['attendees'][number];
type ItemRow = DetailRow['items'][number];
type NoteRow = ItemRow['notes'][number];

type Rendition = { variant: string; storageKey: string };

/** Mindste variant der findes. Listerne viser små billeder. */
function thumbUrl(renditions: Rendition[] | undefined): string | null {
  if (!renditions?.length) return null;
  const preferred =
    renditions.find((r) => r.variant === 'THUMB') ??
    renditions.find((r) => r.variant === 'CARD') ??
    renditions[0];
  return preferred ? publicUrlFor(preferred.storageKey) : null;
}

export function toGathering(row: ListRow): Gathering {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    status: row.status,
    title: row.title,
    summary: row.summary,
    heldAt: row.heldAt?.toISOString() ?? null,
    location: row.location,
    host: { id: row.host.id, displayName: row.host.displayName },
    publishedAt: row.publishedAt?.toISOString() ?? null,
    itemCount: row._count.items,
    attendeeCount: row._count.attendees,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAttendee(row: AttendeeRow): GatheringAttendee {
  return {
    id: row.id,
    userId: row.userId,
    displayName: row.user.displayName,
    avatarUrl: thumbUrl(row.user.avatar?.renditions),
    invitedAt: row.invitedAt.toISOString(),
    joinedAt: row.joinedAt?.toISOString() ?? null,
  };
}

export function toNote(row: NoteRow): GatheringNote {
  return {
    id: row.id,
    attendeeId: row.attendeeId,
    authorName: row.attendee.user.displayName,
    rating: row.rating,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toItem(row: ItemRow): GatheringItem {
  const notes = row.notes.map(toNote);
  const sum = notes.reduce((total, note) => total + note.rating, 0);

  return {
    id: row.id,
    sortOrder: row.sortOrder,
    beverage: row.beverage
      ? {
          id: row.beverage.id,
          name: row.beverage.name,
          slug: row.beverage.slug,
          brandName: row.beverage.brand?.name ?? null,
          imageUrl: thumbUrl(row.beverage.media?.renditions),
        }
      : null,
    label: row.label,
    // Katalognavnet vinder. Er posten ikke knyttet endnu, står etiketten — og
    // databasen garanterer at mindst én af delene findes.
    displayName: row.beverage?.name ?? row.label ?? 'Ukendt',
    blind: row.blind,
    servedAt: row.servedAt?.toISOString() ?? null,
    note: row.note,
    notes,
    averageRating: notes.length ? Math.round((sum / notes.length) * 100) / 100 : null,
    noteCount: notes.length,
  };
}

export interface ViewerRights {
  isHost: boolean;
  isAdmin: boolean;
  attendeeId: string | null;
  canAddItems: boolean;
  canWriteNotes: boolean;
}

export function toGatheringDetail(
  row: DetailRow,
  viewer: ViewerRights,
  options: { includeStory: boolean },
): GatheringDetail {
  return {
    ...toGathering(row),
    // Et halvfærdigt opslag er ikke noget deltagerne skal læse med over
    // skulderen. Admin ser sit eget udkast.
    story: options.includeStory ? row.story : null,
    items: row.items.map(toItem),
    attendees: row.attendees.map(toAttendee),
    viewer,
  };
}
