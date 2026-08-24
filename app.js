/**
 * ====================================================================
 * MiniAnnotate – Image Annotation & Quality Review Tool
 * Vanilla JavaScript Implementation
 * ====================================================================
 * 
 * CORE ARCHITECTURAL CONCEPTS:
 * 1. Single Source of Truth: An in-memory array `annotations` holds all
 *    annotation objects. Every UI change (canvas, cards, metrics, storage)
 *    re-renders from this single array.
 * 2. Coordinate System Decoupling: Canvas internal pixel buffer (canvas.width, canvas.height)
 *    matches the uploaded image's natural dimensions (image.naturalWidth, image.naturalHeight).
 *    CSS displays the canvas scaled to fit the screen. Mouse clicks are converted from
 *    screen CSS pixels to true image coordinates using scale ratios.
 * 3. Supervisor Quality Control: Annotations have three explicit lifecycle states:
 *    - 'pending': newly drawn, awaiting review
 *    - 'approved': verified and ready for dataset inclusion
 *    - 'needs-correction': flagged for error (poor bounding box fit, wrong label, etc.)
 */

// --------------------------------------------------------------------
// Global Configuration & State
// --------------------------------------------------------------------

const DOMAIN_PRESETS = {
  football: {
    player_blue: { name: 'Player (Team Blue)', color: '#38bdf8' },
    player_red: { name: 'Player (Team Red)', color: '#ef4444' },
    goalkeeper: { name: 'Goalkeeper', color: '#facc15' },
    referee: { name: 'Referee', color: '#a855f7' },
    ball: { name: 'Ball', color: '#fb923c' },
    goalpost: { name: 'Goalpost', color: '#94a3b8' }
  },
  general: {
    person: { name: 'Person', color: '#38bdf8' },
    car: { name: 'Car', color: '#f87171' },
    bicycle: { name: 'Bicycle', color: '#34d399' },
    dog: { name: 'Dog', color: '#fbbf24' },
    traffic_light: { name: 'Traffic Light', color: '#a78bfa' }
  }
};

const STORAGE_KEY = 'miniannotate_session_data';

// Application State
let currentDomain = 'football';   // Default to Football Match Analytics
let currentImage = null;          // HTMLImageElement once loaded
let currentImageName = '';        // File name (e.g., 'sample_football.jpg')
let annotations = [];             // Array of annotation objects
let isDrawing = false;            // Dragging state flag
let startX = 0;                   // Drag start coordinate (in image pixels)
let startY = 0;                   // Drag start coordinate (in image pixels)
let currentMouseX = 0;            // Live mouse position during drag
let currentMouseY = 0;            // Live mouse position during drag
let hoveredAnnotationId = null;   // Active card/box hover highlight

// --------------------------------------------------------------------
// DOM Elements
// --------------------------------------------------------------------

const domainModeSelect = document.getElementById('domainModeSelect');
const imageUpload = document.getElementById('imageUpload');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const labelSelect = document.getElementById('labelSelect');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const loadFootballBtn = document.getElementById('loadFootballBtn');
const loadSampleBtn = document.getElementById('loadSampleBtn');

const canvasWrapper = document.getElementById('canvasWrapper');
const canvas = document.getElementById('annotationCanvas');
const ctx = canvas.getContext('2d');
const emptyStatePrompt = document.getElementById('emptyStatePrompt');
const imageInfoTag = document.getElementById('imageInfo');
const canvasStatusText = document.getElementById('canvasStatusText');
const cursorCoordsDisplay = document.getElementById('cursorCoords');

// Quality Summary metrics
const summaryTotal = document.getElementById('summaryTotal');
const summaryPending = document.getElementById('summaryPending');
const summaryApproved = document.getElementById('summaryApproved');
const summaryCorrection = document.getElementById('summaryCorrection');
const annotationCountBadge = document.getElementById('annotationCountBadge');

// Review list container
const annotationList = document.getElementById('annotationList');

// --------------------------------------------------------------------
// 1. Coordinate Conversion Helper
// --------------------------------------------------------------------

/**
 * Converts screen/mouse coordinates (from clientX, clientY) into
 * actual natural image pixel coordinates.
 * 
 * Why this is necessary:
 * The canvas CSS displayed size on screen (rect.width, rect.height)
 * may be smaller than the image's original resolution (canvas.width, canvas.height).
 * Multiplying by the ratio ensures bounding boxes accurately align to original pixels.
 */
