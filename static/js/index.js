const categoriesContainer = document.getElementById('categories-container');
let allCategories = [];
let currentUsername = '';
let gameSearchTimeout = null;

// Update Toastify to match CSS
function showNotification(message, isSuccess = true) {
  Toastify({
    text: message,
    duration: 3000,
    close: true,
    gravity: "top",
    position: "center",
    stopOnFocus: true,
    style: {
      background: isSuccess ? "linear-gradient(135deg, #4CAF50, #388E3C)" : "linear-gradient(135deg, #F44336, #D32F2F)",
      "font-family": "'Cairo', sans-serif",
      "text-align": "center",
      "border-radius": "8px",
      "box-shadow": "0 4px 12px rgba(0,0,0,0.3)",
      "font-weight": "600",
      "direction": "rtl"
    }
  }).showToast();
}

// Fetch suggestions from server based on category type
async function fetchSuggestions(categoryId, searchTerm = '') {
  try {
    const url = `/suggestions?category_id=${encodeURIComponent(categoryId)}&search=${encodeURIComponent(searchTerm)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch suggestions');
    return await res.json();
  } catch (err) {
    console.error('Error fetching suggestions:', err);
    return [];
  }
}

// Create autocomplete dropdown
function createAutocompleteDropdown(input, categoryId, rank = null) {
  // Remove existing dropdown if any
  const existingDropdown = input.parentElement.querySelector('.autocomplete-dropdown');
  if (existingDropdown) {
    existingDropdown.remove();
  }
  
  const dropdown = document.createElement('div');
  dropdown.className = 'autocomplete-dropdown';
  dropdown.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    display: none;
  `;
  
  input.parentElement.style.position = 'relative';
  input.parentElement.appendChild(dropdown);
  
  // Function to update dropdown with suggestions
  const updateDropdown = async (search) => {
    const suggestions = await fetchSuggestions(categoryId, search);
    dropdown.innerHTML = '';
    
    if (suggestions.length === 0) {
      const noResults = document.createElement('div');
      noResults.textContent = 'لا توجد نتائج';
      noResults.style.padding = '10px';
      noResults.style.color = '#666';
      noResults.style.textAlign = 'right';
      noResults.style.direction = 'rtl';
      dropdown.appendChild(noResults);
    } else {
      suggestions.forEach(item => {
        const option = document.createElement('div');
        option.textContent = item;
        option.style.cssText = `
          padding: 8px 12px;
          cursor: pointer;
          border-bottom: 1px solid #eee;
          text-align: right;
          direction: rtl;
          font-family: 'Cairo', sans-serif;
          color: #000000;
        `;
        option.onmouseover = () => {
          option.style.background = '#f5f5f5';
        };
        option.onmouseout = () => {
          option.style.background = '';
        };
        option.onclick = () => {
          input.value = item;
          dropdown.style.display = 'none';
          validateSelectionInput(input);
          updateProgress();
        };
        dropdown.appendChild(option);
      });
    }
  };
  
  // Show/hide dropdown
  input.addEventListener('focus', async () => {
    dropdown.style.display = 'block';
    await updateDropdown(input.value);
  });
  
  input.addEventListener('blur', () => {
    // Delay hiding to allow clicking on dropdown items
    setTimeout(() => {
      dropdown.style.display = 'none';
    }, 200);
  });
  
  input.addEventListener('input', async () => {
    if (gameSearchTimeout) {
      clearTimeout(gameSearchTimeout);
    }
    
    gameSearchTimeout = setTimeout(async () => {
      await updateDropdown(input.value);
    }, 300);
  });
  
  // Handle arrow key navigation
  input.addEventListener('keydown', (e) => {
    const options = dropdown.querySelectorAll('div');
    if (options.length === 0) return;
    
    let currentIndex = -1;
    options.forEach((opt, index) => {
      if (opt.style.background === 'rgb(245, 245, 245)') {
        currentIndex = index;
      }
    });
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentIndex = (currentIndex + 1) % options.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentIndex = currentIndex <= 0 ? options.length - 1 : currentIndex - 1;
    } else if (e.key === 'Enter' && currentIndex >= 0) {
      e.preventDefault();
      options[currentIndex].click();
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none';
    }
    
    // Update highlight
    options.forEach((opt, index) => {
      opt.style.background = index === currentIndex ? '#f5f5f5' : '';
    });
  });
  
  return dropdown;
}

