# MiniAnnotate – Image Annotation & Quality Review Tool

A lightweight, browser-based image annotation and supervisor quality review web application built using **HTML5 Canvas**, **CSS3**, and **Vanilla JavaScript**.

---

## 📌 Project Overview & Purpose

**MiniAnnotate** was developed as a hands-on portfolio project to demonstrate a practical, end-to-end understanding of computer vision data annotation workflows, coordinate mapping, and quality assurance (QA) supervision. 

As a Computer Science graduate (June 2026) with a background in full-stack web development and specialized training in image labeling (CVAT / Annotate Plus certified), I built this application from scratch to explore:
1. How 2D bounding boxes are drawn, formatted, and scaled mathematically onto original pixel dimensions.
2. How quality control (QC) workflows operate—specifically, how annotations are reviewed, marked as **Approved** or **Needs Correction**, and tracked using real-time quality metrics.
3. How annotation metadata is structured and exported into standardized machine-readable JSON for downstream model training pipelines (e.g., YOLO, Pascal VOC, or COCO formats).

> *Note: This is an independent portfolio project designed to demonstrate core engineering and data-supervision concepts; it does not claim to replace enterprise multi-user annotation platforms.*

---

## 🚀 Key Features

* **Dual-Domain Preset Support**:
  * ⚽ **Football Match Analytics Mode**: Labels specifically tailored for sports computer vision (`Player (Team Blue)`, `Player (Team Red)`, `Goalkeeper`, `Referee`, `Ball`, `Goalpost`) with a built-in football pitch test scene.
  * 🚗 **General Object Mode**: Classic benchmark classes (`Person`, `Car`, `Bicycle`, `Dog`, `Traffic Light`) with a street scene.
* **Image Ingestion**: Upload any match or street photo (`.jpg`, `.png`, `.webp`) or click one-click preset test buttons.
* **Canvas-Based Bounding Box Drawing**: Real-time crosshair drawing supporting drag-and-drop in any direction (top-left, bottom-right, etc.).
* **Coordinate Mapping Accuracy**: Automatically resolves the difference between the displayed canvas size on screen and the original high-resolution image dimensions.
* **Annotation Review Queue**: Each bounding box appears in an interactive supervisor review card showing coordinates (`X`, `Y`, `Width`, `Height`) and current status.
* **Three-State Quality Lifecycle**:
  * ⏳ **Pending**: Freshly created annotation waiting for inspection.
  * ✅ **Approved**: Inspected and verified as correct.
  * ⚠️ **Needs Correction**: Flagged for rework or boundary adjustment.
* **Real-Time Quality Dashboard**: Live summary counts for **Total**, **Pending**, **Approved**, and **Needs Fix**.
* **Session Persistence (LocalStorage)**: Automatically saves annotation data locally so progress is not lost upon browser refresh.
* **JSON Export**: One-click export that packages image metadata, quality statistics, and bounding box coordinates into an industry-standard `annotations.json` file.
* **Zero Dependencies**: Pure HTML, CSS, and Vanilla JavaScript—no node modules, build steps, or frameworks required.

---

## 🛠️ Technologies Used

| Technology | Purpose |
| :--- | :--- |
| **HTML5** | Semantic structure, file input, and accessibility |
| **HTML5 Canvas API** | 2D raster image rendering, vector bounding boxes, dynamic badges |
| **CSS3 (Flexbox & Grid)** | Responsive layout, dark theme, supervisor control panel styling |
| **Vanilla JavaScript (ES6+)** | State management, mouse event math, DOM updates, event handling |
| **Web Storage API (`localStorage`)** | Client-side session persistence across browser reloads |
| **JSON & Blob API** | Standardized data serialization and programmatic file download |
| **Git & GitHub** | Version control, documentation, and portfolio hosting |

---

## 📐 How It Works & Coordinate System Explanation

One of the most critical challenges in building an image annotation tool is **Coordinate Scaling**:

```
Screen Click (CSS Pixels)  ──▶  Scale Ratio Calculation  ──▶  True Image Coordinate (Saved)
```

