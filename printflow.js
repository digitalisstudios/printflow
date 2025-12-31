/**
 * PrintFlow.js - Auto-flow HTML content into printable pages
 *
 * Usage:
 *   new PrintFlow({
 *     contentSelector: '#content-source',
 *     pagesContainer: '#pages-container',
 *     tocContainer: '#toc-entries',  // optional
 *     pageStartNumber: 3,            // optional, default 1
 *   }).flow();
 */

class PrintFlow {
    constructor(options = {}) {
        // Page dimensions (in pixels at 96 DPI)
        this.PAGE_WIDTH = (options.pageWidth || 8.5) * 96;
        this.PAGE_HEIGHT = (options.pageHeight || 11) * 96;
        this.PADDING_TOP = (options.paddingTop || 0.6) * 96;
        this.PADDING_BOTTOM = (options.paddingBottom || 0.8) * 96;
        this.PADDING_X = (options.paddingX || 0.6) * 96;
        this.CONTENT_HEIGHT = this.PAGE_HEIGHT - this.PADDING_TOP - this.PADDING_BOTTOM;
        this.CONTENT_WIDTH = this.PAGE_WIDTH - (this.PADDING_X * 2);

        // Pagination behavior
        this.MIN_CONTENT_AFTER_HEADER = options.minContentAfterHeader || 200;
        this.HEADER_ONLY_THRESHOLD = options.headerOnlyThreshold || 100;

        // Selectors
        this.sectionSelector = options.sectionSelector || '.section';
        this.headerSelector = options.headerSelector || 'h2';
        this.subHeaderSelector = options.subHeaderSelector || 'h3';

        // Containers
        this.contentSource = typeof options.contentSelector === 'string'
            ? document.querySelector(options.contentSelector)
            : options.contentSelector;
        this.pagesContainer = typeof options.pagesContainer === 'string'
            ? document.querySelector(options.pagesContainer)
            : options.pagesContainer;

        // TOC options
        this.generateToc = options.generateToc !== false; // default true
        this.tocContainer = options.tocContainer
            ? (typeof options.tocContainer === 'string'
                ? document.querySelector(options.tocContainer)
                : options.tocContainer)
            : null;

        // Page numbering
        this.pageStartNumber = options.pageStartNumber || 1;
        this.currentPageNumber = this.pageStartNumber;

        // State
        this.currentPage = null;
        this.currentPageContent = null;
        this.currentPageHeight = 0;
        this.tocItems = [];
        this.generatedIds = new Set();

        // Callbacks
        this.onPageCreate = options.onPageCreate || null;
        this.onSectionAdd = options.onSectionAdd || null;
        this.onComplete = options.onComplete || null;
    }

    /**
     * Main method - flow content into pages
     */
    flow() {
        if (!this.contentSource || !this.pagesContainer) {
            console.error('PrintFlow: contentSource and pagesContainer are required');
            return;
        }

        // Inject required styles if not already present
        this.injectStyles();

        const sections = Array.from(this.contentSource.querySelectorAll(this.sectionSelector));

        let i = 0;
        while (i < sections.length) {
            const section = sections[i];
            const sectionHeight = this.measureElement(section);

            // Collect sections that should stay together
            const groupedSections = [section];
            let groupHeight = sectionHeight;

            // If this is a header-only section, group it with the next section
            if (this.isHeaderOnlySection(section) && i + 1 < sections.length) {
                const nextSection = sections[i + 1];
                groupedSections.push(nextSection);
                groupHeight += this.measureElement(nextSection);
                i++;
            }
            // If adding this section would leave insufficient space after header
            else if (section.querySelector(this.headerSelector)) {
                const spaceRemaining = this.CONTENT_HEIGHT - this.currentPageHeight - sectionHeight;
                if (this.currentPage && spaceRemaining < this.MIN_CONTENT_AFTER_HEADER && spaceRemaining < sectionHeight * 0.3) {
                    this.createNewPage();
                }
            }

            // Check if we need a new page for the group
            if (!this.currentPage || this.currentPageHeight + groupHeight > this.CONTENT_HEIGHT) {
                this.createNewPage();
            }

            // Add all sections in the group to current page
            groupedSections.forEach(sect => {
                const sectionClone = sect.cloneNode(true);

                // Track TOC item
                const tocTitle = this.getTocTitle(sectionClone);
                const isIndent = this.shouldIndent(sectionClone);

                // Generate ID if missing
                let sectionId = sectionClone.id;
                if (!sectionId && tocTitle) {
                    sectionId = this.generateId(tocTitle);
                    sectionClone.id = sectionId;
                }

                this.currentPageContent.appendChild(sectionClone);

                if (tocTitle && sectionId) {
                    this.tocItems.push({
                        title: tocTitle,
                        id: sectionId,
                        page: this.currentPageNumber,
                        indent: isIndent
                    });
                }

                if (this.onSectionAdd) {
                    this.onSectionAdd(sectionClone, this.currentPage, this.currentPageNumber);
                }
            });

            this.currentPageHeight += groupHeight;
            i++;
        }

        // Build TOC if enabled and container provided
        if (this.generateToc && this.tocContainer) {
            this.buildToc();
            this.setupTocNavigation();
        }

        if (this.onComplete) {
            this.onComplete(this.currentPageNumber, this.tocItems);
        }

        return {
            totalPages: this.currentPageNumber,
            tocItems: this.tocItems
        };
    }