function getCanvasCoordinates(e) {
  const rect = canvas.getBoundingClientRect();
  
  // Calculate position within the displayed CSS box
  const clientX = e.clientX - rect.left;
  const clientY = e.clientY - rect.top;

  // Scale ratio: natural image size / displayed CSS size
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  // Map to true image coordinate
  const x = clientX * scaleX;
  const y = clientY * scaleY;

  // Clamp within image bounds
  return {
    x: Math.max(0, Math.min(x, canvas.width)),
    y: Math.max(0, Math.min(y, canvas.height))
  };
}

// --------------------------------------------------------------------
// 2. Image Loading & Canvas Initialization
// --------------------------------------------------------------------

/**
 * Loads an image from a URL or data URI and configures the canvas.
 */
function loadImageSource(src, fileName) {
  const img = new Image();
  img.onload = () => {
    currentImage = img;
    currentImageName = fileName;

    // Set internal canvas resolution to match the image's real dimensions
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Show canvas, hide empty placeholder
    canvas.style.display = 'block';
    emptyStatePrompt.style.display = 'none';

    // Update UI headers
    fileNameDisplay.textContent = fileName;
    imageInfoTag.textContent = `Original: ${img.naturalWidth} \u00D7 ${img.naturalHeight} px`;
    canvasStatusText.textContent = `Loaded "${fileName}". Ready to annotate.`;

    // Redraw and refresh
    redrawCanvas();
    renderReviewList();
    updateQualitySummary();
    saveToLocalStorage();
  };
  img.onerror = () => {
    alert('Failed to load image. Please select a valid image file (JPG, PNG, WebP).');
  };
  img.src = src;
}

// File input change handler (User uploads their own file)
imageUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    // When a brand new image is loaded, ask if previous annotations should be reset
    if (annotations.length > 0) {
      const confirmReset = confirm(
        'A new image is being loaded. Would you like to clear previous annotations for this new image?'
      );
      if (confirmReset) {
        annotations = [];
      }
    }
    loadImageSource(event.target.result, file.name);
  };
  reader.readAsDataURL(file);
});

/**
 * Populates the label selector based on chosen domain (Football vs General)
 */
function populateLabelDropdown(domain) {
  currentDomain = domain;
  labelSelect.innerHTML = '';
  const labels = DOMAIN_PRESETS[domain] || DOMAIN_PRESETS.football;
  for (const key in labels) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = labels[key].name;
    labelSelect.appendChild(opt);
  }
}

// Domain switch handler
domainModeSelect.addEventListener('change', (e) => {
  populateLabelDropdown(e.target.value);
});

// Load football match benchmark button
loadFootballBtn.addEventListener('click', () => {
  domainModeSelect.value = 'football';
  populateLabelDropdown('football');
  loadImageSource('images/sample_football.jpg', 'sample_football.jpg');
});

// Load sample street scene button handler
loadSampleBtn.addEventListener('click', () => {
  domainModeSelect.value = 'general';
  populateLabelDropdown('general');
  loadImageSource('images/sample_street.jpg', 'sample_street.jpg');
});

// --------------------------------------------------------------------
// 3. Canvas Mouse Events & Bounding Box Drawing
// --------------------------------------------------------------------

canvas.addEventListener('mousedown', (e) => {
  if (!currentImage) return;

  const coords = getCanvasCoordinates(e);
  isDrawing = true;
  startX = coords.x;
  startY = coords.y;
  currentMouseX = coords.x;
  currentMouseY = coords.y;
});

canvas.addEventListener('mousemove', (e) => {
  if (!currentImage) return;

  const coords = getCanvasCoordinates(e);

  // Update cursor coordinate display in status bar
  cursorCoordsDisplay.textContent = `X: ${Math.round(coords.x)} | Y: ${Math.round(coords.y)} (original px)`;

  if (!isDrawing) return;

  currentMouseX = coords.x;
  currentMouseY = coords.y;

  // Redraw canvas with existing annotations + preview box
  redrawCanvas();
  drawInProgressBox();
});

window.addEventListener('mouseup', (e) => {
  if (!isDrawing || !currentImage) return;
  isDrawing = false;

  // Calculate box dimensions (supporting dragging in any direction)
  const boxX = Math.min(startX, currentMouseX);
  const boxY = Math.min(startY, currentMouseY);
  const boxWidth = Math.abs(currentMouseX - startX);
  const boxHeight = Math.abs(currentMouseY - startY);

  // Minimum threshold: ignore tiny accidental clicks smaller than 6x6 px
  if (boxWidth < 6 || boxHeight < 6) {
    redrawCanvas();
    return;
  }

  // Create new annotation object
  const newAnnotation = {
    id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    label: labelSelect.value,
    x: Math.round(boxX),
    y: Math.round(boxY),
    width: Math.round(boxWidth),
    height: Math.round(boxHeight),
    status: 'pending' // Default initial status
  };

  annotations.push(newAnnotation);

  // Refresh everything
  redrawCanvas();
  renderReviewList();
  updateQualitySummary();
  saveToLocalStorage();

  canvasStatusText.textContent = `Created "${formatLabel(newAnnotation.label)}" box (${newAnnotation.width}\u00D7${newAnnotation.height}px). Status: Pending review.`;
});

