<template>
  <div class="webgl-container" ref="containerRef" role="region" aria-label="WebGL 그래픽 영역">
    <canvas ref="canvasRef" width="800" height="600" role="img" aria-label="WebGL 3D 그래픽 애니메이션"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const canvasRef = ref(null);
const containerRef = ref(null);
let animationFrameId = null;
let observer = null;
let isVisible = false;

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const gl =
    canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    console.error("WebGL is not supported in this browser.");
    return;
  }

  // Clear background
  gl.clearColor(0.1, 0.1, 0.15, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const vsSource = `
    attribute vec4 aVertexPosition;
    uniform vec2 uTranslation;
    void main() {
      gl_Position = aVertexPosition + vec4(uTranslation, 0.0, 0.0);
    }
  `;

  const fsSource = `
    void main() {
      gl_FragColor = vec4(1.0, 0.5, 0.0, 1.0); 
    }
  `;

  function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vertexShader || !fragmentShader) return;

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) return;

  gl.useProgram(shaderProgram);

  const positions = [
     0.0,  0.5,
    -0.5, -0.5,
     0.5, -0.5,
  ];
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const positionAttributeLocation = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

  const translationLocation = gl.getUniformLocation(shaderProgram, "uTranslation");

  let time = 0;

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = containerRef.value ? containerRef.value.clientWidth || 800 : 800;
    const height = Math.round(width * 0.75);
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function render() {
    if (!isVisible) return;

    resizeCanvas();
    gl.clearColor(0.1, 0.1, 0.15, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    time += 0.05;
    const xOffset = Math.sin(time) * 0.5;

    gl.uniform2f(translationLocation, xOffset, 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    animationFrameId = requestAnimationFrame(render);
  }

  function startLoop() {
    if (!animationFrameId && isVisible) {
      render();
    }
  }

  function stopLoop() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  if ("IntersectionObserver" in window && containerRef.value) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          isVisible = true;
          startLoop();
        } else {
          isVisible = false;
          stopLoop();
        }
      });
    });
    observer.observe(containerRef.value);
  } else {
    isVisible = true;
    startLoop();
  }

  onUnmounted(() => {
    window.removeEventListener('resize', resizeCanvas);
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    if (observer) {
      observer.disconnect();
    }
  });
});
</script>

<style scoped>
.webgl-container {
  display: flex;
  justify-content: center;
  margin: 20px 0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

canvas {
  max-width: 100%;
  height: auto;
  display: block;
}
</style>
