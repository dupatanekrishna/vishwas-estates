# ವಿಶ್ವಾಸ Estates

By vishwanath E — Trust Built in Person.

Starter page with the approved light green / light mustard logo and an optional Google Forms enquiry dialog. The form opens on every page load. Close, Skip & Browse, and Escape (when focus is outside the Google iframe) dismiss it. Enquire now reopens it. All four fields are required by Google Forms when submitting.

## Publish

In Settings > Pages, choose Deploy from a branch, main, /(root), then Save. Custom domain configuration is deferred until this page is tested.

## Form

https://forms.gle/XMmygcHWyMQBwqot8

The enquiry email address is visvasaestates@dkalki.com. The form-bound Google Apps Script is managed outside this repository; its notification recipient must also be set to this address. No credentials or response data are included here. Keep the response spreadsheet Restricted. Google owns the iframe content and validation; the page does not attempt to infer successful submission from iframe load events. Close the dialog after Google's confirmation.

## Check after publishing

- On desktop and mobile, the dialog opens and the form scrolls.
- Close and Skip & Browse work with empty fields.
- Enquire now reopens the form.
- A complete submission is saved in Forms/Sheets and received in Zoho.

The full website layout is pending. The logo is embedded in index.html to keep this first version self-contained.
