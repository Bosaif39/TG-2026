let currentSearch = "";
let currentPage = 1;
let currentTable = "categories"; // Track current table

function clearSearch() {
  document.getElementById('search-input').value = '';
  currentSearch = '';
  loadAdminTable(1, true);
}

// Use Toastify for notifications
function showToast(msg, isSuccess = true) {
  Toastify({
    text: msg,
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

function checkPassword() {
  const password = document.getElementById('admin-password').value;
  if (!password) {
    showToast("❗ الرجاء إدخال كلمة المرور", false);
    return;
  }
  
  fetch('/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'success') {
      document.getElementById('download-btn').classList.remove('hidden');
      document.getElementById('admin-panel').classList.remove('hidden');
      document.getElementById('stats-panel').classList.remove('hidden');
      document.getElementById('admin-password').value = '';
      showToast("✅ تم تسجيل الدخول بنجاح", true);
      loadAdminTable(1);
      loadStatistics();
    } else {
      showToast("❌ كلمة المرور غير صحيحة", false);
    }
  })
  .catch(error => {
    console.error('Login error:', error);
    showToast("❌ حدث خطأ أثناء تسجيل الدخول", false);
  });
}

function downloadExcel() {
  window.location.href = '/download-excel';
}


function loadStatistics() {
  fetch('/admin/view-table?table=votes')
    .then(res => res.json())
    .then(data => {
      if (data.status === 'success') {
        const totalVotes = data.rows.length;
        
        // Find column indexes dynamically
        const voterNameIndex = data.columns.indexOf('voter_name');
        const selectionIndex = data.columns.indexOf('selection');
        
        let uniqueVoters = 0;
        let uniqueSelections = 0;
        
        if (voterNameIndex !== -1) {
          uniqueVoters = [...new Set(data.rows.map(row => row[voterNameIndex]))].length;
        }
        
        if (selectionIndex !== -1) {
          uniqueSelections = [...new Set(data.rows.map(row => row[selectionIndex]))].length;
        }
        
        // Load categories count
        fetch('/admin/view-table?table=categories')
          .then(res => res.json())
          .then(catData => {
            const totalCategories = catData.rows.length;
            
            // Load games count
            fetch('/admin/view-table?table=games')
              .then(res => res.json())
              .then(gamesData => {
                const totalGames = gamesData.rows.length;
                
                // Load publishers count
                fetch('/admin/view-table?table=publishers')
                  .then(res => res.json())
                  .then(pubsData => {
                    const totalPublishers = pubsData.rows.length;
                    
                    const statsGrid = document.getElementById('stats-grid');
                    statsGrid.innerHTML = `
                      <div class="stat-item">
                        <div class="stat-value">${uniqueVoters}</div>
                        <div class="stat-label">عدد المصوتين</div>
                      </div>
                      <div class="stat-item">
                        <div class="stat-value">${totalVotes}</div>
                        <div class="stat-label">إجمالي التصويتات</div>
                      </div>
                      <div class="stat-item">
                        <div class="stat-value">${uniqueSelections}</div>
                        <div class="stat-label">عدد الألعاب/الاختيارات</div>
                      </div>
                      <div class="stat-item">
                        <div class="stat-value">${totalCategories}</div>
                        <div class="stat-label">عدد الفئات</div>
                      </div>
                      <div class="stat-item">
                        <div class="stat-value">${totalGames}</div>
                        <div class="stat-label">عدد الألعاب</div>
                      </div>
                      <div class="stat-item">
                        <div class="stat-value">${totalPublishers}</div>
                        <div class="stat-label">عدد الناشرين</div>
                      </div>
                    `;
                  });
              });
          });
      }
    })
    .catch(error => {
      console.error('Error loading statistics:', error);
    });
}

function loadAdminTable(page = 1, scrollToTop = false) {
  // Store current position before loading
  const scrollPosition = window.scrollY;
  
  currentPage = page;
  currentTable = document.getElementById('table-select').value;
  const searchParam = currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : "";

  // Show loading state
  const tbody = document.querySelector('#admin-table tbody');
  tbody.innerHTML = `
    <tr>
      <td colspan="100" style="text-align: center; padding: 40px;">
        <div class="spinner">
          <i class="fas fa-spinner fa-spin"></i>
        </div>
        <p>جاري تحميل البيانات...</p>
      </td>
    </tr>
  `;

  fetch(`/admin/view-table?table=${currentTable}&page=${page}${searchParam}`)
    .then(res => res.json())
    .then(data => {
      if (data.status !== 'success') {
        showToast("❌ فشل تحميل البيانات", false);
        return;
      }

      const thead = document.querySelector('#admin-table thead');
      const tbody = document.querySelector('#admin-table tbody');

      // Build table header
      thead.innerHTML = `<tr>${data.columns.map(col => `<th>${col}</th>`).join('')}<th>الإجراءات</th></tr>`;
      tbody.innerHTML = '';

      // Render table rows
      if (data.rows.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="${data.columns.length + 1}" style="text-align: center; padding: 30px; color: var(--text-muted);">
              <i class="fas fa-database" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
              لا توجد بيانات في هذا الجدول
            </td>
          </tr>
        `;
      } else {
        data.rows.forEach(row => {
          const rowId = row[0];
          const tr = document.createElement('tr');
          tr.id = `row-${rowId}`;
          
          // Add cells for each column
          row.forEach((cell, idx) => {
            const td = document.createElement('td');
            td.style.padding = '12px 8px';
            td.style.fontSize = '14px';
            
            // Format timestamp if it's a date
            if ((data.columns[idx] === 'timestamp' || data.columns[idx] === 'created_at') && cell) {
              try {
                const date = new Date(cell);
                td.innerHTML = `${date.toLocaleDateString('ar-SA')}<br>${date.toLocaleTimeString('ar-SA')}`;
              } catch (e) {
                td.textContent = cell;
              }
            }
            // Editable cells for categories
            else if (currentTable === 'categories' && (data.columns[idx] === 'name_ar' || data.columns[idx] === 'name_en' || data.columns[idx] === 'description')) {
              td.contentEditable = true;
              td.className = 'admin-table-input editable-cell';
              td.dataset.id = rowId;
              td.dataset.col = data.columns[idx];
              td.textContent = cell || '';
              td.style.minWidth = '180px';
              td.style.fontSize = '16px';
              td.style.padding = '12px';
            }
            // Handle votes table with category_name column
            else if (currentTable === 'votes') {
              if (data.columns[idx] === 'category_name') {
                // Category name - display only (comes from join with categories table)
                td.textContent = cell || '';
                td.style.minWidth = '200px';
                td.style.fontWeight = '600';
                td.style.color = 'var(--primary-purple)';
                td.style.backgroundColor = 'rgba(138, 43, 226, 0.08)';
                td.className = 'category-name-cell';
              }
              else if (data.columns[idx] === 'selection') {
                // Make selection field larger
                const input = document.createElement('input');
                input.type = 'text';
                input.value = cell;
                input.className = 'admin-table-input';
                input.style.width = '100%';
                input.style.maxWidth = '500px';
                input.style.fontSize = '16px';
                input.style.padding = '12px 14px';
                input.style.minHeight = '45px';
                input.dataset.id = rowId;
                input.dataset.col = data.columns[idx];
                td.appendChild(input);
                td.style.minWidth = '400px';
                td.className = 'selection-cell-wide';
              }
              else if (data.columns[idx] === 'rank') {
                // Rank field
                const input = document.createElement('input');
                input.type = 'number';
                input.value = cell;
                input.className = 'admin-table-input';
                input.style.width = '90px';
                input.style.fontSize = '16px';
                input.style.padding = '12px';
                input.min = '1';
                input.max = '5';
                input.dataset.id = rowId;
                input.dataset.col = data.columns[idx];
                td.appendChild(input);
                td.style.minWidth = '100px';
              }
              else if (data.columns[idx] === 'voter_name') {
                // Voter name - editable
                td.contentEditable = true;
                td.className = 'admin-table-input editable-cell';
                td.dataset.id = rowId;
                td.dataset.col = data.columns[idx];
                td.textContent = cell || '';
                td.style.minWidth = '150px';
                td.style.fontSize = '16px';
                td.style.padding = '12px';
              }
              else if (data.columns[idx] === 'points') {
                // Points - calculated field, not editable
                td.textContent = cell;
                td.style.fontWeight = '600';
                td.style.color = '#4CAF50';
                td.style.minWidth = '80px';
              }
              else {
                // Other columns
                td.textContent = cell;
                td.style.fontSize = '14px';
              }
            }
            // Editable cells for games and publishers (name field)
            else if ((currentTable === 'games' || currentTable === 'publishers') && data.columns[idx] === 'name') {
              td.contentEditable = true;
              td.className = 'admin-table-input editable-cell';
              td.dataset.id = rowId;
              td.dataset.col = data.columns[idx];
              td.textContent = cell || '';
              td.style.minWidth = '250px';
              td.style.fontSize = '16px';
              td.style.padding = '12px';
            }
            else {
              td.textContent = cell;
              td.style.fontSize = '14px';
            }
            
            tr.appendChild(td);
          });

          // Add actions cell
          const actionsTd = document.createElement('td');
          actionsTd.className = 'table-actions-container';
          actionsTd.style.minWidth = '200px';
          actionsTd.style.whiteSpace = 'nowrap';
          
          if (currentTable === 'categories') {
            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn-primary';
            saveBtn.style.padding = '10px 15px';
            saveBtn.style.margin = '2px';
            saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
            saveBtn.onclick = () => saveCategoryEdit(rowId, saveBtn);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-submit';
            deleteBtn.style.padding = '10px 15px';
            deleteBtn.style.margin = '2px';
            deleteBtn.style.background = 'linear-gradient(135deg, #F44336, #D32F2F)';
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> حذف';
            deleteBtn.onclick = () => deleteRow('category', rowId, currentPage);
            
            actionsTd.appendChild(saveBtn);
            actionsTd.appendChild(deleteBtn);
          }
          else if (currentTable === 'votes') {
            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn-primary';
            saveBtn.style.padding = '10px 15px';
            saveBtn.style.margin = '2px';
            saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
            saveBtn.onclick = () => saveVoteEdit(rowId, saveBtn);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-submit';
            deleteBtn.style.padding = '10px 15px';
            deleteBtn.style.margin = '2px';
            deleteBtn.style.background = 'linear-gradient(135deg, #F44336, #D32F2F)';
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> حذف';
            deleteBtn.onclick = () => deleteRow('vote', rowId, currentPage);
            
            actionsTd.appendChild(saveBtn);
            actionsTd.appendChild(deleteBtn);
          }
          else if (currentTable === 'games') {
            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn-primary';
            saveBtn.style.padding = '10px 15px';
            saveBtn.style.margin = '2px';
            saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
            saveBtn.onclick = () => saveGameEdit(rowId, saveBtn);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-submit';
            deleteBtn.style.padding = '10px 15px';
            deleteBtn.style.margin = '2px';
            deleteBtn.style.background = 'linear-gradient(135deg, #F44336, #D32F2F)';
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> حذف';
            deleteBtn.onclick = () => deleteRow('game', rowId, currentPage);
            
            actionsTd.appendChild(saveBtn);
            actionsTd.appendChild(deleteBtn);
          }
          else if (currentTable === 'publishers') {
            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn-primary';
            saveBtn.style.padding = '10px 15px';
            saveBtn.style.margin = '2px';
            saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
            saveBtn.onclick = () => savePublisherEdit(rowId, saveBtn);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-submit';
            deleteBtn.style.padding = '10px 15px';
            deleteBtn.style.margin = '2px';
            deleteBtn.style.background = 'linear-gradient(135deg, #F44336, #D32F2F)';
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> حذف';
            deleteBtn.onclick = () => deleteRow('publisher', rowId, currentPage);
            
            actionsTd.appendChild(saveBtn);
            actionsTd.appendChild(deleteBtn);
          }
          
          tr.appendChild(actionsTd);
          tbody.appendChild(tr);
        });
        
        // Add event listeners for editable cells
        document.querySelectorAll('.editable-cell').forEach(cell => {
          cell.addEventListener('focus', function() {
            this.style.backgroundColor = 'rgba(138, 43, 226, 0.1)';
            this.style.border = '2px solid var(--primary-purple)';
          });
          
          cell.addEventListener('blur', function() {
            this.style.backgroundColor = '';
            this.style.border = '';
          });
          
          // Apply styling
          cell.style.color = '#000000';
          cell.style.textAlign = 'right';
          cell.style.direction = 'rtl';
          cell.style.backgroundColor = 'white';
          cell.style.fontSize = '16px';
        });
        
        // Apply styling to all inputs
        document.querySelectorAll('.admin-table-input').forEach(input => {
          input.style.color = '#000000';
          input.style.textAlign = 'right';
          input.style.direction = 'rtl';
          input.style.backgroundColor = 'white';
          input.style.fontSize = '16px';
        });
      }

      // Pagination
      const pagination = document.getElementById('pagination');
      pagination.innerHTML = '';
      if (data.has_pagination) {
        // Previous button
        if (data.page > 1) {
          pagination.innerHTML += `<button onclick="loadAdminTable(${data.page - 1})" class="btn-secondary">
            <i class="fas fa-chevron-right"></i>
            السابق
          </button>`;
        }
        
        // Page numbers
        const maxPagesToShow = 5;
        let startPage = Math.max(1, data.page - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(data.pages, startPage + maxPagesToShow - 1);
        
        if (endPage - startPage + 1 < maxPagesToShow) {
          startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
          pagination.innerHTML += `<button onclick="loadAdminTable(${i})" class="${i === data.page ? 'active' : ''}">${i}</button>`;
        }
        
        // Next button
        if (data.page < data.pages) {
          pagination.innerHTML += `<button onclick="loadAdminTable(${data.page + 1})" class="btn-secondary">
            التالي
            <i class="fas fa-chevron-left"></i>
          </button>`;
        }
      }
      
      // Restore scroll position if not scrolling to top
      if (!scrollToTop) {
        setTimeout(() => {
          window.scrollTo(0, scrollPosition);
        }, 100);
      }
    })
    .catch(error => {
      console.error('Error loading table:', error);
      showToast("❌ حدث خطأ أثناء تحميل البيانات", false);
      tbody.innerHTML = `
        <tr>
          <td colspan="100" style="text-align: center; padding: 30px; color: var(--danger);">
            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
            فشل تحميل البيانات. الرجاء المحاولة مرة أخرى.
          </td>
        </tr>
      `;
    });
}


// Save Edited Category
function saveCategoryEdit(id, btn) {
  const tr = document.getElementById(`row-${id}`);
  if (!tr) {
    showToast("❌ لم يتم العثور على الصف", false);
    return;
  }
  
  const nameAr = tr.querySelector('[data-col="name_ar"]')?.textContent.trim();
  const nameEn = tr.querySelector('[data-col="name_en"]')?.textContent.trim();
  const description = tr.querySelector('[data-col="description"]')?.textContent.trim();
  
  if (!nameAr || !nameEn) {
    showToast("❗ اسم الفئة (عربي/إنجليزي) لا يمكن أن يكون فارغاً", false);
    return;
  }

  // Show saving indicator
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
  btn.disabled = true;
  
  fetch(`/admin/category/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      name_ar: nameAr,
      name_en: nameEn,
      description: description 
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'success') {
      showToast("✅ تم تعديل الفئة بنجاح", true);
      
      // Visual feedback
      tr.querySelectorAll('.editable-cell').forEach(cell => {
        cell.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
        cell.style.border = '2px solid #4CAF50';
        cell.style.transition = 'all 0.3s ease';
        
        setTimeout(() => {
          cell.style.backgroundColor = '';
          cell.style.border = '';
        }, 1500);
      });
      
      // Reload table but stay on same page
      loadAdminTable(currentPage);
      
    } else {
      showToast("❌ فشل تعديل الفئة", false);
      // Revert the change by reloading the table
      loadAdminTable(currentPage);
    }
  })
  .catch(error => {
    console.error('Error editing category:', error);
    showToast("❌ حدث خطأ أثناء تعديل الفئة", false);
    // Revert on error
    loadAdminTable(currentPage);
  })
  .finally(() => {
    // Restore button state
    btn.innerHTML = originalText;
    btn.disabled = false;
  });
}

// Save Edited Game
function saveGameEdit(id, btn) {
  const tr = document.getElementById(`row-${id}`);
  if (!tr) {
    showToast("❌ لم يتم العثور على الصف", false);
    return;
  }
  
  const nameCell = tr.querySelector('[data-col="name"]');
  const newName = nameCell ? nameCell.textContent.trim() : '';
  
  if (!newName) {
    showToast("❗ اسم اللعبة لا يمكن أن يكون فارغاً", false);
    return;
  }

  // Show saving indicator
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
  btn.disabled = true;
  
  fetch(`/admin/game/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'success') {
      showToast("✅ تم تعديل اللعبة بنجاح", true);
      
      // Visual feedback
      if (nameCell) {
        nameCell.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
        nameCell.style.border = '2px solid #4CAF50';
        
        setTimeout(() => {
          nameCell.style.backgroundColor = '';
          nameCell.style.border = '';
        }, 1500);
      }
      
      // Reload table but stay on same page
      loadAdminTable(currentPage);
      
    } else {
      showToast("❌ فشل تعديل اللعبة", false);
      loadAdminTable(currentPage);
    }
  })
  .catch(error => {
    console.error('Error editing game:', error);
    showToast("❌ حدث خطأ أثناء تعديل اللعبة", false);
    loadAdminTable(currentPage);
  })
  .finally(() => {
    btn.innerHTML = originalText;
    btn.disabled = false;
  });
}

// Save Edited Publisher
function savePublisherEdit(id, btn) {
  const tr = document.getElementById(`row-${id}`);
  if (!tr) {
    showToast("❌ لم يتم العثور على الصف", false);
    return;
  }
  
  const nameCell = tr.querySelector('[data-col="name"]');
  const newName = nameCell ? nameCell.textContent.trim() : '';
  
  if (!newName) {
    showToast("❗ اسم الناشر لا يمكن أن يكون فارغاً", false);
    return;
  }

  // Show saving indicator
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
  btn.disabled = true;
  
  fetch(`/admin/publisher/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'success') {
      showToast("✅ تم تعديل الناشر بنجاح", true);
      
      // Visual feedback
      if (nameCell) {
        nameCell.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
        nameCell.style.border = '2px solid #4CAF50';
        
        setTimeout(() => {
          nameCell.style.backgroundColor = '';
          nameCell.style.border = '';
        }, 1500);
      }
      
      // Reload table but stay on same page
      loadAdminTable(currentPage);
      
    } else {
      showToast("❌ فشل تعديل الناشر", false);
      loadAdminTable(currentPage);
    }
  })
  .catch(error => {
    console.error('Error editing publisher:', error);
    showToast("❌ حدث خطأ أثناء تعديل الناشر", false);
    loadAdminTable(currentPage);
  })
  .finally(() => {
    btn.innerHTML = originalText;
    btn.disabled = false;
  });
}

