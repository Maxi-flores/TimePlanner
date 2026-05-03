# ProfoundProjects Architecture

## Overview

ProfoundProjects is a comprehensive time planning and project management system that bridges browser-based planning with Obsidian vault note-taking. The system consists of a standalone HTML/JavaScript time planner and an integration layer for syncing with Obsidian markdown notes.

## System Components

### 1. Time Planner (index.html)

**Technology Stack:**
- Pure HTML5/CSS3/JavaScript (ES6+)
- No external dependencies
- LocalStorage for data persistence
- Client-side only (static deployment)

**Core Modules:**

#### 1.1 Calendar View
- Monthly grid calendar display
- Event visualization with category colors
- Day selection and detail panel
- Navigation (prev/next/today)

#### 1.2 Daily Schedule
- Hourly time block grid (5 AM - 11 PM)
- Visual time allocation
- Color-coded activity blocks
- Time conflict detection

#### 1.3 Roadmap/Milestones
- Kanban-style lanes organization
- Status tracking (todo, in-progress, done)
- Priority levels (high, medium, low)
- Lane categorization (Training, Finance, Development, etc.)

#### 1.4 Goals Tracking
- Monthly goal organization
- Task breakdown with checkboxes
- Progress calculation
- Category-based filtering

#### 1.5 Time Calculator
- Duration calculator
- Weekly hours tracker
- Date difference calculator
- Month summary statistics

### 2. Data Layer

**Storage Key:** `2026-planner-v1`

**Data Structures:**

```javascript
{
  events: [
    {
      id: "uuid",
      date: "YYYY-MM-DD",
      title: "string",
      category: "work|personal|goal|health|travel",
      start: "HH:MM",
      end: "HH:MM",
      notes: "string"
    }
  ],

  milestones: [
    {
      id: "uuid",
      title: "string",
      date: "YYYY-MM-DD",
      status: "todo|in-progress|done",
      lane: "string",
      priority: "high|medium|low",
      notes: "string"
    }
  ],

  goals: [
    {
      id: "uuid",
      title: "string",
      month: "YYYY-MM",
      category: "work|personal|health|travel|learning|finance",
      desc: "string",
      tasks: [
        {
          id: "uuid",
          text: "string",
          done: boolean
        }
      ]
    }
  ],

  blocks: {
    "YYYY-MM-DD": [
      {
        id: "uuid",
        title: "string",
        start: "HH:MM",
        end: "HH:MM",
        color: "#hex"
      }
    ]
  }
}
```

### 3. Obsidian Integration Layer

#### 3.1 Export System

**Purpose:** Convert planner data to Obsidian-compatible markdown files

**Process Flow:**
```
LocalStorage → JSON Export → Markdown Generation → ZIP Package → Download
```

**Output Structure:**
```
2026/
├── Events/
│   └── YYYY-MM/
│       └── YYYY-MM-DD Event Title.md
├── Milestones/
│   └── [Lane Name]/
│       └── YYYY-MM-DD Milestone Title.md
├── Goals/
│   └── YYYY-MM/
│       └── Goal Title.md
├── Daily/
│   └── YYYY-MM-DD.md (with time blocks)
└── Templates/
    ├── event-template.md
    ├── milestone-template.md
    └── goal-template.md
```

#### 3.2 Metadata Schema

**YAML Frontmatter Standard:**

```yaml
---
# Obsidian Projects Plugin Fields
status: "todo|in-progress|done"
priority: "high|medium|low"
tags: [2026, planner, category]

# Sync Fields
planner-id: "uuid-from-time-planner"
planner-type: "event|milestone|goal|time-block"
planner-category: "work|personal|goal|health|travel|learning|finance"

# Timeline Fields
date: "YYYY-MM-DD"
start-date: "YYYY-MM-DD"
end-date: "YYYY-MM-DD"
due: "YYYY-MM-DD"

# Additional Metadata
month: "YYYY-MM"
lane: "string"
progress: 0-100
source: "time-planner"
synced: "YYYY-MM-DDTHH:MM:SS"
---
```

#### 3.3 Obsidian Projects Plugin Integration

**Board View:**
- Columns: To Do | In Progress | Done
- Group by: `status` field
- Filter by: `planner-type`, `planner-category`, `priority`
- Sort by: `due` date

**Timeline View:**
- Start: `start-date` or `date` field
- End: `end-date` field
- Group by: `lane` or `planner-category`
- Color code: `priority` or `planner-type`

