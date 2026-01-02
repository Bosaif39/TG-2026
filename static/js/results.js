// Get username from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');

if (!username) {
    // If no username in URL, redirect to home
    window.location.href = '/';
}

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

async function loadUserResults() {
  try {
    const response = await fetch(`/user-results/${decodeURIComponent(username)}`);
    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error('Failed to load results');
    }

    displayResults(data);
  } catch (error) {
    console.error('Error loading results:', error);
    document.getElementById('categories-container').innerHTML = `
      <div class="error-msg">
        <i class="fas fa-exclamation-triangle"></i>
        حدث خطأ في تحميل النتائج. الرجاء المحاولة لاحقاً.
        <br>
        <a href="/" style="color: var(--primary-light); text-decoration: underline; margin-top: 10px; display: inline-block;">
          العودة إلى صفحة التصويت
        </a>
      </div>`;
  }
}

function displayResults(data) {
  const container = document.getElementById('categories-container');
  
  // Display username
  document.getElementById('username-display').textContent = data.username || decodeURIComponent(username);
  
  // Display user ID if available
  const userIdElem = document.getElementById('user-id');
  if (userIdElem && data.user_id) {
    userIdElem.textContent = `رقم التصويت: #${data.user_id}`;
  }
  
  // Display total voters
  const totalVotersElem = document.getElementById('total-voters');
  if (totalVotersElem && data.total_voters) {
    totalVotersElem.textContent = `إجمالي المصوتين: ${data.total_voters}`;
  }
  
  // Format and display timestamp
  const timestampElem = document.getElementById('timestamp');
  if (timestampElem && data.timestamp) {
    try {
      const date = new Date(data.timestamp);
      const formattedDate = date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const formattedTime = date.toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      timestampElem.textContent = `تاريخ التصويت: ${formattedDate} - ${formattedTime}`;
    } catch (e) {
      timestampElem.textContent = `تاريخ التصويت: ${data.timestamp}`;
    }
  }
  
  // Check if there are votes
  if (!data.votes_by_category || Object.keys(data.votes_by_category).length === 0) {
    container.innerHTML = `
      <div class="empty-results">
        <i class="fas fa-clipboard-list"></i>
        <h3>لا توجد أصوات مسجلة</h3>
        <p>لم تقم بالتصويت بعد.</p>
        <a href="/" class="btn-primary" style="margin-top: 20px; display: inline-block;">
          <i class="fas fa-vote-yea"></i>
          التصويت الآن
        </a>
      </div>`;
    return;
  }
  
  container.innerHTML = '';
  
  let totalCategories = 0;
  let totalSelections = 0;
  let totalPoints = 0;
  
  // Display votes by category
  Object.entries(data.votes_by_category).forEach(([categoryId, categoryData], categoryIndex) => {
    totalCategories++;
    const categoryPoints = categoryData.selections.reduce((sum, selection) => sum + (selection.points || 0), 0);
    totalPoints += categoryPoints;
    totalSelections += categoryData.selections.length;
    
    const categorySection = document.createElement('div');
    categorySection.className = 'category-section animate__animated';
    categorySection.style.animationDelay = `${categoryIndex * 0.2}s`;
    categorySection.setAttribute('role', 'article');
    categorySection.setAttribute('aria-label', `فئة: ${categoryData.category_name}`);
    categorySection.setAttribute('aria-live', 'polite');
    
    // Check if this is the Best Games category (has 5 selections)
    const isBestGamesCategory = categoryData.selections.length === 5;
    
    let selectionsHTML = '';
    categoryData.selections.forEach((selection, index) => {
      const rankText = isBestGamesCategory 
        ? ['المركز الأول', 'المركز الثاني', 'المركز الثالث', 'المركز الرابع', 'المركز الخامس'][index] 
        : `المركز ${selection.rank}`;
      
      const rankColors = ['#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#F44336'];
      const rankColor = rankColors[index] || rankColors[0];
      
      selectionsHTML += `
        <div class="selection-card" role="listitem">
          <div class="selection-rank">
            <div class="rank-badge" style="background: ${rankColor};" aria-label="المركز ${selection.rank}">
              ${selection.rank}
            </div>
            <div class="rank-label">${rankText}</div>
          </div>
          <div class="selection-content">
            <div class="selection-name" tabindex="0">${selection.selection}</div>
            </div>
          </div>
        </div>
      `;
    });
    
    const categoryDescription = isBestGamesCategory 
      ? 'أفضل 5 ألعاب في 2025 مرتبة حسب الأفضلية'
      : '';
    
    categorySection.innerHTML = `
      <div class="category-header">
        <div>
          <h3 class="category-title" tabindex="0">${categoryData.category_name}</h3>
          <div class="category-description">${categoryDescription}</div>
        </div>
        <div style="text-align: left;">
          <div style="background: linear-gradient(135deg, var(--primary-purple), var(--primary-dark)); color: white; padding: 10px 18px; border-radius: 20px; font-weight: 700; font-size: 1rem; box-shadow: 0 4px 8px rgba(138, 43, 226, 0.2);">
            مجموع النقاط: ${categoryPoints}
          </div>
        </div>
      </div>
      <div class="selections-grid" role="list">
        ${selectionsHTML}
      </div>
    `;
    
    container.appendChild(categorySection);
  });
  
  // Show total statistics
  const totalStats = document.getElementById('total-stats');
  totalStats.classList.remove('hidden');
  
  document.getElementById('total-categories').textContent = totalCategories;
  document.getElementById('total-selections').textContent = totalSelections;
  document.getElementById('total-points').textContent = totalPoints;
  document.getElementById('avg-points').textContent = totalCategories > 0 ? (totalPoints / totalCategories).toFixed(1) : '0';
  
  // Add animation classes after content is loaded
  setTimeout(() => {
    document.querySelectorAll('.category-section').forEach((section, index) => {
      section.classList.add('animate__fadeIn');
      
      // Add focus styling for keyboard navigation
      section.addEventListener('focusin', function() {
        this.style.outline = '2px solid var(--primary-purple)';
        this.style.outlineOffset = '4px';
        this.style.borderRadius = '8px';
      });
      
      section.addEventListener('focusout', function() {
        this.style.outline = 'none';
      });
    });
    
    // Print button functionality
    printResults();
  }, 100);
}