// --------------------------------------------------------------------
// 4. Canvas Rendering Engine
// --------------------------------------------------------------------

/**
 * Clears and repaints the entire canvas:
 * 1. Draws base image
 * 2. Draws all stored bounding boxes, colored badges, and statuses
 */
function redrawCanvas() {
  if (!currentImage) return;

  // 1. Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. Draw base image at full natural resolution
  ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);

  // 3. Draw each stored annotation
  annotations.forEach((ann, index) => {
    const isHovered = ann.id === hoveredAnnotationId;
    const color = getLabelColor(ann.label);

    ctx.save();

    // Box stroke style based on status & hover
    ctx.lineWidth = isHovered ? 4 : 2.5;

    if (ann.status === 'needs-correction') {
      ctx.strokeStyle = '#ef4444';
      ctx.setLineDash([6, 4]); // Dashed line to visually flag correction
    } else if (ann.status === 'approved') {
      ctx.strokeStyle = '#10b981';
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = color;
      ctx.setLineDash([]);
    }

    // Semi-transparent box fill
    if (isHovered) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    } else if (ann.status === 'approved') {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
    } else if (ann.status === 'needs-correction') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    } else {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    }

    ctx.fillRect(ann.x, ann.y, ann.width, ann.height);
    ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);

    // Draw label tag above the box
    drawLabelTag(ann, color, index + 1);

    ctx.restore();
  });
}

/**
 * Draws the in-progress box while the user is actively dragging.
 */
function drawInProgressBox() {
  const boxX = Math.min(startX, currentMouseX);
  const boxY = Math.min(startY, currentMouseY);
  const boxWidth = Math.abs(currentMouseX - startX);
  const boxHeight = Math.abs(currentMouseY - startY);

  const activeColor = getLabelColor(labelSelect.value);

  ctx.save();
  ctx.strokeStyle = activeColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';

  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

  // Temporary dimension preview
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px sans-serif';
  ctx.fillText(
    `${Math.round(boxWidth)} \u00D7 ${Math.round(boxHeight)} px`,
    boxX + 4,
    boxY > 20 ? boxY - 6 : boxY + 16
  );

  ctx.restore();
}

/**
 * Draws a clean tag above a bounding box showing index, label name, and status icon.
 */
function drawLabelTag(ann, color, index) {
  const statusIcon = ann.status === 'approved' ? '\u2713' : (ann.status === 'needs-correction' ? '!' : '?');
  const labelText = `#${index} ${getLabelDisplayName(ann.label)} [${statusIcon}]`;

  ctx.font = 'bold 12px sans-serif';
  const textWidth = ctx.measureText(labelText).width;
  const tagHeight = 18;
  const tagWidth = textWidth + 12;

  // Position tag right above the box; if box is at very top of image, place it inside
  let tagY = ann.y - tagHeight;
  if (tagY < 0) {
    tagY = ann.y;
  }
  const tagX = ann.x;

  // Tag background pill
  ctx.fillStyle = ann.status === 'approved' ? '#10b981' : (ann.status === 'needs-correction' ? '#ef4444' : color);
  ctx.fillRect(tagX, tagY, tagWidth, tagHeight);

  // Tag text
  ctx.fillStyle = '#ffffff';
  ctx.fillText(labelText, tagX + 6, tagY + 13);
}

// --------------------------------------------------------------------
// 5. Annotation Review Section & Actions
// --------------------------------------------------------------------

/**
 * Renders the supervisor review cards in the right sidebar.
 */