// Add New Category
function addCategory() {
  const nameAr = document.getElementById('category-name-ar').value.trim();
  const nameEn = document.getElementById('category-name-en').value.trim();
  const description = document.getElementById('category-description').value.trim();
  
  if (!nameAr || !nameEn) {
    showToast("❗ الرجاء إدخال اسم الفئة (عربي وإنجليزي)", false);
    return;
  }

  // Store current scroll position
  const scrollPosition = window.scrollY;
  
  fetch('/admin/category', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      name_ar: nameAr,
      name_en: nameEn,
      description: description 
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'success') {
      showToast("✅ تمت إضافة الفئة بنجاح", true);
      document.getElementById('category-name-ar').value = '';
      document.getElementById('category-name-en').value = '';
      document.getElementById('category-description').value = '';
      
      // Reload table but stay on same page and restore scroll position
      loadAdminTable(currentPage);
      loadStatistics();
      
      // Restore scroll position after a short delay
      setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 100);
      
    } else {
      showToast("❌ فشل إضافة الفئة", false);
    }
  })
  .catch(error => {
    console.error('Error adding category:', error);
    showToast("❌ حدث خطأ أثناء إضافة الفئة", false);
  });
}

// Add New Game
function addGame() {
  const name = document.getElementById('game-name').value.trim();
  
  if (!name) {
    showToast("❗ الرجاء إدخال اسم اللعبة", false);
    return;
  }

  // Store current scroll position
  const scrollPosition = window.scrollY;
  
  fetch('/admin/game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'success') {
      showToast("✅ تمت إضافة اللعبة بنجاح", true);
      document.getElementById('game-name').value = '';
      
      // Reload table but stay on same page and restore scroll position
      loadAdminTable(currentPage);
      loadStatistics();
      
      // Restore scroll position after a short delay
      setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 100);
      
    } else {
      showToast("❌ فشل إضافة اللعبة", false);
    }
  })
  .catch(error => {
    console.error('Error adding game:', error);
    showToast("❌ حدث خطأ أثناء إضافة اللعبة", false);
  });
}