async function fetchCategories() {
  try {
    const res = await fetch('/categories');
    if (!res.ok) throw new Error('Failed to fetch categories');
    const categoriesData = await res.json();

    if (!Array.isArray(categoriesData)) {
      throw new Error('Invalid categories data format');
    }

    allCategories = categoriesData;
    renderCategories(allCategories);
  } catch (err) {
    showNotification('فشل في تحميل قائمة الفئات', false);
    console.error(err);
    // Fallback to default categories
    allCategories = [
      { id: 1, name_ar: "أفضل توسعة", description: "أفضل لعبة توسعة صدرت في 2025" },
      { id: 2, name_ar: "أفضل قصة", description: "أفضل قصة في لعبة صدرت في 2025" },
      { id: 3, name_ar: "أفضل توجه فني", description: "أفضل توجه فني في لعبة صدرت في 2025" },
      { id: 4, name_ar: "أفضل موسيقى", description: "أفضل موسيقى في لعبة صدرت في 2025" },
      { id: 5, name_ar: "أفضل ناشر", description: "أفضل ناشر ألعاب في 2025" },
      { id: 6, name_ar: "أفضل مفاجأة", description: "أفضل مفاجأة (لعبة/إعلان/معرض) في 2025" },
      { id: 7, name_ar: "أكبر خيبة أمل", description: "أكبر خيبة أمل (لعبة/إعلان/معرض) في 2025" },
      { id: 8, name_ar: "أكثر لعبة تتطلع لها في 2026", description: "أكثر لعبة تتطلع لها في 2026 (يلزم تواجد تأكيد رسمي)" },
      { id: 9, name_ar: "أفضل ألعاب 2025", description: "أفضل 5 ألعاب صدرت في 2025 بشكل عام" }
    ];
    renderCategories(allCategories);
  }
}

function renderCategories(categories) {
  categoriesContainer.innerHTML = '';
  categoriesContainer.classList.remove('loading');
  
  // Sort categories: Best Games 2025 first, then others
  const sortedCategories = [...categories].sort((a, b) => {
    if (a.name_ar.includes("أفضل ألعاب 2025")) return -1;
    if (b.name_ar.includes("أفضل ألعاب 2025")) return 1;
    return 0;
  });
  
  sortedCategories.forEach(category => {
    const isBestGamesCategory = category.name_ar.includes("أفضل ألعاب 2025");
    const isPublisherCategory = category.id === 5; // Category ID 5 is Best Publisher
    const templateId = isBestGamesCategory ? 'category-template-5' : 'category-template-1';
    const template = document.getElementById(templateId);
    
    const categoryCard = template.content.cloneNode(true);
    const cardElement = categoryCard.querySelector('.category-card');
    
    // Set category ID
    cardElement.dataset.categoryId = category.id;
    cardElement.dataset.isBestGames = isBestGamesCategory;
    
    // Set title and description
    const title = categoryCard.querySelector('.category-title');
    title.textContent = category.name_ar;
    
    const description = categoryCard.querySelector('.category-description');
    description.textContent = category.description || 
      (isBestGamesCategory ? 'اختر أفضل 5 ألعاب في 2025 مرتبة حسب الأفضلية (المراكز 1-3 مطلوبة، 4-5 اختيارية)' : 
       isPublisherCategory ? 'اختر أفضل ناشر ألعاب في 2025' : 'اختر اختيار واحد في هذه الفئة (اختياري)');
    
    const selectionsContainer = categoryCard.querySelector('.category-selections');
    
    if (isBestGamesCategory) {
      // Create 5 input fields for Best Games category
      for (let i = 1; i <= 5; i++) {
        const selectionDiv = document.createElement('div');
        selectionDiv.className = 'selection-field';
        
        const label = document.createElement('label');
        label.textContent = `المركز ${i}:`;
        label.setAttribute('for', `category-${category.id}-rank-${i}`);
        
        const inputContainer = document.createElement('div');
        inputContainer.className = 'input-container';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `category-${category.id}-rank-${i}`;
        input.className = 'selection-input';
        // Different placeholder for optional positions
        input.placeholder = i <= 3 ? `اكتب اسم اللعبة (مطلوب)...` : `اكتب اسم اللعبة (اختياري)...`;
        input.dataset.categoryId = category.id;
        input.dataset.rank = i;
        input.autocomplete = 'off';
        
        // Set text alignment and color
        input.style.textAlign = 'right';
        input.style.direction = 'rtl';
        input.style.color = '#000000';
        
        const icon = document.createElement('div');
        icon.className = 'selection-icon';
        icon.id = `icon-${category.id}-${i}`;
        
        inputContainer.appendChild(input);
        inputContainer.appendChild(icon);
        
        selectionDiv.appendChild(label);
        selectionDiv.appendChild(inputContainer);
        selectionsContainer.appendChild(selectionDiv);
        
        // Add autocomplete to input (always games for Best Games category)
        createAutocompleteDropdown(input, category.id, i);
        
        // Add input validation
        input.addEventListener('input', function() {
          validateSelectionInput(this);
          updateProgress();
        });
        
        input.addEventListener('blur', function() {
          validateSelectionInput(this);
        });
      }
    } else {
      // Create 1 input field for other categories
      const selectionDiv = document.createElement('div');
      selectionDiv.className = 'selection-field';
      
      const label = document.createElement('label');
      label.textContent = 'الاختيار:';
      label.setAttribute('for', `category-${category.id}-single`);
      
      const inputContainer = document.createElement('div');
      inputContainer.className = 'input-container';
      
      const input = document.createElement('input');
      input.type = 'text';
      input.id = `category-${category.id}-single`;
      input.className = 'selection-input';
      // Different placeholder for publisher category
      input.placeholder = isPublisherCategory ? `اكتب اسم الناشر (اختياري)...` : `اكتب اسم اللعبة/الاختيار (اختياري)...`;
      input.dataset.categoryId = category.id;
      input.dataset.rank = 1; // Always rank 1 for single selections
      input.autocomplete = 'off';
      
      // Set text alignment and color
      input.style.textAlign = 'right';
      input.style.direction = 'rtl';
      input.style.color = '#000000';
      
      const icon = document.createElement('div');
      icon.className = 'selection-icon';
      icon.id = `icon-${category.id}-1`;
      
      inputContainer.appendChild(input);
      inputContainer.appendChild(icon);
      
      selectionDiv.appendChild(label);
      selectionDiv.appendChild(inputContainer);
      selectionsContainer.appendChild(selectionDiv);
      
      // Add autocomplete to input (category-specific)
      createAutocompleteDropdown(input, category.id);
      
      // Add input validation
      input.addEventListener('input', function() {
        validateSelectionInput(this);
        updateProgress();
      });
      
      input.addEventListener('blur', function() {
        validateSelectionInput(this);
      });
    }
    
    categoriesContainer.appendChild(categoryCard);
  });
  
  updateProgress();
}