function renderReviewList() {
  annotationList.innerHTML = '';
  annotationCountBadge.textContent = `${annotations.length} items`;

  if (annotations.length === 0) {
    annotationList.innerHTML = `
      <div class="no-annotations-msg">
        No bounding boxes drawn yet. Click and drag on the image to create annotations.
      </div>
    `;
    return;
  }

  annotations.forEach((ann, index) => {
    const card = document.createElement('div');
    card.className = 'annotation-card';
    card.id = `card-${ann.id}`;

    // Left accent color matches status
    if (ann.status === 'approved') {
      card.style.borderLeftColor = 'var(--status-approved)';
    } else if (ann.status === 'needs-correction') {
      card.style.borderLeftColor = 'var(--status-correction)';
    } else {
      card.style.borderLeftColor = 'var(--status-pending)';
    }

    const color = getLabelColor(ann.label);
    const displayName = getLabelDisplayName(ann.label);
    const statusText = ann.status === 'needs-correction' ? 'Needs Fix' : capitalize(ann.status);

    card.innerHTML = `
      <div class="card-top">
        <span class="label-badge">
          <span class="label-color-dot" style="background-color: ${color};"></span>
          #${index + 1} ${displayName}
        </span>
        <span class="status-badge ${ann.status}">${statusText}</span>
      </div>

      <div class="card-coords-grid">
        <div class="coord-item"><span>X:</span> <strong>${ann.x}</strong></div>
        <div class="coord-item"><span>Y:</span> <strong>${ann.y}</strong></div>
        <div class="coord-item"><span>W:</span> <strong>${ann.width}</strong></div>
        <div class="coord-item"><span>H:</span> <strong>${ann.height}</strong></div>
      </div>

      <div class="card-actions">
        <button class="btn-card btn-approve ${ann.status === 'approved' ? 'active-approved' : ''}" 
                title="Approve this annotation for dataset inclusion">
          \u2713 Approve
        </button>
        <button class="btn-card btn-correction ${ann.status === 'needs-correction' ? 'active-correction' : ''}" 
                title="Flag this annotation as needing rework">
          ! Needs Fix
        </button>
        <button class="btn-card btn-card-delete" title="Delete this annotation">
          \uD83D\uDDD1
        </button>
      </div>
    `;

    // Button event listeners
    const approveBtn = card.querySelector('.btn-approve');
    const correctionBtn = card.querySelector('.btn-correction');
    const deleteBtn = card.querySelector('.btn-card-delete');

    approveBtn.addEventListener('click', () => updateAnnotationStatus(ann.id, 'approved'));
    correctionBtn.addEventListener('click', () => updateAnnotationStatus(ann.id, 'needs-correction'));
    deleteBtn.addEventListener('click', () => deleteAnnotation(ann.id));

    // Hover interactions to highlight on canvas
    card.addEventListener('mouseenter', () => {
      hoveredAnnotationId = ann.id;
      redrawCanvas();
    });
    card.addEventListener('mouseleave', () => {
      hoveredAnnotationId = null;
      redrawCanvas();
    });

    annotationList.appendChild(card);
  });
}

/**
 * Updates an annotation's quality review status.
 */
function updateAnnotationStatus(id, newStatus) {
  const target = annotations.find(a => a.id === id);
  if (!target) return;

  // Toggle status if clicked again, or set new status
  target.status = (target.status === newStatus) ? 'pending' : newStatus;

  redrawCanvas();
  renderReviewList();
  updateQualitySummary();
  saveToLocalStorage();

  canvasStatusText.textContent = `Updated #${formatLabel(target.label)} status to: ${target.status.toUpperCase()}`;
}

/**
 * Deletes a single annotation by ID.
 */
function deleteAnnotation(id) {
  const index = annotations.findIndex(a => a.id === id);
  if (index === -1) return;

  const removed = annotations.splice(index, 1)[0];

  redrawCanvas();
  renderReviewList();
  updateQualitySummary();
  saveToLocalStorage();

  canvasStatusText.textContent = `Deleted annotation #${index + 1} (${formatLabel(removed.label)}).`;
}

// --------------------------------------------------------------------
// 6. Quality Summary Statistics
// --------------------------------------------------------------------

/**
 * Recalculates metrics and updates the summary cards.
 */
function updateQualitySummary() {
  const total = annotations.length;
  const pending = annotations.filter(a => a.status === 'pending').length;
  const approved = annotations.filter(a => a.status === 'approved').length;
  const correction = annotations.filter(a => a.status === 'needs-correction').length;

  summaryTotal.textContent = total;
  summaryPending.textContent = pending;
  summaryApproved.textContent = approved;
  summaryCorrection.textContent = correction;
}

// --------------------------------------------------------------------
// 7. Clear All & Reset
// --------------------------------------------------------------------