    /**
     * Create a new page
     */
    createNewPage() {
        this.currentPage = document.createElement('div');
        this.currentPage.className = 'page';
        this.currentPage.id = 'page-' + this.currentPageNumber;

        this.currentPageContent = document.createElement('div');
        this.currentPageContent.className = 'page-content';
        this.currentPage.appendChild(this.currentPageContent);

        const pageNumEl = document.createElement('div');
        pageNumEl.className = 'page-number';
        pageNumEl.textContent = this.currentPageNumber;
        this.currentPage.appendChild(pageNumEl);

        this.pagesContainer.appendChild(this.currentPage);

        if (this.onPageCreate) {
            this.onPageCreate(this.currentPage, this.currentPageNumber);
        }

        this.currentPageHeight = 0;
        this.currentPageNumber++;
    }

    /**
     * Measure an element's height
     */
    measureElement(element) {
        const temp = document.createElement('div');
        temp.style.position = 'absolute';
        temp.style.visibility = 'hidden';
        temp.style.width = this.CONTENT_WIDTH + 'px';
        temp.appendChild(element.cloneNode(true));
        document.body.appendChild(temp);
        const height = temp.offsetHeight;
        document.body.removeChild(temp);
        return height;
    }

    /**
     * Check if a section is header-only (small, just a heading)
     */
    isHeaderOnlySection(section) {
        const header = section.querySelector(this.headerSelector);
        if (!header) return false;
        const height = this.measureElement(section);
        return height < this.HEADER_ONLY_THRESHOLD;
    }

    /**
     * Get TOC title from section content
     */
    getTocTitle(section) {
        // Check for explicit data-toc attribute first
        const dataToc = section.getAttribute('data-toc');
        if (dataToc) return dataToc;

        // Auto-detect from h2, fallback to h3
        const header = section.querySelector(this.headerSelector)
            || section.querySelector(this.subHeaderSelector);
        return header ? header.textContent.trim() : null;
    }

    /**
     * Determine if section should be indented in TOC
     * A section with h3 but no h2 is a subsection
     */
    shouldIndent(section) {
        if (section.getAttribute('data-toc-indent') === 'true') return true;
        return !section.querySelector(this.headerSelector)
            && section.querySelector(this.subHeaderSelector);
    }

    /**
     * Generate a unique ID from text
     */
    generateId(text) {
        let baseId = text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        let id = baseId;
        let counter = 1;

        // Ensure uniqueness
        while (this.generatedIds.has(id)) {
            id = `${baseId}-${counter}`;
            counter++;
        }

        this.generatedIds.add(id);
        return id;
    }

