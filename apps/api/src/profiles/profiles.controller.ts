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
import { SearchProfileInput, SearchProfilePatch } from '@trawler/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.searchProfile.findMany({ orderBy: { id: 'asc' } });
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    const p = await this.prisma.searchProfile.findUnique({ where: { id } });
    if (!p) throw new NotFoundException(`profile ${id} not found`);
    return p;
  }

  @Post()
  async create(@Body(new ZodValidationPipe(SearchProfileInput)) body: SearchProfileInput) {
    const dup = await this.prisma.searchProfile.findUnique({ where: { name: body.name } });
    if (dup) throw new ConflictException(`profile "${body.name}" already exists`);
    return this.prisma.searchProfile.create({ data: body });
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(SearchProfilePatch)) body: SearchProfilePatch,
  ) {
    await this.get(id);
    if (body.name) {
      const dup = await this.prisma.searchProfile.findUnique({ where: { name: body.name } });
      if (dup && dup.id !== id) throw new ConflictException(`profile "${body.name}" already exists`);
    }
    return this.prisma.searchProfile.update({ where: { id }, data: body });
  }

  /** Deleting cascades to CrawlRun rows; postings are kept (they are not owned by a profile). */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.get(id);
    await this.prisma.searchProfile.delete({ where: { id } });
    return { deleted: id };
  }
}
