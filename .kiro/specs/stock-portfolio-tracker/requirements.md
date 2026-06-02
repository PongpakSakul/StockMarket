# เอกสารข้อกำหนด (Requirements Document)

## บทนำ

แอปพลิเคชันเว็บสำหรับติดตามราคาหุ้นและ ETF ของสหรัฐอเมริกา พร้อมระบบบันทึกจุดซื้อ (Buy Point) บนกราฟราคา ระบบนี้แก้ปัญหาที่ผู้ใช้ต้องเลื่อนย้อนดูประวัติธุรกรรมในแอป Dime เพื่อหาราคาที่ซื้อเมื่อหลายเดือนก่อน โดยรองรับการอ่านสลิปซื้อจาก Dime ผ่านระบบ OCR อัตโนมัติ และแสดงจุดซื้อบนกราฟราคาหุ้นแบบ Interactive

## อภิธานศัพท์ (Glossary)

- **Chart_System**: ระบบแสดงกราฟราคาหุ้นและ ETF แบบ Interactive พร้อม Buy Point Markers
- **OCR_Service**: บริการประมวลผลภาพสลิปธุรกรรมเพื่อแปลงเป็นข้อมูลที่มีโครงสร้าง
- **Slip_Parser**: ตัวแยกวิเคราะห์ข้อมูลจากข้อความ OCR เพื่อดึงข้อมูลธุรกรรม (Ticker, วันที่, ราคา, จำนวนหุ้น)
- **Portfolio_Dashboard**: หน้าแสดงภาพรวมพอร์ตการลงทุนทั้งหมด
- **Transaction_Manager**: ระบบจัดการธุรกรรมซื้อขายหุ้นทั้งแบบ Manual และจาก OCR
- **Buy_Point_Marker**: เครื่องหมายบนกราฟราคาที่แสดงจุดซื้อจริงของผู้ใช้
- **Financial_API**: บริการ API ภายนอกสำหรับดึงข้อมูลราคาหุ้น (เช่น Yahoo Finance, Alpha Vantage, Finnhub)
- **Dime_Slip**: ภาพสลิปธุรกรรมจากแอป Dime ที่แสดงรายละเอียดการซื้อหุ้น/ETF
- **Confirmation_Modal**: หน้าต่างยืนยันข้อมูลที่แยกวิเคราะห์จากสลิปก่อนบันทึกลงฐานข้อมูล
- **Benchmark_Index**: ดัชนีอ้างอิงสำหรับเปรียบเทียบผลตอบแทนพอร์ต (เช่น S&P 500)
- **Data_Exporter**: ระบบส่งออกข้อมูลธุรกรรมในรูปแบบ CSV/Excel
- **Exchange_Rate_Service**: บริการดึงอัตราแลกเปลี่ยน USD/THB
- **Dividend_Tracker**: ระบบบันทึกและติดตามเงินปันผล
- **Watchlist**: รายการหุ้นที่ผู้ใช้สนใจติดตาม
- **Dime_Portfolio_Import**: ระบบนำเข้าข้อมูลพอร์ตจากแอป Dime

## ข้อกำหนด (Requirements)

### ข้อกำหนดที่ 1: การแสดงกราฟราคาหุ้นและ ETF

**User Story:** ในฐานะนักลงทุน ฉันต้องการดูกราฟราคาหุ้นและ ETF ของสหรัฐฯ เพื่อติดตามความเคลื่อนไหวของราคาในช่วงเวลาต่างๆ

#### เกณฑ์การยอมรับ (Acceptance Criteria)