// Validate selection input - MODIFIED FOR OPTIONAL FIELDS
function validateSelectionInput(input) {
  const categoryId = input.dataset.categoryId;
  const rank = input.dataset.rank;
  const icon = document.getElementById(`icon-${categoryId}-${rank}`);
  const value = input.value.trim();
  const card = input.closest('.category-card');
  const isBestGamesCategory = card.dataset.isBestGames === 'true';
  
  // Check if this is a mandatory field (top 3 in Best Games category)
  const isMandatory = isBestGamesCategory && parseInt(rank) <= 3;
  
  // Clear previous state
  icon.classList.remove('visible');
  icon.removeAttribute('data-valid');
  
  // For empty optional fields
  if (value.length === 0 && !isMandatory) {
    icon.textContent = "○"; // Circle for optional empty
    icon.classList.add('visible');
    icon.setAttribute('data-valid', 'optional');
    return true; // Empty optional fields are valid
  }
  
  // For empty mandatory fields
  if (value.length === 0 && isMandatory) {
    icon.textContent = "✗";
    icon.classList.add('visible');
    icon.setAttribute('data-valid', 'false');
    return false;
  }
  
  // For filled fields
  const isValid = value.length > 1;
  
  if (isValid) {
    icon.textContent = "✓";
    icon.setAttribute('data-valid', 'true');
  } else {
    icon.textContent = "✗";
    icon.setAttribute('data-valid', 'false');
  }
  
  icon.classList.add('visible');
  return isValid;
}