1. **The Problem**: A high-resolution image (e.g., $1920 \times 1080$ px) is often scaled down by CSS to fit on a laptop screen (e.g., $960 \times 540$ px). If you record coordinates directly from the screen mouse click (`clientX`, `clientY`), your bounding boxes will be off by a factor of 2!
2. **The Solution**:
   * The internal canvas buffer (`canvas.width`, `canvas.height`) is set to match the image's original dimensions (`img.naturalWidth`, `img.naturalHeight`).
   * When a mouse event occurs, we find the display rectangle using `canvas.getBoundingClientRect()`.
   * We calculate the exact scaling factors:
     $$\text{scaleX} = \frac{\text{canvas.width}}{\text{rect.width}}, \quad \text{scaleY} = \frac{\text{canvas.height}}{\text{rect.height}}$$
   * The true image coordinates are calculated as:
     $$X_{\text{image}} = (X_{\text{mouse}} - \text{rect.left}) \times \text{scaleX}$$
     $$Y_{\text{image}} = (Y_{\text{mouse}} - \text{rect.top}) \times \text{scaleY}$$
   * As a result, bounding box coordinates are **lossless and independent of screen size or zoom level**.

---

## 📂 Project Structure

```text
MiniAnnotate/
│
├── index.html        # Main semantic markup, toolbar, canvas, and sidebar
├── style.css         # Modern dark-mode styling, grid metrics, and badges
├── app.js            # Pure JavaScript application logic, canvas drawing, QA state
├── README.md         # Comprehensive project documentation
└── images/
    └── sample_street.jpg # Built-in test image for quick demonstrations
```

---

## 💻 How to Run the Project

No installation or build steps are required.

### Option 1: Direct File Opening
Double-click `index.html` or drag it into any modern web browser (Chrome, Firefox, Edge, Safari).

### Option 2: Simple Local Server (Recommended)
If using Python:
```bash
# In the MiniAnnotate directory:
python -m http.server 8000
```
Then navigate to `http://localhost:8000` in your browser.

If using VS Code:
Right-click `index.html` and select **"Open with Live Server"**.

---

## 📄 Example Exported JSON

When you click **Export JSON**, the tool generates an `annotations.json` file structured as follows:

```json
{
  "image": "sample_street.jpg",
  "image_dimensions": {
    "width": 800,
    "height": 500
  },
  "exported_at": "2026-09-26T12:45:00.000Z",
  "quality_summary": {
    "total": 3,
    "pending": 0,
    "approved": 2,
    "needs_correction": 1
  },
  "annotations": [
    {
      "id": "ann_1695738200000_3x8a",
      "label": "person",
      "x": 135,
      "y": 158,
      "width": 32,
      "height": 75,
      "status": "approved"
    },
    {
      "id": "ann_1695738245000_9b2c",
      "label": "car",
      "x": 380,
      "y": 260,
      "width": 160,
      "height": 115,
      "status": "approved"
    },
    {
      "id": "ann_1695738270000_1f4d",
      "label": "traffic_light",
      "x": 680,
      "y": 118,
      "width": 26,
      "height": 120,
      "status": "needs-correction"
    }
  ]
}
```

---

## 🔮 Future Improvements

If extended for a collaborative team environment, the next architectural iterations would include:
1. **User Authentication & Role-Based Access (RBAC)**: Distinguish between "Annotator" (create/edit) and "Supervisor" (approve/reject/comment).
2. **Polygon & Keypoint Segmentation**: Extending beyond rectangular bounding boxes to support instance segmentation polygons.
3. **Backend Database & Storage**: Syncing annotations with a PostgreSQL/MongoDB database and AWS S3/Cloud Storage for managing large image batches.
4. **Inter-Annotator Agreement (IAA)**: Implementing Cohen's Kappa or Intersection over Union (IoU) calculation to benchmark consistency across multiple annotators.
5. **Shortcuts & Hotkeys**: Numeric keybindings (1-5) for rapid label switching and rapid approval navigation.

---

## 👤 Author & Background
 
* **Developer**: Computer Science Graduate (June 2026) | Junior Full-Stack Developer
* **Technical Experience**: Full-stack web application development (including final-year capstone *Bus Tracking & Ticketing System* and various interactive web apps) combined with specialized computer vision data annotation training (Annotate Plus certified, CVAT).
* **Focus**: Data Annotation Quality Assurance (QA/QC), Computer Vision Dataset Hygiene, and Sports/Football Video Analytics.
