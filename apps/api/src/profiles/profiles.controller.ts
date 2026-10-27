import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { type DeleteResult, type SearchProfile, SearchProfileInput, SearchProfilePatch } from '@trawler/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { SearchProfile as SearchProfileRow } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function serialize(p: SearchProfileRow): SearchProfile {
  return { ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() };
}

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<SearchProfile[]> {
    const rows = await this.prisma.searchProfile.findMany({ orderBy: { id: 'asc' } });
    return rows.map(serialize);
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number): Promise<SearchProfile> {
    return serialize(await this.find(id));
  }

  @Post()
  async create(@Body(new ZodValidationPipe(SearchProfileInput)) body: SearchProfileInput): Promise<SearchProfile> {
    const dup = await this.prisma.searchProfile.findUnique({ where: { name: body.name } });
    if (dup) throw new ConflictException(`profile "${body.name}" already exists`);
    return serialize(await this.prisma.searchProfile.create({ data: body }));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(SearchProfilePatch)) body: SearchProfilePatch,
  ): Promise<SearchProfile> {
    await this.find(id);
    if (body.name) {
      const dup = await this.prisma.searchProfile.findUnique({ where: { name: body.name } });
      if (dup && dup.id !== id) throw new ConflictException(`profile "${body.name}" already exists`);
    }
    return serialize(await this.prisma.searchProfile.update({ where: { id }, data: body }));
  }

  /** Deleting cascades to CrawlRun rows; postings are kept (they are not owned by a profile). */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<DeleteResult> {
    await this.find(id);
    await this.prisma.searchProfile.delete({ where: { id } });
    return { deleted: id };
  }

  private async find(id: number): Promise<SearchProfileRow> {
    const p = await this.prisma.searchProfile.findUnique({ where: { id } });
    if (!p) throw new NotFoundException(`profile ${id} not found`);
    return p;
  }
}
