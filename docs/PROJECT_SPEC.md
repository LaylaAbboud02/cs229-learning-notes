# Product Specification

## Product statement

CS229 Learning Notes is a public static website that documents Layla Abboud's progress through the public 2018 Stanford CS229 lecture series. It presents original handwritten lecture and exercise notes as polished, browsable PDF entries with concise context and source attribution.

## Primary goal

Help a visitor understand what Layla is studying, how the learning is progressing, and what each handwritten note contains.

## Secondary goals

- Maintain a meaningful public GitHub project while studying.
- Demonstrate independent learning, organization, frontend work, and technical communication.
- Make physical notes easy to revisit from any device.
- Create a reusable architecture for future note types without prematurely displaying empty sections.

## Audience

- Recruiters or collaborators viewing Layla's GitHub profile
- Other learners interested in the same CS229 material
- Layla revisiting her own notes

The experience should not assume that visitors want a complete tutorial. A short description and source links provide context; the PDF remains the primary content.

## Information architecture

### Home — `/`

- Project title and plain-language purpose
- Explicit unofficial-project disclaimer
- Manual lecture progress: lectures watched out of the configured 2018 total
- Automatic published-note count
- Recently published notes
- Links to the unified library, lectures, and exercises
- Compact author/about section

### Unified library — `/notes`

- All published note entries
- Default sort by `courseOrder`, then title
- Search over title, description, topics, lecture labels, and source labels
- Type filter
- Topic filter
- Optional newest-first sort chosen by the visitor; course order remains the default
- Empty and no-results states

### Lecture notes — `/lectures`

- Same collection and card components as `/notes`
- Fixed `lecture` type filter
- Course-sequence order
- Page is generated only because Lecture is an active configured type

### Exercise notes — `/exercises`

- Same collection and card components as `/notes`
- Fixed `exercise` type filter
- Course-sequence order

### Note detail — `/notes/[slug]`

- Breadcrumb and title
- Custom React PDF reader
- Metadata panel
- Description
- Related lectures and source links
- Topic tags
- Previous and next published notes in course order
- Download action
- Reader fallback containing a direct PDF link when rendering fails

### About — `/about`

- Layla's short reason for studying the course
- Project methodology
- Disclaimer that the site is unofficial and may contain errors
- Link to GitHub repository
- Licensing explanation

### 404

- Helpful link back to notes
- Same visual identity

## Responsive behavior

- Desktop note detail uses navigation, reader, and metadata regions without shrinking the PDF excessively.
- Tablet collapses metadata below or into a drawer.
- Mobile shows a full-width reader, horizontal/compact toolbar, metadata below, and an accessible navigation drawer.
- PDF controls must remain usable without hover.

## Search behavior

Version one searches the small public metadata dataset in the browser. It does not search handwriting inside PDFs. The UI must say what is searched and avoid implying OCR support.

Search fields:

- title
- description
- topics
- type label
- related lecture title/number
- source labels

Full-text/OCR indexing may be added later with Pagefind or another build-time index after reviewed transcriptions exist.

## Content and legal boundaries

- Publish Layla's original handwritten notes and original descriptions.
- Link to public course videos, notes, or exercise sources instead of rehosting them.
- Do not publish Stanford logos, copied slides, transcripts, assignment PDFs, or problem statements unless permission is clear.
- Display: `Unofficial personal learning notes. Not affiliated with or endorsed by Stanford University.`
- A download button is allowed, but the content-license notice must state that downloading does not grant republication rights.

## Version-one non-goals

- User uploads
- Authentication or accounts
- Backend or database
- CMS
- OCR or transcription
- AI-generated explanations or chatbot
- Multi-course or multi-edition support
- Dark theme
- Annotations inside the reader
- Offline/PWA behavior
- Visitor comments or likes
- Analytics or tracking

## Definition of launch-ready

- At least two real published PDFs
- Home, library, type pages, note detail, About, and 404 work at the GitHub Pages subpath
- The PDF reader works on current Chrome, Firefox, Safari, and a real mobile viewport or device
- Search, filters, ordering, and previous/next navigation work
- `pnpm add-note`, draft handling, publishing, and validation are documented and tested
- No draft or fixture PDF appears in the production output
- Automated checks and GitHub Pages deployment pass
- README and licensing notices accurately describe the project

