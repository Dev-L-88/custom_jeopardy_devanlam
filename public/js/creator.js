// --- NEW: GLOBAL DATABASE INITIALIZATION WRAPPER ---
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("JeopardyGameStorage", 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("boards")) {
        db.createObjectStore("boards", { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

// Track the current dynamic state of the layout structure
let currentCols = 5;
let currentRows = 5;
let defaultRowValues = [200, 400, 600, 800, 1000];

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const boardId = urlParams.get('boardId');

  if (boardId) {
    await loadBoardDataForEditing(boardId);
  } else {
    // Render default baseline grid if building fresh
    renderEditorGrid();
  }
});

// --- FIXED: CAPTURES DATA CLEANLY WITH NO EMPTY STORAGE SLOTS ---
function captureCurrentDOMState() {
  const titleField = document.getElementById("board-title") || document.getElementById("board-title-input");
  const title = titleField ? titleField.value.trim() : "";

  const state = {
    title: title,
    categories: []
  };

  // Build a perfectly solid, non-sparse structure column by column, row by row
  for (let col = 0; col < currentCols; col++) {
    const input = document.querySelector(`.category-input[data-col="${col}"]`);
    
    const categoryObj = {
      name: input ? input.value.trim() : `Category ${col + 1}`,
      clues: []
    };

    for (let row = 0; row < currentRows; row++) {
      const card = document.querySelector(`.clue-input-card[data-col="${col}"][data-row="${row}"]`);
      
      let cellValue = defaultRowValues[row] || ((row + 1) * 200);
      let questionText = "";
      let answerText = "";
      let qImg = "";
      let aImg = "";

      if (card) {
        const valInput = card.closest('.clue-card').querySelector('.clue-value-input');
        cellValue = valInput ? parseInt(valInput.value) || 0 : 0;
        questionText = card.querySelector('.clue-question-input').value.trim();
        answerText = card.querySelector('.clue-answer-input').value.trim();
        qImg = card.querySelector('.clue-image-base64').value;
        aImg = card.querySelector('.clue-answer-image-base64').value;
      }

      categoryObj.clues.push({
        value: cellValue,
        question: questionText,
        answer: answerText,
        image: qImg,
        answerImage: aImg
      });
    }

    state.categories.push(categoryObj);
  }

  return state;
}

// --- DYNAMIC MATRIX RENDER ---
function renderEditorGrid(existingState = null) {
  const container = document.getElementById("matrix-builder");
  if (!container) return;
  container.innerHTML = ""; 

  // Update DOM control displays
  const colDisplay = document.getElementById("col-count-display");
  const rowDisplay = document.getElementById("row-count-display");
  if (colDisplay) colDisplay.innerText = currentCols;
  if (rowDisplay) rowDisplay.innerText = currentRows;

  // Set up CSS grid columns dynamically based on counter variable
  container.style.gridTemplateColumns = `repeat(${currentCols}, 1fr)`;

  // 1. Generate Dynamic Headers
  for (let col = 0; col < currentCols; col++) {
    const headerDiv = document.createElement("div");
    headerDiv.className = "category-header";
    let catName = `Category ${col + 1}`;
    
    if (existingState && existingState.categories && existingState.categories[col]) {
      catName = existingState.categories[col].name;
    }

    headerDiv.innerHTML = `
      <input type="text" class="category-input" data-col="${col}" placeholder="${catName}" value="${catName}">
    `;
    container.appendChild(headerDiv);
  }

  // 2. Generate Clue Grid Cards
  for (let rowIndex = 0; rowIndex < currentRows; rowIndex++) {
    for (let colIndex = 0; colIndex < currentCols; colIndex++) {
      const cardDiv = document.createElement("div");
      cardDiv.className = "clue-card";
      
      let cellValue = defaultRowValues[rowIndex] || ((rowIndex + 1) * 200);
      let questionText = "";
      let answerText = "";
      let qImg = "";
      let aImg = "";

      // Hydrate cell data safely if previous structural states match up
      if (existingState && existingState.categories && existingState.categories[colIndex] && existingState.categories[colIndex].clues && existingState.categories[colIndex].clues[rowIndex]) {
        const targetClue = existingState.categories[colIndex].clues[rowIndex];
        cellValue = targetClue.value !== undefined ? targetClue.value : cellValue;
        questionText = targetClue.question || "";
        answerText = targetClue.answer || "";
        qImg = targetClue.image || "";
        aImg = targetClue.answerImage || "";
      }
      
      cardDiv.innerHTML = `
        <div class="clue-value-container" style="margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 4px;">
          <span style="color: #00f5ff; font-weight: bold; font-size: 14px;">$</span>
          <input type="number" class="clue-value-input" value="${cellValue}" style="width: 70px; background: #0b0d19; border: 1px solid #222846; color: #fff; text-align: center; font-weight: bold; font-size: 14px; border-radius: 4px; padding: 2px;">
        </div>
        
        <div class="clue-input-card" data-col="${colIndex}" data-row="${rowIndex}">
          <label>PROMPT / QUESTION</label>
          <textarea class="clue-question-input">${questionText}</textarea>
          
          <div class="image-uploader-container question-img-container" style="margin-top: 5px; margin-bottom: 15px; text-align: left;">
            <label style="display: block; font-size: 11px; color: #00f5ff; font-weight: bold; margin-bottom: 4px;">OPTIONAL IMAGE (QUESTION)</label>
            <div style="display: flex; gap: 10px; align-items: center;">
              <input type="file" class="clue-image-file" accept="image/*" style="display: none;" onchange="previewSelectedImage(this)">
              <button type="button" onclick="this.previousElementSibling.click()" class="btn btn-cyan" style="padding: 4px 12px; font-size: 16px; font-weight: bold; margin: 0;">+</button>
              <span class="image-status-label" style="font-size: 12px; color: #b0b5c6; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${qImg ? 'Saved image loaded' : 'No image attached'}</span>
              <button type="button" class="clear-image-btn" onclick="clearAttachedImage(this)" style="display: ${qImg ? 'inline-block' : 'none'}; background: transparent; border: none; color: #d9534f; cursor: pointer; font-size: 12px; padding: 0;">✕ Clear</button>
            </div>
            <div class="image-preview-wrapper" style="margin-top: 8px; display: ${qImg ? 'block' : 'none'};">
              <img class="clue-image-preview" src="${qImg || ''}" style="max-height: 60px; max-width: 100%; border: 1px solid #00f5ff; border-radius: 4px; display: block;">
            </div>
            <input type="hidden" class="clue-image-base64" value="${qImg}">
          </div>

          <label>ANSWER KEY</label>
          <input type="text" class="clue-answer-input" value="${answerText}">
          
          <div class="image-uploader-container answer-img-container" style="margin-top: 10px; text-align: left;">
            <label style="display: block; font-size: 11px; color: #ffff00; font-weight: bold; margin-bottom: 4px;">OPTIONAL IMAGE (ANSWER)</label>
            <div style="display: flex; gap: 10px; align-items: center;">
              <input type="file" class="clue-image-file" accept="image/*" style="display: none;" onchange="previewSelectedImage(this)">
              <button type="button" onclick="this.previousElementSibling.click()" class="btn btn-cyan" style="padding: 4px 12px; font-size: 16px; font-weight: bold; margin: 0; background-color: #ffff00; color: #000000; border-color: #ffff00;">+</button>
              <span class="image-status-label" style="font-size: 12px; color: #b0b5c6; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${aImg ? 'Saved image loaded' : 'No image attached'}</span>
              <button type="button" class="clear-image-btn" onclick="clearAttachedImage(this)" style="display: ${aImg ? 'inline-block' : 'none'}; background: transparent; border: none; color: #d9534f; cursor: pointer; font-size: 12px; padding: 0;">✕ Clear</button>
            </div>
            <div class="image-preview-wrapper" style="margin-top: 8px; display: ${aImg ? 'block' : 'none'};">
              <img class="clue-image-preview" src="${aImg || ''}" style="max-height: 60px; max-width: 100%; border: 1px solid #ffff00; border-radius: 4px; display: block;">
            </div>
            <input type="hidden" class="clue-answer-image-base64" value="${aImg}">
          </div>
        </div>
      `;
      container.appendChild(cardDiv);
    }
  }
}

// --- BUTTON TRIGGERS FOR ROW/COL ADJUSTMENTS ---
function adjustColumns(amount) {
  const nextCols = currentCols + amount;
  if (nextCols < 1 || nextCols > 9) return alert("Keep board configurations within 1 to 9 columns.");
  
  const savedState = captureCurrentDOMState();
  currentCols = nextCols;
  renderEditorGrid(savedState);
}

function adjustRows(amount) {
  const nextRows = currentRows + amount;
  if (nextRows < 1 || nextRows > 6) return alert("Keep board configurations within 1 to 6 rows.");
  
  const savedState = captureCurrentDOMState();
  currentRows = nextRows;
  renderEditorGrid(savedState);
}

// --- FIXED: SAVE ACTION WITH PROPER CONTEXT TRANSACTIONS ---
async function saveCurrentBoard() {
  const titleField = document.getElementById("board-title") || document.getElementById("board-title-input");
  const title = titleField ? titleField.value.trim() : "";
  
  if (!title) return alert("Please give your board a title before saving!");

  const cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, "");
  const boardId = cleanTitle.toLowerCase().trim().replace(/\s+/g, '-');
  if (!boardId) return alert("Please include at least one letter or number in your title.");

  const boardState = captureCurrentDOMState();
  
  const boardData = { 
    id: boardId, 
    title: title, 
    colsCount: currentCols,
    rowsCount: currentRows,
    categories: boardState.categories 
  };

  try {
    const db = await openDB();
    const transaction = db.transaction("boards", "readwrite");
    const store = transaction.objectStore("boards");
    
    const request = store.put(boardData);
    
    request.onsuccess = () => {
      alert(`Board "${title}" saved cleanly with custom dimensions!`);
    };

    transaction.onerror = (err) => {
      console.error("Transaction Error:", err);
      alert("Database rejected saving changes.");
    };
  } catch (error) {
    console.error("IndexedDB Exception Context Handler:", error);
    alert("Failed to save board layout due to a storage exception.");
  }
}