    /**
     * Build the table of contents
     */
    buildToc() {
        this.tocContainer.innerHTML = '';

        this.tocItems.forEach(item => {
            const entry = document.createElement('a');
            entry.href = '#' + item.id;
            entry.className = 'toc-entry' + (item.indent ? ' indent' : '');
            entry.innerHTML = `
                <span class="toc-text">${item.title}</span>
                <span class="toc-dots"></span>
                <span class="toc-page-num">${item.page}</span>
            `;
            this.tocContainer.appendChild(entry);
        });
    }

    /**
     * Setup smooth scrolling for TOC navigation
     */
    setupTocNavigation() {
        document.querySelectorAll('.toc-entry').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);
                const target = document.getElementById(targetId);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    /**
     * Inject required styles into the document
     */
    injectStyles() {
        if (document.getElementById('printflow-styles')) return;

        const style = document.createElement('style');
        style.id = 'printflow-styles';
        style.textContent = this.getStyles();
        document.head.appendChild(style);
    }

    /**
     * Get CSS for paginated documents
     */
    getStyles() {
        const pageWidth = this.PAGE_WIDTH / 96;
        const pageHeight = this.PAGE_HEIGHT / 96;
        const paddingTop = this.PADDING_TOP / 96;
        const paddingBottom = this.PADDING_BOTTOM / 96;
        const paddingX = this.PADDING_X / 96;

        return `
            .page {
                width: ${pageWidth}in;
                height: ${pageHeight}in;
                padding: ${paddingTop}in ${paddingX}in ${paddingBottom}in;
                margin: 0.25in auto;
                background: white;
                position: relative;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                box-sizing: border-box;
            }

            .page-content {
                height: calc(${pageHeight}in - ${paddingTop + paddingBottom}in);
                overflow: hidden;
            }

            .page-number {
                position: absolute;
                bottom: 0.4in;
                right: ${paddingX}in;
                font-size: 10pt;
                color: #666;
            }

            .section {
                break-inside: avoid;
                margin-bottom: 1.5em;
            }

            /* TOC Styles */
            .toc-entry {
                display: flex;
                align-items: baseline;
                margin: 0.6em 0;
                text-decoration: none;
                color: inherit;
                cursor: pointer;
            }

            .toc-entry.indent {
                padding-left: 1.5em;
                font-size: 0.9em;
            }

            .toc-text {
                flex-shrink: 0;
            }

            .toc-dots {
                flex-grow: 1;
                border-bottom: 1px dotted #ccc;
                margin: 0 0.75em;
                min-width: 1em;
            }

            .toc-page-num {
                flex-shrink: 0;
                color: #666;
            }

            a.toc-entry:hover {
                background: #f5f5f5;
            }

            a.toc-entry:hover .toc-text {
                color: #0066cc;
                text-decoration: underline;
            }

            /* Print styles */
            @media print {
                body {
                    background: white;
                }

                .page {
                    margin: 0;
                    box-shadow: none;
                    page-break-after: always;
                    page-break-inside: avoid;
                }

                .page:last-child {
                    page-break-after: avoid;
                }

                @page {
                    size: letter;
                    margin: 0;
                }
            }
        `;
    }

    /**
     * Get default CSS (static method for external use)
     */
    static getDefaultStyles(options = {}) {
        const pf = new PrintFlow(options);
        return pf.getStyles();
    }
}

/**
 * PrintFlowEditor - Extends PrintFlow with real-time editable reflow
 *
 * Usage:
 *   new PrintFlowEditor({
 *     contentSelector: '#content-source',
 *     pagesContainer: '#pages-container',
 *     editable: true
 *   }).flow();
 */
class PrintFlowEditor extends PrintFlow {
    constructor(options = {}) {
        super(options);

        this.editable = options.editable !== false;
        this.reflowDelay = options.reflowDelay || 300;
        this.reflowTimeout = null;
        this.isReflowing = false;
        this.pages = [];

        // Callbacks
        this.onReflow = options.onReflow || null;
    }

    /**
     * Override flow to enable editing after initial layout
     */
    flow() {
        const result = super.flow();

        if (this.editable) {
            this.enableEditing();
        }

        return result;
    }