1. WHEN ผู้ใช้ค้นหาด้วย Ticker Symbol (เช่น VOO, QQQM), THE Chart_System SHALL แสดงกราฟราคาย้อนหลังของหุ้นหรือ ETF ที่ระบุ
2. WHEN กราฟราคาถูกโหลด, THE Chart_System SHALL แสดงข้อมูลราคา Open, High, Low, Close สำหรับแต่ละช่วงเวลา
3. THE Chart_System SHALL รองรับการเลือกช่วงเวลาแสดงผล ได้แก่ 1 สัปดาห์, 1 เดือน, 3 เดือน, 6 เดือน, 1 ปี, และทั้งหมด
4. WHEN ผู้ใช้เปิดหน้ากราฟ, THE Chart_System SHALL ดึงข้อมูลราคาจาก Financial_API และแสดงข้อมูลล่าสุดภายใน 5 วินาที
5. THE Chart_System SHALL รองรับการ Zoom เข้า-ออก และการเลื่อนดูข้อมูลย้อนหลังบนกราฟ
6. IF Financial_API ไม่สามารถตอบกลับได้, THEN THE Chart_System SHALL แสดงข้อความแจ้งเตือนผู้ใช้ว่าไม่สามารถโหลดข้อมูลได้ พร้อมปุ่มลองใหม่

### ข้อกำหนดที่ 2: การแสดง Buy Point Markers บนกราฟ

**User Story:** ในฐานะนักลงทุน ฉันต้องการเห็นจุดซื้อของฉันบนกราฟราคาหุ้น เพื่อเปรียบเทียบราคาที่ซื้อกับราคาตลาดปัจจุบันได้ทันที

#### เกณฑ์การยอมรับ (Acceptance Criteria)

1. WHEN ผู้ใช้ดูกราฟของหุ้นที่มีธุรกรรมซื้อ, THE Chart_System SHALL แสดง Buy_Point_Marker บนกราฟที่ตำแหน่งวันที่และราคาที่ซื้อจริง
2. WHEN ผู้ใช้ Hover เมาส์เหนือ Buy_Point_Marker, THE Chart_System SHALL แสดง Tooltip ที่ประกอบด้วย วันที่ซื้อ, จำนวนหุ้นที่ได้รับ, ราคาต่อหุ้น, และจำนวนเงินลงทุนทั้งหมด
3. WHEN ผู้ใช้คลิกที่ Buy_Point_Marker, THE Chart_System SHALL แสดงรายละเอียดธุรกรรมแบบเต็มในแผงข้อมูลด้านข้าง
4. THE Chart_System SHALL แสดงเส้นต้นทุนเฉลี่ย (Average Cost Basis) บนกราฟเพื่อเปรียบเทียบกับราคาตลาดปัจจุบัน
5. WHEN มีธุรกรรมซื้อหลายรายการในวันเดียวกัน, THE Chart_System SHALL รวม Buy_Point_Marker เป็นจุดเดียวพร้อมแสดงจำนวนธุรกรรมทั้งหมด

### ข้อกำหนดที่ 3: การอัปโหลดและอ่านสลิป Dime (OCR)

**User Story:** ในฐานะนักลงทุน ฉันต้องการอัปโหลดสลิปซื้อจากแอป Dime เพื่อบันทึกธุรกรรมโดยอัตโนมัติแทนการกรอกข้อมูลเอง

#### เกณฑ์การยอมรับ (Acceptance Criteria)

