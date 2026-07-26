# Production-Quality NotebookLM-Style UI Redesign

Redesign [page.tsx](file:///c:/Users/samui/OneDrive/Desktop/GenAI_Cohort/chai_book_lm/src/app/notebooks/%5Bid%5D/page.tsx) into a polished, production-grade NotebookLM-inspired experience with rich visual design, smooth interactions, and thoughtful UX.

## Proposed Changes

### Design Language
- **Dark theme** with subtle glassmorphism (backdrop-blur, translucent panels)
- **Indigo-to-violet gradient accents** throughout for brand identity
- **Smooth micro-animations**: fade-in on mount, hover scale/glow, typing indicators, shimmer loading states
- **Inter font** via Google Fonts for modern typography
- **Three-column layout**: Sources sidebar → Chat center → Studio panel (right)

---

### Global Styles

#### [MODIFY] [globals.css](file:///c:/Users/samui/OneDrive/Desktop/GenAI_Cohort/chai_book_lm/src/app/globals.css)
- Add CSS keyframe animations (`fadeIn`, `slideUp`, `shimmer`, `pulse-glow`, `typingBounce`)
- Add custom scrollbar styling for the dark theme
- Override dark mode defaults for the black-on-black aesthetic

---

### Layout & Metadata

#### [MODIFY] [layout.tsx](file:///c:/Users/samui/OneDrive/Desktop/GenAI_Cohort/chai_book_lm/src/app/layout.tsx)
- Add Inter font from `next/font/google`
- Update metadata title/description to "ChaiBookLM"

---

### Notebook Detail Page (The Main Deliverable)

#### [MODIFY] [page.tsx](file:///c:/Users/samui/OneDrive/Desktop/GenAI_Cohort/chai_book_lm/src/app/notebooks/%5Bid%5D/page.tsx)

Complete rewrite with the following premium UI components:

**1. Header Bar**
- Back navigation to `/notebooks` with animated arrow
- Notebook name display (fetched via API)
- Subtle gradient bottom border

**2. Sources Sidebar (Left, ~280px)**
- Glassmorphic panel with `backdrop-blur`
- "Add Source" button with gradient border + glow hover effect
- Source cards with:
  - Type-specific icons (📄 PDF, 📝 Text, 🎥 YouTube, 🔗 URL, 🎬 VTT)
  - Animated status indicators (pulsing for indexing, check for ready, etc.)
  - Hover reveal of delete button
  - Checkbox selection for batch operations
  - Source count badge
- Collapsible sections for each source type
- Skeleton loading states while fetching

**3. Chat Panel (Center, flex-1)**
- Full message history (scrollable) — not just latest message
- User messages: right-aligned with indigo gradient background
- Assistant messages: left-aligned with subtle glass card, markdown-friendly typography
- Typing indicator animation (three bouncing dots) while waiting
- Citation chips inline with source references
- Empty state: large branded illustration area with suggested starter questions
- Suggested prompts as clickable chips (e.g., "Summarize all sources", "Key takeaways", "Compare topics")

**4. Input Bar (Bottom of chat)**
- Rounded glassmorphic bar with inner glow on focus
- Character count indicator
- Send button with gradient background + scale animation on hover
- Keyboard shortcut hint (Enter to send)

**5. Upload Modal (replaces inline panel)**
- Full-screen overlay with backdrop blur
- Tab interface: Text | File | YouTube | URL
- Drag & drop zone with animated border
- File preview after selection
- Progress indicator during upload
- Success/error toast notification

**6. Studio Panel (Right, ~300px)** *(new feature placeholder)*
- "Studio" section header
- Quick actions: "Generate summary", "Create study guide", "Generate podcast" (disabled/placeholder)
- Gives the NotebookLM feel of an AI workspace

---

### API Integration Notes
- All existing API endpoints remain unchanged
- Notebook name fetched from existing `GET /api/notebooks/[id]` (though this doesn't exist yet — will use notebook list and filter, or add a simple fetch)
- Sources fetched from `GET /api/sources?notebookId=...`
- Source delete via `DELETE /api/sources/[id]`

> [!NOTE]
> We'll fetch the notebook name by calling `GET /api/notebooks` and filtering by ID since there's no single-notebook GET endpoint. This is fine for now.

---

## Verification Plan

### Manual Verification
- Run `npm run dev` and navigate to a notebook detail page
- Verify all visual elements render correctly
- Test source upload (text, file, YouTube)
- Test source deletion
- Test chat message sending
- Verify responsive layout
- Check all animations and transitions
- Test loading/skeleton states