    /**
     * Enable contenteditable and watch for changes
     */
    enableEditing() {
        // Store references to all pages
        this.pages = Array.from(this.pagesContainer.querySelectorAll('.page'));

        // Make page content editable
        this.pages.forEach(page => {
            const content = page.querySelector('.page-content');
            if (content) {
                content.contentEditable = 'true';
                content.style.outline = 'none';
            }
        });

        // Watch for mutations
        this.observer = new MutationObserver(this.handleMutation.bind(this));
        this.observer.observe(this.pagesContainer, {
            childList: true,
            subtree: true,
            characterData: true
        });

        // Handle paste events
        this.pagesContainer.addEventListener('paste', this.handlePaste.bind(this));

        // Handle keydown for special cases (only at page boundaries)
        this.pagesContainer.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    /**
     * Disable editing mode
     */
    disableEditing() {
        if (this.observer) {
            this.observer.disconnect();
        }

        this.pages.forEach(page => {
            const content = page.querySelector('.page-content');
            if (content) {
                content.contentEditable = 'false';
            }
        });
    }

    /**
     * Handle mutations (content changes)
     */
    handleMutation(mutations) {
        if (this.isReflowing) return;

        // Check if any page is overflowing or has room to pull content
        const needsReflow = this.checkNeedsReflow();
        if (!needsReflow) return;

        // Debounce reflow
        clearTimeout(this.reflowTimeout);
        this.reflowTimeout = setTimeout(() => {
            this.reflow();
        }, this.reflowDelay);
    }

    /**
     * Check if reflow is needed (overflow or underflow)
     */
    checkNeedsReflow() {
        const pages = Array.from(this.pagesContainer.querySelectorAll('.page'));

        for (let i = 0; i < pages.length; i++) {
            const content = pages[i].querySelector('.page-content');
            if (!content) continue;

            // Check for overflow - content taller than container
            if (content.scrollHeight > content.clientHeight + 10) {
                return true;
            }

            // Check for underflow - room to pull content from next page
            if (i < pages.length - 1) {
                const nextContent = pages[i + 1].querySelector('.page-content');
                if (nextContent && nextContent.children.length > 0) {
                    const currentHeight = content.scrollHeight;
                    const availableSpace = this.CONTENT_HEIGHT - currentHeight;

                    // Get first child of next page to see if it would fit
                    const firstChild = nextContent.children[0];
                    if (firstChild) {
                        const firstChildHeight = this.measureElement(firstChild);
                        if (firstChildHeight < availableSpace - 10) {
                            return true;
                        }
                    }
                }
            }
        }

        // Check if we can consolidate pages (last page could merge with previous)
        if (pages.length > 1) {
            const lastContent = pages[pages.length - 1].querySelector('.page-content');
            const secondLastContent = pages[pages.length - 2]?.querySelector('.page-content');

            if (lastContent && secondLastContent) {
                const lastHeight = lastContent.scrollHeight;
                const secondLastHeight = secondLastContent.scrollHeight;
                const availableSpace = this.CONTENT_HEIGHT - secondLastHeight;

                // If last page content could fit in available space of second-to-last
                if (lastHeight < availableSpace - 20) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Handle paste - strip formatting and reflow
     */
    handlePaste(e) {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    }

    /**
     * Handle special keystrokes
     */
    handleKeydown(e) {
        // Only intercept backspace at the very start of a page to merge with previous
        if (e.key === 'Backspace') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                const pageContent = this.getPageContentFromNode(range.startContainer);

                if (pageContent && this.isAtStartOfContent(pageContent, range)) {
                    const pageIndex = this.getPageIndex(pageContent.parentElement);
                    if (pageIndex > 0) {
                        e.preventDefault();
                        this.mergeWithPreviousPage(pageIndex);
                        return;
                    }
                }
            }
            // Otherwise let backspace work normally - reflow will handle pagination
        }
    }

    /**
     * Get page-content element from a node
     */
    getPageContentFromNode(node) {
        while (node && !node.classList?.contains('page-content')) {
            node = node.parentElement;
        }
        return node;
    }

    /**
     * Check if cursor is at very start of page content
     */
    isAtStartOfContent(content, range) {
        // Must be at offset 0
        if (range.startOffset !== 0) return false;

        // Walk up the tree - if any ancestor has a previous sibling, we're not at the start
        let node = range.startContainer;
        while (node && node !== content) {
            if (node.previousSibling) {
                // Check if previous sibling has any actual content
                const prev = node.previousSibling;
                if (prev.textContent && prev.textContent.trim().length > 0) {
                    return false;
                }
            }
            node = node.parentElement;
        }
        return node === content;
    }

    /**
     * Get page index from page element
     */
    getPageIndex(page) {
        return this.pages.indexOf(page);
    }

    /**
     * Reflow content across all pages
     */
    reflow() {
        this.isReflowing = true;

        // Save cursor position
        const cursorInfo = this.saveCursorPosition();

        // Collect all content from all pages
        const allContent = this.collectAllContent();

        // Clear existing pages
        this.pagesContainer.innerHTML = '';
        this.pages = [];
        this.currentPageNumber = this.pageStartNumber;
        this.currentPage = null;
        this.currentPageContent = null;
        this.currentPageHeight = 0;

        // Re-flow content
        allContent.forEach(node => {
            const nodeHeight = this.measureElement(node);

            // Check if we need a new page
            if (!this.currentPage || this.currentPageHeight + nodeHeight > this.CONTENT_HEIGHT) {
                this.createEditablePage();
            }

            this.currentPageContent.appendChild(node);
            this.currentPageHeight += nodeHeight;
        });

        // Ensure at least one page exists
        if (!this.currentPage) {
            this.createEditablePage();
        }

        // Update pages array
        this.pages = Array.from(this.pagesContainer.querySelectorAll('.page'));

        // Restore cursor position
        this.restoreCursorPosition(cursorInfo);

        this.isReflowing = false;

        if (this.onReflow) {
            this.onReflow(this.pages.length);
        }
    }

    /**
     * Collect all content nodes from all pages
     */
    collectAllContent() {
        const content = [];
        this.pages = Array.from(this.pagesContainer.querySelectorAll('.page'));

        this.pages.forEach(page => {
            const pageContent = page.querySelector('.page-content');
            if (pageContent) {
                // Get all direct children (sections or other elements)
                Array.from(pageContent.children).forEach(child => {
                    content.push(child.cloneNode(true));
                });
            }
        });

        return content;
    }

    /**
     * Create a new editable page
     */
    createEditablePage() {
        this.createNewPage();

        // Make it editable
        if (this.currentPageContent) {
            this.currentPageContent.contentEditable = 'true';
            this.currentPageContent.style.outline = 'none';
        }

        this.pages.push(this.currentPage);
    }

    /**
     * Merge current page with previous page
     */
    mergeWithPreviousPage(pageIndex) {
        if (pageIndex <= 0) return;

        const currentPage = this.pages[pageIndex];
        const prevPage = this.pages[pageIndex - 1];

        const currentContent = currentPage.querySelector('.page-content');
        const prevContent = prevPage.querySelector('.page-content');

        if (currentContent && prevContent) {
            // Move cursor to end of previous page
            const lastChild = prevContent.lastChild;
            if (lastChild) {
                const range = document.createRange();
                const sel = window.getSelection();

                if (lastChild.nodeType === Node.TEXT_NODE) {
                    range.setStart(lastChild, lastChild.length);
                } else {
                    range.setStartAfter(lastChild);
                }
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }

            // Trigger reflow to handle content redistribution
            this.reflow();
        }
    }

    /**
     * Save cursor position before reflow
     */
    saveCursorPosition() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;

        const range = selection.getRangeAt(0);
        const pageContent = this.getPageContentFromNode(range.startContainer);

        if (!pageContent) return null;

        // Calculate global text offset
        const pageIndex = this.getPageIndex(pageContent.parentElement);
        const localOffset = this.getTextOffset(pageContent, range.startContainer, range.startOffset);

        // Calculate global offset by adding text from previous pages
        let globalOffset = localOffset;
        for (let i = 0; i < pageIndex; i++) {
            const prevContent = this.pages[i].querySelector('.page-content');
            if (prevContent) {
                globalOffset += this.getTextLength(prevContent);
            }
        }

        // Also track if we're at end of content (for new lines)
        const totalLength = this.getTotalTextLength();
        const atEnd = globalOffset >= totalLength;

        return { globalOffset, atEnd };
    }

    /**
     * Get total text length across all pages
     */
    getTotalTextLength() {
        let total = 0;
        this.pages.forEach(page => {
            const content = page.querySelector('.page-content');
            if (content) {
                total += this.getTextLength(content);
            }
        });
        return total;
    }

    /**
     * Restore cursor position after reflow
     */
    restoreCursorPosition(cursorInfo) {
        if (!cursorInfo) return;

        // If cursor was at end, place it at end of last page
        if (cursorInfo.atEnd) {
            const lastPage = this.pages[this.pages.length - 1];
            if (lastPage) {
                const content = lastPage.querySelector('.page-content');
                if (content) {
                    this.placeCursorAtEnd(content);
                }
            }
            return;
        }

        let remainingOffset = cursorInfo.globalOffset;

        // Find which page and position
        for (const page of this.pages) {
            const content = page.querySelector('.page-content');
            if (!content) continue;

            const pageTextLength = this.getTextLength(content);

            if (remainingOffset <= pageTextLength) {
                // Cursor is on this page
                const position = this.findPositionFromOffset(content, remainingOffset);
                if (position) {
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.setStart(position.node, position.offset);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);

                    // Scroll into view
                    position.node.parentElement?.scrollIntoView({ block: 'nearest' });
                }
                return;
            }

            remainingOffset -= pageTextLength;
        }

        // Fallback: place at end of last page
        const lastPage = this.pages[this.pages.length - 1];
        if (lastPage) {
            const content = lastPage.querySelector('.page-content');
            if (content) {
                this.placeCursorAtEnd(content);
            }
        }
    }

