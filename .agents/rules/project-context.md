# Project Context (AI Reference)

บริบทโปรเจคสำหรับ AI ใช้อ้างอิงเวลาทำงาน อ่านไฟล์นี้ก่อนเริ่มแก้โค้ดเสมอ
เอกสารฉบับเต็มอยู่ที่ `.kiro/specs/stock-portfolio-tracker/` (requirements.md, design.md, tasks.md)

## What this project is

Stock Portfolio Tracker — เว็บแอปติดตามหุ้น/ETF สหรัฐฯ สำหรับนักลงทุนไทย
จุดเด่นคือบันทึกจุดซื้อ (Buy Point) บนกราฟราคา, อ่านสลิป Dime ผ่าน OCR,
และแสดงมูลค่าพอร์ตทั้ง USD และ THB

## Tech Stack (ยึดตามนี้ ห้ามเปลี่ยนไป lib อื่นโดยไม่ถาม)

- Backend: Node.js + Express 4 + TypeScript, `pg` (PostgreSQL ตรงๆ ไม่มี ORM), `yahoo-finance2`, `multer`, `helmet`, `morgan`
- Frontend: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS + Redux Toolkit
- Charts: TradingView Lightweight Charts (กราฟราคา/markers), Recharts (pie chart เท่านั้น)
- DB: PostgreSQL, Cache: Redis (และมี in-memory cache ใน backend)
- Test: Jest + Supertest (backend), Vitest + React Testing Library (frontend), fast-check (property-based ทั้งคู่)
- Container: Docker + Docker Compose

## Structure-by-feature (กฎสำคัญ)

โค้ดจัดกลุ่ม **ตามฟีเจอร์ ไม่ใช่ตาม layer** ทั้ง backend และ frontend

### Backend `backend/src/`
- `app.ts` — wiring express, middleware, ประกอบ service เข้า router แล้ว mount ที่ `/api/*`
- `index.ts` — entry point
- `features/<feature>/` — หนึ่งโฟลเดอร์ต่อหนึ่งฟีเจอร์ (charts, dividends, exchange-rate, export, import, portfolio, slips, tickers, transaction, watch-list)
- `db/` — pool, constants, repositories (Postgres)
- `cache/` — in-memory cache
- `types/` — shared types

ไฟล์ในแต่ละ feature:
- `*.routes.ts` — HTTP layer เท่านั้น (parse, validate, ตอบกลับ) ห้ามมี business logic
- `*.service.ts` — business logic ทั้งหมด ห้ามแตะ req/res ของ express
- `*.repository.ts` / `postgres-*.repository.ts` — data access ผ่าน `pg`
- `*.client.ts` — external API client (เช่น Yahoo Finance)

Flow ที่ต้องรักษาไว้: `routes → service → repository/client`

การเพิ่ม backend feature ใหม่: สร้าง `features/<feature>/` ใส่ routes + service (+ repository/client ถ้าจำเป็น) แล้ว **ไป mount router ใน `app.ts`** ด้วย

### Frontend `frontend/src/`
- `app/<feature>/` — หน้าเพจ (App Router): chart, dividends, transactions, watchlist
- `components/<feature>/` — component เฉพาะฟีเจอร์
- `components/ui/` — primitive ใช้ซ้ำได้ (ErrorBanner, Skeleton, Toast ฯลฯ)
- `components/layout/` — layout ร่วม (Sidebar)
- `store/` — Redux Toolkit (`store.ts`, `api.ts`, middleware) และ `store/slices/` สำหรับ state แต่ละฟีเจอร์
- `test/setup.ts` — test setup

การเพิ่ม frontend feature ใหม่: เพิ่ม `components/<feature>/`, เพิ่มเพจใน `app/<feature>/` ถ้าต้องมีหน้า, เพิ่ม slice ใน `store/slices/` ถ้าต้องมี state

## Conventions

- ทุก component/service มีไฟล์เทสต์วางคู่กัน: `Foo.tsx` + `Foo.test.tsx` / `foo.service.ts` + เทสต์ใน `backend/src/services/`
- เขียนเทสต์ใหม่เมื่อเพิ่มฟีเจอร์/แก้บั๊ก แต่ **ห้ามเพิ่มเทสต์เองถ้าผู้ใช้ไม่ได้ขอ** นอกจากเป็นส่วนของงานที่ระบุ
- Property-based test: รันอย่างน้อย 100 iterations และใส่ comment อ้าง property เช่น
  `Feature: stock-portfolio-tracker, Property {n}: {property_text}` (ดู design.md หัวข้อ Correctness Properties มี 19 properties)
- Error response ของ backend ใช้รูปแบบ: `{ code, message, retryable, details? }` (ดูตาราง error codes ใน design.md)
- วันที่ใช้ ISO 8601 (`YYYY-MM-DD`); ราคา 2 ตำแหน่งทศนิยม, จำนวนหุ้น 6 ตำแหน่งทศนิยม (ระดับ logic)
- ESLint + Prettier มาตรฐาน; commit แบบ conventional (`feat:`, `fix:`, `chore:`, `docs:`) — ดู `.agents/rules/rule.md`

## Run / Build / Test

- ทั้งระบบ: `docker-compose up -d --build` (frontend :3000, backend :3001, postgres, redis)
- Backend (ใน `backend/`): `npm run dev` | `npm run build` | `npm test` | `npm run lint`
- Frontend (ใน `frontend/`): `npm run dev` | `npm run build` | `npm test` | `npm run lint`
- dev server เป็น process ที่รันค้าง อย่ารันแบบ block ใน automation ให้ผู้ใช้รันเองหรือใช้ background process

## External services (ต้องมี key ใน `.env`)

Google Cloud Vision (OCR), Financial API (ราคาหุ้น), Exchange Rate API (USD/THB)
ดู `.env.example` สำหรับตัวแปรทั้งหมด ห้าม commit ค่าจริงของ key

## DB schema ปัจจุบัน (`backend/db/init/01-schema.sql`)

ตารางที่มีจริงตอนนี้: `transactions`, `watchlists`, `exchange_rates`
(design.md ออกแบบไว้กว้างกว่านี้ เช่น dividends/tickers — ให้ยึดไฟล์ schema จริงเป็นหลัก ถ้าต้องเพิ่มตารางให้แก้ที่ไฟล์ schema นี้)
