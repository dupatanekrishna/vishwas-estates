/* Visvasa Estates custom SELL form.
 * Public client configuration only. AWS and Turnstile secrets stay server-side.
 */
(() => {
  "use strict";
  const API = "https://508tvgngdd.execute-api.ap-south-1.amazonaws.com";
  const SITE_KEY = "0x4AAAAAAFXZutxhV7cscgbB";
  const MiB = 1024 * 1024;
  const accepted = {
    "application/pdf": {extensions:["pdf"], max:10*MiB, category:"floorplan"},
    "image/jpeg": {extensions:["jpg","jpeg"], max:10*MiB, category:"photo"},
    "image/png": {extensions:["png"], max:10*MiB, category:"photo"},
    "image/webp": {extensions:["webp"], max:10*MiB, category:"photo"},
    "video/mp4": {extensions:["mp4"], max:100*MiB, category:"video"},
    "video/webm": {extensions:["webm"], max:100*MiB, category:"video"}
  };
  const dlg = document.getElementById("sell-dialog");
  const trigger = document.getElementById("sell-open");
  const form = document.getElementById("sell-form");
  const submit = document.getElementById("sell-submit");
  const status = document.getElementById("sell-status");
  const consent = document.getElementById("sell-consent");
  const fileInput = document.getElementById("sell-files");
  if (!dlg || !trigger || !form || !submit) return;

  let widgetId = null, widgetLoading = null, turnstileToken = "";
  let busy = false, session = null, completed = false;
  const fieldNames = [
    "name","phone","email","projectName","configuration",
    "superBuiltUpArea","carpetArea","askingPrice","projectStatus",
    "location","projectStartDate","remarks"
  ];
  const message = text => { status.textContent = text; };
  const canSubmit = () => !completed && !busy && !!(session || (turnstileToken && consent.checked));
  function updateButton() {
    submit.disabled = !canSubmit();
    if (!completed) submit.textContent = session ? "Retry submission" : "Submit property";
  }
  function invalidateTurnstile() {
    turnstileToken = "";
    if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
    updateButton();
  }
  function renderTurnstile() {
    if (widgetId !== null || !window.turnstile) return;
    widgetId = window.turnstile.render("#sell-turnstile", {
      sitekey: SITE_KEY, action: "sell",
      callback: token => { turnstileToken = token; updateButton(); },
      "expired-callback": () => {
        turnstileToken = "";
        message("Security check expired. Please verify again.");
        updateButton();
      },
      "error-callback": () => {
        turnstileToken = "";
        message("Security verification could not load. Try again.");
        updateButton();
      }
    });
  }
  function loadTurnstile() {
    if (window.turnstile) { renderTurnstile(); return Promise.resolve(); }
    if (widgetLoading) return widgetLoading;
    widgetLoading = new Promise((resolve,reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => { renderTurnstile(); resolve(); };
      script.onerror = () => {
        widgetLoading = null;
        script.remove();
        reject(new Error("Could not load the bot protection widget."));
      };
      document.head.appendChild(script);
    });
    return widgetLoading;
  }
  function attachments(files) {
    if (files.length > 10) throw new Error("A maximum of 10 attachments is allowed.");
    let total = 0;
    const result = files.map(file => {
      const format = accepted[file.type];
      const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
      if (!format || !format.extensions.includes(ext) ||
          file.name.length > 180 || /[\x00-\x1f]/.test(file.name)) {
        throw new Error("Supported uploads: JPG, PNG, WebP, PDF, MP4 and WebM. Convert MOV/HEIC before uploading.");
      }
      if (!file.size || file.size > format.max) {
        throw new Error("File too large or empty: " + file.name);
      }
      total += file.size;
      return {name:file.name, type:file.type, size:file.size, category:format.category};
    });
    if (total > 200 * MiB) throw new Error("Total attachment size must not exceed 200 MiB.");
    return result;
  }
  const phoneInput = form.elements.namedItem("phone");
  const phoneHint = document.getElementById("sell-phone-hint");
  function normalizeIndianPhone(value) {
    const stripped = String(value || "").replace(/[\s()-]/g, "");
    const local = stripped.startsWith("+91") ? stripped.slice(3) : stripped;
    return /^[6-9][0-9]{9}$/.test(local) ? local : null;
  }
  function validatePhone() {
    const raw = phoneInput.value.trim();
    const normalized = normalizeIndianPhone(raw);
    const invalid = !!raw && !normalized;
    phoneInput.setCustomValidity(invalid ? "Enter a valid 10-digit Indian mobile number (optional +91)." : "");
    phoneInput.setAttribute("aria-invalid", String(invalid));
    phoneHint.classList.toggle("invalid", invalid);
    phoneHint.textContent = invalid
      ? "Invalid Indian mobile number. Use 10 digits starting with 6–9 (optional +91)."
      : "10-digit Indian mobile number starting with 6–9; +91 optional.";
    return normalized;
  }
  phoneInput.addEventListener("input", validatePhone);
  phoneInput.addEventListener("blur", validatePhone);
  function details() {
    const result = {};
    for (const key of fieldNames) {
      result[key] = String(form.elements.namedItem(key).value || "").trim();
    }
    const normalizedPhone = validatePhone();
    if (!normalizedPhone) throw new Error("Enter a valid 10-digit Indian mobile number.");
    result.phone = normalizedPhone;
    if (Number(result.carpetArea) > Number(result.superBuiltUpArea)) {
      throw new Error("Carpet area cannot exceed super built-up area.");
    }
    return result;
  }
  async function api(path, options) {
    let response;
    try {
      response = await fetch(API + path, {
        cache:"no-store", referrerPolicy:"no-referrer", ...options
      });
    } catch (error) {
      throw new Error("Cannot reach the AWS property API. Check your connection and API CORS configuration.");
    }
    let body = {};
    try { body = await response.json(); } catch (_) { /* Non-JSON errors */ }
    if (!response.ok) {
      const error = new Error(typeof body.error === "string" ? body.error : "HTTP " + response.status);
      error.statusCode = response.status;
      throw error;
    }
    return body;
  }
  async function create(files) {
    const request = {
      details:details(),
      files:attachments(files),
      consent:consent.checked,
      website:form.elements.namedItem("website").value || "",
      turnstileToken
    };
    if (!turnstileToken) throw new Error("Complete the security verification first.");
    let result;
    try {
      result = await api("/submissions", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(request)
      });
    } finally {
      // Tokens are single-use, including some unsuccessful verification attempts.
      invalidateTurnstile();
    }
    if (!/^[a-f0-9]{32}$/.test(result.submissionId || "") ||
        typeof result.uploadToken !== "string" ||
        !Array.isArray(result.uploads) ||
        result.uploads.length !== files.length) {
      throw new Error("AWS API returned an incomplete submission session.");
    }
    return {
      id:result.submissionId, token:result.uploadToken, files,
      uploads:result.uploads, uploaded:new Set(),
      startTime:Date.now(), tokenExpiry:Number(result.uploadExpires)*1000
    };
  }
  async function uploadFiles(active) {
    if (active.uploads.length && active.uploaded.size < active.uploads.length &&
        Date.now() - active.startTime >= 9 * 60 * 1000) {
      throw new Error("The S3 upload links have expired. Please contact Visvasa Estates with your listing reference.");
    }
    for (let index=0; index<active.uploads.length; index++) {
      if (active.uploaded.has(index)) continue;
      const descriptor = active.uploads[index];
      if (!descriptor || typeof descriptor.url !== "string" ||
          !descriptor.fields || typeof descriptor.fields !== "object") {
        throw new Error("AWS returned invalid attachment instructions.");
      }
      const formData = new FormData();
      for (const [key,value] of Object.entries(descriptor.fields)) {
        formData.append(key,String(value));
      }
      formData.append("file",active.files[index]); // File must be LAST for presigned POST.
      message("Uploading attachment " + (index + 1) + " of " + active.files.length + "…");
      let response;
      try {
        response = await fetch(descriptor.url,{
          method:"POST", body:formData, referrerPolicy:"no-referrer"
        });
      } catch (_) {
        throw new Error("Unable to upload attachment " + (index + 1) + ". Check S3 CORS and your connection.");
      }
      if (!response.ok) {
        throw new Error("Attachment " + (index + 1) + " failed (HTTP " + response.status + ").");
      }
      active.uploaded.add(index);
    }
  }
  async function finalize(active) {
    if (Date.now() >= active.tokenExpiry) {
      throw new Error("The submission session expired. Contact Visvasa Estates with the listing reference.");
    }
    for (let attempt=0; attempt<3; attempt++) {
      try {
        const response = await api("/submissions/" + encodeURIComponent(active.id) + "/complete",{
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":"Bearer " + active.token},
          body:"{}"
        });
        if (response.status !== "submitted") throw new Error("Unexpected AWS completion response.");
        return;
      } catch (error) {
        if (error.statusCode !== 409 || attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve,2500));
      }
    }
  }
  function lockFields() {
    for (const control of form.querySelectorAll("input, select, textarea")) control.disabled = true;
  }
  trigger.addEventListener("click",() => {
    if (!dlg.open) dlg.showModal();
    document.body.classList.add("modal-open");
    loadTurnstile().catch(error => message(error.message));
  });
  function close() { if (!busy) dlg.close(); }
  document.getElementById("sell-close").addEventListener("click",close);
  document.getElementById("sell-cancel").addEventListener("click",close);
  dlg.addEventListener("cancel",event => { if (busy) event.preventDefault(); });
  dlg.addEventListener("close",() => {
    document.body.classList.remove("modal-open");
    trigger.focus();
  });
  consent.addEventListener("change",updateButton);
  form.addEventListener("submit",async event => {
    event.preventDefault();
    if (busy || completed) return;
    if (!session) validatePhone();
    if (!session && (!form.reportValidity() || !consent.checked || !turnstileToken)) {
      message("Complete all required fields, consent and the security check.");
      return;
    }
    busy = true;
    updateButton();
    try {
      if (!session) {
        const files = Array.from(fileInput.files);
        message("Creating a secure listing…");
        session = await create(files);
        lockFields(); // Prevent edits to a listing already accepted by AWS.
      }
      await uploadFiles(session);
      message("Finishing your listing and notifying Visvasa Estates…");
      await finalize(session);
      completed = true;
      submit.textContent = "Submitted";
      message("Your property has been submitted successfully. Reference: " + session.id);
    } catch (error) {
      const ref = session ? " Reference: " + session.id + "." : "";
      message(error.message + ref + (session ? " You may retry with this button." : ""));
    } finally {
      busy = false;
      updateButton();
    }
  });
  updateButton();
})();