// --- RESTORES CUSTOM MATRIX SIZES ---
async function loadBoardDataForEditing(boardId) {
  try {
    const db = await openDB();
    const transaction = db.transaction("boards", "readonly");
    const store = transaction.objectStore("boards");
    const request = store.get(boardId);

    request.onsuccess = () => {
      const board = request.result;
      if (!board) return alert("Saved board configuration layout not found.");

      const titleField = document.getElementById("board-title") || document.getElementById("board-title-input");
      if (titleField) titleField.value = board.title;

      currentCols = board.colsCount || (board.categories ? board.categories.length : 5);
      currentRows = board.rowsCount || (board.categories && board.categories[0] && board.categories[0].clues ? board.categories[0].clues.length : 5);

      renderEditorGrid(board);
    };
  } catch (error) {
    console.error("Failed to load board from IndexedDB:", error);
  }
}

// --- IMAGE SELECTION AND PREVIEW CONTROLLER UTILITIES ---
function previewSelectedImage(inputElement) {
  const file = inputElement.files[0];
  if (!file) return;

  const container = inputElement.closest('.image-uploader-container');
  const statusLabel = container.querySelector('.image-status-label');
  const previewWrapper = container.querySelector('.image-preview-wrapper');
  const previewImg = container.querySelector('.clue-image-preview');
  const hiddenInput = container.querySelector('input[type="hidden"]');

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64String = e.target.result;
    if (hiddenInput) hiddenInput.value = base64String;
    if (previewImg) previewImg.src = base64String;
    if (previewWrapper) previewWrapper.style.display = 'block';
    if (statusLabel) statusLabel.innerText = 'Image attached successfully';
    
    const clearBtn = container.querySelector('.clear-image-btn');
    if (clearBtn) clearBtn.style.display = 'inline-block';
  };
  reader.readAsDataURL(file);
}

