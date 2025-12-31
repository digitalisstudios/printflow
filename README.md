# PrintFlow.js v1.0.0

A JavaScript library for auto-flowing HTML content into printable, paginated pages with real-time editing support.

## Features

- **Automatic Pagination** - Content flows into fixed-size pages (default 8.5" x 11")
- **Smart Section Handling** - Keeps headers with their content, prevents orphaned headings
- **Auto-generated TOC** - Table of contents with page numbers and anchor links
- **Real-time Editing** - `PrintFlowEditor` enables contenteditable with live reflow
- **Cursor Preservation** - Maintains cursor position across reflows
- **Print-ready Output** - CSS optimized for PDF export and printing
- **Zero Dependencies** - Pure vanilla JavaScript

## Installation

Download `printflow.js` and include it in your HTML:

```html
<script src="printflow.js"></script>
```

Or copy the contents into your project.

## Quick Start

### Basic Usage (Static Document)

```html
<!-- Hidden content source -->
<div id="content-source" style="display: none;">
    <div class="section" id="intro">
        <h2>Introduction</h2>
        <p>Your content here...</p>
    </div>
    <div class="section" id="details">
        <h2>Details</h2>
        <p>More content...</p>
    </div>
</div>

<!-- Container for generated pages -->
<div id="pages-container"></div>

<!-- Optional TOC container -->
<div id="toc-entries"></div>

<script src="printflow.js"></script>
<script>
    new PrintFlow({
        contentSelector: '#content-source',
        pagesContainer: '#pages-container',
        tocContainer: '#toc-entries'
    }).flow();
</script>
```

### Editable Document

```javascript
new PrintFlowEditor({
    contentSelector: '#content-source',
    pagesContainer: '#pages-container',
    tocContainer: '#toc-entries',
    pageStartNumber: 1
}).flow();
```

## Classes

### PrintFlow

The base class for static document pagination.

### PrintFlowEditor

Extends `PrintFlow` with real-time editing capabilities. Pages become `contenteditable` and content automatically reflows as you type.

## Options

### Page Dimensions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pageWidth` | Number | `8.5` | Page width in inches |
| `pageHeight` | Number | `11` | Page height in inches |
| `paddingTop` | Number | `0.6` | Top padding in inches |
| `paddingBottom` | Number | `0.8` | Bottom padding in inches |
| `paddingX` | Number | `0.6` | Left/right padding in inches |

### Selectors

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `contentSelector` | String/Element | *required* | Source content element or CSS selector |
| `pagesContainer` | String/Element | *required* | Container for generated pages |
| `tocContainer` | String/Element | `null` | Container for table of contents |
| `sectionSelector` | String | `'.section'` | CSS selector for content sections |
| `headerSelector` | String | `'h2'` | CSS selector for main headers |
| `subHeaderSelector` | String | `'h3'` | CSS selector for sub-headers |

### Behavior

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pageStartNumber` | Number | `1` | First page number |
| `generateToc` | Boolean | `true` | Whether to generate table of contents |
| `minContentAfterHeader` | Number | `200` | Minimum pixels of content required after a header on same page |
| `headerOnlyThreshold` | Number | `100` | Max height (px) for a section to be considered "header-only" |

### Editor Options (PrintFlowEditor only)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `editable` | Boolean | `true` | Enable editing mode |
| `reflowDelay` | Number | `300` | Milliseconds to debounce before reflow |

### Callbacks

| Option | Type | Description |
|--------|------|-------------|
| `onPageCreate` | Function | Called when a new page is created. Args: `(page, pageNumber)` |
| `onSectionAdd` | Function | Called when a section is added. Args: `(section, page, pageNumber)` |
| `onComplete` | Function | Called when pagination completes. Args: `(totalPages, tocItems)` |
| `onReflow` | Function | (Editor only) Called after reflow. Args: `(pageCount)` |

## Content Structure

### Sections

Wrap your content in `.section` divs. Each section is treated as an atomic unit that won't be split across pages.

```html
<div class="section">
    <h2>Section Title</h2>
    <p>Content that stays together...</p>
</div>
```

### Auto-generated IDs

If a section doesn't have an `id`, one will be generated from the header text:

```html
<!-- This section... -->
<div class="section">
    <h2>Getting Started</h2>
</div>

<!-- Gets id="getting-started" -->
```

### TOC Entries

TOC entries are automatically created from:
- `h2` elements (main entries)
- `h3` elements when no `h2` exists (indented entries)

Override with `data-toc` attribute:

```html
<div class="section" data-toc="Custom TOC Title">
    <h2>Actual Header</h2>
</div>
```

Force indentation with `data-toc-indent`:

```html
<div class="section" data-toc-indent="true">
    <h3>Subsection</h3>
