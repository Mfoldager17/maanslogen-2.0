import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  erKurateret,
  roleAtLeast,
  slugify,
  type AccessTokenClaims,
  type AddGatheringItemInput,
  type CreateGatheringInput,
  type Gathering,
  type GatheringDetail,
  type GatheringListQuery,
  type InviteAttendeeInput,
  type Paginated,
  type UpdateGatheringInput,
  type UpdateGatheringItemInput,
  type UpsertGatheringNoteInput,
} from '@maanslogen/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/http/app-error';
import { paginate } from '../../common/pagination/cursor';
import { idOrSlugWhere } from '../../common/utils/id-or-slug';
import { uniqueSlug } from '../../common/utils/slug';
import {
  gatheringDetailInclude,
  gatheringListInclude,
  toGathering,
  toGatheringDetail,
  type ViewerRights,
} from './gathering.mapper';

/**
 * Arrangementer er ikke offentlige. Adgang har admin og de inviterede — og
 * ingen andre.
 *
 * Et arrangement man ikke er inviteret til svarer 404, ikke 403. Et 403 ville
 * bekræfte at det findes, og hvem der holder hvad er også en oplysning.
 */
@Injectable()
export class GatheringService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(viewer: AccessTokenClaims): boolean {
    return roleAtLeast(viewer.role, 'ADMIN');
  }

  private assertAdmin(viewer: AccessTokenClaims): void {
    if (!this.isAdmin(viewer)) {
      throw AppError.forbidden('Kun en administrator kan ændre arrangementer');
    }
  }

  /** Hvad brugeren overhovedet må se. Admin ser alt; andre kun deres egne. */
  private visibleWhere(viewer: AccessTokenClaims): Prisma.GatheringWhereInput {
    if (this.isAdmin(viewer)) return {};
    return { attendees: { some: { userId: viewer.sub } } };
  }

  async list(query: GatheringListQuery, viewer: AccessTokenClaims): Promise<Paginated<Gathering>> {
    const where: Prisma.GatheringWhereInput = {
      ...this.visibleWhere(viewer),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { summary: { contains: query.q, mode: 'insensitive' } },
              { location: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.GatheringOrderByWithRelationInput[] = [
      { [query.sort]: query.order },
      { id: 'asc' },
    ];

    return paginate(
      query,
      (take, cursorId) =>
        this.prisma.gathering.findMany({
          where,
          include: gatheringListInclude,
          orderBy,
          take,
          ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        }),
      toGathering,
      query.withTotal ? () => this.prisma.gathering.count({ where }) : undefined,
    );
  }

  /**
   * Henter arrangementet og afgør hvad brugeren må. Findes det ikke — eller er
   * brugeren ikke inviteret — er svaret det samme: 404.
   */
  private async load(idOrSlug: string, viewer: AccessTokenClaims) {
    const row = await this.prisma.gathering.findFirst({
      where: { AND: [this.visibleWhere(viewer), idOrSlugWhere(idOrSlug)] },
      include: gatheringDetailInclude,
    });
    if (!row) throw AppError.notFound('Arrangement', idOrSlug);

    const attendee = row.attendees.find((a) => a.userId === viewer.sub);
    const isAdmin = this.isAdmin(viewer);
    const published = row.publishedAt !== null;

    const rights: ViewerRights = {
      isHost: row.hostId === viewer.sub,
      isAdmin,
      attendeeId: attendee?.id ?? null,
      // Ved en smagning er rækkefølgen bestemt i forvejen, så kun admin lægger
      // ting på. Ved alt andet skriver deltagerne selv ind, mens det står på.
      canAddItems:
        isAdmin || (attendee !== undefined && !erKurateret(row.kind) && row.status === 'LIVE'),
      // Udgivelsen fryser noterne. Uden det ville "hvad vi syntes den aften"
      // kunne skrives om bagefter, og så betyder opslaget ingenting.
      canWriteNotes: attendee !== undefined && !published && row.status !== 'PLANNED',
    };

    return { row, rights, attendee };
  }

  async detail(idOrSlug: string, viewer: AccessTokenClaims): Promise<GatheringDetail> {
    const { row, rights } = await this.load(idOrSlug, viewer);
    return toGatheringDetail(row, rights, {
      includeStory: row.publishedAt !== null || rights.isAdmin,
    });
  }

  // ---- Arrangementet ------------------------------------------------------

  async create(input: CreateGatheringInput, viewer: AccessTokenClaims): Promise<GatheringDetail> {
    this.assertAdmin(viewer);

    const slug = await uniqueSlug(slugify(input.title), async (candidate) => {
      const existing = await this.prisma.gathering.findUnique({ where: { slug: candidate } });
      return existing !== null;
    });

    const created = await this.prisma.gathering.create({
      data: {
        slug,
        kind: input.kind,
        title: input.title,
        summary: input.summary ?? null,
        heldAt: input.heldAt ? new Date(input.heldAt) : null,
        location: input.location ?? null,
        hostId: viewer.sub,
        // Værten er selv med. Ellers ville den der holder smagningen skulle
        // invitere sig selv for at kunne skrive en note.
        attendees: { create: { userId: viewer.sub } },
      },
      include: gatheringDetailInclude,
    });

    return this.detail(created.id, viewer);
  }

  async update(
    idOrSlug: string,
    input: UpdateGatheringInput,
    viewer: AccessTokenClaims,
  ): Promise<GatheringDetail> {
    this.assertAdmin(viewer);
    const { row } = await this.load(idOrSlug, viewer);

    await this.prisma.gathering.update({
      where: { id: row.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.summary !== undefined ? { summary: input.summary ?? null } : {}),
        ...(input.story !== undefined ? { story: input.story ?? null } : {}),
        ...(input.location !== undefined ? { location: input.location ?? null } : {}),
        ...(input.heldAt !== undefined
          ? { heldAt: input.heldAt ? new Date(input.heldAt) : null }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });

    return this.detail(row.id, viewer);
  }

  async remove(idOrSlug: string, viewer: AccessTokenClaims): Promise<void> {
    this.assertAdmin(viewer);
    const { row } = await this.load(idOrSlug, viewer);
    await this.prisma.gathering.delete({ where: { id: row.id } });
  }

  /** Udgiver opslaget til deltagerne og låser noterne. */
  async publish(idOrSlug: string, viewer: AccessTokenClaims): Promise<GatheringDetail> {
    this.assertAdmin(viewer);
    const { row } = await this.load(idOrSlug, viewer);
    await this.prisma.gathering.update({
      where: { id: row.id },
      data: { publishedAt: new Date(), status: 'DONE' },
    });
    return this.detail(row.id, viewer);
  }

  /** Låser op igen, så en fejl kan rettes. */
  async unpublish(idOrSlug: string, viewer: AccessTokenClaims): Promise<GatheringDetail> {
    this.assertAdmin(viewer);
    const { row } = await this.load(idOrSlug, viewer);
    await this.prisma.gathering.update({ where: { id: row.id }, data: { publishedAt: null } });
    return this.detail(row.id, viewer);
  }

  // ---- Deltagere ----------------------------------------------------------

  async invite(
    idOrSlug: string,
    input: InviteAttendeeInput,
    viewer: AccessTokenClaims,
  ): Promise<GatheringDetail> {
    this.assertAdmin(viewer);
    const { row } = await this.load(idOrSlug, viewer);

    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, deletedAt: null, active: true },
    });
    if (!user) throw AppError.notFound('Bruger', input.userId);

    await this.prisma.gatheringAttendee.upsert({
      where: { gatheringId_userId: { gatheringId: row.id, userId: input.userId } },
      create: { gatheringId: row.id, userId: input.userId },
      update: {},
    });

    return this.detail(row.id, viewer);
  }

  async uninvite(
    idOrSlug: string,
    attendeeId: string,
    viewer: AccessTokenClaims,
  ): Promise<GatheringDetail> {
    this.assertAdmin(viewer);
    const { row } = await this.load(idOrSlug, viewer);

    const attendee = row.attendees.find((a) => a.id === attendeeId);
    if (!attendee) throw AppError.notFound('Deltager', attendeeId);

    // Noterne hænger på posterne, ikke på deltageren, så de tælles her frem for
    // at blive hentet med i hvert eneste detaljesvar.
    const noteCount = await this.prisma.gatheringNote.count({ where: { attendeeId } });
    if (noteCount > 0) {
      throw AppError.conflict(
        'Deltageren har skrevet noter. Slet noterne først, hvis de skal fjernes helt.',
      );
    }

    await this.prisma.gatheringAttendee.delete({ where: { id: attendeeId } });
    return this.detail(row.id, viewer);
  }

  // ---- Ting på listen -----------------------------------------------------

  async addItem(
    idOrSlug: string,
    input: AddGatheringItemInput,
    viewer: AccessTokenClaims,
  ): Promise<GatheringDetail> {
    const { row, rights } = await this.load(idOrSlug, viewer);
    if (!rights.canAddItems) {
      throw AppError.forbidden(
        erKurateret(row.kind)
          ? 'Ved en smagning er det værten der sætter rækkefølgen'
          : 'Der kan kun tilføjes mens arrangementet er i gang',
      );
    }

    if (input.beverageId) {
      const beverage = await this.prisma.beverage.findUnique({ where: { id: input.beverageId } });
      if (!beverage) throw AppError.notFound('Drikkevare', input.beverageId);
    }

    const last = await this.prisma.gatheringItem.findFirst({
      where: { gatheringId: row.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    await this.prisma.gatheringItem.create({
      data: {
        gatheringId: row.id,
        beverageId: input.beverageId ?? null,
        label: input.label ?? null,
        blind: input.blind ?? false,
        note: input.note ?? null,
        sortOrder: last ? last.sortOrder + 1 : 0,
        addedById: viewer.sub,
      },
    });

    return this.detail(row.id, viewer);
  }

  async updateItem(
    idOrSlug: string,
    itemId: string,
    input: UpdateGatheringItemInput,
    viewer: AccessTokenClaims,
  ): Promise<GatheringDetail> {
    this.assertAdmin(viewer);
    const { row } = await this.load(idOrSlug, viewer);
    const item = row.items.find((i) => i.id === itemId);
    if (!item) throw AppError.notFound('Post', itemId);

    const nextBeverageId = input.beverageId !== undefined ? input.beverageId : item.beverageId;
    const nextLabel = input.label !== undefined ? input.label : item.label;
    if (!nextBeverageId && !nextLabel) {
      throw AppError.validation('Posten skal have enten en drikkevare eller et navn', {
        label: ['Angiv enten en drikkevare fra kataloget eller et navn'],
      });
    }

    if (input.beverageId) {
      const beverage = await this.prisma.beverage.findUnique({ where: { id: input.beverageId } });
      if (!beverage) throw AppError.notFound('Drikkevare', input.beverageId);
    }

    await this.prisma.gatheringItem.update({
      where: { id: itemId },
      data: {
        ...(input.beverageId !== undefined ? { beverageId: input.beverageId ?? null } : {}),
        ...(input.label !== undefined ? { label: input.label ?? null } : {}),
        ...(input.blind !== undefined ? { blind: input.blind } : {}),
        ...(input.note !== undefined ? { note: input.note ?? null } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });

    return this.detail(row.id, viewer);
  }

  async removeItem(
    idOrSlug: string,
    itemId: string,
    viewer: AccessTokenClaims,
  ): Promise<GatheringDetail> {
    this.assertAdmin(viewer);
    const { row } = await this.load(idOrSlug, viewer);
    if (!row.items.some((i) => i.id === itemId)) throw AppError.notFound('Post', itemId);
    await this.prisma.gatheringItem.delete({ where: { id: itemId } });
    return this.detail(row.id, viewer);
  }

  /**
   * Værten skænker. Sætter tidspunktet — det er også det der giver opslaget
   * sin tidslinje — og bringer arrangementet i gang hvis det ikke var det.
   */
  async serveItem(
    idOrSlug: string,
    itemId: string,
    viewer: AccessTokenClaims,
  ): Promise<GatheringDetail> {
    this.assertAdmin(viewer);
    const { row } = await this.load(idOrSlug, viewer);
    if (!row.items.some((i) => i.id === itemId)) throw AppError.notFound('Post', itemId);

    await this.prisma.$transaction([
      this.prisma.gatheringItem.update({ where: { id: itemId }, data: { servedAt: new Date() } }),
      ...(row.status === 'PLANNED'
        ? [this.prisma.gathering.update({ where: { id: row.id }, data: { status: 'LIVE' } })]
        : []),
    ]);

    return this.detail(row.id, viewer);
  }

  // ---- Noter --------------------------------------------------------------

  async upsertNote(
    idOrSlug: string,
    itemId: string,
    input: UpsertGatheringNoteInput,
    viewer: AccessTokenClaims,
  ): Promise<GatheringDetail> {
    const { row, rights, attendee } = await this.load(idOrSlug, viewer);

    if (!attendee) throw AppError.forbidden('Kun deltagere kan skrive noter');
    if (row.publishedAt !== null) {
      throw AppError.conflict('Opslaget er udgivet, og noterne kan ikke længere ændres');
    }
    if (!rights.canWriteNotes) {
      throw AppError.conflict('Arrangementet er ikke begyndt endnu');
    }
    if (!row.items.some((i) => i.id === itemId)) throw AppError.notFound('Post', itemId);

    await this.prisma.$transaction([
      this.prisma.gatheringNote.upsert({
        where: { itemId_attendeeId: { itemId, attendeeId: attendee.id } },
        create: {
          itemId,
          attendeeId: attendee.id,
          rating: input.rating,
          body: input.body ?? null,
        },
        update: { rating: input.rating, body: input.body ?? null },
      }),
      // Første gang deltageren skriver noget, var vedkommende med.
      ...(attendee.joinedAt === null
        ? [
            this.prisma.gatheringAttendee.update({
              where: { id: attendee.id },
              data: { joinedAt: new Date() },
            }),
          ]
        : []),
    ]);

    return this.detail(row.id, viewer);
  }

  async removeNote(
    idOrSlug: string,
    itemId: string,
    viewer: AccessTokenClaims,
  ): Promise<GatheringDetail> {
    const { row, attendee } = await this.load(idOrSlug, viewer);
    if (!attendee) throw AppError.forbidden('Kun deltagere kan slette deres noter');
    if (row.publishedAt !== null) {
      throw AppError.conflict('Opslaget er udgivet, og noterne kan ikke længere ændres');
    }

    const note = await this.prisma.gatheringNote.findUnique({
      where: { itemId_attendeeId: { itemId, attendeeId: attendee.id } },
    });
    if (!note) throw AppError.notFound('Note', itemId);

    await this.prisma.gatheringNote.delete({ where: { id: note.id } });
    return this.detail(row.id, viewer);
  }
}