// Add print functionality
function printResults() {
  const printButton = document.createElement('button');
  printButton.innerHTML = '<i class="fas fa-print"></i> طباعة النتائج';
  printButton.className = 'btn-secondary';
  printButton.style.margin = '20px auto';
  printButton.style.display = 'block';
  printButton.style.width = '200px';
  printButton.setAttribute('aria-label', 'طباعة نتائج التصويت');
  printButton.onclick = () => {
    // Add print-specific styles temporarily
    const printStyle = document.createElement('style');
    printStyle.textContent = `
      @media print {
        body * {
          visibility: hidden;
        }
        .container, .container * {
          visibility: visible;
        }
        .container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          padding: 0;
          margin: 0;
          box-shadow: none;
          background: white;
          color: black;
        }
        .btn-primary, .btn-secondary, .btn-submit, 
        .mobile-banner, .theme-footer a, .point-system-info,
        button {
          display: none !important;
        }
        .category-section {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        h1, h2, h3 {
          color: black !important;
        }
        .selection-card {
          border: 1px solid #ddd !important;
          box-shadow: none !important;
          background: white !important;
          color: black !important;
        }
        .total-stats-card {
          background: #f5f5f5 !important;
          color: black !important;
          border: 1px solid #ddd !important;
        }
        .theme-footer {
          display: none;
        }
      }
    `;
    document.head.appendChild(printStyle);
    window.print();
    setTimeout(() => {
      document.head.removeChild(printStyle);
    }, 100);
  };
  
  const totalStats = document.getElementById('total-stats');
  if (totalStats && totalStats.parentNode) {
    totalStats.parentNode.insertBefore(printButton, totalStats);
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Set proper text alignment for any inputs
  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.style.textAlign = 'right';
    input.style.direction = 'rtl';
    input.style.color = '#000000';
  });
  
  // Focus on the container for better accessibility
  const container = document.getElementById('categories-container');
  if (container) {
    container.setAttribute('tabindex', '-1');
    setTimeout(() => {
      container.focus({ preventScroll: true });
    }, 100);
  }
  
  // Show loading state
  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner">
        <i class="fas fa-spinner fa-spin"></i>
      </div>
      <p>جاري تحميل نتائج ${decodeURIComponent(username)}...</p>
    </div>`;
  
  // Load results
  loadUserResults();
  
  // Add animation classes to headers
  const headers = document.querySelectorAll('h1, h2, .user-header, .point-system-info');
  headers.forEach(header => {
    header.classList.add('animate__animated', 'animate__fadeIn');
  });
  
  // Mobile-specific adjustments
  if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    // Add mobile viewport adjustments
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
    }
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
    
    // Prevent zoom on double-tap
    document.addEventListener('touchstart', function(event) {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    }, { passive: false });
    
    // Better touch experience for selection cards
    document.addEventListener('touchstart', function() {}, { passive: true });
  }
  
  // Add keyboard navigation support
  document.addEventListener('keydown', function(e) {
    // Escape key goes back to home
    if (e.key === 'Escape') {
      window.location.href = '/';
    }
    
    // Space/Enter scrolls down (when not in an input)
    if ((e.key === ' ' || e.key === 'Enter') && 
        !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) {
      e.preventDefault();
      window.scrollBy({
        top: window.innerHeight * 0.8,
        behavior: 'smooth'
      });
    }
    
    // Ctrl+P or Cmd+P for print
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      printResults();
      setTimeout(() => {
        const printButton = document.querySelector('button[aria-label*="طباعة"]');
        if (printButton) printButton.click();
      }, 100);
    }
  });
  
  // Add copy to clipboard functionality for sharing
  const shareButton = document.createElement('button');
  shareButton.innerHTML = '<i class="fas fa-share-alt"></i> مشاركة النتائج';
  shareButton.className = 'btn-primary';
  shareButton.style.margin = '10px auto';
  shareButton.style.display = 'none';
  shareButton.style.width = '200px';
  shareButton.setAttribute('aria-label', 'مشاركة رابط النتائج');
  shareButton.onclick = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(`نتائج تصويت جوائز الألعاب 2025: ${url}`);
      showNotification('✅ تم نسخ رابط النتائج إلى الحافظة', true);
    } catch (err) {
      console.error('Failed to copy:', err);
      showNotification('❌ فشل نسخ الرابط', false);
    }
  };
  
  // Add share button after results load
  setTimeout(() => {
    const totalStats = document.getElementById('total-stats');
    if (totalStats && totalStats.parentNode && navigator.share) {
      shareButton.style.display = 'block';
      totalStats.parentNode.insertBefore(shareButton, totalStats);
    }
  }, 1500);
  
  // Add offline detection
  window.addEventListener('offline', () => {
    showNotification('⚠️ أنت غير متصل بالإنترنت. بعض الميزات قد لا تعمل.', false);
  });
  
  window.addEventListener('online', () => {
    showNotification('✅ تم استعادة الاتصال بالإنترنت.', true);
  });
});

// Add error handling for fetch
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
  
  // Show user-friendly error for fetch failures
  if (event.reason && event.reason.name === 'TypeError' && event.reason.message.includes('fetch')) {
    showNotification('❌ حدث خطأ في الاتصال بالخادم. الرجاء التحقق من اتصال الإنترنت.', false);
  }
});

// Lazy loading for images (if any are added later)
const imageObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      img.classList.add('loaded');
      observer.unobserve(img);
    }
  });
});

// Observe any lazy-loaded images
document.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));