1. THE Transaction_Manager SHALL รองรับการอัปโหลดไฟล์ภาพสลิปในรูปแบบ JPG และ PNG
2. WHEN ผู้ใช้อัปโหลดภาพสลิป, THE Transaction_Manager SHALL ส่งภาพไปยัง OCR_Service เพื่อแปลงเป็นข้อความ
3. WHEN OCR_Service ส่งข้อความกลับมา, THE Slip_Parser SHALL แยกวิเคราะห์ข้อมูล Ticker Symbol, วันที่และเวลาทำธุรกรรม, ราคาต่อหุ้น, จำนวนหุ้นที่ได้รับ, และจำนวนเงินลงทุนทั้งหมด
4. WHEN Slip_Parser แยกวิเคราะห์ข้อมูลสำเร็จ, THE Transaction_Manager SHALL แสดง Confirmation_Modal ให้ผู้ใช้ตรวจสอบและแก้ไขข้อมูลก่อนบันทึก
5. WHEN ผู้ใช้ยืนยันข้อมูลใน Confirmation_Modal, THE Transaction_Manager SHALL บันทึกธุรกรรมลงฐานข้อมูลและรีเฟรชกราฟเพื่อแสดง Buy_Point_Marker ใหม่
6. IF OCR_Service ไม่สามารถอ่านข้อความจากภาพได้, THEN THE Transaction_Manager SHALL แสดงข้อความแจ้งเตือนผู้ใช้และเสนอให้กรอกข้อมูลด้วยตนเอง
7. IF Slip_Parser ไม่สามารถแยกวิเคราะห์ข้อมูลครบถ้วน, THEN THE Transaction_Manager SHALL แสดงข้อมูลที่แยกได้ใน Confirmation_Modal พร้อมเน้นฟิลด์ที่ต้องกรอกเพิ่มเติม
8. THE Transaction_Manager SHALL จำกัดขนาดไฟล์ภาพที่อัปโหลดไม่เกิน 10 MB ต่อไฟล์

### ข้อกำหนดที่ 4: การแยกวิเคราะห์ข้อมูลจากสลิป (Slip Parsing)

**User Story:** ในฐานะนักลงทุน ฉันต้องการให้ระบบแยกข้อมูลจากสลิป Dime ได้อย่างถูกต้อง เพื่อลดข้อผิดพลาดในการบันทึกธุรกรรม

#### เกณฑ์การยอมรับ (Acceptance Criteria)

1. WHEN ข้อความ OCR ถูกส่งมา, THE Slip_Parser SHALL แยกวิเคราะห์ Ticker Symbol จากข้อความโดยจับคู่กับรายชื่อหุ้นและ ETF ที่รองรับ
2. WHEN ข้อความ OCR มีรูปแบบวันที่, THE Slip_Parser SHALL แปลงวันที่เป็นรูปแบบมาตรฐาน ISO 8601 (YYYY-MM-DD)
3. WHEN ข้อความ OCR มีตัวเลขราคาและจำนวนหุ้น, THE Slip_Parser SHALL แยกค่าตัวเลขและแปลงเป็นรูปแบบทศนิยม 2 ตำแหน่งสำหรับราคา และทศนิยม 6 ตำแหน่งสำหรับจำนวนหุ้น
4. THE Slip_Parser SHALL จัดรูปแบบข้อมูลที่แยกได้เป็น Structured Transaction Object ที่ประกอบด้วย ticker, date, price_per_share, shares, total_amount
5. FOR ALL Structured Transaction Objects ที่ถูกต้อง, การแปลงเป็น JSON แล้วแปลงกลับเป็น Structured Transaction Object SHALL ได้ผลลัพธ์ที่เทียบเท่ากัน (Round-trip Property)

### ข้อกำหนดที่ 5: แดชบอร์ดภาพรวมพอร์ตการลงทุน

**User Story:** ในฐานะนักลงทุน ฉันต้องการเห็นภาพรวมพอร์ตการลงทุนทั้งหมดในที่เดียว เพื่อประเมินผลการลงทุนได้อย่างรวดเร็ว

#### เกณฑ์การยอมรับ (Acceptance Criteria)

1. THE Portfolio_Dashboard SHALL แสดงมูลค่ารวมของพอร์ตการลงทุนทั้งหมดเป็นสกุลเงิน USD
2. THE Portfolio_Dashboard SHALL แสดงต้นทุนเฉลี่ยต่อหุ้นสำหรับแต่ละหุ้นหรือ ETF ที่ถือครอง
3. THE Portfolio_Dashboard SHALL แสดงกำไร/ขาดทุนที่ยังไม่รับรู้ (Unrealized P/L) ทั้งเป็นจำนวนเงินและเปอร์เซ็นต์
4. THE Portfolio_Dashboard SHALL แสดงสัดส่วนการจัดสรรสินทรัพย์ (Asset Allocation) ในรูปแบบแผนภูมิวงกลม
5. WHEN ผู้ใช้เลือกช่วงเวลา, THE Portfolio_Dashboard SHALL แสดงผลตอบแทนของพอร์ตเปรียบเทียบกับ Benchmark_Index (S&P 500)
6. WHEN ราคาหุ้นมีการอัปเดต, THE Portfolio_Dashboard SHALL คำนวณมูลค่าพอร์ตใหม่โดยใช้ราคาล่าสุดจาก Financial_API

