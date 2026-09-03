# CS229 Learning Notes 🧚✨

A cozy little place for my handwritten notes as I work through Stanford’s public
[2018 CS229: Machine Learning](https://www.youtube.com/playlist?list=PLoROMvodv4rMiGQp3WXShtMGgzqpfVfbU)
lecture series.

I made this site to keep everything organised and easy to go over, and hopefully
helpful to anyone learning the same stuff!!

**[Visit the live notes →](https://laylaabboud02.github.io/cs229-learning-notes/)**

## What’s inside? 📖

* Handwritten lecture notes
* Browsable PDF pages
* Search and topic filters
* Lecture and exercise collections
* A custom PDF reader with zoom, rotation, fullscreen, and downloads
* My progress through the course

The collection will keep growing as I study and finish more notes.

## Want to make it your own?  🛠️

You’re welcome to fork this project and adapt the site for your own learning
notes, or simply run it locally to explore how it works.

This project uses Astro, React, TypeScript, Tailwind CSS, and pnpm.

You’ll need Node.js 24 and pnpm 11.25.0.

```bash
git clone https://github.com/LaylaAbboud02/cs229-learning-notes.git
cd cs229-learning-notes
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Then visit:

```text
http://localhost:4321/cs229-learning-notes/
```

To run all the main checks:

```bash
pnpm verify
pnpm test:browser
```

## Adding a new note 📝

The guided publishing command handles the PDF, metadata, page count, validation,
and thumbnail generation:

```bash
pnpm add-note /absolute/path/to/note.pdf
```

To continue an unfinished local draft:

```bash
pnpm publish-note <draft-slug>
```

To check all published notes:

```bash
pnpm validate-notes
```

You can find the complete publishing and recovery guide in
[`docs/PUBLISHING_WORKFLOW.md`](./docs/PUBLISHING_WORKFLOW.md).

## Using my notes 💌

You’re welcome to share, reuse, or adapt my original notes with credit.

My handwritten notes, PDFs, descriptions, and note thumbnails are licensed under
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

Suggested attribution:

> CS229 Learning Notes by Layla Abboud, licensed under CC BY 4.0.

The website’s source code is available under the [MIT License](./LICENSE). See
[`CONTENT-LICENSE.md`](./CONTENT-LICENSE.md) for the complete licensing details.

## A small disclaimer

This is my independent learning project. It isn’t affiliated with, endorsed by, 
or sponsored by Stanford University.

These are my personal study notes, so they may contain mistakes or simplified
explanations. For the authoritative course material, please refer to Stanford’s
original CS229 resources.
