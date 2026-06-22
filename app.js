document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll(".portfolio-section");
  const sectionButtons = document.querySelectorAll(".section-toggle");
  const toggleAllBtn = document.getElementById("toggleAllBtn");

  let allCollapsed = false;

  sectionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.closest(".portfolio-section");
      section.classList.toggle("collapsed");

      const isCollapsed = section.classList.contains("collapsed");
      button.textContent = isCollapsed ? "Expand" : "Collapse";
      updateGlobalButtonLabel();
    });
  });

  toggleAllBtn.addEventListener("click", () => {
    allCollapsed = !allCollapsed;

    sections.forEach((section) => {
      section.classList.toggle("collapsed", allCollapsed);
      const btn = section.querySelector(".section-toggle");
      if (btn) {
        btn.textContent = allCollapsed ? "Expand" : "Collapse";
      }
    });

    toggleAllBtn.textContent = allCollapsed ? "Expand All" : "Collapse All";
  });

  function updateGlobalButtonLabel() {
    const collapsedCount = document.querySelectorAll(".portfolio-section.collapsed").length;
    const total = sections.length;

    allCollapsed = collapsedCount === total;
    toggleAllBtn.textContent = allCollapsed ? "Expand All" : "Collapse All";
  }
});