// Add New Publisher
function addPublisher() {
  const name = document.getElementById('publisher-name').value.trim();
  
  if (!name) {
    showToast("❗ الرجاء إدخال اسم الناشر", false);
    return;
  }

  // Store current scroll position
  const scrollPosition = window.scrollY;
  
  fetch('/admin/publisher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'success') {
      showToast("✅ تمت إضافة الناشر بنجاح", true);
      document.getElementById('publisher-name').value = '';
      
      // Reload table but stay on same page and restore scroll position
      loadAdminTable(currentPage);
      loadStatistics();
      
      // Restore scroll position after a short delay
      setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 100);
      
    } else {
      showToast("❌ فشل إضافة الناشر", false);
    }
  })
  .catch(error => {
    console.error('Error adding publisher:', error);
    showToast("❌ حدث خطأ أثناء إضافة الناشر", false);
  });
}

// Save Edited Vote
function saveVoteEdit(id, btn) {
  const tr = document.getElementById(`row-${id}`);
  if (!tr) {
    showToast("❌ لم يتم العثور على الصف", false);
    return;
  }
  
  const selectionInput = tr.querySelector('input[data-col="selection"]');
  const rankInput = tr.querySelector('input[data-col="rank"]');
  
  if (!selectionInput || !rankInput) {
    showToast("❌ لم يتم العثور على الحقول المطلوبة", false);
    return;
  }
  
  const newSelection = selectionInput.value.trim();
  const newRank = parseInt(rankInput.value.trim());

  if (!newSelection) {
    showToast("❗ الرجاء إدخال اسم اللعبة/الاختيار", false);
    selectionInput.focus();
    return;
  }
  
  if (isNaN(newRank) || newRank < 1 || newRank > 5) {
    showToast("❗ الرجاء إدخال رتبة صحيحة بين 1 و 5", false);
    rankInput.focus();
    return;
  }

  // Show saving indicator
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
  btn.disabled = true;
  
  fetch(`/admin/vote/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      selection: newSelection,
      rank: newRank 
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === "success") {
      showToast("✅ تم تعديل التصويت بنجاح", true);
      
      // Visual feedback
      selectionInput.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
      rankInput.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
      
      setTimeout(() => {
        selectionInput.style.backgroundColor = '';
        rankInput.style.backgroundColor = '';
      }, 1500);
      
      // Reload table but stay on same page
      loadAdminTable(currentPage);
      
    } else {
      showToast("❌ فشل تعديل التصويت: " + (data.message || ''), false);
    }
  })
  .catch(error => {
    console.error('Error editing vote:', error);
    showToast("❌ حدث خطأ أثناء تعديل التصويت", false);
  })
  .finally(() => {
    // Restore button state
    btn.innerHTML = originalText;
    btn.disabled = false;
  });
}

// Helper function to get points for rank
function getPointsForRank(rank) {
  const pointSystem = {1: 5, 2: 4, 3: 3, 4: 2, 5: 1};
  return pointSystem[rank] || 0;
}

// Delete Row - Updated to maintain page position
function deleteRow(type, id, pageToStayOn = 1) {
  const messages = {
    'vote': "⚠️ هل أنت متأكد من حذف هذا التصويت؟\n\nهذا الإجراء لا يمكن التراجع عنه.",
    'category': "⚠️ هل أنت متأكد من حذف هذه الفئة؟\n\nملاحظة: لا يمكن حذف فئة تحتوي على تصويتات.",
    'game': "⚠️ هل أنت متأكد من حذف هذه اللعبة؟\n\nهذا الإجراء لا يمكن التراجع عنه.",
    'publisher': "⚠️ هل أنت متأكد من حذف هذا الناشر؟\n\nهذا الإجراء لا يمكن التراجع عنه."
  };
  
  const endpointMap = {
    'vote': `/admin/vote/${id}`,
    'category': `/admin/category/${id}`,
    'game': `/admin/game/${id}`,
    'publisher': `/admin/publisher/${id}`
  };
  
  if (!confirm(messages[type] || "هل أنت متأكد من الحذف؟")) {
    return;
  }

  // Store current scroll position before deleting
  const scrollPosition = window.scrollY;
  const endpoint = endpointMap[type];
  
  fetch(endpoint, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'success') {
        showToast("✅ تم الحذف بنجاح", true);
        const row = document.getElementById(`row-${id}`);
        if (row) {
          row.style.transition = "opacity 0.4s, transform 0.4s";
          row.style.opacity = "0";
          row.style.transform = "translateX(-20px)";
          setTimeout(() => {
            // Reload table but stay on same page and restore scroll position
            loadAdminTable(pageToStayOn);
            loadStatistics();
            
            // Restore scroll position after reload
            setTimeout(() => {
              window.scrollTo(0, scrollPosition);
            }, 100);
          }, 400);
        } else {
          // If row not found, still reload with same page
          loadAdminTable(pageToStayOn);
          loadStatistics();
          setTimeout(() => {
            window.scrollTo(0, scrollPosition);
          }, 100);
        }
      } else {
        showToast("❌ فشل الحذف: " + (data.message || ''), false);
      }
    })
    .catch(error => {
      console.error('Error deleting row:', error);
      showToast("❌ حدث خطأ أثناء الحذف", false);
    });
}

// Search function - stay on same page
function searchAdmin() {
  currentSearch = document.getElementById('search-input').value.trim();
  // Reset to page 1 for search results (this is expected behavior for search)
  loadAdminTable(1, true); // true means scroll to top for search
}

// Search with Debounce
let searchTimeout;
document.getElementById('search-input')?.addEventListener('input', function() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentSearch = this.value.trim();
    // Reset to page 1 for search results
    loadAdminTable(1, true);
  }, 500);
});

// Handle Enter key in search
document.getElementById('search-input')?.addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    currentSearch = this.value.trim();
    // Reset to page 1 for search results
    loadAdminTable(1, true);
  }
});

// Handle Enter key in editable cells
document.addEventListener('keypress', function(e) {
  if (e.target.hasAttribute('contenteditable') && e.key === 'Enter') {
    e.preventDefault();
    e.target.blur();
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Focus on password input
  const passwordInput = document.getElementById('admin-password');
  if (passwordInput) {
    passwordInput.focus();
    passwordInput.style.color = '#000000';
    passwordInput.style.textAlign = 'right';
    passwordInput.style.direction = 'rtl';
  }
  
  // Apply styling to all admin inputs
  const adminInputs = document.querySelectorAll(
    '#admin-password, ' +
    '#search-input, ' +
    '#table-select, ' +
    '.admin-input-large, ' +
    '.admin-table-input, ' +
    '#category-name-ar, ' +
    '#category-name-en, ' +
    '#category-description, ' +
    '#game-name, ' +
    '#publisher-name'
  );
  
  adminInputs.forEach(input => {
    input.style.color = '#000000';
    input.style.textAlign = 'right';
    input.style.direction = 'rtl';
    input.style.backgroundColor = 'white';
    input.style.fontSize = '16px';
  });
  
  // Apply to dynamically created inputs as well (for table rows)
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) { // Element node
            const inputs = node.querySelectorAll('input[type="text"], input[type="password"], select, textarea, input[type="number"]');
            inputs.forEach(input => {
              input.style.color = '#000000';
              input.style.textAlign = 'right';
              input.style.direction = 'rtl';
              input.style.backgroundColor = 'white';
              input.style.fontSize = '16px';
              input.style.padding = '10px 12px';
              
              // Make selection inputs wider
              if (input.dataset.col === 'selection') {
                input.style.width = '100%';
                input.style.maxWidth = '400px';
                input.style.minHeight = '40px';
              }
            });
            
            // Also handle contenteditable cells
            const editableCells = node.querySelectorAll('[contenteditable="true"]');
            editableCells.forEach(cell => {
              cell.style.color = '#000000';
              cell.style.textAlign = 'right';
              cell.style.direction = 'rtl';
              cell.style.backgroundColor = 'white';
              cell.style.fontSize = '16px';
              cell.style.padding = '12px';
            });
          }
        });
      }
    });
  });
  
  // Start observing the admin table for changes
  const adminTable = document.getElementById('admin-table');
  if (adminTable) {
    observer.observe(adminTable, { childList: true, subtree: true });
  }
  
  // Also observe the admin panel for any new inputs
  const adminPanel = document.getElementById('admin-panel');
  if (adminPanel) {
    observer.observe(adminPanel, { childList: true, subtree: true });
  }
});