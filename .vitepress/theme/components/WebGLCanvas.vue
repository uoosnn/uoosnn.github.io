<template>
  <div class="webgl-container">
    <canvas ref="canvasRef" width="800" height="600"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const canvasRef = ref(null)

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
  if (!gl) {
    console.error('WebGL is not supported in this browser.')
    return
  }

  // Clear with a nice dark gray color
  gl.clearColor(0.1, 0.1, 0.15, 1.0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  // TODO: Add your WebGL rendering code here!
  // This is a basic template to get you started.
})
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
