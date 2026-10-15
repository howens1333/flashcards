// Shared visual controls. Existing page handlers remain responsible for data.
(() => {
  const icon = (name) => {
    const paths = {
      back: '<path d="m15 18-6-6 6-6"/>',
      close: '<path d="m6 6 12 12M6 18 18 6"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
      theme: '<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>',
    };
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
  };
  document.addEventListener("DOMContentLoaded", () =>
    setTimeout(() => {
      const page =
        location.pathname.split("/").pop().replace(".html", "") || "index";
      document.body.dataset.page = page;
      const nav = document.querySelector("nav");
      if (nav) {
        nav.classList.add("native-nav");
        const brand = nav.querySelector(".nav-brand");
        if (brand) brand.textContent = "Flashcards";
        if (nav.classList.contains("set-nav")) {
          const back = document.createElement("a");
          back.href = "index.html";
          back.className = "native-icon native-back";
          back.setAttribute("aria-label", "Back to sets");
          back.innerHTML = icon("back");
          nav.prepend(back);
          const links = nav.querySelector(".nav-links");
          links
            .querySelectorAll('a[href="index.html"]')
            .forEach((a) => a.remove());
          const segments = document.createElement("div");
          segments.className = "native-segments";
          links.querySelectorAll("a").forEach((a) => segments.append(a));
          links.prepend(segments);
          const theme = links.querySelector(".theme-toggle");
          if (theme) nav.append(theme);
        }
        if (page === "import") {
          const back = nav.querySelector(
            'a[href="index.html"]:not(.nav-brand)',
          );
          if (back) {
            back.className = "native-icon";
            back.innerHTML = icon("back");
            back.setAttribute("aria-label", "Back to sets");
          }
        }
      }
      document.querySelectorAll(".theme-toggle").forEach((button) => {
        button.setAttribute("aria-label", "Toggle light and dark appearance");
        const oldLabel = button.querySelector("#theme-label");
        button.innerHTML = icon("theme");
        // Existing pages update this label after theme changes.
        if (oldLabel) {
          oldLabel.hidden = true;
          button.append(oldLabel);
        }
      });
      document.querySelectorAll(".modal").forEach((modal) => {
        const cancel = [...modal.querySelectorAll("button")].find((b) =>
          /^(cancel|close)$/i.test(b.textContent.trim()),
        );
        if (!cancel) return;
        cancel.className = "native-close";
        cancel.setAttribute("aria-label", "Close dialog");
        cancel.innerHTML = icon("close");
        modal.prepend(cancel);
        modal.classList.add("has-native-close");
      });
      if (page === "edit") enhanceEditor(nav, icon);
      const meta = document.querySelector('meta[name="theme-color"]');
      const refreshMeta = () => {
        if (meta)
          meta.content = getComputedStyle(document.documentElement)
            .getPropertyValue("--bg")
            .trim();
      };
      refreshMeta();
      new MutationObserver(refreshMeta).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
    }),
  );

  function enhanceEditor(nav, icon) {
    const fields = document.querySelector(".edit-header-fields");
    if (!fields) return;
    // Keep the original inputs and IDs: save, export, and validation still use them.
    fields.hidden = true;
    const heading = document.createElement("div");
    heading.innerHTML =
      '<h1 class="native-edit-title"></h1><p class="native-edit-description"></p><button type="button" class="native-details-link">Edit details ›</button>';
    fields.before(heading);
    const title = document.getElementById("edit-title");
    const description = document.getElementById("edit-desc");
    const refreshHeading = () => {
      heading.querySelector("h1").textContent = title.value || "Untitled set";
      heading.querySelector("p").textContent = description.value;
    };
    refreshHeading();
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="native-details-title"><div class="native-details-head"><button type="button" class="native-close" aria-label="Close without applying changes">${icon("close")}</button><h2 id="native-details-title">Set Details</h2><button type="button" class="native-icon native-check" aria-label="Apply set details">${icon("check")}</button></div><div class="native-details-fields"><label>Title<input id="native-title" maxlength="100" required></label><label>Description<input id="native-description" maxlength="200"></label></div></section>`;
    document.body.append(overlay);
    let returnFocus;
    const close = () => {
      overlay.hidden = true;
      returnFocus?.focus();
    };
    const open = () => {
      returnFocus = document.activeElement;
      overlay.querySelector("#native-title").value = title.value;
      overlay.querySelector("#native-description").value = description.value;
      overlay.hidden = false;
      overlay.querySelector("input").focus();
    };
    heading.querySelector("button").onclick = open;
    overlay.querySelector(".native-close").onclick = close;
    overlay.querySelector(".native-check").onclick = () => {
      const nextTitle = overlay.querySelector("#native-title");
      if (!nextTitle.value.trim()) {
        nextTitle.reportValidity();
        nextTitle.focus();
        return;
      }
      title.value = nextTitle.value.trim();
      description.value = overlay.querySelector("#native-description").value;
      title.dispatchEvent(new Event("input", { bubbles: true }));
      refreshHeading();
      close();
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
      if (e.key === "Tab") {
        const controls = [...overlay.querySelectorAll("button,input")];
        const first = controls[0],
          last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    // Make the old empty-title validation reveal the now-hidden field in the sheet.
    const originalSave = window.saveAll;
    window.saveAll = function () {
      if (!title.value.trim()) {
        open();
        return false;
      }
      return originalSave();
    };
    if (nav) {
      const wrap = document.createElement("div");
      wrap.className = "native-menu-wrap";
      wrap.innerHTML = `<button type="button" class="native-icon" aria-label="More set actions" aria-expanded="false">${icon("more")}</button><div class="native-menu" hidden><button type="button" data-action="details">Set Details</button><button type="button" data-action="export">Export JSON</button><button type="button" data-action="import">Import Cards</button></div>`;
      nav.append(wrap);
      const trigger = wrap.querySelector("button"),
        menu = wrap.querySelector(".native-menu");
      const hide = () => {
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      };
      trigger.onclick = () => {
        menu.hidden = !menu.hidden;
        trigger.setAttribute("aria-expanded", String(!menu.hidden));
      };
      menu.onclick = (e) => {
        const action = e.target.dataset.action;
        if (!action) return;
        hide();
        if (action === "details") open();
        if (action === "export") window.exportCurrentSet();
        if (action === "import") window.openTextImport();
      };
      document.addEventListener("click", (e) => {
        if (!wrap.contains(e.target)) hide();
      });
      wrap.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          hide();
          trigger.focus();
        }
      });
      document
        .querySelector('.edit-actions button[onclick="exportCurrentSet()"]')
        ?.remove();
    }
  }
})();