### ข้อกำหนดที่ 6: การจัดการธุรกรรมด้วยตนเอง

**User Story:** ในฐานะนักลงทุน ฉันต้องการเพิ่ม แก้ไข และลบธุรกรรมด้วยตนเอง เพื่อจัดการข้อมูลการลงทุนให้ถูกต้องครบถ้วน

#### เกณฑ์การยอมรับ (Acceptance Criteria)

1. THE Transaction_Manager SHALL รองรับการเพิ่มธุรกรรมใหม่โดยกรอก Ticker Symbol, วันที่ซื้อ, ราคาต่อหุ้น, จำนวนหุ้น, และจำนวนเงินลงทุน
2. WHEN ผู้ใช้กรอกข้อมูลธุรกรรม, THE Transaction_Manager SHALL ตรวจสอบความถูกต้องของข้อมูล ได้แก่ Ticker Symbol ต้องตรงกับหุ้นที่มีอยู่จริง, วันที่ต้องไม่เป็นอนาคต, ราคาและจำนวนหุ้นต้องเป็นค่าบวก
3. THE Transaction_Manager SHALL รองรับการแก้ไขธุรกรรมที่บันทึกไว้แล้ว
4. WHEN ผู้ใช้ลบธุรกรรม, THE Transaction_Manager SHALL แสดงหน้าต่างยืนยันก่อนลบ และอัปเดตกราฟและแดชบอร์ดหลังลบสำเร็จ
5. THE Transaction_Manager SHALL แสดงประวัติธุรกรรมทั้งหมดในรูปแบบตาราง พร้อมรองรับการกรองตามชื่อหุ้นหรือช่วงวันที่
6. THE Transaction_Manager SHALL รองรับการเรียงลำดับตารางธุรกรรมตามวันที่, Ticker Symbol, หรือจำนวนเงิน

### ข้อกำหนดที่ 7: การจัดการข้อผิดพลาดและประสิทธิภาพ

**User Story:** ในฐานะนักลงทุน ฉันต้องการให้ระบบทำงานได้อย่างเสถียรและรวดเร็ว เพื่อประสบการณ์การใช้งานที่ดี

#### เกณฑ์การยอมรับ (Acceptance Criteria)

1. WHEN เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย, THE Chart_System SHALL แสดงข้อความแจ้งเตือนที่เข้าใจง่ายพร้อมตัวเลือกลองใหม่
2. THE Chart_System SHALL แคชข้อมูลราคาหุ้นที่ดึงมาแล้วเพื่อลดจำนวนการเรียก Financial_API
3. WHEN ผู้ใช้อัปโหลดไฟล์ที่ไม่ใช่รูปแบบ JPG หรือ PNG, THE Transaction_Manager SHALL แสดงข้อความแจ้งเตือนว่ารูปแบบไฟล์ไม่รองรับ
4. IF ฐานข้อมูลไม่สามารถบันทึกธุรกรรมได้, THEN THE Transaction_Manager SHALL แสดงข้อความแจ้งเตือนผู้ใช้และเก็บข้อมูลไว้ในหน่วยความจำชั่วคราวเพื่อลองบันทึกใหม่
5. THE Portfolio_Dashboard SHALL โหลดข้อมูลภาพรวมพอร์ตภายใน 3 วินาทีสำหรับพอร์ตที่มีธุรกรรมไม่เกิน 500 รายการ

