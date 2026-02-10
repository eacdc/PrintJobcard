1. Header (top table, row 1 & 2)

Procedure: `Execute ProductionWorkOrderPrint 1, '<job_number>', '2'`  
(Single row result set; map result columns to the fields below.)

| Job Card field | Procedure output column | Notes |
|----------------|-------------------------|--------|
| jobNo | JobCardContentNo | e.g. J06180_25_26[1_1] |
| soNo | OrderBookingNo | e.g. SL04795_25_26 |
| jobDate | BookingDate | e.g. 30-Jan-2026 |
| estNo | *(not in procedure)* | Optional; leave empty or ask which column |
| delDate | DeliveryDate | e.g. 10-Feb-2026 |
| quantity | OrderQuantity | e.g. 46000 PCS |
| refProductMasterCode | RefProductMasterCode | Ref code (e.g. 11994); QR image later from QRCode |
| soQuantity | OrderQuantity | Same as quantity in this procedure |

**Clarifications needed (if any):**
- **estNo:** No obvious “Estimate No” column in the procedure output. Should this come from another column (e.g. EstimationUnit, JobBookingID) or be left blank?
- **refProductMasterCode vs QRCode:** Use RefProductMasterCode for the text ref; use QRCode (base64 image) when you implement the real QR in the PDF. Confirm if that’s correct.


2. Job Information (4‑column table)

Same procedure: `ProductionWorkOrderPrint 1, '<job_number>', '2'`

| Job Card field | Procedure output column | Notes |
|----------------|-------------------------|--------|
| jobName | JobName | e.g. RKG PLAY SPP |
| clientName | LedgerName | Client / ledger name |
| consignee | ConsigneeName | |
| coordinator | JobCoordinatorName | e.g. Nickita |
| category | CategoryName or Category | e.g. Carton - Side Pasting |
| contentName | ContentName | e.g. Reverse Tuck In |
| jobSizeMm | JobCloseSize | e.g. L:130,W:32,H:184,OF:30,PF:30 |
| salesPerson | salespersonname | e.g. Sameer Arora |
| poNo | PONo | |
| poDate | PODate | |
| jobPriority | JobPriority | e.g. HIGH |
| jobType | JobType | e.g. REPEAT |
| plateType | PlanType or PlateType | e.g. Sheet Planning |
| productCode | ProductCode | |
| pcCode | ProductMasterCode | e.g. PC03029_25_26 |
| refPcCode | RefProductMasterCode or RefProductMasterCode1 | e.g. 11994 |
| finishedFormat | FormprintStyle | optional |
| ups | TotalUps | |
| paperBy | PaperBy | e.g. Self |
| actualSheets | ActualSheets | |
| processWaste | WastageSheets | |
| makeReadyWaste | MakeReadyWastageSheet | |
| totalReqSheets | TotalSheets | |


3. Paper Details (table; one row per item)
Each row has:
Field	Description
itemCode	Item code
itemName	Item name
paperSize	Paper size
totalSheets	Total sheets
cutSize	Cut size
cuts	Cuts
finalQty	Final quantity
itemWeight	Item weight


4. Print Details (4‑column table)
Field	Description
machineName	Machine name
printingStyle	Printing style (e.g. Single Side)
plateQty	Plate quantity
reverseTuckIn	Reverse tuck in (optional)
frontColor	Front color
backColor	Back color
spFrontColor	Special front color (optional)
spBackColor	Special back color (optional)
gripperMm	Gripper (mm)
onlineCoating	Online coating (optional)
impressions	Impressions
processSize	Process size
soiRemark	S.O.I. remark (optional)
remark	Remark (optional)
specialInstr	Special instructions (optional)
jobReference	Job reference


5. Operation Details (table; one row per operation)
Each row has:
Field	Description
sn	Serial number
operationName	Operation name
scheduleMachineName	Schedule machine name
scheduleQty	Schedule quantity
employeeName	Employee name (optional)
proMachineName	Production machine name
proQty	Production quantity
date	Date
status	Status (e.g. Complete, In Queue)
remark	Remark (optional)
toolCode	Tool code (optional, e.g. for Punching)
refNo	Ref no (optional)


6. Allocated Material Details (table; one row per material)
Each row has:
Field	Description
operationName	Operation name
material	Material name
qty	Quantity
unit	Unit (e.g. Kg)


7. Paper Flow (Page 2)
7a. Paper flow header rows (two text lines before the table)
Each row has:
Field	Description
operation	Operation (e.g. Printing Front Side)
description	Description (paper/ink)
qty	Quantity
unit	Unit (e.g. Sheet, Kg)
7b. Paper Flow table (one row per flow line)
Each row has:
Field	Description
jobNo	Job number
compName	Component name
stage	Stage (e.g. Item Issued)
voucherNo	Voucher number
voucherDate	Voucher date
itemCode	Item code
itemName	Item name
qty	Quantity


8. Footer (last page only)
Field	Description
preparedBy	Prepared by
checkedBy	Checked by (optional)
approved	Approved (optional)
printDateAndTime	Print date and time
modifiedDate	Modified date
