import { Dividend, DividendFilters } from '../../types';

export interface CreateDividendDTO {
  userId: string;
  tickerSymbol: string;
  dividendDate: string;
  amountPerShare: number;
  totalAmount: number;
  sharesHeld: number;
}

export interface UpdateDividendDTO {
  tickerSymbol?: string;
  dividendDate?: string;
  amountPerShare?: number;
  totalAmount?: number;
  sharesHeld?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IDividendRepository {
  create(dto: CreateDividendDTO): Promise<Dividend>;
  update(id: string, dto: UpdateDividendDTO): Promise<Dividend | null>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<Dividend | null>;
  findAll(userId: string, filters: DividendFilters): Promise<PaginatedResult<Dividend>>;
  findByUser(userId: string): Promise<Dividend[]>;
  findByUserAndTicker(userId: string, ticker: string): Promise<Dividend[]>;
}

let nextId = 1;

function generateId(): string {
  return `div-${nextId++}`;
}

export class InMemoryDividendRepository implements IDividendRepository {
  private store: Map<string, Dividend> = new Map();

  clear(): void {
    this.store.clear();
  }

  async create(dto: CreateDividendDTO): Promise<Dividend> {
    const now = new Date().toISOString();
    const dividend: Dividend = {
      id: generateId(),
      userId: dto.userId,
      tickerSymbol: dto.tickerSymbol,
      dividendDate: dto.dividendDate,
      amountPerShare: dto.amountPerShare,
      totalAmount: dto.totalAmount,
      sharesHeld: dto.sharesHeld,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(dividend.id, dividend);
    return { ...dividend };
  }

  async update(id: string, dto: UpdateDividendDTO): Promise<Dividend | null> {
    const existing = this.store.get(id);
    if (!existing) return null;

    const updated: Dividend = {
      ...existing,
      ...(dto.tickerSymbol !== undefined && { tickerSymbol: dto.tickerSymbol }),
      ...(dto.dividendDate !== undefined && { dividendDate: dto.dividendDate }),
      ...(dto.amountPerShare !== undefined && { amountPerShare: dto.amountPerShare }),
      ...(dto.totalAmount !== undefined && { totalAmount: dto.totalAmount }),
      ...(dto.sharesHeld !== undefined && { sharesHeld: dto.sharesHeld }),
      updatedAt: new Date().toISOString(),
    };
    this.store.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  async findById(id: string): Promise<Dividend | null> {
    const dividend = this.store.get(id);
    return dividend ? { ...dividend } : null;
  }

  async findAll(userId: string, filters: DividendFilters): Promise<PaginatedResult<Dividend>> {
    let results = Array.from(this.store.values()).filter((d) => d.userId === userId);

    if (filters.tickerSymbol) {
      const ticker = filters.tickerSymbol;
      results = results.filter((d) => d.tickerSymbol === ticker);
    }
    if (filters.fromDate) {
      const from = filters.fromDate;
      results = results.filter((d) => d.dividendDate >= from);
    }
    if (filters.toDate) {
      const to = filters.toDate;
      results = results.filter((d) => d.dividendDate <= to);
    }

    results.sort((a, b) => b.dividendDate.localeCompare(a.dividendDate));

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const total = results.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const data = results.slice(start, start + pageSize);

    return { data, total, page, pageSize, totalPages };
  }

  async findByUser(userId: string): Promise<Dividend[]> {
    return Array.from(this.store.values()).filter((d) => d.userId === userId);
  }

  async findByUserAndTicker(userId: string, ticker: string): Promise<Dividend[]> {
    return Array.from(this.store.values()).filter(
      (d) => d.userId === userId && d.tickerSymbol === ticker,
    );
  }
}