// Update progress calculation - MODIFIED FOR OPTIONAL FIELDS
function updateProgress() {
  let mandatoryFields = 0;
  let filledMandatoryFields = 0;
  
  // Count all input fields
  const allInputs = document.querySelectorAll('.selection-input');
  
  allInputs.forEach(input => {
    const card = input.closest('.category-card');
    const isBestGamesCategory = card.dataset.isBestGames === 'true';
    const rank = input.dataset.rank;
    
    // Check if this is a mandatory field
    // Top 3 in Best Games category are mandatory
    // Single selections in other categories are optional
    const isMandatory = isBestGamesCategory && parseInt(rank) <= 3;
    
    if (isMandatory) {
      mandatoryFields++;
      if (input.value.trim().length > 0 && validateSelectionInput(input)) {
        filledMandatoryFields++;
      }
    }
  });
  
  const progressFill = document.getElementById('progress-fill');
  const progressPercentage = mandatoryFields > 0 ? 
    (filledMandatoryFields / mandatoryFields) * 100 : 0;
  
  // Update progress bar
  progressFill.style.width = `${progressPercentage}%`;
  
  // Update step indicators
  const steps = document.querySelectorAll('.step');
  if (filledMandatoryFields === mandatoryFields && mandatoryFields > 0) {
    steps[2].classList.add('active');
    steps[1].classList.add('active');
  } else if (filledMandatoryFields > 0) {
    steps[1].classList.add('active');
    steps[2].classList.remove('active');
  } else {
    steps[1].classList.remove('active');
    steps[2].classList.remove('active');
  }
}

async function checkNameAndProceed() {
  const usernameInput = document.getElementById('username');
  const username = usernameInput.value.trim();

  if (!username) {
    showNotification('الرجاء إدخال اسمك.', false);
    usernameInput.focus();
    return;
  }

  try {
    const response = await fetch('/check-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: username })
    });

    const data = await response.json();

    if (data.status === 'admin') {
      window.location.href = '/admin';
      return;
    } else if (data.status === 'exists') {
      // User has already voted - automatically redirect to results
      showNotification('مرحباً! لقد قمت بالتصويت مسبقاً. يتم توجيهك إلى صفحة النتائج...', true);
      
      // Delay to show the notification
      setTimeout(() => {
        window.location.href = `/results?username=${encodeURIComponent(username)}`;
      }, 1500);
      return; // IMPORTANT: Exit function here
    }
    
    // Only if user hasn't voted before, proceed to voting
    currentUsername = username;
    
    // Show voting section
    document.getElementById('name-section').classList.add('hidden');
    document.getElementById('voting-section').classList.remove('hidden');
    
    // Update progress indicator
    document.getElementById('progress-fill').style.width = '33%';
    document.querySelectorAll('.step').forEach((step, index) => {
      step.classList.toggle('active', index === 1);
    });
    
    // Load categories if not already loaded
    if (allCategories.length === 0) {
      await fetchCategories();
    }
    
  } catch (err) {
    console.error('Error checking name:', err);
    showNotification('حدث خطأ أثناء التحقق', false);
  }
}

function goBackToName() {
  document.getElementById('voting-section').classList.add('hidden');
  document.getElementById('name-section').classList.remove('hidden');
  
  // Update progress
  document.getElementById('progress-fill').style.width = '0%';
  
  // Update active step
  document.querySelectorAll('.step').forEach((step, index) => {
    step.classList.toggle('active', index === 0);
  });
}