### ข้อกำหนดที่ 8: การส่งออกข้อมูลธุรกรรม (Data Export)

**User Story:** ในฐานะนักลงทุน ฉันต้องการส่งออกข้อมูลธุรกรรมเป็นไฟล์ CSV หรือ Excel เพื่อนำไปใช้คำนวณภาษีหรือวิเคราะห์เพิ่มเติมในเครื่องมืออื่น

#### เกณฑ์การยอมรับ (Acceptance Criteria)

1. THE Data_Exporter SHALL รองรับการส่งออกข้อมูลธุรกรรมในรูปแบบ CSV และ Excel (.xlsx)
2. WHEN ผู้ใช้เลือกส่งออกข้อมูล, THE Data_Exporter SHALL สร้างไฟล์ที่ประกอบด้วย Ticker Symbol, วันที่ซื้อ, ราคาต่อหุ้น, จำนวนหุ้น, และจำนวนเงินลงทุนทั้งหมดสำหรับทุกธุรกรรม
3. WHEN ผู้ใช้เลือกช่วงวันที่สำหรับการส่งออก, THE Data_Exporter SHALL ส่งออกเฉพาะธุรกรรมที่อยู่ในช่วงวันที่ที่ระบุ
4. WHEN ผู้ใช้เลือกกรองตาม Ticker Symbol, THE Data_Exporter SHALL ส่งออกเฉพาะธุรกรรมของหุ้นที่ระบุ
5. IF ไม่มีธุรกรรมที่ตรงกับเงื่อนไขการกรอง, THEN THE Data_Exporter SHALL แสดงข้อความแจ้งเตือนว่าไม่มีข้อมูลสำหรับส่งออก
6. FOR ALL ธุรกรรมที่ส่งออกเป็น CSV, การนำเข้าไฟล์ CSV กลับเข้าระบบ SHALL ได้ข้อมูลธุรกรรมที่เทียบเท่ากับข้อมูลต้นฉบับ (Round-trip Property)

### ข้อกำหนดที่ 9: การอัปโหลดสลิปหลายใบพร้อมกัน (Multi-slip Upload)

**User Story:** ในฐานะนักลงทุน ฉันต้องการอัปโหลดสลิปหลายใบพร้อมกัน เพื่อบันทึกธุรกรรมย้อนหลังหลายรายการได้อย่างรวดเร็วโดยไม่ต้องอัปโหลดทีละใบ

#### เกณฑ์การยอมรับ (Acceptance Criteria)

1. THE Transaction_Manager SHALL รองรับการอัปโหลดไฟล์ภาพสลิปพร้อมกันสูงสุด 20 ไฟล์ต่อครั้ง
2. WHEN ผู้ใช้อัปโหลดสลิปหลายใบ, THE Transaction_Manager SHALL ประมวลผลแต่ละสลิปผ่าน OCR_Service และ Slip_Parser แบบขนาน
3. WHEN การประมวลผลสลิปทั้งหมดเสร็จสิ้น, THE Transaction_Manager SHALL แสดงสรุปผลลัพธ์ทั้งหมดใน Confirmation_Modal เดียว โดยแยกรายการที่สำเร็จและรายการที่ต้องแก้ไข
4. WHILE กำลังประมวลผลสลิปหลายใบ, THE Transaction_Manager SHALL แสดงแถบความคืบหน้า (Progress Bar) พร้อมจำนวนสลิปที่ประมวลผลแล้วและจำนวนทั้งหมด
5. IF สลิปบางใบไม่สามารถประมวลผลได้, THEN THE Transaction_Manager SHALL ดำเนินการประมวลผลสลิปที่เหลือต่อไปโดยไม่หยุดทั้งกระบวนการ
6. WHEN ผู้ใช้ยืนยันธุรกรรมจากการอัปโหลดหลายใบ, THE Transaction_Manager SHALL บันทึกเฉพาะรายการที่ผู้ใช้เลือกยืนยัน

