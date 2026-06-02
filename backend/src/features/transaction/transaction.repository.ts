import { Transaction, TransactionSource, TransactionFilters } from '../../types';

// ────────────────────────────────────────────────────────────
// DTOs
// ────────────────────────────────────────────────────────────

export interface CreateTransactionDTO {
  userId: string;
  tickerSymbol: string;
  transactionDate: string;
  pricePerShare: number;
  shares: number;
  totalAmount: number;
  source?: TransactionSource;
  slipImageUrl?: string;
  ocrRawText?: string;
}

export interface UpdateTransactionDTO {
  tickerSymbol?: string;
  transactionDate?: string;
  pricePerShare?: number;
  shares?: number;
  totalAmount?: number;
  source?: TransactionSource;
}

// ────────────────────────────────────────────────────────────
// Paginated result wrapper
// ────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ────────────────────────────────────────────────────────────
// Repository interface
// ────────────────────────────────────────────────────────────

export interface ITransactionRepository {
  create(dto: CreateTransactionDTO): Promise<Transaction>;
  update(id: string, dto: UpdateTransactionDTO): Promise<Transaction | null>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<Transaction | null>;
  findAll(filters: TransactionFilters): Promise<PaginatedResult<Transaction>>;
  findByUserAndTicker(userId: string, ticker: string): Promise<Transaction[]>;
}

// ────────────────────────────────────────────────────────────
// In-memory implementation (for testing)
// ────────────────────────────────────────────────────────────

let nextId = 1;

function generateId(): string {
  return `txn-${nextId++}`;
}

export class InMemoryTransactionRepository implements ITransactionRepository {
  private store: Map<string, Transaction> = new Map();

  /** Reset the store — useful between tests */
  clear(): void {
    this.store.clear();
  }

  async create(dto: CreateTransactionDTO): Promise<Transaction> {
    const now = new Date().toISOString();
    const txn: Transaction = {
      id: generateId(),
      userId: dto.userId,
      tickerSymbol: dto.tickerSymbol,
      transactionDate: dto.transactionDate,
      pricePerShare: dto.pricePerShare,
      shares: dto.shares,
      totalAmount: dto.totalAmount,
      source: dto.source ?? 'manual',
      slipImageUrl: dto.slipImageUrl,
      ocrRawText: dto.ocrRawText,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(txn.id, txn);
    return { ...txn };
  }

  async update(id: string, dto: UpdateTransactionDTO): Promise<Transaction | null> {
    const existing = this.store.get(id);
    if (!existing) return null;

    const updated: Transaction = {
      ...existing,
      ...(dto.tickerSymbol !== undefined && { tickerSymbol: dto.tickerSymbol }),
      ...(dto.transactionDate !== undefined && { transactionDate: dto.transactionDate }),
      ...(dto.pricePerShare !== undefined && { pricePerShare: dto.pricePerShare }),
      ...(dto.shares !== undefined && { shares: dto.shares }),
      ...(dto.totalAmount !== undefined && { totalAmount: dto.totalAmount }),
      ...(dto.source !== undefined && { source: dto.source }),
      updatedAt: new Date().toISOString(),
    };
    this.store.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  async findById(id: string): Promise<Transaction | null> {
    const txn = this.store.get(id);
    return txn ? { ...txn } : null;
  }

  async findAll(filters: TransactionFilters): Promise<PaginatedResult<Transaction>> {
    let results = Array.from(this.store.values());

    // ── Filtering ──
    if (filters.tickerSymbol) {
      const ticker = filters.tickerSymbol;
      results = results.filter((t) => t.tickerSymbol === ticker);
    }
    if (filters.fromDate) {
      const from = filters.fromDate;
      results = results.filter((t) => t.transactionDate >= from);
    }
    if (filters.toDate) {
      const to = filters.toDate;
      results = results.filter((t) => t.transactionDate <= to);
    }

    // ── Sorting ──
    const sortBy = filters.sortBy ?? 'date';
    const sortOrder = filters.sortOrder ?? 'desc';
    const direction = sortOrder === 'asc' ? 1 : -1;

    results.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'date':
          cmp = a.transactionDate.localeCompare(b.transactionDate);
          break;
        case 'ticker':
          cmp = a.tickerSymbol.localeCompare(b.tickerSymbol);
          break;
        case 'amount':
          cmp = a.totalAmount - b.totalAmount;
          break;
      }
      return cmp * direction;
    });

    // ── Pagination ──
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const total = results.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const data = results.slice(start, start + pageSize);

    return { data, total, page, pageSize, totalPages };
  }

  async findByUserAndTicker(userId: string, ticker: string): Promise<Transaction[]> {
    return Array.from(this.store.values()).filter(
      (t) => t.userId === userId && t.tickerSymbol === ticker,
    );
  }
}