</div>
```

### Header-Only Sections

Sections with just a header (< 100px tall) are automatically grouped with the following section to prevent orphaned headers:

```html
<!-- These will stay together -->
<div class="section">
    <h2>Chapter 1</h2>
</div>
<div class="section">
    <h3>First Topic</h3>
    <p>Content...</p>
</div>
```

## Methods

### PrintFlow

| Method | Returns | Description |
|--------|---------|-------------|
| `flow()` | `{ totalPages, tocItems }` | Paginate content and build pages |
| `getStyles()` | String | Get the CSS styles |

### PrintFlowEditor

| Method | Returns | Description |
|--------|---------|-------------|
| `flow()` | `{ totalPages, tocItems }` | Paginate and enable editing |
| `enableEditing()` | void | Enable contenteditable mode |
| `disableEditing()` | void | Disable contenteditable mode |
| `reflow()` | void | Manually trigger reflow |
| `getContent()` | Array | Get HTML content per page |
| `getContentFlat()` | String | Get all content as single HTML string |

## Styling

PrintFlow automatically injects required CSS when `flow()` is called. The styles include:

- Page container layout
- Page numbering positioning
- TOC entry formatting
- Print media queries

### Custom Styling

Add your own styles to customize appearance:

```css
/* Custom page background */
.page {
    background: #fafafa;
}

/* Custom section spacing */
.section {
    margin-bottom: 2em;
}

/* Style the page numbers */
.page-number {
    font-family: Georgia, serif;
    font-style: italic;
}

/* TOC customization */
.toc-entry {
    font-size: 14px;
}

.toc-dots {
    border-bottom-style: dashed;
}
```

## Examples

### Document with Cover Page

```html
<!-- Static cover page (not part of flow) -->
<div class="page" id="cover">
    <div class="cover-content">
        <h1>Document Title</h1>
        <p>Prepared: December 2024</p>
    </div>
</div>

<!-- Static TOC page -->
<div class="page" id="toc-page">
    <h1>Table of Contents</h1>
    <div id="toc-entries"></div>
</div>

<!-- Dynamic content pages -->
<div id="pages-container"></div>

<!-- Hidden source -->
<div id="content-source" style="display: none;">
    <!-- sections... -->
</div>

<script>
    new PrintFlow({
        contentSelector: '#content-source',
        pagesContainer: '#pages-container',
        tocContainer: '#toc-entries',
        pageStartNumber: 3  // Start after cover and TOC
    }).flow();
</script>
```

### Legal Size Paper

```javascript
new PrintFlow({
    contentSelector: '#content-source',
    pagesContainer: '#pages-container',
    pageWidth: 8.5,
    pageHeight: 14,  // Legal size
    paddingTop: 1,
    paddingBottom: 1
}).flow();
```

### A4 Paper

```javascript
new PrintFlow({
    contentSelector: '#content-source',
    pagesContainer: '#pages-container',
    pageWidth: 8.27,   // 210mm
    pageHeight: 11.69  // 297mm
}).flow();
```

### With Callbacks

```javascript
new PrintFlowEditor({
    contentSelector: '#content-source',
    pagesContainer: '#pages-container',
    onPageCreate: (page, num) => {
        console.log(`Created page ${num}`);
    },
    onComplete: (total, toc) => {
        console.log(`Document has ${total} pages`);
        console.log(`TOC entries:`, toc);
    },
    onReflow: (pageCount) => {
        document.getElementById('page-count').textContent = pageCount;
    }
}).flow();
```

### Disable TOC

```javascript
new PrintFlow({
    contentSelector: '#content-source',
    pagesContainer: '#pages-container',
    generateToc: false
}).flow();
```

### Get Content for Saving

```javascript
const editor = new PrintFlowEditor({
    contentSelector: '#content-source',
    pagesContainer: '#pages-container'
}).flow();

// Later, get edited content
document.getElementById('save-btn').addEventListener('click', () => {
    const html = editor.getContentFlat();
    // Save html to server, localStorage, etc.
});
```

## Browser Support

PrintFlow works in all modern browsers:
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Print / PDF Export

For best results when printing or saving as PDF:

1. Use Chrome's Print dialog (Cmd/Ctrl + P)
2. Select "Save as PDF"
3. **Disable** "Headers and footers" in More Settings
4. Set margins to "None" or "Default"

The print styles ensure each `.page` becomes a physical page with proper breaks.

## License

MIT License - free for personal and commercial use.

## Contributing

Issues and pull requests welcome at [repository URL].

---

**PrintFlow.js v1.0.0** - Auto-flow HTML content into printable pages.
