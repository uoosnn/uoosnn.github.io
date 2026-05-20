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
  // 1. 버텍스 셰이더 수정 (이동을 위한 uTranslation 변수 추가)
  const vsSource = `
    attribute vec4 aVertexPosition;
    uniform vec2 uTranslation; // JS에서 매 프레임마다 위치 값을 받을 변수(Uniform)
    
    void main() {
      // 기존 정점 위치에 uTranslation 값을 더해서 이동시킵니다.
      gl_Position = aVertexPosition + vec4(uTranslation, 0.0, 0.0);
    }
  `;

  // 픽셀(Fragment) 셰이더는 기존과 동일하게 오렌지색 유지
  const fsSource = `
    void main() {
      gl_FragColor = vec4(1.0, 0.5, 0.0, 1.0); 
    }
  `;

  // ... (2. 셰이더 컴파일, 3. 프로그램 생성, 4. 버텍스 데이터 세팅은 이전 코드와 완전히 동일) ...

  // 5. 메모리와 셰이더 변수 연결 (Attribute & Uniform)
  const positionAttributeLocation = gl.getAttribLocation(
    shaderProgram,
    "aVertexPosition",
  );
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

  // 새로 추가된 uTranslation 변수의 메모리 위치를 찾습니다.
  const translationLocation = gl.getUniformLocation(
    shaderProgram,
    "uTranslation",
  );

  // 6. 렌더링 루프 (애니메이션의 심장)
  let time = 0;

  function render() {
    // A. 화면 지우기 (매 프레임마다 이전 프레임의 잔상을 지워야 함)
    gl.clearColor(0.1, 0.1, 0.15, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // B. 로직 업데이트 (시간에 따라 좌우로 움직이는 값 계산)
    time += 0.05; // 애니메이션 속도 조절
    const xOffset = Math.sin(time) * 0.5; // sin 함수를 써서 -0.5 ~ 0.5 사이를 왕복

    // C. 계산된 위치값을 GPU(셰이더)로 쏴주기
    gl.uniform2f(translationLocation, xOffset, 0.0);

    // D. 드로우 콜 (화면에 그리기)
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // E. 다음 프레임 예약 (모니터 주사율에 맞춰서 이 함수를 무한 반복)
    requestAnimationFrame(render);
  }

  // 루프 최초 실행!
  render();
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