**Table View:**
- Columns: Title, Status, Priority, Category, Date, Progress
- Sortable and filterable by all metadata fields

## Architecture Patterns

### 1. State Management

**Pattern:** Single Source of Truth in LocalStorage

```javascript
// Load state
function loadState() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : defaultState();
}

// Save state
function saveState() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

// Global state
let state = loadState();
```

**Benefits:**
- Simple and reliable
- No backend required
- Instant persistence
- Works offline

**Limitations:**
- Browser-specific storage
- No multi-device sync (addressed by Obsidian integration)
- Storage size limits (~5-10MB)

### 2. View Management

**Pattern:** Tab-based Single Page Application

```javascript
function switchTab(name, btn) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  // Show selected view
  document.getElementById('view-' + name).classList.add('active');
  // Render view
  if (name === 'calendar') renderCalendar();
  // ... other views
}
```

**Benefits:**
- Fast view switching
- No page reloads
- Shared state across views
- Consistent UI

### 3. Event-Driven Updates

**Pattern:** Direct DOM manipulation with state sync

```javascript
function saveEvent() {
  // 1. Update state
  state.events.push(newEvent);

  // 2. Persist to storage
  saveState();

  // 3. Update affected views
  renderCalendar();
  if (currentPanelDate === ev.date) renderDayPanel();
}
```

### 4. Export Architecture

**Pattern:** Client-side transformation pipeline

```
State Object → Transformation Functions → Markdown Files → ZIP Archive
```

**Components:**
- **Data Readers:** Extract from localStorage
- **Transformers:** Convert to markdown with frontmatter
- **Generators:** Create file structure
- **Packager:** Bundle as ZIP
- **Downloader:** Trigger browser download

## Integration Workflows

### Workflow 1: Initial Setup

```
Use Time Planner → Add Events/Milestones/Goals → Click Export Button →
Download ZIP → Extract to 2026 Vault → Obsidian Auto-indexes Notes →
Configure Projects Plugin → View in Board/Timeline
```

### Workflow 2: Regular Sync

```
Update Planner Data → Export to Obsidian → Compare with Existing Notes →
Changes Detected? → Update Modified Notes → Preserve Manual Edits →
Update Sync Timestamp
```

### Workflow 3: Bidirectional Sync (Future)

```
Planner Changes → Export JSON ──┐
                                ├→ Sync Service → Conflict Resolution → Update Both
Obsidian Changes → Parse ───────┘
```

## Deployment Architecture

### Current: Static Site

```
┌─────────────────┐
│   Vercel CDN    │
│                 │
│  index.html     │
│  planner.png    │
│  vercel.json    │
└─────────────────┘
        ↓
┌─────────────────┐
│  User Browser   │
│                 │
│  LocalStorage   │
└─────────────────┘
```

**Deployment Configuration (vercel.json):**
```json
{
  "routes": [
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

### Future: Integrated System

```
┌──────────────┐     ┌──────────────┐
│   Vercel     │────▶│  Next.js App │
│   Hosting    │     │  (Optional)  │
└──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Sync API    │
                     │  (Optional)  │
                     └──────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌──────────────┐                        ┌──────────────┐
│  Time Planner│                        │  Obsidian    │
│  (Browser)   │                        │  Vault       │
└──────────────┘                        └──────────────┘
```

## Data Flow Diagrams

### Event Creation Flow

```
User Input → Form Validation → Generate UUID → Update State →
Save LocalStorage → Re-render Calendar → Close Modal
```

### Export Flow

```
Click Export → Read State → For Each Item Type:
  ├─ Generate Frontmatter
  ├─ Generate Markdown Body
  ├─ Determine File Path
  └─ Add to Files Array