    /**
     * Place cursor at end of an element
     */
    placeCursorAtEnd(element) {
        const range = document.createRange();
        const sel = window.getSelection();

        // Find last text node or use element itself
        const lastText = this.getLastTextNode(element);
        if (lastText) {
            range.setStart(lastText, lastText.length);
        } else {
            range.selectNodeContents(element);
            range.collapse(false);
        }

        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);

        element.scrollIntoView({ block: 'nearest' });
    }

    /**
     * Get total text length of an element
     */
    getTextLength(element) {
        return element.textContent?.length || 0;
    }

    /**
     * Get text offset from start of container to a specific position
     */
    getTextOffset(container, targetNode, targetOffset) {
        let offset = 0;
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);

        let node;
        while ((node = walker.nextNode())) {
            if (node === targetNode) {
                return offset + targetOffset;
            }
            offset += node.length;
        }

        return offset;
    }

    /**
     * Find node and offset from global text offset
     */
    findPositionFromOffset(container, targetOffset) {
        let currentOffset = 0;
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);

        let node;
        while ((node = walker.nextNode())) {
            const nodeLength = node.length;
            if (currentOffset + nodeLength >= targetOffset) {
                return {
                    node: node,
                    offset: targetOffset - currentOffset
                };
            }
            currentOffset += nodeLength;
        }

        // If not found, return end of container
        const lastText = this.getLastTextNode(container);
        if (lastText) {
            return { node: lastText, offset: lastText.length };
        }

        return null;
    }

    /**
     * Get last text node in container
     */
    getLastTextNode(container) {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        let lastNode = null;
        while (walker.nextNode()) {
            lastNode = walker.currentNode;
        }
        return lastNode;
    }

    /**
     * Get current content as HTML
     */
    getContent() {
        const content = [];
        this.pages.forEach(page => {
            const pageContent = page.querySelector('.page-content');
            if (pageContent) {
                content.push(pageContent.innerHTML);
            }
        });
        return content;
    }

    /**
     * Get current content as flat HTML
     */
    getContentFlat() {
        return this.collectAllContent()
            .map(node => node.outerHTML)
            .join('\n');
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PrintFlow, PrintFlowEditor };
}
