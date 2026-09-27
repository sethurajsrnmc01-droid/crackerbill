/**
 * SIVAKASI CRACKERS BILLING & INVOICE ENGINE
 * Pure Vanilla JavaScript Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    cart: {}, // productId -> quantity
    activeCategory: 'ALL',
    invoice: {
      date: getTodayDateString(),
      invoiceNo: generateInvoiceNumber(),
      paymentMode: 'Cash'
    }
  };

  // DOM Elements
  const orderTableBody = document.getElementById('orderTableBody');
  const categoryPillsContainer = document.getElementById('categoryPills');
  
  // Dynamic Stats Summary Elements
  const statTotalItems = document.getElementById('statTotalItems');
  const statTotalMRP = document.getElementById('statTotalMRP');
  const statTotalSavings = document.getElementById('statTotalSavings');
  const statNetPayable = document.getElementById('statNetPayable');
  
  // Minimal Top Bar Inputs
  const invDateInput = document.getElementById('invDate');
  const paymentModeInput = document.getElementById('paymentMode');

  // Live Invoice Sheet Elements
  const invSheetNo = document.getElementById('invSheetNo');
  const invSheetDate = document.getElementById('invSheetDate');
  const invSheetPayMode = document.getElementById('invSheetPayMode');
  const invTableBody = document.getElementById('invTableBody');
  const invSubTotalMrp = document.getElementById('invSubTotalMrp');
  const invTotalSavings = document.getElementById('invTotalSavings');
  const invNetPayable = document.getElementById('invNetPayable');
  const invAmountWords = document.getElementById('invAmountWords');

  // Primary Action Buttons
  const btnPrintBill = document.getElementById('btnPrintBill');
  const btnDownloadPDF = document.getElementById('btnDownloadPDF');

  // Sales History Modal Elements
  const salesHistoryModal = document.getElementById('salesHistoryModal');
  const btnSalesHistory = document.getElementById('btnSalesHistory');
  const btnHistoryClose = document.getElementById('btnHistoryClose');
  const btnHistoryCloseCross = document.getElementById('btnHistoryCloseCross');
  const historyDateInput = document.getElementById('historyDateInput');
  const historyFilterPills = document.getElementById('historyFilterPills');
  const histTotalCount = document.getElementById('histTotalCount');
  const histTotalRevenue = document.getElementById('histTotalRevenue');
  const historyTableBody = document.getElementById('historyTableBody');

  // Action Buttons
  const btnClear = document.getElementById('btnClearAll');

  let activeHistoryRange = 'all';

  // Initialize App
  init();

  function init() {
    setupCategoryPills();
    setupTopBarListeners();
    renderOrderTable();
    updateCalculations();
    setupEventListeners();
    setupActionButtons();
    setupHistoryEventListeners();
    
    // Offline sync setup
    window.addEventListener('online', syncOfflineBills);
    syncOfflineBills();

    // Fetch and restore Sales History directly from Google Sheets if LocalStorage is empty
    fetchSalesHistoryFromSheets();

    // Default today's date
    if (invDateInput) invDateInput.value = state.invoice.date;
  }

  // Generate today's date formatted (YYYY-MM-DD)
  function getTodayDateString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Format date to DD/MM/YYYY for invoice
  function formatDateForInvoice(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  // Generate unique Surya Crackers invoice bill number
  function generateInvoiceNumber() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const year = new Date().getFullYear();
    return `SURYA-${year}-${randomNum}`;
  }

  // Build Category Pill Buttons
  function setupCategoryPills() {
    if (!categoryPillsContainer) return;
    
    let html = `<button class="pill-btn active" data-category="ALL">💥 ALL CATEGORIES</button>`;
    
    CRACKERS_CATALOG.forEach(cat => {
      const shortName = cat.category.split('/')[0].trim();
      html += `<button class="pill-btn" data-category="${cat.category}">${shortName}</button>`;
    });
    
    categoryPillsContainer.innerHTML = html;

    categoryPillsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('pill-btn')) {
        document.querySelectorAll('.pill-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        state.activeCategory = e.target.dataset.category;
        renderOrderTable();
      }
    });
  }

  // Listen to Top Bar Changes (Date & Payment Mode)
  function setupTopBarListeners() {
    if (invDateInput) {
      invDateInput.addEventListener('change', (e) => {
        state.invoice.date = e.target.value;
        renderLiveInvoice();
      });
    }
    if (paymentModeInput) {
      paymentModeInput.addEventListener('change', (e) => {
        state.invoice.paymentMode = e.target.value;
        renderLiveInvoice();
      });
    }
  }

  // Action Button Handlers
  function setupEventListeners() {
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (Object.keys(state.cart).length === 0) {
          showToast('Cart is already empty!');
          return;
        }
        state.cart = {};
        state.invoice.invoiceNo = generateInvoiceNumber(); // Generate fresh bill no
        renderOrderTable();
        updateCalculations();
        showToast('All quantities reset & new bill created!');
      });
    }
  }

  // Reset all item quantities, generate new unique Bill Number, and refresh UI
  function resetFormForNewBill() {
    state.cart = {};
    state.invoice.invoiceNo = generateInvoiceNumber();
    state.invoice.date = getTodayDateString();
    state.invoice.paymentMode = 'Cash';

    if (invDateInput) invDateInput.value = state.invoice.date;
    if (paymentModeInput) paymentModeInput.value = 'Cash';

    renderOrderTable();
    updateCalculations();
  }

  // Primary Action Button Handlers
  function setupActionButtons() {
    const btnPrintBill = document.getElementById('btnPrintBill');
    const btnPrintOnly = document.getElementById('btnPrintOnly');
    const btnPrintDropdownToggle = document.getElementById('btnPrintDropdownToggle');
    const printDropdownMenu = document.getElementById('printDropdownMenu');

    if (btnPrintBill) {
      btnPrintBill.addEventListener('click', () => {
        if (printDropdownMenu) printDropdownMenu.classList.add('hidden');
        
        let totalQty = 0;
        Object.keys(state.cart).forEach(id => {
          if (state.cart[id] > 0) totalQty += state.cart[id];
        });

        if (totalQty === 0) {
          showToast('Cart is empty! Select items to print bill.');
          return;
        }

        // 1. Record in Sales History & push to Google Sheets via doPost
        saveCurrentInvoiceToHistory();

        // 2. Open native print dialog
        window.print();

        // 3. Auto-reset for new bill & generate new unique bill number
        resetFormForNewBill();
        showToast('Bill printed & saved! Reset for new bill.');
      });
    }

    if (btnPrintOnly) {
      btnPrintOnly.addEventListener('click', () => {
        if (printDropdownMenu) printDropdownMenu.classList.add('hidden');
        window.print();
      });
    }

    if (btnPrintDropdownToggle && printDropdownMenu) {
      btnPrintDropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        printDropdownMenu.classList.toggle('hidden');
      });

      document.addEventListener('click', (e) => {
        if (!printDropdownMenu.contains(e.target) && e.target !== btnPrintDropdownToggle) {
          printDropdownMenu.classList.add('hidden');
        }
      });
    }

    const btnSaveInvoice = document.getElementById('btnSaveInvoice');
    if (btnSaveInvoice) {
      btnSaveInvoice.addEventListener('click', () => {
        if (printDropdownMenu) printDropdownMenu.classList.add('hidden');
        
        let totalQty = 0;
        Object.keys(state.cart).forEach(id => {
          if (state.cart[id] > 0) totalQty += state.cart[id];
        });

        if (totalQty === 0) {
          showToast('Cart is empty! Select items to save invoice.');
          return;
        }

        saveCurrentInvoiceToHistory();
        showToast('Invoice Saved Successfully!');

        // Clear billing screen and generate new bill number for next invoice
        resetFormForNewBill();
      });
    }

    if (btnDownloadPDF) {
      btnDownloadPDF.addEventListener('click', () => {
        downloadPDF();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (printDropdownMenu) printDropdownMenu.classList.add('hidden');
        if (salesHistoryModal && !salesHistoryModal.classList.contains('hidden')) {
          closeSalesHistoryModal();
        }
      }
    });
  }

  // Sales History Event Listeners & Logic
  function setupHistoryEventListeners() {
    if (btnSalesHistory) {
      btnSalesHistory.addEventListener('click', openSalesHistoryModal);
    }
    if (btnHistoryClose) {
      btnHistoryClose.addEventListener('click', closeSalesHistoryModal);
    }
    if (btnHistoryCloseCross) {
      btnHistoryCloseCross.addEventListener('click', closeSalesHistoryModal);
    }
    if (salesHistoryModal) {
      salesHistoryModal.addEventListener('click', (e) => {
        if (e.target === salesHistoryModal) closeSalesHistoryModal();
      });
    }

    if (historyDateInput) {
      historyDateInput.addEventListener('change', (e) => {
        activeHistoryRange = 'custom';
        updateHistoryPillSelection();
        renderSalesHistory();
      });
    }

    if (historyFilterPills) {
      historyFilterPills.addEventListener('click', (e) => {
        if (e.target.classList.contains('pill-btn')) {
          activeHistoryRange = e.target.dataset.range;
          if (historyDateInput) historyDateInput.value = '';
          updateHistoryPillSelection();
          renderSalesHistory();
        }
      });
    }
  }

  function updateHistoryPillSelection() {
    if (!historyFilterPills) return;
    historyFilterPills.querySelectorAll('.pill-btn').forEach(btn => {
      if (btn.dataset.range === activeHistoryRange) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function openSalesHistoryModal() {
    if (!salesHistoryModal) return;
    renderSalesHistory();
    salesHistoryModal.classList.remove('hidden');
    void salesHistoryModal.offsetWidth;
    salesHistoryModal.classList.add('show');
  }

  function closeSalesHistoryModal() {
    if (!salesHistoryModal) return;
    salesHistoryModal.classList.remove('show');
    setTimeout(() => {
      salesHistoryModal.classList.add('hidden');
    }, 200);
  }

  function getSalesHistoryFromStorage() {
    try {
      const saved = localStorage.getItem('sivakasi_sales_history') || localStorage.getItem('salesHistory');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Error loading sales history:', e);
      return [];
    }
  }

  function sendToGoogleSheets(billData) {
    let scriptURL = "AKfycbxwrG_yNWNZ0iP7Ajp9G20_SSEj2D9ZJd-GIFyBYy4MLHTSElgITnHzr54ZFbCztDHP";
    if (!scriptURL.startsWith('http')) {
      scriptURL = 'https://script.google.com/macros/s/' + scriptURL + '/exec';
    }
    
    const payload = {
      billNo: billData.billNo || billData.id,
      dateTime: billData.dateTime || (billData.displayDate ? `${billData.displayDate} ${billData.displayTime || ''}`.trim() : new Date().toLocaleString()),
      paymentMode: billData.paymentMode || 'Cash',
      totalMRP: billData.totalMRP || 0,
      discount: billData.discountAmount !== undefined ? billData.discountAmount : (billData.totalSavings || 0),
      netAmount: billData.netAmount !== undefined ? billData.netAmount : (billData.netPayable || 0),
      totalItems: billData.totalItems !== undefined ? billData.totalItems : (billData.itemsCount !== undefined ? billData.itemsCount : (billData.items ? billData.items.length : 0)),
      itemsSummary: billData.items ? billData.items.map(i => `${i.name} (x${i.qty})`).join(', ') : ''
    };

    if (!navigator.onLine) {
      let queue = JSON.parse(localStorage.getItem('unsyncedBills')) || [];
      queue.push(payload);
      localStorage.setItem('unsyncedBills', JSON.stringify(queue));
      console.log('Offline: Bill saved to offline queue.');
      return;
    }

    fetch(scriptURL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })
    .then(() => console.log('Bill synced to Google Sheets successfully!'))
    .catch(error => {
      console.error('Error syncing to Google Sheets:', error);
      let queue = JSON.parse(localStorage.getItem('unsyncedBills')) || [];
      queue.push(payload);
      localStorage.setItem('unsyncedBills', JSON.stringify(queue));
      console.log('Offline: Bill saved to offline queue.');
    });
  }

  function syncOfflineBills() {
    if (!navigator.onLine) return;

    let queue = JSON.parse(localStorage.getItem('unsyncedBills')) || [];
    if (!queue || queue.length === 0) return;

    let scriptURL = "AKfycbxwrG_yNWNZ0iP7Ajp9G20_SSEj2D9ZJd-GIFyBYy4MLHTSElgITnHzr54ZFbCztDHP";
    if (!scriptURL.startsWith('http')) {
      scriptURL = 'https://script.google.com/macros/s/' + scriptURL + '/exec';
    }

    const promises = queue.map(payload => {
      return fetch(scriptURL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
    });

    Promise.all(promises)
      .then(() => {
        localStorage.removeItem('unsyncedBills');
        console.log('Offline bills synced to Google Sheets successfully!');
        showToast('Online restored: Offline bills synced to Google Sheets successfully!');
      })
      .catch(error => console.error('Error syncing offline bills:', error));
  }

  // Fetch and restore Sales History directly from Google Sheets if LocalStorage is empty or cleared
  function fetchSalesHistoryFromSheets() {
    const existingHistory = getSalesHistoryFromStorage();
    if (existingHistory && existingHistory.length > 0) {
      // LocalStorage already has sales history
      return;
    }

    let scriptURL = "AKfycbxwrG_yNWNZ0iP7Ajp9G20_SSEj2D9ZJd-GIFyBYy4MLHTSElgITnHzr54ZFbCztDHP";
    if (!scriptURL.startsWith('http')) {
      scriptURL = 'https://script.google.com/macros/s/' + scriptURL + '/exec';
    }

    if (!navigator.onLine) return;

    fetch(scriptURL)
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch sales history from Google Sheets');
        return response.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const restoredRecords = data.map(item => {
            const billNo = item.billNo || item.id || generateInvoiceNumber();
            const dateTimeStr = item.dateTime || item.timestamp || '';
            const dateParts = dateTimeStr.split(' ');
            const dateVal = item.date || dateParts[0] || getTodayDateString();
            const timeVal = item.displayTime || dateParts.slice(1).join(' ') || '';

            return {
              id: billNo,
              billNo: billNo,
              date: dateVal,
              timestamp: item.timestamp || dateTimeStr || new Date().toISOString(),
              displayDate: item.displayDate || formatDateForInvoice(dateVal),
              displayTime: timeVal,
              paymentMode: item.paymentMode || 'Cash',
              itemsCount: parseInt(item.totalItems || item.itemsCount || 0, 10),
              totalItems: parseInt(item.totalItems || item.itemsCount || 0, 10),
              totalMRP: parseFloat(item.totalMRP || 0),
              totalSavings: parseFloat(item.discount || item.totalSavings || 0),
              discountAmount: parseFloat(item.discount || item.totalSavings || 0),
              netPayable: parseFloat(item.netAmount || item.netPayable || 0),
              netAmount: parseFloat(item.netAmount || item.netPayable || 0),
              itemsSummary: item.itemsSummary || '',
              items: item.items || []
            };
          });

          localStorage.setItem('sivakasi_sales_history', JSON.stringify(restoredRecords));
          localStorage.setItem('salesHistory', JSON.stringify(restoredRecords));

          renderSalesHistory();
          showToast('Sales history restored from Google Sheets!');
        }
      })
      .catch(error => {
        console.error('Error fetching sales history from Google Sheets:', error);
      });
  }

  function saveToSalesHistory() {
    return saveCurrentInvoiceToHistory();
  }

  // Save current active invoice to localStorage sales history
  function saveCurrentInvoiceToHistory() {
    const selectedItems = [];
    let totalItems = 0;
    let totalActualMRP = 0;
    let netPayable = 0;

    Object.keys(state.cart).forEach(id => {
      const qty = state.cart[id];
      const item = findItemById(id);
      if (item && qty > 0) {
        totalItems += qty;
        totalActualMRP += (item.mrp * qty);
        netPayable += (item.price * qty);
        selectedItems.push({
          code: item.code,
          name: item.name,
          tamilName: item.tamilName,
          unit: item.unit,
          qty: qty,
          mrp: item.mrp,
          rate: item.price,
          total: qty * item.price
        });
      }
    });

    if (selectedItems.length === 0) return; // Do not save empty bills

    const totalSavings = totalActualMRP - netPayable;
    const now = new Date();

    const historyRecord = {
      id: state.invoice.invoiceNo || generateInvoiceNumber(),
      billNo: state.invoice.invoiceNo || generateInvoiceNumber(),
      date: state.invoice.date,
      timestamp: now.toISOString(),
      displayDate: formatDateForInvoice(state.invoice.date),
      displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      paymentMode: state.invoice.paymentMode || 'Cash',
      itemsCount: totalItems,
      totalItems: totalItems,
      totalMRP: totalActualMRP,
      totalSavings: totalSavings,
      discountAmount: totalSavings,
      netPayable: netPayable,
      netAmount: netPayable,
      items: selectedItems,
      cart: JSON.parse(JSON.stringify(state.cart))
    };

    let history = getSalesHistoryFromStorage();
    const existingIndex = history.findIndex(h => h.id === historyRecord.id);
    if (existingIndex >= 0) {
      history[existingIndex] = historyRecord;
    } else {
      history.unshift(historyRecord);
    }

    try {
      localStorage.setItem('sivakasi_sales_history', JSON.stringify(history));
      localStorage.setItem('salesHistory', JSON.stringify(history));
    } catch (e) {
      console.error('Error saving sales history:', e);
    }

    // Send bill data asynchronously to Google Sheets
    sendToGoogleSheets(historyRecord);
  }

  function renderSalesHistory() {
    const allHistory = getSalesHistoryFromStorage();
    const filteredHistory = filterHistoryByRange(allHistory, activeHistoryRange, historyDateInput ? historyDateInput.value : '');

    let totalCount = filteredHistory.length;
    let totalRevenue = 0;
    filteredHistory.forEach(h => totalRevenue += (h.netPayable || 0));

    if (histTotalCount) histTotalCount.textContent = totalCount;
    if (histTotalRevenue) histTotalRevenue.textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;

    if (!historyTableBody) return;

    if (filteredHistory.length === 0) {
      historyTableBody.innerHTML = `
        <tr class="history-empty-row">
          <td colspan="6">
            📜 No sales history records found for the selected date filter.<br>
            Generate, preview, or download bills to populate sales history!
          </td>
        </tr>
      `;
      return;
    }

    let rowsHTML = '';
    filteredHistory.forEach(h => {
      rowsHTML += `
        <tr>
          <td><strong style="font-family: monospace; color: var(--sivakasi-purple-dark);">${h.id}</strong></td>
          <td>
            ${h.displayDate || h.date} 
            <span style="font-size: 0.7rem; color: #64748b; font-weight: 500;">(${h.displayTime || ''})</span>
          </td>
          <td class="text-center" style="font-weight: 700;">${h.itemsCount || 0}</td>
          <td><span style="font-size: 0.72rem; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${h.paymentMode || 'Cash'}</span></td>
          <td class="text-right" style="font-weight: 800; color: #059669;">₹${(h.netPayable || 0).toLocaleString('en-IN')}</td>
          <td class="text-center">
            <div class="history-actions">
              <button class="btn btn-purple btn-xs btn-view-hist" data-id="${h.id}">View Bill</button>
              <button class="btn btn-outline-danger btn-xs btn-delete-hist" data-id="${h.id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    });

    historyTableBody.innerHTML = rowsHTML;
    attachHistoryTableListeners();
  }

  function filterHistoryByRange(history, range, customDateVal) {
    if (range === 'custom' && customDateVal) {
      return history.filter(h => h.date === customDateVal);
    }

    const todayStr = getTodayDateString();
    const todayDate = new Date();

    if (range === 'today') {
      return history.filter(h => h.date === todayStr);
    } else if (range === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(todayDate.getDate() - 7);
      return history.filter(h => new Date(h.date || h.timestamp) >= oneWeekAgo);
    } else if (range === 'month') {
      const currentYearMonth = todayStr.substring(0, 7); // YYYY-MM
      return history.filter(h => h.date && h.date.startsWith(currentYearMonth));
    }

    return history; // 'all'
  }

  function attachHistoryTableListeners() {
    document.querySelectorAll('.btn-view-hist').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const allHistory = getSalesHistoryFromStorage();
        const record = allHistory.find(h => h.id === id);
        if (record) {
          state.invoice.invoiceNo = record.id;
          state.invoice.date = record.date;
          state.invoice.paymentMode = record.paymentMode;
          state.cart = JSON.parse(JSON.stringify(record.cart || {}));

          if (invDateInput) invDateInput.value = record.date;
          if (paymentModeInput) paymentModeInput.value = record.paymentMode;

          renderOrderTable();
          updateCalculations();
          closeSalesHistoryModal();
          setTimeout(() => {
            showToast(`Loaded Bill ${record.id}`);
          }, 250);
        }
      });
    });

    document.querySelectorAll('.btn-delete-hist').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        if (confirm(`Are you sure you want to delete Bill ${id} from sales history?`)) {
          let allHistory = getSalesHistoryFromStorage();
          allHistory = allHistory.filter(h => h.id !== id);
          localStorage.setItem('sivakasi_sales_history', JSON.stringify(allHistory));
          renderSalesHistory();
          showToast(`Deleted Bill ${id}`);
        }
      });
    });
  }

  // Download PDF Function - Universal Multi-Page PDF Capture directly from #invoice-template
  function downloadPDF() {
    const invoiceTemplate = document.getElementById('invoice-template');
    if (!invoiceTemplate) return;

    showToast('Generating Crackers_Invoice.pdf...');

    if (typeof html2pdf === 'undefined') {
      window.print();
      return;
    }

    const generate = () => {
      const opt = {
        margin:       [4, 4, 4, 4],
        filename:     'Crackers_Invoice.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          scrollY: 0,
          scrollX: 0
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'] }
      };

      html2pdf().set(opt).from(invoiceTemplate).save().then(() => {
        showToast('PDF downloaded successfully!');
      }).catch(err => {
        console.error('PDF export error:', err);
        window.print();
      });
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(generate);
    } else {
      generate();
    }
  }

  // Load Preset Demo Order Data
  function loadDemoData() {
    state.cart = {
      'spk-02': 2, // 10 cm Electric Sparklers x 2
      'flp-03': 1, // Flower Pots Special x 1
      'chk-03': 2, // Ground Chakkara Deluxe x 2
      'rkt-02': 1, // Bomb Rocket x 1
      'sky-01': 1  // 7 Shots Aerial x 1
    };
    renderOrderTable();
    updateCalculations();
    showToast('Loaded sample Sivakasi order!');
  }

  // Render Interactive Crackers Table with ITEM CODE
  function renderOrderTable() {
    if (!orderTableBody) return;

    let rowsHTML = '';

    CRACKERS_CATALOG.forEach(cat => {
      if (state.activeCategory !== 'ALL' && state.activeCategory !== cat.category) {
        return;
      }

      rowsHTML += `
        <tr class="category-banner-row">
          <td colspan="7">
            <div class="category-banner-content">
              <span class="category-title">🔥 ${cat.category}</span>
              <span style="font-size: 0.75rem; font-weight: 600;">FACTORY DISCOUNT APPLIED</span>
            </div>
          </td>
        </tr>
      `;

      cat.items.forEach(item => {
        const qty = state.cart[item.id] || 0;
        const total = qty * item.price;
        const hasQtyClass = qty > 0 ? 'has-qty' : '';

        rowsHTML += `
          <tr class="item-row ${hasQtyClass}" data-id="${item.id}">
            <td class="col-code">
              ${item.code}
            </td>
            <td class="col-name">
              ${item.name}
              <span class="tamil-sub">${item.tamilName}</span>
            </td>
            <td class="col-mrp">
              <span class="unit-tag">${item.unit}</span>
              <span class="mrp-struck">₹${item.mrp.toLocaleString('en-IN')}</span>
            </td>
            <td class="col-price">
              ₹${item.price.toLocaleString('en-IN')}
            </td>
            <td class="col-qty">
              <div class="qty-control">
                <button type="button" class="qty-btn btn-minus" data-id="${item.id}">-</button>
                <input type="number" class="qty-input" data-id="${item.id}" value="${qty}" min="0" max="999">
                <button type="button" class="qty-btn btn-plus" data-id="${item.id}">+</button>
              </div>
            </td>
            <td class="col-total">
              ₹${total.toLocaleString('en-IN')}
            </td>
          </tr>
        `;
      });
    });

    orderTableBody.innerHTML = rowsHTML;
    attachTableListeners();
  }

  // Attach Event Listeners to Quantity Inputs & Stepper Buttons
  function attachTableListeners() {
    document.querySelectorAll('.btn-minus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const currentQty = state.cart[id] || 0;
        if (currentQty > 0) {
          state.cart[id] = currentQty - 1;
          if (state.cart[id] === 0) delete state.cart[id];
          updateRowUI(id);
          updateCalculations();
        }
      });
    });

    document.querySelectorAll('.btn-plus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const currentQty = state.cart[id] || 0;
        state.cart[id] = currentQty + 1;
        updateRowUI(id);
        updateCalculations();
      });
    });

    document.querySelectorAll('.qty-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 0) val = 0;
        
        if (val === 0) {
          delete state.cart[id];
        } else {
          state.cart[id] = val;
        }
        updateRowUI(id);
        updateCalculations();
      });

      input.addEventListener('focus', (e) => {
        e.target.select();
      });
    });
  }

  // Fast Row UI update without re-rendering entire table DOM
  function updateRowUI(productId) {
    const row = document.querySelector(`tr[data-id="${productId}"]`);
    if (!row) return;

    const qty = state.cart[productId] || 0;
    const item = findItemById(productId);
    if (!item) return;

    const input = row.querySelector('.qty-input');
    if (input && parseInt(input.value, 10) !== qty) {
      input.value = qty;
    }

    const colTotal = row.querySelector('.col-total');
    if (colTotal) {
      colTotal.textContent = `₹${(qty * item.price).toLocaleString('en-IN')}`;
    }

    if (qty > 0) {
      row.classList.add('has-qty');
    } else {
      row.classList.remove('has-qty');
    }
  }

  function findItemById(id) {
    for (const cat of CRACKERS_CATALOG) {
      const item = cat.items.find(i => i.id === id);
      if (item) return item;
    }
    return null;
  }

  // Recalculate Totals & Update Live Invoice Sheet
  function updateCalculations() {
    let totalItems = 0;
    let totalActualMRP = 0;
    let netPayable = 0;

    Object.keys(state.cart).forEach(id => {
      const qty = state.cart[id];
      const item = findItemById(id);
      if (item && qty > 0) {
        totalItems += qty;
        totalActualMRP += (item.mrp * qty);
        netPayable += (item.price * qty);
      }
    });

    const totalSavings = totalActualMRP - netPayable;

    // Update Summary Bar
    if (statTotalItems) statTotalItems.textContent = totalItems;
    if (statTotalMRP) statTotalMRP.textContent = `₹${totalActualMRP.toLocaleString('en-IN')}`;
    if (statTotalSavings) statTotalSavings.textContent = `₹${totalSavings.toLocaleString('en-IN')}`;
    if (statNetPayable) statNetPayable.textContent = `₹${netPayable.toLocaleString('en-IN')}`;

    // Update Right Panel Live A4 Invoice Sheet
    renderLiveInvoice(totalActualMRP, totalSavings, netPayable);
  }

  // Render Multi-Page Paginated Live A4 Invoice Sheet (27 items per page max)
  function renderLiveInvoice(totalActualMRP = 0, totalSavings = 0, netPayable = 0) {
    const invoiceTemplate = document.getElementById('invoice-template');
    if (!invoiceTemplate) return;

    const selectedItems = [];
    let srNo = 1;

    Object.keys(state.cart).forEach(id => {
      const qty = state.cart[id];
      const item = findItemById(id);
      if (item && qty > 0) {
        selectedItems.push({
          srNo: srNo++,
          code: item.code,
          name: item.name,
          tamilName: item.tamilName,
          unit: item.unit,
          qty: qty,
          mrp: item.mrp,
          rate: item.price,
          total: qty * item.price
        });
      }
    });

    const ITEMS_PER_PAGE = 27;
    const totals = { totalActualMRP, totalSavings, netPayable };
    let fullInvoiceHTML = '';

    if (selectedItems.length === 0) {
      fullInvoiceHTML = renderInvoicePage([], 1, 1, totals);
    } else {
      const totalPages = Math.ceil(selectedItems.length / ITEMS_PER_PAGE);
      for (let p = 1; p <= totalPages; p++) {
        const startIndex = (p - 1) * ITEMS_PER_PAGE;
        const pageItems = selectedItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
        fullInvoiceHTML += renderInvoicePage(pageItems, p, totalPages, totals);
      }
    }

    invoiceTemplate.innerHTML = fullInvoiceHTML;
  }

  function renderInvoicePage(pageItems, pageNum, totalPages, totals) {
    const isLastPage = pageNum === totalPages;
    const dateStr = formatDateForInvoice(state.invoice.date);
    const billNo = state.invoice.invoiceNo || 'SURYA-2026-1001';
    const payMode = state.invoice.paymentMode || 'Cash';

    let tableRowsHTML = '';
    if (pageItems.length === 0) {
      tableRowsHTML = `
        <tr>
          <td colspan="6">
            <div class="inv-empty-msg">
              🛒 No crackers selected yet.<br>
              Add item quantities in the table on the left to see your live A4 bill preview!
            </div>
          </td>
        </tr>
      `;
    } else {
      pageItems.forEach(item => {
        tableRowsHTML += `
          <tr>
            <td class="text-center" style="font-weight: 600;">${item.srNo}</td>
            <td>
              <strong>${item.name}</strong> <span style="font-size: 0.68rem; color: #64748b; font-family: monospace;">(#${item.code})</span>
              <div style="font-size: 0.68rem; color: #475569; font-family: 'Noto Sans Tamil', sans-serif;">${item.tamilName}</div>
            </td>
            <td class="text-center col-packing">${item.unit}</td>
            <td class="text-center" style="font-weight: 700;">${item.qty}</td>
            <td class="text-right">₹${item.rate.toLocaleString('en-IN')}</td>
            <td class="text-right" style="font-weight: 700;">₹${item.total.toLocaleString('en-IN')}</td>
          </tr>
        `;
      });
    }

    let footerSectionHTML = '';
    if (isLastPage) {
      footerSectionHTML = `
        <footer class="inv-footer-section invoice-footer">
          <div class="inv-totals-grid">
            <div class="inv-words-box">
              <strong>Amount in Words:</strong>
              <span>${totals.netPayable > 0 ? `${numberToWords(totals.netPayable)} Only` : 'Rupees Zero Only'}</span>
            </div>

            <div class="inv-amounts-box">
              <div class="amount-row">
                <span>Total MRP Price:</span>
                <span>₹${totals.totalActualMRP.toLocaleString('en-IN')}</span>
              </div>
              <div class="amount-row savings">
                <span>Direct Factory Discount (80%):</span>
                <span>- ₹${totals.totalSavings.toLocaleString('en-IN')}</span>
              </div>
              <div class="amount-row grand-total">
                <span>NET PAYABLE:</span>
                <span>₹${totals.netPayable.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          <div class="inv-bottom-terms">
            <div>
              <strong style="color: #1e293b;">Terms & Conditions:</strong><br>
              1. Goods once sold will not be taken back or exchanged.<br>
              2. Store crackers in a cool, dry place away from flame.<br>
              3. Subject to Sivakasi Jurisdiction only.
            </div>
            <div class="signatory-box">
              <div>For <strong>Surya Crackers</strong></div>
              <div class="sign-line">Authorized Signatory</div>
            </div>
          </div>
          <div class="inv-page-num text-right" style="font-size: 0.65rem; color: #94a3b8; margin-top: 4px;">
            Page ${pageNum} of ${totalPages}
          </div>
        </footer>
      `;
    } else {
      footerSectionHTML = `
        <footer class="inv-footer-section inv-footer-continued invoice-footer">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: #64748b; font-weight: 600; padding-top: 6px; border-top: 1px dashed #cbd5e1;">
            <span>⏩ Continued on Page ${pageNum + 1}...</span>
            <span>Page ${pageNum} of ${totalPages}</span>
          </div>
        </footer>
      `;
    }

    const sheetId = pageNum === 1 ? 'id="printableA4Bill"' : '';

    return `
      <div class="a4-sheet compact-bill invoice-page" ${sheetId} data-page="${pageNum}">
        <header class="inv-header">
          <div class="inv-brand-row">
            <div>
              <div class="inv-company-name">SURYA CRACKERS</div>
              <div class="inv-company-sub">Direct Sivakasi Crackers Manufacturer & Whole Seller</div>
              <div class="inv-company-contact">
                📍 3/1234/4C, Paraipatti Check Post, Viswanatham, Sivakasi - 626 189, Tamil Nadu<br>
                📞 Mobile: +91 97862 18428 / 96292 68023
              </div>
            </div>
            <div class="inv-badge-title">TAX INVOICE</div>
          </div>

          <div class="inv-meta-grid">
            <div class="inv-meta-block">
              <strong>BILL INFORMATION:</strong>
              <p><strong>Date:</strong> <span>${dateStr}</span></p>
              <p><strong>Payment Mode:</strong> <span>${payMode}</span></p>
            </div>
            <div class="inv-meta-block" style="text-align: right;">
              <strong>BILL DETAILS:</strong>
              <p><strong>Bill No:</strong> <span style="font-family: monospace; font-weight: 700;">${billNo}</span></p>
            </div>
          </div>
        </header>

        <div class="inv-table-wrapper">
          <table class="inv-table">
            <thead>
              <tr>
                <th style="width: 32px;" class="text-center">S.No</th>
                <th>Item Description</th>
                <th style="width: 80px;" class="text-center">Packing</th>
                <th style="width: 45px;" class="text-center">Qty</th>
                <th style="width: 70px;" class="text-right">Rate (₹)</th>
                <th style="width: 80px;" class="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHTML}
            </tbody>
          </table>
        </div>

        ${footerSectionHTML}
      </div>
    `;
  }

  // Indian Currency Number to Words Converter
  function numberToWords(amount) {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function inWords(num) {
      if ((num = num.toString()).length > 9) return 'overflow';
      const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
      if (!n) return '';
      let str = '';
      str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
      str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
      str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
      str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
      str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
      return str.trim();
    }

    const words = inWords(amount);
    return words ? `Rupees ${words}` : 'Rupees Zero';
  }

  // Toast Notification Helper
  function showToast(message) {
    let toast = document.getElementById('toastNotification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastNotification';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `✨ <span>${message}</span>`;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
});
