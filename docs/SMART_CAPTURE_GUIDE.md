# Smart Capture Guide

Smart Capture is Career Pipeline's deterministic paste-review workflow for copied job postings. It helps you turn job-board text into editable application fields without scraping, browser extensions, or AI extraction. (Still WIP, more updates soon)

Use it from Add Job -> Paste Job Text. Paste the copied posting text, click Prepare review, check the suggested fields, edit anything that looks wrong, then save the opportunity.

Screenshots and a fuller visual walkthrough will be added soon.

## What Smart Capture Does

- Reads the pasted text you provide in the Add Job form.
- Prepares suggested fields such as company, role, location, employment type, compensation, and saved notes when those details are visible in the copied text.
- Keeps the review step editable so you can correct or complete the details before saving.
- Works best with copied posting text from LinkedIn-style, Indeed-style, and ZipRecruiter-style pages.

## What It Does Not Do

- It does not scrape job boards.
- It does not use AI extraction.
- It does not automatically import hidden links.
- It does not infer Source from pasted text or URLs.
- It does not scan pasted text for the Job Link.

Source remains the value you choose in the Source dropdown. Job Link remains explicit and user-controlled through the Job link field. Currently, it is most efficient with LinkedIn, Indeed, and ZipRecruiter. Smart capture for more job boards will be added soon.

## Copying LinkedIn-Style Posts

Start copying around the company logo and company name area. You do not need the actual image or logo, but starting near that area helps include company and title context.

Continue through:

- Company name
- Job title
- Location and work arrangement
- Job type when visible
- About the job section

Copying only the About the job text may miss company, role, location, or work arrangement details. If Smart Capture misses a field, fill it in during review before saving.

## Copying Indeed-Style Posts

Start copying at the job title.

Include:

- Company
- Location
- Pay or compensation when visible
- Job type
- Benefits or job details area when visible
- Full job description

Copying only the full description can miss important header details like pay, job type, and location.

## Copying ZipRecruiter-Style Posts

Start copying at the job title.

Include:

- Company
- Location or work arrangement
- Job type metadata
- Benefits when visible
- Posted date if visible
- Job description
- Responsibilities
- Qualifications
- Company description if relevant

Pasted text may include extra job-board UI text. That is okay because Smart Capture is review-first. Review the suggested fields before saving.

## What To Review Before Saving

Check these fields carefully:

- Company name
- Role title
- Source
- Job Link
- Location and work arrangement
- Employment type
- Compensation
- Saved notes

If a field is missing or wrong, edit it in the review form. Smart Capture is meant to speed up capture, not replace your review.

## Demo Mode Note

The GitHub Pages demo uses fictional sample data and resets when the page reloads. You can try Add Job and Smart Capture in the demo, but changes are temporary and are not saved to a backend database.

