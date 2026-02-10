# Job Card Queries – Table Names & Use for Packaging Job Card

**Inputs:** `ContID` = Job card content id (e.g. `J06371_25_26`), `GBLCompanyID` = `'2'`, `JobBookingID` = from procedure/query 1.

---

## 1. JobCardContents Query
**Query:** `EXEC ProductionWorkOrderPrint 1, '<ContID>', '<GBLCompanyID>'`

**Tables:** None directly (stored procedure; it uses DB objects internally).

**Use for Job Card:**  
- **Section 1 – Header** (already mapped)  
- **Section 2 – Job Information** (already mapped)  
- **Section 3 – Paper Details** (can map from procedure output)  
- **Section 4 – Print Details** (can map from procedure output)  
- **Section 8 – Footer** (partially: UserName/PrintedBy, PrintedDate, LastModifiedDate)

---

## 2. FormDetails Query
**Query:** Select from `JobBookingJOBCardFormWiseDetails`  
**Filter:** `CompanyID`, `JobBookingID`  
**Order:** `JobCardFormNo`

**Tables:**
| Table |
|-------|
| JobBookingJOBCardFormWiseDetails |

**Use for Job Card:**  
- Form-wise breakdown (JobCardFormNO, PlanContName, RefNo, PrintingStyle, Pages, TotalSheets, ActualSheets, WasteSheets, etc.).  
- Not one of the current 8 sections; **helpful** if you add a “Form Details” or form-level table to the card.

---

## 3. ItemDetails Query
**Query:** Complex SELECT with JOINs and subqueries.

**Tables:**
| Table |
|-------|
| JobBookingJobCard |
| JobBookingJobCardContents |
| JobBookingJobCardProcessMaterialRequirement |
| ItemMaster |
| ItemGroupMaster |
| ItemTransactionMain (in subquery) |
| ItemTransactionDetail (in subquery) |

**Use for Job Card:**  
- **Section 3 – Paper Details** (itemCode, itemName, paperSize, totalSheets, cutSize, cuts, finalQty, itemWeight).  
- **Section 7b – Paper Flow table** (MaterialStatus can map to “stage” e.g. Item Issued / PickList Created / Indent Send; plus job/comp/item/qty).  
**Very helpful** for Paper Details and Paper Flow.

---

## 4. OperationDetails Query
**Query:** SELECT from JobBookingJobCard + JobBookingJobCardContents + process/machine/schedule/production.

**Tables:**
| Table |
|-------|
| JobBookingJobCard |
| JobBookingJobCardContents |
| JobBookingJobCardProcess |
| ProcessMaster |
| MachineMaster (multiple aliases) |
| JobScheduleRelease |
| JobBookingJobCardProcessToolAllocation |
| ToolMaster |
| ProcessAllocatedMachineMaster |
| ProductionEntry (in subquery) |
| ProductionUpdateEntry (in subquery) |
| UserMaster (in subquery) |

**Use for Job Card:**  
- **Section 5 – Operation Details** (SNo, ProcessName, MachineName, ToBeProduceQty/ScheduleQty, ReadyQty/ProductionQty, Status, Remark, date FromTime/ToTime, EmployeeName).  
**Very helpful** for Operation Details.

---

## 5. AllocateMaterialDetails Query
**Query:** SELECT from JobBookingJobCard + contents + process + material requirement + item + allocation/issue.

**Tables:**
| Table |
|-------|
| JobBookingJobCard |
| JobBookingJobCardContents |
| JobBookingJobCardProcess |
| JobBookingJobCardProcessMaterialRequirement |
| ItemMaster |
| ItemGroupMaster |
| ItemMasterDetails (multiple aliases: IMD, IML, IMG) |
| ProcessMaster |
| MachineMaster |
| ItemAllocationPending (in subquery) |
| ItemIssuePending (in subquery) |

**Use for Job Card:**  
- **Section 6 – Allocated Material Details** (ProcessName → operationName, ItemName → material, AllocatedQty/IssuedQty/EstimatedQuantity, StockUnit → unit).  
**Very helpful** for Allocated Material Details.

---

## 6. JobBookingBatchDetails Query
**Query:** Select from `JobBookingJobCardBatch`  
**Filter:** `CompanyID`, `JobBookingID`.

**Tables:**
| Table |
|-------|
| JobBookingJobCardBatch |

