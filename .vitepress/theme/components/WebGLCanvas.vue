<template>
  <div class="webgl-container">
    <canvas ref="canvasRef" width="800" height="600"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const canvasRef = ref(null);

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const gl =
    canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    console.error("WebGL is not supported in this browser.");
    return;
  }

  // Clear with a nice dark gray color
  gl.clearColor(0.1, 0.1, 0.15, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // TODO: Add your WebGL rendering code here!
  // This is a basic template to get you started.\
  const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec4 aVertexColor;
    varying vec4 vColor;
    void main(){
    gl_Position=aVertexPosition;vColor=aVertexColor;
  }`;

  const fsSource = `
  void main(){
    gl_FragColor = vec4(1.0, 0.5, 0.0, 1.0);
  }
  `;
  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    // 컴파일 에러 체크 (시스템 엔지니어에게 필수적인 에러 로깅)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  // 셰이더 생성
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // 3. WebGL 프로그램 생성 및 링크
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  gl.useProgram(shaderProgram);

  // 4. 버텍스 데이터 준비 (삼각형의 3개 점 좌표: x, y)
  const vertices = new Float32Array([
    0.0,
    0.5, // 위쪽 꼭짓점
    -0.5,
    -0.5, // 왼쪽 아래 꼭짓점
    0.5,
    -0.5, // 오른쪽 아래 꼭짓점
  ]);

  // GPU 메모리에 버퍼 생성 및 데이터 전송
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  // 5. 메모리와 셰이더 변수 연결
  const positionAttributeLocation = gl.getAttribLocation(
    shaderProgram,
    "aVertexPosition",
  );
  gl.enableVertexAttribArray(positionAttributeLocation);

  // 어떻게 데이터를 읽을지 지시 (2개씩(x,y), Float 타입으로)
  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

  // 6. 드로우 콜 (화면에 그리기 실행!)
  gl.drawArrays(gl.TRIANGLES, 0, 3);
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
