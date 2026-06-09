function createToast(toastElement) {
  let hideTimer = null;
  const homeParent = toastElement.parentElement;
  const homeNextSibling = toastElement.nextSibling;

  function restoreHome() {
    if (toastElement.parentElement !== homeParent) {
      homeParent.insertBefore(toastElement, homeNextSibling);
    }
    toastElement.classList.remove("in-dialog");
  }

  function placeToast() {
    const openDialogs = Array.from(document.querySelectorAll("dialog[open]"));
    const activeDialog = openDialogs.at(-1);

    if (!activeDialog) {
      restoreHome();
      return;
    }

    if (toastElement.parentElement !== activeDialog) {
      activeDialog.append(toastElement);
    }
    toastElement.classList.add("in-dialog");
  }

  function show(message, options = {}) {
    const durationMs = options.durationMs ?? 2600;

    placeToast();
    toastElement.textContent = message;
    toastElement.classList.add("visible");
    clearTimeout(hideTimer);

    if (durationMs > 0) {
      hideTimer = setTimeout(() => {
        hide();
      }, durationMs);
    }
  }

  function hide() {
    clearTimeout(hideTimer);
    toastElement.classList.remove("visible");
    restoreHome();
  }

  return { show, hide };
}

window.createToast = createToast;