### ข้อกำหนดที่ 10: การแสดงมูลค่าเป็นสองสกุลเงิน (Currency Display)

**User Story:** ในฐานะนักลงทุนไทยที่ลงทุนหุ้นสหรัฐฯ ฉันต้องการเห็นมูลค่าเป็นทั้ง USD และ THB เพื่อประเมินผลตอบแทนจริงในสกุลเงินบาทได้อย่างแม่นยำ

#### เกณฑ์การยอมรับ (Acceptance Criteria)

1. THE Portfolio_Dashboard SHALL แสดงมูลค่าพอร์ตทั้งในสกุลเงิน USD และ THB
2. WHEN หน้า Portfolio_Dashboard ถูกโหลด, THE Exchange_Rate_Service SHALL ดึงอัตราแลกเปลี่ยน USD/THB ล่าสุด
3. THE Portfolio_Dashboard SHALL แสดงกำไร/ขาดทุนที่ยังไม่รับรู้ (Unrealized P/L) ทั้งในสกุลเงิน USD และ THB
4. WHEN อัตราแลกเปลี่ยนมีการอัปเดต, THE Portfolio_Dashboard SHALL คำนวณมูลค่าเป็น THB ใหม่โดยอัตโนมัติ
5. THE Portfolio_Dashboard SHALL แสดงอัตราแลกเปลี่ยน USD/THB ที่ใช้ในการคำนวณ พร้อมเวลาที่อัปเดตล่าสุด
6. IF Exchange_Rate_Service ไม่สามารถดึงอัตราแลกเปลี่ยนได้, THEN THE Portfolio_Dashboard SHALL แสดงอัตราแลกเปลี่ยนล่าสุดที่แคชไว้ พร้อมข้อความแจ้งว่าเป็นข้อมูลเก่า

### ข้อกำหนดที่ 11: การติดตามเงินปันผล (Dividend Tracking)

**User Story:** ในฐานะนักลงทุน ฉันต้องการบันทึกเงินปันผลที่ได้รับจากหุ้นและ ETF แต่ละตัว เพื่อเห็นผลตอบแทนรวม (Total Return) ที่แท้จริง ไม่ใช่แค่ Capital Gain

#### เกณฑ์การยอมรับ (Acceptance Criteria)

1. THE Dividend_Tracker SHALL รองรับการบันทึกเงินปันผลโดยระบุ Ticker Symbol, วันที่ได้รับ, จำนวนเงินปันผลต่อหุ้น, และจำนวนเงินปันผลรวม
2. WHEN ผู้ใช้บันทึกเงินปันผล, THE Dividend_Tracker SHALL ตรวจสอบว่า Ticker Symbol ตรงกับหุ้นที่ผู้ใช้ถือครองอยู่ ณ วันที่ระบุ
3. THE Portfolio_Dashboard SHALL แสดงผลตอบแทนรวม (Total Return) ที่รวมทั้ง Capital Gain และเงินปันผลสำหรับแต่ละหุ้น
4. THE Dividend_Tracker SHALL แสดงประวัติเงินปันผลทั้งหมดในรูปแบบตาราง พร้อมรองรับการกรองตาม Ticker Symbol หรือช่วงวันที่
5. THE Portfolio_Dashboard SHALL แสดง Dividend Yield รวมของพอร์ตทั้งหมดเป็นเปอร์เซ็นต์
6. WHEN ผู้ใช้เลือกช่วงเวลา, THE Dividend_Tracker SHALL แสดงยอดเงินปันผลสะสมในช่วงเวลาที่เลือก

### ข้อกำหนดที่ 12: รายการหุ้นที่สนใจติดตาม (Watchlist)

**User Story:** ในฐานะนักลงทุน ฉันต้องการมีรายการหุ้นที่สนใจติดตามแต่ยังไม่ได้ซื้อ เพื่อดูกราฟราคาได้สะดวกโดยไม่ต้องค้นหาทุกครั้ง