clearAllBtn.addEventListener('click', () => {
  if (annotations.length === 0) {
    alert('There are no annotations to clear.');
    return;
  }

  const confirmed = confirm(
    `Are you sure you want to clear all ${annotations.length} annotations? This action cannot be undone.`
  );
  if (!confirmed) return;

  annotations = [];
  redrawCanvas();
  renderReviewList();
  updateQualitySummary();
  saveToLocalStorage();

  canvasStatusText.textContent = 'All annotations cleared.';
});

// --------------------------------------------------------------------
// 8. JSON Export Feature
// --------------------------------------------------------------------

exportJsonBtn.addEventListener('click', () => {
  if (!currentImage) {
    alert('Please upload or load an image before exporting annotations.');
    return;
  }

  // Build clean export payload matching requirement
  const exportData = {
    image: currentImageName,
    image_dimensions: {
      width: canvas.width,
      height: canvas.height
    },
    exported_at: new Date().toISOString(),
    quality_summary: {
      total: annotations.length,
      pending: annotations.filter(a => a.status === 'pending').length,
      approved: annotations.filter(a => a.status === 'approved').length,
      needs_correction: annotations.filter(a => a.status === 'needs-correction').length
    },
    annotations: annotations.map(ann => ({
      id: ann.id,
      label: ann.label,
      x: ann.x,
      y: ann.y,
      width: ann.width,
      height: ann.height,
      status: ann.status
    }))
  };

  // Convert to formatted JSON string
  const jsonString = JSON.stringify(exportData, null, 2);

  // Create downloadable Blob
  const blob = new Blob([jsonString], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);

  // Trigger browser download
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = downloadUrl;
  downloadAnchor.download = 'annotations.json';
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  document.body.removeChild(downloadAnchor);

  // Revoke object URL to free memory
  URL.revokeObjectURL(downloadUrl);

  canvasStatusText.textContent = `Exported ${annotations.length} annotations to annotations.json`;
});

// --------------------------------------------------------------------
// 9. LocalStorage Persistence
// --------------------------------------------------------------------

/**
 * Saves current session state to browser LocalStorage.
 * Stored as a serialized JSON string.
 */
function saveToLocalStorage() {
  try {
    const sessionData = {
      imageName: currentImageName,
      annotations: annotations
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
  } catch (err) {
    console.warn('Unable to persist to LocalStorage:', err);
  }
}

/**
 * Restores saved annotations from LocalStorage on page load.
 */
function restoreFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const sessionData = JSON.parse(raw);
    if (sessionData && Array.isArray(sessionData.annotations)) {
      annotations = sessionData.annotations;
      console.log(`Restored ${annotations.length} annotations from LocalStorage.`);

      // If the saved session had a sample image loaded, auto-restore it
      if (sessionData.imageName === 'sample_football.jpg') {
        domainModeSelect.value = 'football';
        populateLabelDropdown('football');
        loadImageSource('images/sample_football.jpg', 'sample_football.jpg');
      } else if (sessionData.imageName === 'sample_street.jpg') {
        domainModeSelect.value = 'general';
        populateLabelDropdown('general');
        loadImageSource('images/sample_street.jpg', 'sample_street.jpg');
      } else {
        // Update metric summaries even before image is re-uploaded
        updateQualitySummary();
        renderReviewList();
        if (sessionData.imageName) {
          fileNameDisplay.textContent = `${sessionData.imageName} (Please re-upload image to view boxes)`;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to parse saved LocalStorage session:', err);
  }
}

// --------------------------------------------------------------------
// 10. String & Label Helpers
// --------------------------------------------------------------------

function getLabelColor(labelKey) {
  if (DOMAIN_PRESETS[currentDomain] && DOMAIN_PRESETS[currentDomain][labelKey]) {
    return DOMAIN_PRESETS[currentDomain][labelKey].color;
  }
  for (const domain in DOMAIN_PRESETS) {
    if (DOMAIN_PRESETS[domain][labelKey]) {
      return DOMAIN_PRESETS[domain][labelKey].color;
    }
  }
  return '#38bdf8';
}

function getLabelDisplayName(labelKey) {
  for (const domain in DOMAIN_PRESETS) {
    if (DOMAIN_PRESETS[domain][labelKey]) {
      return DOMAIN_PRESETS[domain][labelKey].name;
    }
  }
  return formatLabel(labelKey);
}

function formatLabel(str) {
  if (!str) return '';
  return str.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// --------------------------------------------------------------------
// Application Bootstrap
// --------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  populateLabelDropdown('football');
  restoreFromLocalStorage();
  
  // Auto-load football benchmark scene on first launch
  if (!currentImage) {
    loadImageSource('images/sample_football.jpg', 'sample_football.jpg');
  }

  updateQualitySummary();
  renderReviewList();
});

