/**
 * Job Card Generator
 * Search by job number → build JSON → download multi-page PDF.
 * Same DB will be used; different SQL procedure/query when API is connected.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Config: backend API for job card data (procedure ProductionWorkOrderPrint for packaging header)
  // ---------------------------------------------------------------------------
  const isLocalHost = typeof window !== 'undefined' && /localhost|127\.0\.0\.1/i.test(window.location.hostname);
  const CONFIG = {
    apiBaseUrl: isLocalHost ? 'http://localhost:3001/api' : 'https://cdcapi.onrender.com/api',
    useApi: true // when true and apiBaseUrl set, search calls API; 00001/00002 still use sample data
  };

  // Shared PDF layout: same table width and margins for packaging and commercial
  const HEADER_LABEL_FILL = [200, 200, 200]; // background for column headings and field-name cells (darker gray)
  const PDF_LAYOUT = {
    margin: 10,
    tableWidth: 190, // A4 width 210 - 2*margin
    fillColor: HEADER_LABEL_FILL,
    textColor: [0, 0, 0], // black for header/label text (same as field name font color)
    lineColor: [130, 130, 130], // darker borders for all table cells
    col4: {
      0: { cellWidth: 35, fillColor: HEADER_LABEL_FILL },
      1: { cellWidth: 60 },
      2: { cellWidth: 35, fillColor: HEADER_LABEL_FILL },
      3: { cellWidth: 60 }
    },
    col8: {
      0: { cellWidth: 20, fillColor: HEADER_LABEL_FILL },
      1: { cellWidth: 30 },
      2: { cellWidth: 16, fillColor: HEADER_LABEL_FILL },
      3: { cellWidth: 30 },
      4: { cellWidth: 18, fillColor: HEADER_LABEL_FILL },
      5: { cellWidth: 26 },
      6: { cellWidth: 16, fillColor: HEADER_LABEL_FILL },
      7: { cellWidth: 34 }
    },
    col6: {
      0: { cellWidth: 28, fillColor: HEADER_LABEL_FILL },
      1: { cellWidth: 35 },
      2: { cellWidth: 22, fillColor: HEADER_LABEL_FILL },
      3: { cellWidth: 38 },
      4: { cellWidth: 22, fillColor: HEADER_LABEL_FILL },
      5: { cellWidth: 45 }
    },
    footerColWidth: 190 / 3
  };

  let currentJobNumber = '';
  let currentJobType = null; // 'packaging' | 'commercial'
  let currentJobJson = null;

  const $ = (id) => document.getElementById(id);
  const searchBtn = $('searchBtn');
  const jobBookingNoInput = $('jobBookingNo');
  const clientNameInput = $('clientName');
  const salesPersonInput = $('salesPerson');
  const fromJobDateInput = $('fromJobDate');
  const toJobDateInput = $('toJobDate');
  const databaseSelect = $('database');
  const resultsSection = $('resultsSection');
  const resultsColgroup = $('resultsColgroup');
  const resultsTable = $('resultsTable');
  const resultsThead = $('resultsThead');
  const resultsTbody = $('resultsTbody');
  const resultsActions = $('resultsActions');
  const downloadJobCardBtn = $('downloadJobCardBtn');
  const unselectRowBtn = $('unselectRowBtn');
  const selectedJobInfo = $('selectedJobInfo');
  const resultsPlaceholder = $('resultsPlaceholder');
  const resultSection = $('resultSection');
  const messageSection = $('messageSection');
  const messageText = $('messageText');
  const jobTypeBadge = $('jobTypeBadge');
  const jobIdDisplay = $('jobIdDisplay');
  const downloadBtn = $('downloadBtn');
  const viewJsonBtn = $('viewJsonBtn');
  const jsonPreview = $('jsonPreview');
  const jsonContent = $('jsonContent');

  let searchResults = [];
  let selectedSearchRow = null;
  let salesPersonList = [];
  let clientNameFullList = [];
  const clientNameListBox = $('clientNameListBox');
  const salesPersonListBox = $('salesPersonListBox');

  let messageHideTimeout = null;
  function showMessage(text, type, autoHideMs) {
    if (messageHideTimeout) { clearTimeout(messageHideTimeout); messageHideTimeout = null; }
    messageSection.classList.remove('hidden');
    messageText.textContent = text;
    messageText.className = 'message ' + (type || '');
    if (autoHideMs > 0) messageHideTimeout = setTimeout(() => { hideMessage(); messageHideTimeout = null; }, autoHideMs);
  }

  function hideMessage() {
    if (messageHideTimeout) { clearTimeout(messageHideTimeout); messageHideTimeout = null; }
    messageSection.classList.add('hidden');
  }

  function renderExcelDropdownList(listBox, items, inputEl) {
    if (!listBox) return;
    listBox.innerHTML = '';
    const list = Array.isArray(items) ? items : [];
    list.forEach((text) => {
      const item = document.createElement('div');
      item.className = 'excel-dropdown-item';
      item.textContent = text;
      item.setAttribute('role', 'option');
      item.addEventListener('click', () => {
        if (inputEl) inputEl.value = (text || '').trim();
        listBox.classList.remove('open');
      });
      listBox.appendChild(item);
    });
    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'excel-dropdown-item empty';
      empty.textContent = 'No matches';
      empty.setAttribute('role', 'option');
      listBox.appendChild(empty);
    }
  }

  function setupExcelDropdowns() {
    const clientDropdown = $('clientNameDropdown');
    const salesDropdown = $('salesPersonDropdown');
    const clientArrow = clientDropdown && clientDropdown.querySelector('.excel-dropdown-arrow');
    const salesArrow = salesDropdown && salesDropdown.querySelector('.excel-dropdown-arrow');

    function openClientList() {
      if (salesPersonListBox) salesPersonListBox.classList.remove('open');
      if (clientNameListBox) {
        const q = (clientNameInput && clientNameInput.value) ? clientNameInput.value.trim().toLowerCase() : '';
        const filtered = q ? clientNameFullList.filter(n => (n || '').toLowerCase().includes(q)) : clientNameFullList;
        renderExcelDropdownList(clientNameListBox, filtered, clientNameInput);
        clientNameListBox.classList.add('open');
      }
    }
    function openSalesList() {
      if (clientNameListBox) clientNameListBox.classList.remove('open');
      if (salesPersonListBox) {
        const q = (salesPersonInput && salesPersonInput.value) ? salesPersonInput.value.trim().toLowerCase() : '';
        const names = salesPersonList.map(s => (s.ledgerName || '').trim());
        const filtered = q ? names.filter(n => n.toLowerCase().includes(q)) : names;
        renderExcelDropdownList(salesPersonListBox, filtered, salesPersonInput);
        salesPersonListBox.classList.add('open');
      }
    }

    if (clientNameInput) {
      clientNameInput.addEventListener('focus', openClientList);
      clientNameInput.addEventListener('input', () => { if (clientNameListBox && clientNameListBox.classList.contains('open')) openClientList(); });
    }
    if (salesPersonInput) {
      salesPersonInput.addEventListener('focus', openSalesList);
      salesPersonInput.addEventListener('input', () => { if (salesPersonListBox && salesPersonListBox.classList.contains('open')) openSalesList(); });
    }
    if (clientArrow) clientArrow.addEventListener('click', () => { if (clientNameInput) clientNameInput.focus(); });
    if (salesArrow) salesArrow.addEventListener('click', () => { if (salesPersonInput) salesPersonInput.focus(); });

    document.addEventListener('click', (e) => {
      if (clientNameListBox && clientNameListBox.classList.contains('open') && !clientDropdown.contains(e.target)) clientNameListBox.classList.remove('open');
      if (salesPersonListBox && salesPersonListBox.classList.contains('open') && !salesDropdown.contains(e.target)) salesPersonListBox.classList.remove('open');
    });
  }

  function showResult(type, displayId) {
    hideMessage();
    resultSection.classList.remove('hidden');
    jobTypeBadge.textContent = type === 'packaging' ? 'Packaging' : 'Commercial';
    jobTypeBadge.className = 'job-type-badge ' + type;
    jobIdDisplay.textContent = 'Job: ' + displayId;
  }

  function hideResult() {
    resultSection.classList.add('hidden');
  }

  /** Derive job card type from segment name (e.g. "Commercial" -> commercial, else packaging). */
  function segmentToType(segmentName) {
    return (segmentName || '').toLowerCase().includes('commercial') ? 'commercial' : 'packaging';
  }

  /**
   * Fetch job data. Uses API when CONFIG.useApi and apiBaseUrl set; else sample for 00001/00002.
   * @param {string} jobNumber
   * @param {string} type - 'packaging' | 'commercial'
   * @param {string} [database] - 'KOL' | 'AHM', default KOL
   */
  async function fetchJobData(jobNumber, type, database) {
    const db = database || 'KOL';
    const useSample = jobNumber === '00001' || jobNumber === '00002';

    if (CONFIG.useApi && CONFIG.apiBaseUrl && !useSample) {
      try {
        const url = `${CONFIG.apiBaseUrl}/job-card?jobNumber=${encodeURIComponent(jobNumber)}&type=${encodeURIComponent(type)}&database=${encodeURIComponent(db)}`;
        const res = await fetch(url);
        if (res.status === 404) throw new Error('Job not found');
        if (!res.ok) {
          const errBody = await res.text();
          let msg = 'Job not found';
          try {
            const j = JSON.parse(errBody);
            if (j.message) msg = j.message;
            else if (j.error) msg = j.error;
          } catch (_) {}
          throw new Error(msg);
        }
        return await res.json();
      } catch (e) {
        throw new Error(e.message || 'Failed to load job');
      }
    }

    if (useSample) {
      if (type === 'packaging') return getPackagingSampleData(jobNumber);
      if (type === 'commercial') return getCommercialSampleData(jobNumber);
    }
    throw new Error('Job not found. Use 00001 or 00002 for sample data, or a real job number when API is on.');
  }

  // ---------------------------------------------------------------------------
  // Sample data: Packaging (images 1 & 2 – Job Card + Paper Flow)
  // ---------------------------------------------------------------------------
  // function getPackagingSampleData(jobNumber) {
  //   return {
  //     type: 'packaging',
  //     jobNumber: jobNumber,
  //     displayId: 'J06180_25_26 [1_1]',
  //     qrCode: 'J06180_25_26 [1_1]',
  //     header: {
  //       jobNo: 'J06180_25_26 [1_1]',
  //       soNo: 'SL04795_25_26',
  //       jobDate: '30-Jan-2026',
  //       estNo: '',
  //       delDate: '10-Feb-2026',
  //       quantity: '46000 PCS',
  //       refProductMasterCode: '', // QR placeholder
  //       soQuantity: '46000 PCS'
  //     },
  //     jobInfo: {
  //       jobName: 'RKG PLAY SPP',
  //       clientName: 'Dollar Industries Ltd - Kolkata',
  //       consignee: 'Dollar Industries Ltd - Kolkata',
  //       coordinator: 'Nickita',
  //       category: 'Carton - Side Pasting',
  //       contentName: 'Reverse Tuck In',
  //       jobSizeMm: 'L:130,W:32,H:184,OF:30,PF:30',
  //       salesPerson: 'Sameer Arora',
  //       poNo: '133025689',
  //       poDate: '02-Feb-2026',
  //       jobPriority: 'HIGH',
  //       jobType: 'REPEAT',
  //       plateType: 'Sheet Planning',
  //       productCode: '',
  //       pcCode: 'PC03029_25_26',
  //       refPcCode: '11994',
  //       finishedFormat: 'null',
  //       ups: '8',
  //       paperBy: 'Self',
  //       actualSheets: '5750',
  //       processWaste: '0',
  //       makeReadyWaste: '1',
  //       totalReqSheets: '5751'
  //     },
  //     paperDetails: [
  //       {
  //         itemCode: 'P00913',
  //         itemName: 'Grey Back, 285 GSM, Mehali, NONE, 975x685-',
  //         paperSize: '975 X 685',
  //         totalSheets: '5751',
  //         cutSize: '975x685',
  //         cuts: '1',
  //         finalQty: '5751',
  //         itemWeight: '1094.671'
  //       }
  //     ],
  //     printDetails: {
  //       machineName: 'CD102 - 6L',
  //       printingStyle: 'Single Side',
  //       plateQty: '5',
  //       frontColor: '5 F-INK, PANTONE 7694 C || INK, Process Ink CMYK',
  //       spFrontColor: '',
  //       soiRemark: '',
  //       remark: 'undefined',
  //       specialInstr: '',
  //       jobReference: 'APPROVED SHADE CARD (Text, Dieline as per artwork)',
  //       processSize: '961 X 669',
  //       reverseTuckIn: 'ReverseTuckIn',
  //       onlineCoating: '',
  //       gripperMm: '10- Single Side',
  //       backColor: '',
  //       spBackColor: '',
  //       impressions: '6000'
  //     },
  //     operationDetails: [
  //       { sn: 1, operationName: 'Printing Front Side', scheduleMachineName: 'CD102 - 6L', scheduleQty: '5650', employeeName: '-', proMachineName: 'CD102 - 6L', proQty: '5650', date: '02-Feb-2026', status: 'Complete', remark: 'Old kld' },
  //       { sn: 2, operationName: 'Coating - Aq Gloss', scheduleMachineName: 'CD102 - 6L', scheduleQty: '0', employeeName: '-', proMachineName: 'CD102 - 6L', proQty: '0', date: '', status: 'In Queue', remark: '' },
  //       { sn: 3, operationName: 'Emboss Online', scheduleMachineName: 'Punching Panchla', scheduleQty: '0', employeeName: '-', proMachineName: 'Punching Panchla', proQty: '0', date: '', status: 'In Queue', remark: 'old emboss block' },
  //       { sn: 4, operationName: 'Pasting - Side Pasting', scheduleMachineName: 'DGM Pasting', scheduleQty: '44320', employeeName: '-', proMachineName: 'DGM Pasting', proQty: '44320', date: '03-Feb-2026', status: 'Complete', remark: '' },
  //       { sn: 5, operationName: 'Punching', scheduleMachineName: 'Bobst punching', scheduleQty: '5600', employeeName: '-', proMachineName: 'Bobst punching', proQty: '5600', date: '03-Feb-2026', status: 'Complete', remark: '', toolCode: 'AD00795', refNo: '1032' }
  //     ],
  //     allocatedMaterials: [
  //       { operationName: 'Coating - Aq Gloss', material: 'Aqueous Gloss Varnish', qty: '15.36', unit: 'Kg' }
  //     ],
  //     paperFlow: [
  //       { jobNo: 'J06180_25_26', compName: 'Reverse Tuck In', stage: 'Item Issued', voucherNo: 'IS12196_25_26', voucherDate: '1/31/2026 12:00:00 AM', itemCode: 'P00913', itemName: 'Grey Back, 285 GSM, Mehali, NONE, 975x685', qty: '5751' }
  //     ],
  //     paperFlowHeaderRows: [
  //       { operation: 'Printing Front Side', description: 'Grey Back, 285 GSM, Mehali, NONE, 975x685', qty: '5751', unit: 'Sheet' },
  //       { operation: 'Printing Front Side', description: 'INK, Process Ink CMYK', qty: '15.36', unit: 'Kg' }
  //     ],
  //     footer: {
  //       preparedBy: 'Nickita',
  //       checkedBy: '',
  //       approved: '',
  //       printDateAndTime: '04-Feb-2026 09:40:57 AM',
  //       modifiedDate: '30-Jan-2026 03:25:46 PM'
  //     }
  //   };
  // }

  // ---------------------------------------------------------------------------
  // Sample data: Commercial (images 3 & 4 – Job Docket, parts, paper flow)
  // ---------------------------------------------------------------------------
  // function getCommercialSampleData(jobNumber) {
  //   return {
  //     type: 'commercial',
  //     jobNumber: jobNumber,
  //     displayId: 'J05928_25_26',
  //     header: {
  //       jobDocketNo: 'J05928_25_26',
  //       jobDocketDate: '19-Jan-2026',
  //       orderQty: '5000 PCS',
  //       jobQty: '5000 PCS',
  //       deliveryDate: '24-Jan-2026'
  //     },
  //     generalInfo: {
  //       clientName: 'Aludecor Lamination Pvt Ltd',
  //       jobPriority: 'HIGH',
  //       quotationNo: '3039.0',
  //       jobName: 'MSC Vol. 3 Catalog',
  //       poNo: 'mail Order',
  //       poDate: '19-Jan-2026',
  //       closeSize: 'L:304.8,W:482.6',
  //       itemType: 'COMMERCIAL CATALOGUE HSN 49111020 GST 18%',
  //       executive: 'Netai',
  //       erpCode: '',
  //       salesPerson: 'Sanjay Biswas',
  //       jobCardRemarks: '',
  //       salesOrderRemarks: ''
  //     },
  //     parts: [
  //       {
  //         partName: 'Cover',
  //         qrPlaceholder: true,
  //         closeSize: 'L:304.8,W:482.6',
  //         colour: '4 F',
  //         quantity: '5000 PCS',
  //         paperType: 'FBB, 300 GSM, ITC, 635x965',
  //         sheetsFull: '1854',
  //         kgs: '266.976',
  //         paperBy: 'Self',
  //         cutSize: '512.6x938.4',
  //         sheetsCut: '1854',
  //         machine: 'SM102',
  //         ups: '3',
  //         printingImpressions: 'Form Details:Single Side & Impressions:2000',
  //         operations: [
  //           { sn: 1, operationName: 'Printing Front Side', scheduleMachineName: 'CD102 - 6L', scheduleQty: '1854', employeeName: '-', proMachineName: 'CD102 - 6L', proQty: '1854', date: '24-Jan-2026', status: 'Complete', remark: '' },
  //           { sn: 2, operationName: 'Lamination - BOPP Matt', scheduleMachineName: 'Lamination Panchla', scheduleQty: '1850', employeeName: '-', proMachineName: 'Lamination Panchla', proQty: '1850', date: '31-Jan-2026', status: 'Complete', remark: '' },
  //           { sn: 3, operationName: 'Back to Back Pasting Book Std', scheduleMachineName: 'B2B Pasting Panchla', scheduleQty: '1854', employeeName: '-', proMachineName: 'B2B Pasting Panchla', proQty: '1854', date: '30-Jan-2026', status: 'Complete', remark: '' }
  //         ],
  //         processMaterials: [
  //           { processName: 'Lamination - BOPP Matt', itemName: 'Lamination Adhesive', reqQty: '8.02', allocated: '0', issued: '1', unit: 'Kg' },
  //           { processName: 'Printing Front Side', itemName: 'FBB, 300 GSM, ITC, NONE, 635x965 MM', reqQty: '0', allocated: '0', issued: '1', unit: 'Sheet' },
  //           { processName: 'Printing Front Side', itemName: 'INK, Process Ink CMYK', reqQty: '3.21', allocated: '0', issued: '1', unit: 'Kg' }
  //         ]
  //       },
  //       {
  //         partName: '8 Spread',
  //         qrPlaceholder: true,
  //         closeSize: 'L:457.2,H:292.1,Pages:8',
  //         colour: '4 F',
  //         quantity: '5000 PCS',
  //         paperType: 'FBB, 200 GSM, ITC, 635x966',
  //         sheetsFull: '10812',
  //         kgs: '1286.628',
  //         paperBy: 'Self',
  //         cutSize: '632.2x944.4',
  //         sheetsCut: '10812',
  //         machine: 'SM102',
  //         ups: '4',
  //         printingImpressions: 'Form Details:Sin - 2 & Impressions:10000',
  //         operations: [],
  //         processMaterials: []
  //       },
  //       {
  //         partName: '1 Spread',
  //         qrPlaceholder: true,
  //         closeSize: 'L:292.1,W:457.2',
  //         colour: '4 F',
  //         quantity: '5000 PCS',
  //         paperType: 'FBB, 200 GSM, ITC, 635x966',
  //         sheetsFull: '1428',
  //         kgs: '169.932',
  //         paperBy: 'Self',
  //         cutSize: '630.2x944.4',
  //         sheetsCut: '1428',
  //         machine: 'SM102',
  //         ups: '4',
  //         printingImpressions: 'Form Details:Single Side & Impressions:2000',
  //         operations: [
  //           { sn: 1, operationName: 'Printing Front Side', scheduleMachineName: 'SM102', scheduleQty: '1428', employeeName: '-', proMachineName: 'SM102', proQty: '1428', date: '21-Jan-2026', status: 'Complete', remark: '' },
  //           { sn: 2, operationName: 'Lamination - BOPP Matt', scheduleMachineName: 'Lamination Panchla', scheduleQty: '1380', employeeName: '-', proMachineName: 'Lamination Panchla', proQty: '1380', date: '24-Jan-2026', status: 'Complete', remark: '' },
  //           { sn: 3, operationName: 'Cutting Post', scheduleMachineName: 'Protech', scheduleQty: '0', employeeName: '-', proMachineName: 'Protech', proQty: '0', date: '', status: 'In Queue', remark: '' },
  //           { sn: 4, operationName: 'Back to Back Pasting Book Std', scheduleMachineName: 'B2B Pasting Panchla', scheduleQty: '5712', employeeName: '-', proMachineName: 'B2B Pasting Panchla', proQty: '5712', date: '30-Jan-2026', status: 'Complete', remark: '' }
  //         ],
  //         processMaterials: [
  //           { processName: 'Lamination - BOPP Matt', itemName: 'BOPP Matte, Indian, 902 MM, 12 MICRON', reqQty: '8.93', allocated: '0', issued: '20', unit: 'Kg' },
  //           { processName: 'Lamination - BOPP Matt', itemName: 'Lamination Adhesive', reqQty: '7.44', allocated: '0', issued: '20', unit: 'Kg' },
  //           { processName: 'Printing Front Side', itemName: 'INK, Process Ink CMYK', reqQty: '2.98', allocated: '0', issued: '20', unit: 'Kg' },
  //           { processName: 'Printing Front Side', itemName: 'FBB, 200 GSM, ITC, NONE, 635 X 966 MM', reqQty: '175.19', allocated: '0', issued: '20', unit: 'Sheet' }
  //         ]
  //       }
  //     ],
  //     paperFlow: [
  //       { jobNo: 'J05928_25_26', compName: '1 Spread', stage: 'Item Issued', voucherNo: 'IS11172_25_26', voucherDate: '1/20/2026 12:00:00 AM', itemCode: 'R00255', itemName: '0 BF,FBB,205 GSM, Imported,, 1050 MM, 20', qty: '1050' },
  //       { jobNo: 'J05928_25_26', compName: '8 Spread', stage: 'Item Issued', voucherNo: 'IS11171_25_26', voucherDate: '1/20/2026 12:00:00 AM', itemCode: 'R00255', itemName: '0 BF,FBB,205 GSM, Imported,, 1050 MM, 20', qty: '1700' },
  //       { jobNo: 'J05928_25_26', compName: 'Cover', stage: 'Item Issued', voucherNo: 'IS11174_25_26', voucherDate: '1/20/2026 12:00:00 AM', itemCode: 'R00323', itemName: '0 BF,FBB,295 GSM, Importet - April,, 1092 MM, 1', qty: '1' }
  //     ],
  //     footer: {
  //       preparedBy: '',
  //       checkedBy: '',
  //       approved: '',
  //       printDateAndTime: '04-Feb-2026 09:47:14 AM',
  //       modifiedDate: ''
  //     }
  //   };
  // }

  // ---------------------------------------------------------------------------
  // Helper: Generate QR code as data URL
  // ---------------------------------------------------------------------------
  function generateQRDataURL(text, size = 256) {
    if (!text || typeof qrcode === 'undefined') return null;
    try {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      const cellSize = Math.floor(size / qr.getModuleCount());
      const canvas = document.createElement('canvas');
      const actualSize = cellSize * qr.getModuleCount();
      canvas.width = actualSize;
      canvas.height = actualSize;
      const ctx = canvas.getContext('2d');
      for (let row = 0; row < qr.getModuleCount(); row++) {
        for (let col = 0; col < qr.getModuleCount(); col++) {
          ctx.fillStyle = qr.isDark(row, col) ? '#000000' : '#ffffff';
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.warn('QR generation failed:', e);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // PDF: Packaging (Page 1 = Job Card, Page 2 = Paper Flow)
  // ---------------------------------------------------------------------------
  function buildPackagingPdf(json) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = PDF_LAYOUT.margin;
    const tableWidth = PDF_LAYOUT.tableWidth;
    let y = 10;
    const font = 'helvetica';
    const fontB = 'helvetica';

    function sectionGap() { return 4; }
    
    // Helper: draw section heading, ensuring it's not orphaned from table
    function drawSectionHeading(title, currentY, alignLeft = false) {
      const pageH = doc.internal.pageSize.getHeight();
      const minSpaceNeeded = 20; // heading + table header + at least 1 row
      if (currentY + minSpaceNeeded > pageH - 10) {
        doc.addPage();
        currentY = 10;
      }
      doc.setFont(fontB, 'bold');
      doc.setFontSize(10);
      if (alignLeft) {
        doc.text(title, margin, currentY);
      } else {
        doc.text(title, pageW / 2, currentY, { align: 'center' });
      }
      return currentY + 5;
    }

    // ----- Page 1: JOB CARD -----
    doc.setFontSize(14);
    doc.setFont(fontB, 'bold');
    doc.text('JOB CARD', pageW / 2, y, { align: 'center' });
    y += 8;

    const h = json.header;
    const headerStartY = y;
    const qrGap = 3;
    const qrWidth = 28;
    const headerTableWidth = tableWidth - qrWidth - qrGap;
    // Reserve right side for QR: right margin so autoTable only uses headerTableWidth
    const headerRightMargin = pageW - margin - headerTableWidth;
    doc.setFontSize(9);
    doc.setFont(font, 'normal');
    doc.autoTable({
      startY: y,
      body: [
        ['Job No.', h.jobNo, 'SO No.', h.soNo, 'Job Date', h.jobDate, 'Est No.', h.estNo || '-'],
        ['Del. Date', h.delDate, 'Quantity', h.quantity, 'Ref Product Master Code', (h.refProductMasterCode || '-'), 'SO Quantity', h.soQuantity]
      ],
      theme: 'grid',
      styles: { fontSize: 8, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
      margin: { left: margin, right: headerRightMargin },
      tableWidth: 'auto',
      columnStyles: {
        0: { fillColor: PDF_LAYOUT.fillColor },
        2: { fillColor: PDF_LAYOUT.fillColor },
        4: { fillColor: PDF_LAYOUT.fillColor },
        6: { fillColor: PDF_LAYOUT.fillColor }
      }
    });
    
    // QR code in the right gap, height matches header table height
    const headerTableHeight = doc.lastAutoTable.finalY - headerStartY;
    if (json.qrCode) {
      const qrDataURL = generateQRDataURL(json.qrCode, 128);
      if (qrDataURL) {
        const qrX = margin + headerTableWidth + qrGap;
        const qrY = headerStartY;
        doc.addImage(qrDataURL, 'PNG', qrX, qrY, qrWidth, headerTableHeight);
      }
    }
    
    y = doc.lastAutoTable.finalY + sectionGap();

    const ji = json.jobInfo;
    const jobInfoLines = [
      ['Job Name', ji.jobName, 'Sales Person', ji.salesPerson],
      ['Client Name', ji.clientName, 'PO No', ji.poNo],
      ['Consignee', ji.consignee, 'PO Date', ji.poDate],
      ['Coordinator', ji.coordinator, 'Job Priority', ji.jobPriority],
      ['Category', ji.category, 'Job Type', ji.jobType],
      ['Content Name', ji.contentName, 'Plate Type', ji.plateType],
      ['Job Size in MM', ji.jobSizeMm, 'Product Code', ji.productCode || '-'],
      ['', '', 'PC Code', ji.pcCode],
      ['', '', 'Ref. PC Code', ji.refPcCode],
      ['Finished Format', ji.finishedFormat || '-', 'Ups', ji.ups],
      ['Paper By', ji.paperBy, 'Actual Sheets', ji.actualSheets],
      ['Process Waste', ji.processWaste, 'Make Ready Waste', ji.makeReadyWaste],
      ['Total Req. Sheets', ji.totalReqSheets, '', '']
    ];
    doc.autoTable({
      startY: y,
      body: jobInfoLines.map(row => [row[0], row[1], row[2], row[3]]),
      theme: 'grid',
      styles: { fontSize: 8, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
      margin: { left: margin, right: margin },
      tableWidth: tableWidth,
      columnStyles: PDF_LAYOUT.col4
    });
    y = doc.lastAutoTable.finalY + sectionGap();

    doc.setFontSize(10);
    doc.setFont(fontB, 'bold');
    doc.text('PAPER DETAILS', pageW / 2, y, { align: 'center' });
    y += 6;
    doc.autoTable({
      startY: y,
      head: [['Item Code', 'Item Name', 'Paper Size', 'Total Sheets', 'Cut Size', 'Cuts', 'Final Qty', 'Item Weight']],
      body: json.paperDetails.map(p => [p.itemCode, p.itemName, p.paperSize, p.totalSheets, p.cutSize, p.cuts, p.finalQty, p.itemWeight]),
      theme: 'grid',
      headStyles: { fillColor: PDF_LAYOUT.fillColor, halign: 'center', textColor: PDF_LAYOUT.textColor, lineColor: PDF_LAYOUT.lineColor },
      styles: { fontSize: 7, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
      margin: { left: margin, right: margin },
      tableWidth: tableWidth
    });
    y = doc.lastAutoTable.finalY + sectionGap();

    doc.text('PRINT DETAILS', pageW / 2, y, { align: 'center' });
    y += 6;
    const pd = json.printDetails;
    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    const printDetailsRows = [
      ['Machine Name', pd.machineName || '-', 'Printing Style', pd.printingStyle || '-'],
      ['Plate Qty', pd.plateQty || '-', pd.reverseTuckIn ? 'Reverse Tuck In' : '', pd.reverseTuckIn || ''],
      ['Front Color', pd.frontColor || '-', 'Back Color', pd.backColor || '-'],
      ['Sp. Front Color', pd.spFrontColor || '-', 'Sp. Back Color', pd.spBackColor || '-'],
      ['Gripper (MM)', pd.gripperMm || '-', 'Online Coating', pd.onlineCoating || '-'],
      ['Impressions', pd.impressions || '-', 'Process Size', pd.processSize || '-'],
      ['S.O.I. Remark', pd.soiRemark || '-', 'Remark', pd.remark || '-'],
      ['Special Instr.', pd.specialInstr || '-', 'Job Reference', pd.jobReference || '-']
    ];
    doc.autoTable({
      startY: y,
      body: printDetailsRows.map(row => [row[0], row[1], row[2], row[3]]),
      theme: 'grid',
      styles: { fontSize: 8, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
      margin: { left: margin, right: margin },
      tableWidth: tableWidth,
      columnStyles: PDF_LAYOUT.col4
    });
    y = doc.lastAutoTable.finalY + sectionGap();

    // Build operation table body: backend already sorted (non-tool first, tool-related at bottom)
    // Add tool row above each operation that has tool code
    const opBody = [];
    const numCols = 9;
    json.operationDetails.forEach(op => {
      // If operation has tool code, insert tool row first
      if (op.toolCode || op.refNo) {
        const toolParts = [
          'ToolCode: ' + (op.toolCode || '-'),
          'Ref No: ' + (op.refNo || '-'),
          'Remark: ' + (op.toolRemark != null ? op.toolRemark : '-')
        ];
        opBody.push([{ content: toolParts.join('   '), colSpan: numCols }]);
      }
      // Then the operation row (use the SN from backend which is already sorted)
      opBody.push([
        op.sn,
        op.operationName,
        op.scheduleMachineName,
        op.scheduleQty,
        op.proMachineName,
        op.proQty,
        op.date || '-',
        op.status,
        op.remark || ''
      ]);
    });
    y = drawSectionHeading('OPERATION DETAILS', y);
    const opStartPage = doc.internal.getCurrentPageInfo().pageNumber;
    doc.autoTable({
      startY: y,
      head: [['SN', 'Operation Name', 'Schedule Machine', 'Schedule Qty', 'Pro.Machine', 'Pro. Qty', 'Date', 'Status', 'Remark']],
      body: opBody,
      theme: 'grid',
      headStyles: { fillColor: PDF_LAYOUT.fillColor, halign: 'center', textColor: PDF_LAYOUT.textColor, lineColor: PDF_LAYOUT.lineColor },
      styles: { fontSize: 7, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
      margin: { left: margin, right: margin },
      tableWidth: tableWidth,
      didDrawPage: function(data) {
        // Repeat section heading on continuation pages
        const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
        if (currentPage > opStartPage) {
          doc.setFont(fontB, 'bold');
          doc.setFontSize(10);
          doc.text('OPERATION DETAILS (Continued)', pageW / 2, 10, { align: 'center' });
        }
      }
    });
    y = doc.lastAutoTable.finalY + sectionGap();

    y = drawSectionHeading('ALLOCATED MATERIAL DETAILS', y);
    const allocStartPage = doc.internal.getCurrentPageInfo().pageNumber;
    doc.autoTable({
      startY: y,
      head: [['Operation Name', 'Material', 'Qty', 'Unit']],
      body: json.allocatedMaterials.map(m => [m.operationName, m.material, m.qty, m.unit]),
      theme: 'grid',
      headStyles: { fillColor: PDF_LAYOUT.fillColor, halign: 'center', textColor: PDF_LAYOUT.textColor, lineColor: PDF_LAYOUT.lineColor },
      styles: { fontSize: 8, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
      margin: { left: margin, right: margin },
      tableWidth: tableWidth,
      didDrawPage: function(data) {
        const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
        if (currentPage > allocStartPage) {
          doc.setFont(fontB, 'bold');
          doc.setFontSize(10);
          doc.text('ALLOCATED MATERIAL DETAILS (Continued)', pageW / 2, 10, { align: 'center' });
        }
      }
    });
    y = doc.lastAutoTable.finalY + sectionGap();

    // ----- Corrugation Details (below Allocated Material Details, only when data present) -----
    const corrugationDetails = json.corrugationDetails || [];
    if (corrugationDetails.length > 0) {
      y = drawSectionHeading('Corrugation Details', y);
      doc.autoTable({
        startY: y,
        head: [['PlyNo', 'Flute', 'Item Code', 'Item Details', 'Dechle Size', 'Cut Size', 'Weight(Gm)', 'Sheets']],
        body: corrugationDetails.map(c => [c.plyNo, c.flute, c.itemCode, c.itemDetails, c.dechleSize, c.cutSize, c.weightGm, c.sheets]),
        theme: 'grid',
        headStyles: { fillColor: PDF_LAYOUT.fillColor, halign: 'center', textColor: PDF_LAYOUT.textColor, lineColor: PDF_LAYOUT.lineColor },
        styles: { fontSize: 7, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
        margin: { left: margin, right: margin },
        tableWidth: tableWidth
      });
      y = doc.lastAutoTable.finalY + sectionGap();
    }

    // ----- Paper Flow (same page if space, else new page) -----
    const foot = json.footer;
    y = drawSectionHeading('Paper Flow For Job Card', y);
    const paperFlowStartPage = doc.internal.getCurrentPageInfo().pageNumber;
    doc.autoTable({
      startY: y,
      head: [['Job No.', 'Comp.Name', 'Stage', 'Voucher No.', 'Voucher Date', 'Item Code', 'Item Name', 'Qty']],
      body: json.paperFlow.map(r => [r.jobNo, r.compName, r.stage, r.voucherNo, r.voucherDate, r.itemCode, r.itemName, r.qty]),
      theme: 'grid',
      headStyles: { fillColor: PDF_LAYOUT.fillColor, halign: 'center', textColor: PDF_LAYOUT.textColor, lineColor: PDF_LAYOUT.lineColor },
      styles: { fontSize: 7, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
      margin: { left: margin, right: margin },
      tableWidth: tableWidth,
      didDrawPage: function(data) {
        const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
        if (currentPage > paperFlowStartPage) {
          doc.setFont(fontB, 'bold');
          doc.setFontSize(10);
          doc.text('Paper Flow For Job Card (Continued)', pageW / 2, 10, { align: 'center' });
        }
      }
    });
    y = doc.lastAutoTable.finalY + sectionGap();
    doc.autoTable({
      startY: y,
      body: [
        ['PREPARED BY - ' + (foot.preparedBy || ''), 'CHECKED BY ' + (foot.checkedBy || ''), 'APPROVED ' + (foot.approved || '')],
        ['Print Date And Time: ' + (foot.printDateAndTime || '-'), '', 'ModifiedDate: ' + (foot.modifiedDate || '-')]
      ],
      theme: 'grid',
      styles: { fontSize: 8, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
      margin: { left: margin, right: margin },
      tableWidth: tableWidth,
      columnStyles: {
        0: { cellWidth: PDF_LAYOUT.footerColWidth, fillColor: PDF_LAYOUT.fillColor },
        1: { cellWidth: PDF_LAYOUT.footerColWidth, fillColor: PDF_LAYOUT.fillColor },
        2: { cellWidth: PDF_LAYOUT.footerColWidth, fillColor: PDF_LAYOUT.fillColor }
      },
      didParseCell: function (data) {
        if (data.section === 'body' && data.row.index === 1 && data.column.index === 1) {
          data.cell.styles.fillColor = [255, 255, 255];
        }
      }
    });

    return doc;
  }

  // ---------------------------------------------------------------------------
  // PDF: Book / Commercial Job Card (header + job details + per-component sections + paper flow + footer)
  // ---------------------------------------------------------------------------
  function buildCommercialPdf(json) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = PDF_LAYOUT.margin;
    const tableWidth = PDF_LAYOUT.tableWidth;
    let y = 10;
    const font = 'helvetica';
    const fontB = 'helvetica';

    function sectionGap() { return 4; }

    function drawSectionHeading(title, currentY, alignLeft = false) {
      const minSpaceNeeded = 20;
      if (currentY + minSpaceNeeded > pageH - 10) {
        doc.addPage();
        currentY = 10;
      }
      doc.setFont(fontB, 'bold');
      doc.setFontSize(10);
      if (alignLeft) {
        doc.text(title, margin, currentY);
      } else {
        doc.text(title, pageW / 2, currentY, { align: 'center' });
      }
      return currentY + 5;
    }

    // ----- 1. Company name -----
    doc.setFontSize(12);
    doc.setFont(fontB, 'bold');
    doc.text('CDC Printers Pvt. Ltd.', pageW / 2, y, { align: 'center' });
    y += 8;

    // ----- 2. Job Docket header bar (single row: Docket No | Date | Order/Job Qty | Delivery Date) -----
    const h = json.header;
    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    doc.autoTable({
      startY: y,
      body: [[
        'JOB DOCKET NO. ' + (h.jobDocketNo || '-'),
        'JOB DOCKET DATE ' + (h.jobDocketDate || '-'),
        'Order Qty-' + (h.orderQty || '-') + ', Job Qty-' + (h.jobQty || '-'),
        'DELIVERY DATE ' + (h.deliveryDate || '-')
      ]],
      theme: 'grid',
      styles: { fontSize: 8, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
      margin: { left: margin, right: margin },
      tableWidth: tableWidth,
      columnStyles: {
        0: { cellWidth: tableWidth / 4, fillColor: PDF_LAYOUT.fillColor },
        1: { cellWidth: tableWidth / 4, fillColor: PDF_LAYOUT.fillColor },
        2: { cellWidth: tableWidth / 4, fillColor: PDF_LAYOUT.fillColor },
        3: { cellWidth: tableWidth / 4, fillColor: PDF_LAYOUT.fillColor }
      }
    });
    y = doc.lastAutoTable.finalY + sectionGap();

    // ----- 3. Job details grid (6 columns: label-value pairs, labels gray) -----
    const gi = json.generalInfo;
    const genRows = [
      ['Client Name', gi.clientName || '-', 'Job Priority', gi.jobPriority || '-', 'Quotation No.', gi.quotationNo || '-'],
      ['Job Name', gi.jobName || '-', 'PO No.', gi.poNo || '-', 'PO Date', gi.poDate || '-'],
      ['Close Size', gi.closeSize || '-', 'Item Type', gi.itemType || '-', 'Executive', gi.executive || '-'],
      ['ERP Code', gi.erpCode || '-', 'Job Card Remarks', gi.jobCardRemarks || '-', 'Sales Order Remarks', gi.salesOrderRemarks || '-'],
      ['Sales Person', gi.salesPerson || '-', '', '', '', '']
    ];
    doc.autoTable({
      startY: y,
      body: genRows.map(r => [r[0], r[1], r[2], r[3], r[4] || '', r[5] || '']),
      theme: 'grid',
      styles: { fontSize: 8, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
      margin: { left: margin, right: margin },
      tableWidth: tableWidth,
      columnStyles: PDF_LAYOUT.col6
    });
    y = doc.lastAutoTable.finalY + sectionGap();

    // ----- 4. Per-component sections (each book component: Cover, 8 Spread, 1 Spread, etc.) -----
    const parts = json.parts || [];
    const componentBlockGap = 8;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (y > pageH - 80) { doc.addPage(); y = 10; }

      // Gap above component block so QR doesn't touch the table above
      if (i > 0) y += componentBlockGap;

      // Component heading: QR code + component name
      const qrSize = 14;
      const qrPadding = 2;
      const qrX = margin;
      const qrY = y + qrPadding;
      if (part.qrCode) {
        const qrDataURL = generateQRDataURL(part.qrCode, 128);
        if (qrDataURL) {
          doc.addImage(qrDataURL, 'PNG', qrX, qrY, qrSize, qrSize);
        } else {
          doc.setDrawColor(0, 0, 0);
          doc.rect(qrX, qrY, qrSize, qrSize);
        }
      } else {
        doc.setDrawColor(0, 0, 0);
        doc.rect(qrX, qrY, qrSize, qrSize);
      }
      doc.setFont(fontB, 'bold');
      doc.setFontSize(11);
      doc.text(part.partName || ('Component ' + (i + 1)), margin + qrSize + 4, y + qrPadding + qrSize / 2 + 2);
      y += qrSize + qrPadding * 2 + sectionGap();

      // Paper specifications table (6 columns, label cells gray)
      doc.setFont(font, 'normal');
      doc.setFontSize(8);
      const specRows = [
        ['Close Size', part.closeSize || '-', 'Colour', part.colour || '-', 'Quanitty', part.quantity || '-'],
        ['Paper Type', part.paperType || '-', 'Sheets (Full)', part.sheetsFull || '-', 'Kgs', part.kgs || '-'],
        ['Paper By', part.paperBy || '-', 'Cut Size', part.cutSize || '-', 'Sheets (Cut)', part.sheetsCut || '-'],
        ['Machine', part.machine || '-', 'Ups', part.ups || '-', '', ''],
        ['Printing Impressions', part.printingImpressions || '-', '', '', '', '']
      ];
      doc.autoTable({
        startY: y,
        body: specRows.map(r => [r[0], r[1], r[2], r[3], r[4] || '', r[5] || '']),
        theme: 'grid',
        styles: { fontSize: 7, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
        margin: { left: margin, right: margin },
        tableWidth: tableWidth,
        columnStyles: PDF_LAYOUT.col6
      });
      y = doc.lastAutoTable.finalY + sectionGap();

      // Operations table (10 columns including Employee Name)
      if (part.operations && part.operations.length > 0) {
        y = drawSectionHeading('Operations', y, true);
        const opsStartPage = doc.internal.getCurrentPageInfo().pageNumber;
        doc.autoTable({
          startY: y,
          head: [['SN', 'Operation Name', 'Schedule Machine Name', 'Schedule Qty', 'Employee Name', 'Pro.Machine Name', 'Pro. Qty', 'Date', 'Status', 'Remark']],
          body: part.operations.map(op => [
            op.sn,
            op.operationName,
            op.scheduleMachineName || '-',
            op.scheduleQty || '-',
            op.employeeName || '-',
            op.proMachineName || '-',
            op.proQty || '-',
            op.date || '-',
            op.status || '-',
            op.remark || ''
          ]),
          theme: 'grid',
          headStyles: { fillColor: PDF_LAYOUT.fillColor, halign: 'center', textColor: PDF_LAYOUT.textColor, lineColor: PDF_LAYOUT.lineColor },
          styles: { fontSize: 6, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
          margin: { left: margin, right: margin },
          tableWidth: tableWidth,
          didDrawPage: function() {
            const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
            if (currentPage > opsStartPage) {
              doc.setFont(fontB, 'bold');
              doc.setFontSize(10);
              doc.text(part.partName + ' - Operations (Continued)', margin, 10);
            }
          }
        });
        y = doc.lastAutoTable.finalY + sectionGap();
      }

      // Allocated / Process Materials table
      if (part.processMaterials && part.processMaterials.length > 0) {
        y = drawSectionHeading('Process Materials', y, true);
        const procMatStartPage = doc.internal.getCurrentPageInfo().pageNumber;
        doc.autoTable({
          startY: y,
          head: [['Process Name', 'Item Name', 'Req. Qty', 'Unit']],
          body: part.processMaterials.map(m => [m.processName, m.itemName, m.reqQty, m.unit]),
          theme: 'grid',
          headStyles: { fillColor: PDF_LAYOUT.fillColor, halign: 'center', textColor: PDF_LAYOUT.textColor, lineColor: PDF_LAYOUT.lineColor },
          styles: { fontSize: 7, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
          margin: { left: margin, right: margin },
          tableWidth: tableWidth,
          didDrawPage: function() {
            const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
            if (currentPage > procMatStartPage) {
              doc.setFont(fontB, 'bold');
              doc.setFontSize(10);
              doc.text(part.partName + ' - Process Materials (Continued)', margin, 10);
            }
          }
        });
        y = doc.lastAutoTable.finalY + sectionGap();
      }
    }

    // ----- 5. Paper Flow For Job Card -----
    if (y > pageH - 60) { doc.addPage(); y = 10; }
    y = drawSectionHeading('Paper Flow For Job Card', y);
    const paperFlowStartPage = doc.internal.getCurrentPageInfo().pageNumber;
    const paperFlowBody = (json.paperFlow || []).map(r => [r.jobNo, r.compName, r.stage, r.voucherNo, r.voucherDate || '-', r.itemCode, r.itemName, r.qty]);
    doc.autoTable({
      startY: y,
      head: [['Job No.', 'Comp. Name', 'Stage', 'Voucher No.', 'Voucher Date', 'Item Code', 'Item Name', 'Qty']],
      body: paperFlowBody.length ? paperFlowBody : [['-', '-', '-', '-', '-', '-', '-', '-']],
      theme: 'grid',
      headStyles: { fillColor: PDF_LAYOUT.fillColor, halign: 'center', textColor: PDF_LAYOUT.textColor, lineColor: PDF_LAYOUT.lineColor },
      styles: { fontSize: 7, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
      margin: { left: margin, right: margin },
      tableWidth: tableWidth,
      didDrawPage: function() {
        const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
        if (currentPage > paperFlowStartPage) {
          doc.setFont(fontB, 'bold');
          doc.setFontSize(10);
          doc.text('Paper Flow For Job Card (Continued)', pageW / 2, 10, { align: 'center' });
        }
      }
    });
    y = doc.lastAutoTable.finalY + sectionGap();

    // ----- 6. Footer -----
    const foot = json.footer || {};
    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    doc.autoTable({
      startY: y,
      body: [
        ['PREPARED BY - ' + (foot.preparedBy || ''), 'CHECKED BY ' + (foot.checkedBy || ''), 'APPROVED ' + (foot.approved || '')],
        ['Print Date And Time: ' + (foot.printDateAndTime || '-'), '', 'ModifiedDate: ' + (foot.modifiedDate || '-')]
      ],
      theme: 'grid',
      styles: { fontSize: 8, halign: 'center', lineColor: PDF_LAYOUT.lineColor },
      margin: { left: margin, right: margin },
      tableWidth: tableWidth,
      columnStyles: {
        0: { cellWidth: PDF_LAYOUT.footerColWidth, fillColor: PDF_LAYOUT.fillColor },
        1: { cellWidth: PDF_LAYOUT.footerColWidth, fillColor: PDF_LAYOUT.fillColor },
        2: { cellWidth: PDF_LAYOUT.footerColWidth, fillColor: PDF_LAYOUT.fillColor }
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.row.index === 1 && data.column.index === 1) {
          data.cell.styles.fillColor = [255, 255, 255];
        }
      }
    });

    return doc;
  }

  function downloadPdf() {
    if (!currentJobJson || !currentJobType) return;
    const doc = currentJobType === 'packaging'
      ? buildPackagingPdf(currentJobJson)
      : buildCommercialPdf(currentJobJson);
    const filename = 'JobCard_' + (currentJobJson.displayId || currentJobNumber).replace(/\s/g, '_') + '.pdf';
    doc.save(filename);
  }

  function toggleJsonPreview() {
    if (!currentJobJson) return;
    if (jsonPreview.classList.contains('hidden')) {
      jsonContent.textContent = JSON.stringify(currentJobJson, null, 2);
      jsonPreview.classList.remove('hidden');
      viewJsonBtn.textContent = 'Hide JSON';
    } else {
      jsonPreview.classList.add('hidden');
      viewJsonBtn.textContent = 'View JSON';
    }
  }

  const SEARCH_COLUMNS = [
    { key: 'jobBookingNo', label: 'Job Booking No', width: 8 },
    { key: 'segmentName', label: 'Segment', width: 5 },
    { key: 'categoryName', label: 'Category', width: 6 },
    { key: 'clientName', label: 'Client Name', width: 8 },
    { key: 'salesPersonName', label: 'Sales Person', width: 6 },
    { key: 'jobName', label: 'Job Name', width: 11 },
    { key: 'jobType', label: 'Job Type', width: 5 },
    { key: 'orderQuantity', label: 'Order Qty', width: 4 },
    { key: 'coordinatorName', label: 'Coordinator', width: 6 },
    { key: 'deliveryDate', label: 'Delivery Date', width: 5 },
    { key: 'productCode', label: 'Product Code', width: 5 },
    { key: 'refProductMasterCode', label: 'Ref Product Code', width: 5 },
    { key: 'salesOrderNo', label: 'SO No', width: 7 },
    { key: 'poNo', label: 'PO No', width: 5 },
    { key: 'poDate', label: 'PO Date', width: 5 },
    { key: 'jobBookingDate', label: 'Job Date', width: 5 }
  ];

  function formatCellVal(val) {
    if (val == null) return '';
    if (val instanceof Date) {
      const d = val.getDate(), m = val.getMonth() + 1, y = val.getFullYear();
      return String(d).padStart(2, '0') + '-' + String(m).padStart(2, '0') + '-' + y;
    }
    const s = String(val);
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (iso) return iso[3] + '-' + iso[2] + '-' + iso[1];
    return s;
  }

  function renderSearchResults(results) {
    if (resultsColgroup) {
      resultsColgroup.innerHTML = '';
      SEARCH_COLUMNS.forEach(col => {
        const colEl = document.createElement('col');
        colEl.style.width = (col.width || 100 / SEARCH_COLUMNS.length) + '%';
        resultsColgroup.appendChild(colEl);
      });
    }
    resultsThead.innerHTML = '';
    resultsTbody.innerHTML = '';
    if (!results.length) {
      resultsTbody.innerHTML = '<tr><td colspan="' + SEARCH_COLUMNS.length + '">No rows found.</td></tr>';
      return;
    }
    const theadTr = document.createElement('tr');
    SEARCH_COLUMNS.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.label;
      theadTr.appendChild(th);
    });
    resultsThead.appendChild(theadTr);
    results.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.dataset.index = index;
      tr.classList.add('result-row');
      SEARCH_COLUMNS.forEach(col => {
        const td = document.createElement('td');
        td.textContent = formatCellVal(row[col.key]);
        tr.appendChild(td);
      });
      tr.addEventListener('click', function () {
        document.querySelectorAll('.results-table tbody tr.result-row').forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
        selectedSearchRow = row;
        resultsActions.classList.remove('hidden');
        selectedJobInfo.textContent = row.jobBookingNo + ' · ' + (row.segmentName || 'Packaging');
      });
      resultsTbody.appendChild(tr);
    });
  }

  async function loadFilterOptions() {
    const database = databaseSelect ? databaseSelect.value : 'KOL';
    try {
      const [salesRes, clientRes] = await Promise.all([
        fetch(`${CONFIG.apiBaseUrl}/job-card/filters/sales-persons?database=${encodeURIComponent(database)}`),
        fetch(`${CONFIG.apiBaseUrl}/job-card/filters/client-names?database=${encodeURIComponent(database)}`)
      ]);
      const salesData = salesRes.ok ? await salesRes.json() : [];
      const clientData = clientRes.ok ? await clientRes.json() : [];
      salesPersonList = Array.isArray(salesData) ? salesData : [];
      clientNameFullList = Array.isArray(clientData) ? clientData : [];
    } catch (e) {
      console.warn('Filter options load failed:', e.message);
    }
  }

  async function searchJobs() {
    const params = new URLSearchParams();
    const jobBookingNo = (jobBookingNoInput && jobBookingNoInput.value) ? jobBookingNoInput.value.trim() : '';
    const clientName = (clientNameInput && clientNameInput.value) ? clientNameInput.value.trim() : '';
    const salesPersonText = (salesPersonInput && salesPersonInput.value) ? salesPersonInput.value.trim() : '';
    const salesPersonMatch = salesPersonList.find(s => (s.ledgerName || '').trim() === salesPersonText);
    const salesPersonID = salesPersonMatch ? String(salesPersonMatch.ledgerID) : '';
    const fromJobDate = (fromJobDateInput && fromJobDateInput.value) ? fromJobDateInput.value : '';
    const toJobDate = (toJobDateInput && toJobDateInput.value) ? toJobDateInput.value : '';
    const database = databaseSelect ? databaseSelect.value : 'KOL';
    if (jobBookingNo) params.set('jobBookingNo', jobBookingNo);
    if (clientName) params.set('clientName', clientName);
    if (salesPersonID) params.set('salesPersonID', salesPersonID);
    if (fromJobDate) params.set('fromJobDate', fromJobDate);
    if (toJobDate) params.set('toJobDate', toJobDate);
    params.set('database', database);

    const prevSearchText = searchBtn ? searchBtn.textContent : '';
    if (searchBtn) { searchBtn.disabled = true; searchBtn.classList.add('loading'); searchBtn.textContent = 'Loading...'; }
    hideMessage();
    selectedSearchRow = null;
    resultsActions.classList.add('hidden');
    selectedJobInfo.textContent = '';
    try {
      const url = `${CONFIG.apiBaseUrl}/job-card/search?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Search failed');
      }
      const data = await res.json();
      searchResults = data.results || [];
      renderSearchResults(searchResults);
      resultsSection.classList.remove('hidden');
      if (resultsPlaceholder) resultsPlaceholder.classList.add('hidden');
      if (searchResults.length === 0) showMessage('No jobs found. Try different filters.', '');
    } catch (e) {
      showMessage(e.message || 'Search failed.', 'error');
      resultsSection.classList.add('hidden');
      if (resultsPlaceholder) resultsPlaceholder.classList.remove('hidden');
    } finally {
      if (searchBtn) { searchBtn.disabled = false; searchBtn.classList.remove('loading'); searchBtn.textContent = prevSearchText || 'Search'; }
    }
  }

  async function onDownloadJobCardFromTable() {
    if (!selectedSearchRow) return;
    const jobBookingNo = selectedSearchRow.jobBookingNo;
    const type = segmentToType(selectedSearchRow.segmentName);
    const database = databaseSelect ? databaseSelect.value : 'KOL';
    if (!jobBookingNo) {
      showMessage('No job selected.', 'error');
      return;
    }
    const prevDownloadText = downloadJobCardBtn ? downloadJobCardBtn.textContent : '';
    if (downloadJobCardBtn) { downloadJobCardBtn.disabled = true; downloadJobCardBtn.classList.add('loading'); downloadJobCardBtn.textContent = 'Loading...'; }
    hideMessage();
    try {
      const data = await fetchJobData(jobBookingNo, type, database);
      currentJobNumber = jobBookingNo;
      currentJobType = type;
      currentJobJson = data;
      const doc = type === 'packaging' ? buildPackagingPdf(data) : buildCommercialPdf(data);
      const filename = 'JobCard_' + (data.displayId || jobBookingNo).replace(/\s/g, '_') + '.pdf';
      doc.save(filename);
      showMessage('Job card downloaded.', 'success', 2000);
    } catch (e) {
      showMessage(e.message || 'Download failed.', 'error');
    } finally {
      if (downloadJobCardBtn) { downloadJobCardBtn.disabled = false; downloadJobCardBtn.classList.remove('loading'); downloadJobCardBtn.textContent = prevDownloadText || 'Download Job Card'; }
    }
  }

  function unselectRow() {
    document.querySelectorAll('.results-table tbody tr.result-row.selected').forEach(r => r.classList.remove('selected'));
    selectedSearchRow = null;
    resultsActions.classList.add('hidden');
    selectedJobInfo.textContent = '';
  }

  function clearAllFilters() {
    if (jobBookingNoInput) jobBookingNoInput.value = '';
    if (clientNameInput) clientNameInput.value = '';
    if (salesPersonInput) salesPersonInput.value = '';
    if (fromJobDateInput) fromJobDateInput.value = '';
    if (toJobDateInput) toJobDateInput.value = '';
    if (clientNameListBox) clientNameListBox.classList.remove('open');
    if (salesPersonListBox) salesPersonListBox.classList.remove('open');
    hideMessage();
  }

  if (searchBtn) searchBtn.addEventListener('click', searchJobs);
  const clearFiltersBtn = $('clearFiltersBtn');
  if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearAllFilters);
  const filterInputs = [jobBookingNoInput, clientNameInput, salesPersonInput, fromJobDateInput, toJobDateInput];
  filterInputs.forEach(el => {
    if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchJobs(); });
  });
  if (databaseSelect) databaseSelect.addEventListener('change', loadFilterOptions);
  loadFilterOptions();
  setupExcelDropdowns();
  if (downloadJobCardBtn) downloadJobCardBtn.addEventListener('click', onDownloadJobCardFromTable);
  if (unselectRowBtn) unselectRowBtn.addEventListener('click', unselectRow);
  downloadBtn.addEventListener('click', downloadPdf);
  viewJsonBtn.addEventListener('click', toggleJsonPreview);
})();
