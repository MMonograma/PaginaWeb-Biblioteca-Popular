const menuToggle = document.getElementById("menu-toggle");
const menu = document.getElementById("menu");

menuToggle.addEventListener("click", () => {
  const isOpen = !menu.classList.toggle("hidden");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

// Fotos que todavía no existen: se ocultan y dejan ver el hueco de atrás.
document.querySelectorAll("img[data-optional]").forEach((img) => {
  img.addEventListener("error", () => img.remove());
});

document.getElementById("year").textContent = new Date().getFullYear();