→ Create ZIP → Download
```

### Obsidian Sync Flow

```
Read Markdown Files → Parse Frontmatter → Extract planner-id →
Match with Planner Data → Compare Timestamps →
Update Changed Fields → Preserve User Content → Write Files
```

## Security Considerations

### Current Implementation

1. **No Authentication:** Static site, no user accounts
2. **Client-side Storage:** Data never leaves browser
3. **No API Calls:** No external data transmission
4. **XSS Protection:** Minimal user input, sanitization needed for notes field

### Future Enhancements

1. **Input Sanitization:** Sanitize user-entered text
2. **CORS Policies:** If API added
3. **Encryption:** Optional localStorage encryption
4. **Git Security:** Obsidian vault with Git authentication

## Performance Considerations

### Current Performance

- **Load Time:** <100ms (single HTML file, no bundling)
- **Render Speed:** Instant (client-side rendering)
- **Storage Limits:** ~5MB localStorage (~5000 events estimated)
- **Calendar Render:** O(n) where n = days in month
- **Export Time:** <1s for typical dataset

### Optimization Strategies

1. **Lazy Loading:** Load views on-demand
2. **Virtual Scrolling:** For large event lists
3. **Debouncing:** On calculator inputs
4. **Caching:** Rendered calendar cells
5. **Compression:** ZIP export already compressed

## Extensibility Points

### 1. Custom Categories

Add new categories by extending:
```javascript
const CATEGORIES = ['work', 'personal', 'goal', 'health', 'travel', 'NEW_CATEGORY'];
```

### 2. Custom Lanes

Add roadmap lanes dynamically through UI or state:
```javascript
milestones: [{ lane: "Custom Lane Name", ... }]
```

### 3. Export Formats

Extend export system:
```javascript
function exportToFormat(format) {
  switch(format) {
    case 'obsidian': return exportToObsidian();
    case 'json': return exportToJSON();
    case 'csv': return exportToCSV();
    // Add more formats
  }
}
```

### 4. Plugins/Extensions

Future plugin architecture:
```javascript
const plugins = {
  beforeSave: [],
  afterSave: [],
  beforeExport: [],
  afterExport: []
};
```

## Technology Decisions

### Why Pure JavaScript?

1. **No Build Step:** Deploy directly
2. **No Dependencies:** No npm, no bundler
3. **Maximum Compatibility:** Works everywhere
4. **Easy Maintenance:** Single file
5. **Fast Loading:** No framework overhead

### Why LocalStorage?

1. **Simplicity:** Built-in browser API
2. **Synchronous:** No async complexity
3. **Persistent:** Survives page reload
4. **Sufficient:** For single-user planning

### Why Obsidian Integration?

1. **Portable:** Markdown files
2. **Version Control:** Git integration
3. **Extensible:** Rich plugin ecosystem
4. **Multi-device:** Through Obsidian Sync or Git
5. **Future-proof:** Plain text format

## Development Roadmap

### Phase 1: Core Features ✅
- Calendar view
- Daily schedule
- Roadmap/milestones
- Goals tracking
- Time calculator
- LocalStorage persistence

### Phase 2: Obsidian Integration (In Progress)
- Export functionality
- Markdown generation
- Frontmatter standardization
- ZIP packaging
- Template system

### Phase 3: Enhanced Sync
- Bidirectional sync script
- Conflict resolution
- Incremental updates
- Sync status dashboard

### Phase 4: Advanced Features
- Recurring events
- Reminders/notifications
- Custom themes
- Import from external sources
- Collaborative features (optional)

## File Structure

```
ProfoundProjects/
├── index.html              # Main application
├── planner.png            # Preview image
├── vercel.json            # Deployment config
├── README.md              # Project documentation
├── Architecture.md        # This file
├── CONCEPT-PLAN/
│   └── 26.4.25 @         # Planning notes
└── .git/                  # Version control
```

## Related Repositories

- **ProfoundProjects:** Main time planner application (this repo)
- **2026:** Obsidian vault with notes and projects (separate repo)

## Contributing Guidelines

### Code Style

- Use ES6+ features
- Keep functions small and focused
- Comment complex logic
- Use descriptive variable names
- Follow existing patterns

### Testing

- Test in multiple browsers (Chrome, Firefox, Safari, Edge)
- Verify localStorage persistence
- Test export functionality
- Validate markdown generation
- Check Obsidian compatibility

### Documentation

- Update this Architecture.md for structural changes
- Comment non-obvious code
- Document new features in README.md
- Update frontmatter schema if changed

## Support and Resources

- **Obsidian Projects Plugin:** https://github.com/marcusolsson/obsidian-projects
- **Obsidian Documentation:** https://help.obsidian.md/
- **Markdown Specification:** https://commonmark.org/
- **YAML Frontmatter:** https://jekyllrb.com/docs/front-matter/

## Version History

- **v1.0:** Initial time planner with calendar, schedule, roadmap, goals
- **v1.1:** Added Obsidian export planning (current)
- **v2.0:** (Planned) Full Obsidian integration with sync

---

**Last Updated:** 2026-04-25
**Maintained By:** Maxi-flores
**Repository:** https://github.com/Maxi-flores/ProfoundProjects