#### เกณฑ์การยอมรับ (Acceptance Criteria)

1. THE Watchlist SHALL รองรับการเพิ่มหุ้นหรือ ETF โดยระบุ Ticker Symbol
2. WHEN ผู้ใช้เพิ่มหุ้นเข้า Watchlist, THE Watchlist SHALL ตรวจสอบว่า Ticker Symbol ตรงกับหุ้นหรือ ETF ที่มีอยู่จริงผ่าน Financial_API
3. THE Watchlist SHALL แสดงราคาปัจจุบัน, การเปลี่ยนแปลงราคารายวัน (ทั้งจำนวนเงินและเปอร์เซ็นต์), และกราฟราคาย่อ (Sparkline) สำหรับแต่ละหุ้นในรายการ
4. WHEN ผู้ใช้คลิกที่หุ้นใน Watchlist, THE Chart_System SHALL แสดงกราฟราคาเต็มของหุ้นที่เลือก
5. THE Watchlist SHALL รองรับการลบหุ้นออกจากรายการ
6. THE Watchlist SHALL รองรับการเรียงลำดับตามชื่อ Ticker Symbol, ราคาปัจจุบัน, หรือเปอร์เซ็นต์การเปลี่ยนแปลง
7. IF ผู้ใช้เพิ่ม Ticker Symbol ที่มีอยู่ใน Watchlist แล้ว, THEN THE Watchlist SHALL แสดงข้อความแจ้งว่าหุ้นนี้อยู่ในรายการแล้ว

### ข้อกำหนดที่ 13: การนำเข้าข้อมูลพอร์ตจาก Dime (Dime Portfolio Import)

**User Story:** ในฐานะนักลงทุนที่ใช้แอป Dime ฉันต้องการนำเข้าข้อมูลพอร์ตจาก Dime เข้ามาในระบบได้ เพื่อไม่ต้องกรอกข้อมูลย้อนหลังทีละรายการ

#### เกณฑ์การยอมรับ (Acceptance Criteria)

1. THE Dime_Portfolio_Import SHALL รองรับการนำเข้าไฟล์ข้อมูลพอร์ตจากแอป Dime ในรูปแบบ CSV หรือ JSON
2. WHEN ผู้ใช้อัปโหลดไฟล์ข้อมูลจาก Dime, THE Dime_Portfolio_Import SHALL แยกวิเคราะห์ข้อมูลธุรกรรมทั้งหมดจากไฟล์
3. WHEN การแยกวิเคราะห์สำเร็จ, THE Dime_Portfolio_Import SHALL แสดงตัวอย่างธุรกรรมที่จะนำเข้าใน Confirmation_Modal ให้ผู้ใช้ตรวจสอบก่อนบันทึก
4. WHEN ผู้ใช้ยืนยันการนำเข้า, THE Dime_Portfolio_Import SHALL บันทึกธุรกรรมทั้งหมดลงฐานข้อมูลและอัปเดต Portfolio_Dashboard
5. IF ไฟล์ข้อมูลจาก Dime มีรูปแบบไม่ถูกต้อง, THEN THE Dime_Portfolio_Import SHALL แสดงข้อความแจ้งเตือนพร้อมระบุรูปแบบไฟล์ที่รองรับ
6. WHEN มีธุรกรรมซ้ำกับข้อมูลที่มีอยู่แล้วในระบบ, THE Dime_Portfolio_Import SHALL แจ้งเตือนผู้ใช้และให้เลือกว่าจะข้ามหรือเขียนทับรายการที่ซ้ำ
7. FOR ALL ธุรกรรมที่นำเข้าจากไฟล์ Dime, การส่งออกข้อมูลผ่าน Data_Exporter แล้วนำเข้ากลับ SHALL ได้ข้อมูลธุรกรรมที่เทียบเท่ากับข้อมูลต้นฉบับ (Round-trip Property)
