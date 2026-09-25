(function () {
  if (typeof window !== "undefined") {
    const originalInsertBefore = Node.prototype.insertBefore;
    const originalRemoveChild = Node.prototype.removeChild;
    const originalReplaceChild = Node.prototype.replaceChild;

    let suspiciousOperations = 0;
    const MAX_SUSPICIOUS = 10;

    Node.prototype.insertBefore = function (newNode, referenceNode) {
      try {
        if (
          this.closest &&
          this.closest("[data-react-component]") &&
          newNode.className &&
          newNode.className.includes("goog-te")
        ) {
          return newNode;
        }

        if (
          newNode.nodeType === Node.TEXT_NODE &&
          this.hasAttribute &&
          this.hasAttribute("data-react-protected")
        ) {
          suspiciousOperations++;
          if (suspiciousOperations > MAX_SUSPICIOUS) {
            console.warn(
              "[GoogleTranslate] Too many suspicious operations, blocking"
            );
            return newNode;
          }
        }

        return originalInsertBefore.call(this, newNode, referenceNode);
      } catch (e) {
        console.warn("[GoogleTranslate] DOM manipulation prevented:", e);
        return newNode;
      }
    };

    Node.prototype.removeChild = function (child) {
      try {
        if (
          this.closest &&
          this.closest("[data-react-component]") &&
          child.className &&
          child.className.includes("goog-te")
        ) {
          return child;
        }

        if (child.hasAttribute && child.hasAttribute("data-react-protected")) {
          console.warn(
            "[GoogleTranslate] Preventing removal of protected element"
          );
          return child;
        }

        return originalRemoveChild.call(this, child);
      } catch (e) {
        console.warn("[GoogleTranslate] DOM removal prevented:", e);
        return child;
      }
    };

    Node.prototype.replaceChild = function (newChild, oldChild) {
      try {
        if (oldChild.hasAttribute && oldChild.hasAttribute("data-react-protected")) {
          console.warn(
            "[GoogleTranslate] Preventing replacement of protected element"
          );
          return oldChild;
        }

        return originalReplaceChild.call(this, newChild, oldChild);
      } catch (e) {
        console.warn("[GoogleTranslate] DOM replacement prevented:", e);
        return oldChild;
      }
    };

    setInterval(() => {
      suspiciousOperations = Math.max(0, suspiciousOperations - 1);
    }, 5000);
  }
})();