**Use for Job Card:**  
- Batch info (BatchNo, MfgDate, ExpDate, Quantity).  
- Not in current 8 sections; **helpful** if you add a “Batch” section.

---

## 7. JobBookingCorrugationDetail Query
**Query:** Select from `JobBookingJobCardCorrugation` + ItemMaster + JobBookingJobCardContents.

**Tables:**
| Table |
|-------|
| JobBookingJobCardCorrugation |
| ItemMaster |
| JobBookingJobCardContents |

**Use for Job Card:**  
- Corrugation (CutSize, DechleSize, PlyNo, FluteName, ItemDetails, Weight, Sheets).  
- Not in current 8 sections; **helpful** for corrugated packaging jobs if you add that block.

---

## 8. JobCardPWOGang Query
**Query:** Select from view `JobBookingJobcardGangView`  
**Filter:** `JobBookingID`.

**Tables / Views:**
| Object |
|--------|
| JobBookingJobcardGangView (view) |

**Use for Job Card:**  
- Gang/work order (GangUps, GangJobType, RequiredSheets, GangWorkOrderNo, etc.).  
- Not in current 8 sections; **helpful** if you add gang/PWO info.

---

## 9. ToolAllocationDetails Query
**Query:** SELECT from JobBookingJobCard + JobBookingJobCardContents + JobBookingJobCardProcess + ProcessMaster + tool allocation + ToolMaster + machine.

**Tables:**
| Table |
|-------|
| JobBookingJobCard |
| JobBookingJobCardContents |
| JobBookingJobCardProcess |
| ProcessMaster |
| JobBookingJobCardProcessToolAllocation |
| ToolMaster |
| ProcessAllocatedMachineMaster |
| MachineMaster |

**Use for Job Card:**  
- **Section 5 – Operation Details** (ToolCode, ToolRefCode, Remark per process; can merge with query 4 for toolCode/refNo).  
**Helpful** to enrich Operation Details with tool info.

---

## 10. PaperFlowForJobCard Query
**Query:** `EXEC GetPaperFlowForJob '<ContID>'`

**Tables:** None directly (stored procedure).

**Use for Job Card:**  
- **Section 7 – Paper Flow (Page 2)** (likely returns voucher/issue/comp/stage/item/qty).  
**Very helpful** for Paper Flow table and possibly header rows.

---

## Summary: Unique table/view names (alphabetical)

| Table / View |
|--------------|
| ItemAllocationPending |
| ItemGroupMaster |
| ItemIssuePending |
| ItemMaster |
| ItemMasterDetails |
| ItemTransactionDetail |
| ItemTransactionMain |
| JobBookingJOBCardFormWiseDetails |
| JobBookingJobCard |
| JobBookingJobCardBatch |
| JobBookingJobCardContents |
| JobBookingJobCardCorrugation |
| JobBookingJobCardProcess |
| JobBookingJobCardProcessMaterialRequirement |
| JobBookingJobCardProcessToolAllocation |
| JobBookingJobcardGangView *(view)* |
| JobScheduleRelease |
| MachineMaster |
| ProcessAllocatedMachineMaster |
| ProcessMaster |
| ProductionEntry |
| ProductionUpdateEntry |
| ToolMaster |
| UserMaster |

**Procedures:**  
`ProductionWorkOrderPrint`, `GetPaperFlowForJob`

---

## Which queries are most helpful for the current 8 sections

| Section | Best source | Other useful source |
|---------|-------------|----------------------|
| 1. Header | Query 1 (procedure) | — |
| 2. Job Information | Query 1 (procedure) | — |
| 3. Paper Details | Query 1 (procedure) or **Query 3** (ItemDetails) | — |
| 4. Print Details | Query 1 (procedure) | — |
| 5. Operation Details | **Query 4** (OperationDetails) | **Query 9** (ToolAllocationDetails) for toolCode/refNo |
| 6. Allocated Material Details | **Query 5** (AllocateMaterialDetails) | — |
| 7. Paper Flow | **Query 10** (GetPaperFlowForJob) | Query 3 (ItemDetails) for status/stage |
| 8. Footer | Query 1 (procedure) | — |

So for the current packaging job card, the ones that add the most are: **3 (ItemDetails), 4 (OperationDetails), 5 (AllocateMaterialDetails), and 10 (PaperFlow procedure)**. **2, 6, 7, 8, 9** are helpful for extra or future sections (forms, batch, corrugation, gang, tool allocation).