function clearAttachedImage(buttonElement) {
  const container = buttonElement.closest('.image-uploader-container');
  const fileInput = container.querySelector('.clue-image-file');
  const statusLabel = container.querySelector('.image-status-label');
  const previewWrapper = container.querySelector('.image-preview-wrapper');
  const previewImg = container.querySelector('.clue-image-preview');
  const hiddenInput = container.querySelector('input[type="hidden"]');

  if (fileInput) fileInput.value = "";
  if (hiddenInput) hiddenInput.value = "";
  if (previewImg) previewImg.src = "";
  if (previewWrapper) previewWrapper.style.display = 'none';
  if (statusLabel) statusLabel.innerText = 'No image attached';
  buttonElement.style.display = 'none';
}

// --- DELETE FUNCTIONALITY WRAPPERS ---
function openDeleteModal() {
  const modal = document.getElementById('delete-modal');
  if (modal) modal.style.display = 'flex';
}

function closeDeleteModal() {
  const modal = document.getElementById('delete-modal');
  if (modal) modal.style.display = 'none';
}

async function executePermanentDelete() {
  const urlParams = new URLSearchParams(window.location.search);
  let boardId = urlParams.get('boardId');

  if (!boardId) {
    const titleField = document.getElementById("board-title") || document.getElementById("board-title-input");
    const title = titleField ? titleField.value.trim() : "";
    const cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, "");
    boardId = cleanTitle.toLowerCase().trim().replace(/\s+/g, '-');
  }

  closeDeleteModal();

  try {
    const db = await openDB();
    const transaction = db.transaction("boards", "readwrite");
    const store = transaction.objectStore("boards");
    
    const request = store.delete(boardId);
    
    request.onsuccess = () => {
      alert("Board configuration deleted successfully!");
      window.location.href = "/";
    };
  } catch (error) {
    alert("Could not complete deletion due to a database access issue.");
  }
}