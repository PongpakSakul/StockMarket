# Stock Portfolio Tracker

เว็บแอปพลิเคชันสำหรับติดตามราคาหุ้นและ ETF ของสหรัฐอเมริกา ออกแบบมาสำหรับนักลงทุนไทยที่ลงทุนผ่านแอป Dime

ปัญหาที่แก้: เวลาอยากรู้ว่า "ตอนนั้นซื้อหุ้นตัวนี้ที่ราคาเท่าไหร่" ต้องเลื่อนย้อนดูประวัติใน Dime ทีละรายการ แอปนี้ช่วยบันทึกจุดซื้อ (Buy Point) ไว้บนกราฟราคาโดยตรง อ่านสลิปซื้อจาก Dime ด้วย OCR อัตโนมัติ และสรุปภาพรวมพอร์ตให้เห็นทั้งกำไร/ขาดทุนเป็น USD และ THB

---

## สารบัญ

- [ฟีเจอร์หลัก](#ฟีเจอร์หลัก)
- [Tech Stack](#tech-stack)
- [สถาปัตยกรรม](#สถาปัตยกรรม)
- [โครงสร้างโปรเจค](#โครงสร้างโปรเจค)
- [การติดตั้งและรัน](#การติดตั้งและรัน)
- [คำสั่งที่ใช้บ่อย](#คำสั่งที่ใช้บ่อย)
- [API Endpoints](#api-endpoints)
- [ฐานข้อมูล](#ฐานข้อมูล)
- [การทดสอบ](#การทดสอบ)
- [แนวทางการพัฒนา (Conventions)](#แนวทางการพัฒนา-conventions)
- [เอกสารเพิ่มเติม](#เอกสารเพิ่มเติม)

---

## ฟีเจอร์หลัก

| # | ฟีเจอร์ | รายละเอียดย่อ |
|---|---------|----------------|
| 1 | กราฟราคาหุ้น/ETF | กราฟ interactive รองรับช่วงเวลา 1W–ALL, zoom/pan, ข้อมูล OHLC |
| 2 | Buy Point Markers | แสดงจุดซื้อจริงบนกราฟ + เส้นต้นทุนเฉลี่ย, hover ดูรายละเอียด, รวมจุดในวันเดียวกัน |
| 3 | อ่านสลิป Dime (OCR) | อัปโหลดภาพสลิป (JPG/PNG ≤10MB) แล้วแยกข้อมูลธุรกรรมอัตโนมัติ |
| 4 | Slip Parser | แปลงข้อความ OCR เป็นข้อมูลธุรกรรมมีโครงสร้าง (ticker, วันที่, ราคา, จำนวนหุ้น) |
| 5 | แดชบอร์ดพอร์ต | มูลค่ารวม, ต้นทุนเฉลี่ย, กำไร/ขาดทุน, asset allocation, เทียบกับ S&P 500 |
| 6 | จัดการธุรกรรมเอง | เพิ่ม/แก้ไข/ลบ พร้อม validation, กรอง, เรียงลำดับ |
| 7 | จัดการ error & performance | แคชราคา, ข้อความ error ที่เข้าใจง่าย, retry |
| 8 | ส่งออกข้อมูล | export ธุรกรรมเป็น CSV / Excel ตามช่วงวันที่หรือ ticker |
| 9 | อัปโหลดสลิปหลายใบ | สูงสุด 20 ไฟล์/ครั้ง, ประมวลผลขนาน, progress bar, ทนความล้มเหลวบางส่วน |
| 10 | แสดงสองสกุลเงิน | มูลค่าและกำไร/ขาดทุนทั้ง USD และ THB ตามอัตราแลกเปลี่ยนล่าสุด |
| 11 | ติดตามเงินปันผล | บันทึกปันผล, total return, dividend yield |
| 12 | Watchlist | หุ้นที่สนใจแต่ยังไม่ซื้อ พร้อมราคาปัจจุบันและ sparkline |
| 13 | นำเข้าข้อมูลจาก Dime | import พอร์ตจากไฟล์ CSV/JSON พร้อมตรวจจับรายการซ้ำ |

> ข้อกำหนดแบบละเอียด (acceptance criteria) อยู่ใน `.kiro/specs/stock-portfolio-tracker/requirements.md`

---

## Tech Stack

**Frontend**
- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS (styling)
- Redux Toolkit + React-Redux (state management)
- TradingView Lightweight Charts (กราฟราคา + markers), Recharts (pie chart)

**Backend**
- Node.js + Express 4 + TypeScript
- `pg` เชื่อมต่อ PostgreSQL โดยตรง (ไม่มี ORM)
- `yahoo-finance2` (ดึงราคาหุ้น), `multer` (อัปโหลดไฟล์), `helmet` + `morgan` + `cors`

**Data & Infra**
- PostgreSQL (ฐานข้อมูลหลัก)
- Redis (cache)
- Docker + Docker Compose

**External APIs**
- Google Cloud Vision (OCR อ่านสลิป)
- Financial API (ราคาหุ้น)
- Exchange Rate API (USD/THB)

**Testing**
- Backend: Jest + Supertest
- Frontend: Vitest + React Testing Library
- ทั้งสองฝั่ง: fast-check (property-based testing)

---

## สถาปัตยกรรม

ระบบเป็น Layered Architecture แยก frontend / backend ชัดเจน สื่อสารผ่าน REST API

```
┌─────────────────────────┐        ┌──────────────────────────────────┐
│   Frontend (Next.js)     │        │      Backend (Express)            │
│                          │ HTTP   │                                   │
│  React Components        │ /REST  │  Routes  →  Services  →  Repos     │
│  Redux Toolkit Store     │ ─────► │  (HTTP)     (logic)     (pg)       │
│  Lightweight Charts      │        │                ↓                  │
└─────────────────────────┘        │         External Clients          │
                                    │   (Yahoo Finance, OCR, FX Rate)   │
                                    └──────────────────────────────────┘
                                            ↓              ↓
                                      PostgreSQL        Redis cache
```

หลักการที่ยึด: **Routes จัดการแค่เรื่อง HTTP, Service ถือ business logic ทั้งหมด, Repository ดูแลการเข้าถึงข้อมูล** การไหลของข้อมูลเป็นทางเดียว `routes → service → repository/client`

ตัวอย่างการประกอบร่าง (wiring) อยู่ใน `backend/src/app.ts` ซึ่งสร้าง service จาก repository แล้ว inject เข้า router ก่อน mount ที่ `/api/*`

---

## โครงสร้างโปรเจค

โปรเจคใช้แนวทาง **structure-by-feature** คือจัดกลุ่มโค้ดตามฟีเจอร์ทางธุรกิจ ไม่ใช่ตามชนิดของไฟล์ ทำให้โค้ดที่เกี่ยวข้องกันอยู่ใกล้กัน หาง่าย แก้ง่าย

```
StockMarket/
├── backend/                  # Express + TypeScript REST API
│   ├── src/
│   │   ├── app.ts            # ประกอบ express + mount routes ที่ /api/*
│   │   ├── index.ts          # entry point เปิด server
│   │   ├── features/         # หนึ่งโฟลเดอร์ = หนึ่งฟีเจอร์
│   │   │   ├── charts/       # chart.service, stock.routes, yahoo-finance.client
│   │   │   ├── dividends/
│   │   │   ├── exchange-rate/
│   │   │   ├── export/
│   │   │   ├── import/
│   │   │   ├── portfolio/
│   │   │   ├── slips/        # OCR + แยกวิเคราะห์สลิป
│   │   │   ├── tickers/
│   │   │   ├── transaction/
│   │   │   └── watch-list/
│   │   ├── db/               # connection pool + repositories (Postgres)
│   │   ├── cache/            # in-memory cache
│   │   ├── routes/           # integration tests รวมหลายฟีเจอร์
│   │   ├── services/         # unit + property tests รวมหลายฟีเจอร์
│   │   └── types/            # TypeScript types ที่ใช้ร่วมกัน
│   └── db/init/01-schema.sql # สคีมาเริ่มต้น (รันตอน postgres ขึ้นครั้งแรก)
│
├── frontend/                 # Next.js 14 (App Router)
│   └── src/
│       ├── app/              # เพจ (route ละโฟลเดอร์): chart, dividends, transactions, watchlist
│       ├── components/       # component แยกตามฟีเจอร์
│       │   ├── chart/  dividends/  export/  import/
│       │   ├── portfolio/  transactions/  watchlist/
│       │   ├── layout/       # Sidebar ฯลฯ
│       │   └── ui/           # primitive ใช้ซ้ำ (ErrorBanner, Skeleton, Toast)
│       ├── store/            # Redux store, api, middleware
│       │   └── slices/       # state แยกตามฟีเจอร์
│       └── test/             # test setup
│
├── .kiro/specs/stock-portfolio-tracker/   # requirements / design / tasks
├── .agents/                  # rules + skills สำหรับ AI agent
├── docker-compose.yml
└── .env.example
```

### จะเพิ่มฟีเจอร์ใหม่ตรงไหน

**ฝั่ง Backend**
1. สร้างโฟลเดอร์ `backend/src/features/<ชื่อฟีเจอร์>/`
2. เพิ่มไฟล์ตามบทบาท:
   - `<feature>.routes.ts` — รับ request, validate, ตอบกลับ (ห้ามใส่ business logic)
   - `<feature>.service.ts` — business logic (ห้ามแตะ object req/res ของ express)
   - `<feature>.repository.ts` หรือ `postgres-<feature>.repository.ts` — query ฐานข้อมูล
   - `<feature>.client.ts` — ถ้าต้องเรียก external API
3. ไป mount router ใน `backend/src/app.ts`

**ฝั่ง Frontend**
1. เพิ่ม component ที่ `frontend/src/components/<ฟีเจอร์>/` (ของใช้ซ้ำทั่วไปไปไว้ `components/ui/`)
2. ถ้าต้องมีหน้าเพจ เพิ่มที่ `frontend/src/app/<ฟีเจอร์>/`
3. ถ้าต้องเก็บ state เพิ่ม slice ที่ `frontend/src/store/slices/`

---

## การติดตั้งและรัน

### วิธีที่ 1: Docker (แนะนำ)

รันทั้งระบบ (frontend, backend, postgres, redis) ด้วยคำสั่งเดียว

```bash
# 1. คัดลอกไฟล์ env แล้วเติมค่า API key
cp .env.example .env

# 2. build และรันทุก service
docker-compose up -d --build

# 3. ดู log
docker-compose logs -f

# หยุดการทำงาน
docker-compose down
```

เปิดใช้งานที่:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- Health check: http://localhost:3001/api/health

### วิธีที่ 2: รันแยกแต่ละส่วน (local dev)

ต้องมี Node.js, PostgreSQL และ Redis ทำงานอยู่ก่อน

```bash
# Backend
cd backend
npm install
npm run dev          # ขึ้นที่ http://localhost:3001

# Frontend (อีก terminal)
cd frontend
npm install
npm run dev          # ขึ้นที่ http://localhost:3000
```

> dev server เป็นโปรเซสที่รันค้างไว้ (long-running) ให้รันในเทอร์มินัลของตัวเอง

### ตัวแปร Environment

กำหนดใน `.env` (ดูตัวอย่างทั้งหมดใน `.env.example`):

| กลุ่ม | ตัวแปรสำคัญ |
|-------|--------------|
| PostgreSQL | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL` |
| Redis | `REDIS_URL` |
| Backend/Frontend | `BACKEND_PORT`, `FRONTEND_PORT`, `NEXT_PUBLIC_API_URL` |
| OCR | `GOOGLE_CLOUD_VISION_API_KEY` |
| ราคาหุ้น | `FINANCIAL_API_KEY`, `FINANCIAL_API_BASE_URL` |
| อัตราแลกเปลี่ยน | `EXCHANGE_RATE_API_KEY`, `EXCHANGE_RATE_API_BASE_URL` |

> อย่า commit ไฟล์ `.env` หรือค่า API key จริงเข้า git

---

## คำสั่งที่ใช้บ่อย

| งาน | Backend (`backend/`) | Frontend (`frontend/`) |
|-----|----------------------|------------------------|
| dev server | `npm run dev` | `npm run dev` |
| build | `npm run build` | `npm run build` |
| รันเทสต์ | `npm test` | `npm test` |
| เทสต์แบบ watch | `npm run test:watch` | `npm run test:watch` |
| coverage | `npm run test:coverage` | `npm run test:coverage` |
| lint | `npm run lint` | `npm run lint` |

---

## API Endpoints

Base path: `/api`

```
# ราคาหุ้น / กราฟ
GET    /api/stocks/:ticker/prices?range={1W|1M|3M|6M|1Y|ALL}
GET    /api/stocks/:ticker/info
GET    /api/stocks/search?q={query}

# ธุรกรรม
GET    /api/transactions?ticker=&from=&to=&sort=&order=
POST   /api/transactions
PUT    /api/transactions/:id
DELETE /api/transactions/:id

# สลิป / OCR
POST   /api/slips/upload          # สลิปเดียว
POST   /api/slips/upload-batch    # หลายใบ (สูงสุด 20)

# พอร์ต
GET    /api/portfolio/summary
GET    /api/portfolio/allocation
GET    /api/portfolio/performance?range=&benchmark=

# เงินปันผล
GET    /api/dividends?ticker=&from=&to=
POST   /api/dividends
PUT    /api/dividends/:id
DELETE /api/dividends/:id
GET    /api/dividends/summary?range=

# watchlist
GET    /api/watchlist
POST   /api/watchlist
DELETE /api/watchlist/:ticker

# export / import
GET    /api/export/transactions?format={csv|xlsx}&ticker=&from=&to=
POST   /api/import/dime           # อัปโหลด CSV/JSON

# อื่นๆ
GET    /api/exchange-rate/usd-thb
GET    /api/tickers/validate/:ticker
GET    /api/health
```

### รูปแบบ Error Response

```json
{
  "code": "INVALID_TICKER",
  "message": "ข้อความสำหรับแสดงผู้ใช้",
  "retryable": false,
  "details": {}
}
```

ตาราง error code ทั้งหมด (เช่น `OCR_FAILED`, `API_UNAVAILABLE`, `FILE_TOO_LARGE`) ดูใน `design.md`

---

## ฐานข้อมูล

สคีมาเริ่มต้นอยู่ที่ `backend/db/init/01-schema.sql` ถูกรันอัตโนมัติตอน PostgreSQL container ขึ้นครั้งแรก

ตารางที่มีในปัจจุบัน:
- `transactions` — ข้อมูลธุรกรรมซื้อ (ราคา, จำนวนหุ้น, source: manual/ocr/dime_import)
- `watchlists` — หุ้นที่ผู้ใช้ติดตาม
- `exchange_rates` — แคชอัตราแลกเปลี่ยน

> ถ้าต้องเพิ่ม/แก้ตาราง ให้แก้ที่ไฟล์ schema นี้ design.md มีการออกแบบ data model ที่กว้างกว่า (เช่น dividends, tickers) ไว้เป็นแนวทาง แต่ของจริงให้ยึดไฟล์ schema

---

## การทดสอบ

ใช้สองแนวทางควบคู่กัน:

- **Unit / Example-based tests** — เทสต์เคสเฉพาะ, edge case, error condition
- **Property-based tests (fast-check)** — เทสต์คุณสมบัติที่ต้องจริงเสมอสำหรับทุก input เช่น "export แล้ว import กลับต้องได้ข้อมูลเดิม" (round-trip)

กติกาสำหรับ property test:
- รันอย่างน้อย 100 iterations ต่อ property
- ใส่ comment อ้างอิง property เช่น `Feature: stock-portfolio-tracker, Property 3: ...`
- รายการ properties ทั้ง 19 ข้ออยู่ใน `design.md` หัวข้อ Correctness Properties

ไฟล์เทสต์วางคู่กับโค้ด เช่น `TransactionForm.tsx` + `TransactionForm.test.tsx`

---

## แนวทางการพัฒนา (Conventions)

- **Backend**: ยึด clean architecture แยก routes / service / repository ตามที่อธิบายข้างบน
- **Frontend**: React + Tailwind, จัด component ตามฟีเจอร์
- **รูปแบบข้อมูล**: วันที่เป็น ISO 8601 (`YYYY-MM-DD`), ราคา 2 ตำแหน่งทศนิยม, จำนวนหุ้น 6 ตำแหน่งทศนิยม
- **Formatting**: ESLint + Prettier มาตรฐาน รัน `npm run lint` ก่อน commit
- **Git commit**: ใช้ conventional commits — `feat:`, `fix:`, `chore:`, `docs:`
- กฎฉบับเต็มอยู่ใน `.agents/rules/rule.md`

---

## เอกสารเพิ่มเติม

| เอกสาร | เนื้อหา |
|--------|---------|
| `.kiro/specs/stock-portfolio-tracker/requirements.md` | ข้อกำหนด + acceptance criteria ทั้ง 13 ข้อ |
| `.kiro/specs/stock-portfolio-tracker/design.md` | สถาปัตยกรรม, interfaces, data models, 19 correctness properties, error handling |
| `.kiro/specs/stock-portfolio-tracker/tasks.md` | รายการงาน (implementation plan) |
| `.agents/rules/project-context.md` | สรุปบริบทสำหรับ AI agent |
| `.agents/rules/rule.md` | กฎการเขียนโค้ด |
| `.agents/skills/` | skills: `docker-deploy`, `project-structure` |
