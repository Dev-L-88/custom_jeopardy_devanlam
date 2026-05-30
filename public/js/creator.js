const rowValues = [200, 400, 600, 800, 1000];

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Render the base blank grid structure first
  renderEditorGrid();

  // 2. Check if we are in "Edit Mode" by looking for ?boardId= in the address bar
  const urlParams = new URLSearchParams(window.location.search);
  const boardId = urlParams.get('boardId');

  if (boardId) {
    await loadBoardDataForEditing(boardId);
  }
});

function renderEditorGrid() {
  const container = document.getElementById("matrix-builder");
  container.innerHTML = ""; 

  // Generate Category Name Headers (Row 0)
  for (let col = 0; col < 5; col++) {
    const headerDiv = document.createElement("div");
    headerDiv.className = "category-header";
    headerDiv.innerHTML = `
      <input type="text" class="category-input" data-col="${col}" placeholder="Category ${col + 1}" value="Category ${col + 1}">
    `;
    container.appendChild(headerDiv);
  }

  // Generate Clue Matrix Grid Cards
  rowValues.forEach((value, rowIndex) => {
    for (let col = 0; col < 5; col++) {
      const cardDiv = document.createElement("div");
      cardDiv.className = "clue-card";
      
      cardDiv.innerHTML = `
        <p class="clue-value">$${value}</p>
        
        <div class="clue-input-card" data-col="${col}" data-row="${rowIndex}" data-val="${value}">
          <label>PROMPT / QUESTION</label>
          <textarea class="clue-question-input"></textarea>
          
          <label>ANSWER KEY</label>
          <input type="text" class="clue-answer-input">
          
          <div class="image-uploader-container" style="margin-top: 10px; text-align: left;">
            <label style="display: block; font-size: 11px; color: #00f5ff; font-weight: bold; margin-bottom: 4px;">OPTIONAL IMAGE</label>
            
            <div style="display: flex; gap: 10px; align-items: center;">
              <input type="file" class="clue-image-file" accept="image/*" style="display: none;" onchange="previewSelectedImage(this)">
              
              <button type="button" onclick="this.previousElementSibling.click()" class="btn btn-cyan" style="padding: 4px 12px; font-size: 16px; font-weight: bold; margin: 0;">+</button>
              
              <span class="image-status-label" style="font-size: 12px; color: #b0b5c6; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">No image attached</span>
              
              <button type="button" class="clear-image-btn" onclick="clearAttachedImage(this)" style="display: none; background: transparent; border: none; color: #d9534f; cursor: pointer; font-size: 12px; padding: 0;">✕ Clear</button>
            </div>
            
            <div class="image-preview-wrapper" style="margin-top: 8px; display: none;">
              <img class="clue-image-preview" src="" style="max-height: 60px; max-width: 100%; border: 1px solid #00f5ff; border-radius: 4px; display: block;">
            </div>
            
            <input type="hidden" class="clue-image-base64" value="">
          </div>
        </div>
      `;
      container.appendChild(cardDiv);
    }
  });
}

// --- Injecting Saved Data and Images back into inputs ---
async function loadBoardDataForEditing(boardId) {
  try {
    // Read directly from browser local storage instead of backend API
    const localBoards = JSON.parse(localStorage.getItem("jeopardy_boards") || "{}");
    const board = localBoards[boardId];

    if (!board) {
      alert("Saved board configuration layout not found in browser storage.");
      return;
    }

    // FIXED: Making sure this doesn't crash if your title element is called "board-title" or "board-title-input"
    const titleField = document.getElementById("board-title") || document.getElementById("board-title-input");
    if (titleField) titleField.value = board.title;

    // Loop through columns and inject saved category titles and fields
    board.categories.forEach((category, colIndex) => {
      const catInput = document.querySelector(`.category-input[data-col="${colIndex}"]`);
      if (catInput) catInput.value = category.name;

      // Inject individual clue queries inside this column
      category.clues.forEach((clue, rowIndex) => {
        const cardSelector = `.clue-input-card[data-col="${colIndex}"][data-row="${rowIndex}"]`;
        const card = document.querySelector(cardSelector);
        
        if (card) {
          card.querySelector('.clue-question-input').value = clue.question || "";
          card.querySelector('.clue-answer-input').value = clue.answer || "";
          
          // Re-populate images if they were previously saved
          if (clue.image && clue.image.trim() !== "") {
            card.querySelector('.clue-image-base64').value = clue.image;
            card.querySelector('.clue-image-preview').src = clue.image;
            card.querySelector('.image-preview-wrapper').style.display = "block";
            card.querySelector('.image-status-label').innerText = "Saved image loaded";
            card.querySelector('.image-status-label').style.color = "#ffff00";
            card.querySelector('.clear-image-btn').style.display = "inline-block";
          }
        }
      });
    });

  } catch (error) {
    console.error("Failed to parse board edit data payload:", error);
  }
}

