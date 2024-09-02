window.addEventListener("load", function () {
  const boxElement = document.getElementById("meet-controls-bar");
  const draggable = document.getElementById("draggable");

  document.addEventListener("mousedown", function (event) {
    if (event.target === draggable) {
      draggable.style.cursor = "grabbing";

      const offsetX = boxElement.offsetLeft;
      const offsetY = boxElement.offsetTop;
      const initialX = event.clientX - offsetX;
      const initialY = event.clientY - offsetY;

      const mouseMoveHandler = function (event) {
        // limit the movement of the box within the screen
        const maxX = window.innerWidth - boxElement.offsetWidth;
        const maxY = window.innerHeight - boxElement.offsetHeight;
        const x = Math.min(maxX, Math.max(0, event.clientX - initialX));
        const y = Math.min(maxY, Math.max(0, event.clientY - initialY));
        boxElement.style.left = x + "px";
        boxElement.style.top = y + "px";
      };

      document.addEventListener("mousemove", mouseMoveHandler);

      document.addEventListener("mouseup", function () {
        draggable.style.cursor = "grab";
        document.removeEventListener("mousemove", mouseMoveHandler);
      });
    }
  });
});