// Submit all votes - MODIFIED FOR OPTIONAL FIELDS
async function submitAllVotes() {
  // Reset duplicate error
  const duplicateError = document.getElementById('duplicate-error');
  duplicateError.classList.add('hidden');
  
  // Validate mandatory fields only
  let hasError = false;
  
  // Find all mandatory fields (top 3 in Best Games category)
  const allInputs = document.querySelectorAll('.selection-input');
  allInputs.forEach(input => {
    const card = input.closest('.category-card');
    const isBestGamesCategory = card.dataset.isBestGames === 'true';
    const rank = input.dataset.rank;
    
    // Check if this is a mandatory field
    const isMandatory = isBestGamesCategory && parseInt(rank) <= 3;
    
    if (isMandatory) {
      if (!input.value.trim()) {
        showNotification('يرجى ملء المركزين 1، 2، 3 في فئة أفضل ألعاب 2025', false);
        input.focus();
        hasError = true;
        return;
      }
      
      if (!validateSelectionInput(input)) {
        showNotification('يرجى إدخال اختيارات صحيحة في المراكز الثلاثة الأولى', false);
        input.focus();
        hasError = true;
        return;
      }
    }
  });
  
  if (hasError) return;
  
  // Validate all filled fields (including optional ones)
  allInputs.forEach(input => {
    const value = input.value.trim();
    if (value.length > 0) {
      // Only validate if field is not empty
      if (!validateSelectionInput(input)) {
        showNotification('يرجى إدخال اختيارات صحيحة', false);
        input.focus();
        hasError = true;
        return;
      }
    }
  });
  
  if (hasError) return;
  
  // Check for duplicates within Best Games category (only among filled positions)
  const votesByCategory = {};
  const duplicateErrors = [];
  
  allCategories.forEach(category => {
    const categoryId = category.id;
    const isBestGamesCategory = category.name_ar.includes("أفضل ألعاب 2025");
    const selections = [];
    const filledSelections = [];
    const seenSelections = new Set();
    const duplicateInCategory = [];
    
    if (isBestGamesCategory) {
      // Best Games category: Get up to 5 selections
      for (let i = 1; i <= 5; i++) {
        const input = document.getElementById(`category-${categoryId}-rank-${i}`);
        const value = input.value.trim();
        // For empty optional positions (4 and 5), send empty string
        selections.push(value || "");
        
        // Only check duplicates among filled positions
        if (value) {
          filledSelections.push(value);
          if (seenSelections.has(value.toLowerCase())) {
            duplicateInCategory.push({ rank: i, value });
          }
          seenSelections.add(value.toLowerCase());
        }
      }
      
      if (duplicateInCategory.length > 0) {
        duplicateErrors.push(`فئة "${category.name_ar}": لا يمكن تكرار اللعبة نفسها في أكثر من مركز`);
      }
    } else {
      // Other categories: Get single selection (if filled)
      const input = document.getElementById(`category-${categoryId}-single`);
      const value = input.value.trim();
      // For optional categories, send empty string if not filled
      selections.push(value || "");
    }
    
    if (duplicateInCategory.length > 0) {
      duplicateErrors.push(`الفئة "${category.name_ar}": اختيارات مكررة`);
    }
    
    votesByCategory[categoryId] = selections;
  });
  
  // Show duplicate errors if any
  if (duplicateErrors.length > 0) {
    const errorMessage = document.getElementById('error-message');
    errorMessage.innerHTML = `
      هناك مشاكل في التصويت:<br>
      ${duplicateErrors.join('<br>')}<br>
      يرجى التأكد من صحة البيانات قبل الإرسال.
    `;
    duplicateError.classList.remove('hidden');
    duplicateError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    hasError = true;
  }
  
  if (hasError) return;
  
  // Ask for confirmation
  const confirmSubmit = confirm(`هل أنت متأكد من إرسال تصويتك ${currentUsername}؟\nبعد الإرسال لا يمكنك التعديل إلا عن طريق التواصل مع المشرف.`);
  if (!confirmSubmit) return;
  
  try {
    const response = await fetch('/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: currentUsername, 
        votes: votesByCategory 
      }),
    });

    const data = await response.json();
    if (data.status === 'success') {
      showNotification('تم إرسال تصويتك بنجاح!', true);
      setTimeout(() => {
        window.location.href = `/results?username=${encodeURIComponent(currentUsername)}`;
      }, 2000);
    } else if (data.status === 'error' && data.message.includes('already voted')) {
      const confirmOverride = confirm('لقد قمت بالتصويت مسبقاً. هل تريد استبدال تصويتك السابق؟');
      if (confirmOverride) {
        showNotification('يرجى التواصل مع المشرف لتعديل تصويتك', false);
      }
    } else {
      showNotification('❌ ' + data.message, false);
    }
  } catch (err) {
    showNotification('حدث خطأ أثناء إرسال التصويت.', false);
    console.error(err);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Set text alignment and color for all inputs
  document.querySelectorAll('input, select, textarea').forEach(input => {
    input.style.textAlign = 'right';
    input.style.direction = 'rtl';
    input.style.color = '#000000';
  });
  
  // Specifically set username input color
  const usernameInput = document.getElementById('username');
  if (usernameInput) {
    usernameInput.style.color = '#000000';
  }
  
  // Load categories
  fetchCategories();
  
  // Update progress indicator on page load
  document.querySelectorAll('.step').forEach((step, index) => {
    step.classList.toggle('active', index === 0);
  });

  // Mobile-specific adjustments
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    // Add mobile viewport adjustments
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
    }
    
    // Prevent zoom on input focus
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        setTimeout(() => {
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      });
    });
  }
});