// --- UPDATED SAVE FUNCTION IN CREATOR.JS ---
async function saveCurrentBoard() {
  const titleField = document.getElementById("board-title") || document.getElementById("board-title-input");
  const title = titleField ? titleField.value.trim() : "";
  
  if (!title) {
    return alert("Please give your board a title before saving!");
  }

  const boardId = title.toLowerCase().replace(/\s+/g, '-');
  const categories = [];
  
  for (let col = 0; col < 5; col++) {
    const input = document.querySelector(`.category-input[data-col="${col}"]`);
    categories[col] = {
      name: input ? input.value.trim() : `Category ${col + 1}`,
      clues: []
    };
  }

  const allCards = document.querySelectorAll(".clue-input-card");
  allCards.forEach((card) => {
    const col = parseInt(card.getAttribute("data-col"));
    const value = parseInt(card.getAttribute("data-val"));
    
    categories[col].clues.push({
      value: value,
      question: card.querySelector('.clue-question-input').value.trim(),
      answer: card.querySelector('.clue-answer-input').value.trim(),
      image: card.querySelector('.clue-image-base64').value
    });
  });

  // Pull existing boards map out of local storage
  const localBoards = JSON.parse(localStorage.getItem("jeopardy_boards") || "{}");
  
  // Insert or overwrite our newly modified board layout profile
  localBoards[boardId] = { id: boardId, title, categories };
  
  // Commit straight down to browser client data registry
  localStorage.setItem("jeopardy_boards", JSON.stringify(localBoards));

  alert(`Board "${title}" saved cleanly to your browser storage!`);
}

// --- MODAL TOGGLE WINDOW CONTROLS ---
function openDeleteModal() {
  const urlParams = new URLSearchParams(window.location.search);
  let boardId = urlParams.get('boardId');
  const titleField = document.getElementById("board-title") || document.getElementById("board-title-input");
  const title = titleField ? titleField.value.trim() : "";

  if (!boardId && !title) {
    return alert("There is no saved board configuration loaded here to delete!");
  }
  document.getElementById('delete-modal').style.display = 'flex';
}

function closeDeleteModal() {
  document.getElementById('delete-modal').style.display = 'none';
}

// --- FIXED: Delete directly from local storage map array instead of backend API ---
async function executePermanentDelete() {
  const urlParams = new URLSearchParams(window.location.search);
  let boardId = urlParams.get('boardId');

  if (!boardId) {
    const titleField = document.getElementById("board-title") || document.getElementById("board-title-input");
    const title = titleField ? titleField.value.trim() : "";
    boardId = title.toLowerCase().replace(/\s+/g, '-');
  }

  closeDeleteModal();

  // Grab local storage data registry
  const localBoards = JSON.parse(localStorage.getItem("jeopardy_boards") || "{}");
  
  if (localBoards[boardId]) {
    // Drop the property profile match completely
    delete localBoards[boardId];
    localStorage.setItem("jeopardy_boards", JSON.stringify(localBoards));
    
    alert("Board configuration deleted successfully!");
    window.location.href = "/";
  } else {
    alert("Could not complete deletion: Board profile match not found in storage.");
  }
}

// Automatically convert image payload files into manageable text string blocks
function previewSelectedImage(inputElement) {
  const file = inputElement.files[0];
  const container = inputElement.closest('.image-uploader-container');
  const statusLabel = container.querySelector('.image-status-label');
  const clearBtn = container.querySelector('.clear-image-btn');
  const previewWrapper = container.querySelector('.image-preview-wrapper');
  const previewImg = container.querySelector('.clue-image-preview');
  const hiddenInput = container.querySelector('.clue-image-base64');

  if (!file) return;

  if (file.size > 2 * 1024 * 1024) { 
    alert("This image is too large! Please choose an image smaller than 2MB.");
    inputElement.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Data = e.target.result;
    hiddenInput.value = base64Data;
    
    statusLabel.innerText = file.name;
    statusLabel.style.color = "#ffff00"; 
    clearBtn.style.display = "inline-block";
    
    previewImg.src = base64Data;
    previewWrapper.style.display = "block";
  };
  
  reader.readAsDataURL(file);
}

function clearAttachedImage(buttonElement) {
  const container = buttonElement.closest('.image-uploader-container');
  container.querySelector('.clue-image-file').value = "";
  container.querySelector('.clue-image-base64').value = "";
  container.querySelector('.image-status-label').innerText = "No image attached";
  container.querySelector('.image-status-label').style.color = "#b0b5c6";
  container.querySelector('.image-preview-wrapper').style.display = "none";
  container.querySelector('.clue-image-preview').src = "";
  buttonElement.style.display = "none";
}