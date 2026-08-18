/**
 * 🎵 WebGL ShaderGradient 3D 流体渐变渲染引擎 (Harmonious Ambient Edition)
 * 灵感参考：ShaderGradient (https://shadergradient.co/ by ruucm)
 * 核心技术：WebGL GLSL 3D 高度场 + 缓速行进波 (Gentle Traveling Waves) + 色彩家族和谐算法 (Color Harmonizer) + 柔和法线漫反射
 * 职责：为音乐模式提供舒缓柔美、色彩和谐统一、丝滑起伏的 Apple Music 级 3D 流体渐变背景。
 */
(function (global) {
  'use strict';

  // 顶点着色器：全屏覆盖双三角顶点坐标
  const VERTEX_SHADER_SOURCE = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // 片元着色器：基于 3D 缓速行进波、多重域扭曲与柔和法线光照
  const FRAGMENT_SHADER_SOURCE = `
    precision highp float;
    varying vec2 v_uv;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec3 u_color1;
    uniform vec3 u_color2;
    uniform vec3 u_color3;
    uniform vec3 u_color4;
    uniform float u_speed;
    uniform float u_strength;
    uniform float u_density;
    uniform float u_grain;
    uniform float u_brightness;
    uniform float u_saturation;

    // 2D 连续梯度噪声
    vec2 hash22(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }

    float snoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(dot(hash22(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
            dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
        mix(dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
            dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    // 分形布朗运动 (Fractal Brownian Motion)
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 rot = mat2(cos(0.52), sin(0.52), -sin(0.52), cos(0.52));
      for (int i = 0; i < 4; ++i) {
        v += a * snoise(p);
        p = rot * p * 2.08 + vec2(2.1, 1.7);
        a *= 0.5;
      }
      return v;
    }

    // 3D 高度场计算 (模拟 ShaderGradient waterPlane 3D 波动曲面)
    float getWaveHeight(vec2 p, float t) {
      vec2 uv = p * u_density;

      // 1. 多向舒缓行进波 (Gentle Harmonic Waves)
      float w1 = sin(uv.x * 1.6 + uv.y * 1.1 + t * 1.1);
      float w2 = cos(uv.x * 1.9 - uv.y * 1.5 + t * 0.85);
      float w3 = sin(length(uv - vec2(0.5, 0.35)) * 2.3 - t * 1.25);

      // 2. 嵌套流体域扭曲 (Domain Warped Turbulence)
      vec2 q = vec2(
        fbm(uv + vec2(w1 * 0.35, w2 * 0.25) + vec2(0.2, 0.15) * t),
        fbm(uv + vec2(w2 * 0.25, w3 * 0.35) + vec2(0.15, 0.25) * t)
      );

      vec2 r = vec2(
        fbm(uv + 2.4 * q + vec2(1.5, 8.4) + vec2(0.12, 0.18) * t),
        fbm(uv + 2.4 * q + vec2(7.2, 3.1) + vec2(0.16, 0.14) * t)
      );

      float wave = fbm(uv + 2.8 * r + vec2(0.14, 0.10) * t);

      // 混合行进波与柔和多重涡流，生成自然舒缓的 3D 起伏
      return (w1 * 0.26 + w2 * 0.22 + w3 * 0.20 + wave * 0.62) * u_strength;
    }

    void main() {
      vec2 st = gl_FragCoord.xy / u_resolution.xy;
      float aspect = u_resolution.x / u_resolution.y;
      vec2 uv = st;
      uv.x *= aspect;

      // 舒缓低速时间轴
      float t = u_time * u_speed * 0.18;

      // 计算中心及邻近像素高度以求解 3D 表面法线 (Surface Normal)
      float eps = 0.006;
      float hCenter = getWaveHeight(uv, t);
      float hRight  = getWaveHeight(uv + vec2(eps, 0.0), t);
      float hUp     = getWaveHeight(uv + vec2(0.0, eps), t);

      // 3D 法线与柔和光照
      vec3 normal = normalize(vec3(
        (hCenter - hRight) / eps * 0.65,
        (hCenter - hUp) / eps * 0.65,
        1.0
      ));

      // 柔和主光源
      vec3 lightDir = normalize(vec3(0.55, 0.75, 1.15));
      float diffuse = clamp(dot(normal, lightDir) * 0.45 + 0.55, 0.0, 1.0);

      // 丝绸水光微高光 (柔和不刺眼)
      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      vec3 halfDir = normalize(lightDir + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 16.0) * 0.18;

      // 归一化高度值 [-1..1] -> [0..1]
      float hNorm = clamp(hCenter * 0.5 + 0.5, 0.0, 1.0);

      // 4 色流体渐变平滑交融映射
      vec3 colA = mix(u_color1, u_color2, smoothstep(0.0, 0.48, hNorm));
      vec3 colB = mix(u_color3, u_color4, smoothstep(0.40, 0.95, hNorm));
      vec3 color = mix(colA, colB, smoothstep(0.20, 0.78, hNorm));

      // 融合 3D 漫反射光影与柔和高光
      color = color * (0.72 + diffuse * 0.45) + spec * vec3(1.0, 0.97, 0.94);

      // 柔和暗角与中心微聚焦
      vec2 centerDist = st - vec2(0.5);
      float vignette = clamp(1.0 - dot(centerDist, centerDist) * 0.45, 0.0, 1.0);
      color *= vignette;

      // 胶片微颗粒 (Film Grain) 防 8-bit 色阶断层
      float grain = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * u_grain;
      color += grain;

      // 色彩鲜活度与明度校准
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(lum), color, u_saturation);
      color *= u_brightness;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `;

  // 精心调配的和谐深空极光调色板 (和谐、温润、高级)
  const DEFAULT_PALETTE = [
    [0.05, 0.08, 0.22], // 沉静幽蓝 (Deep Midnight Indigo)
    [0.19, 0.07, 0.28], // 暮色紫罗兰 (Velvet Twilight Plum)
    [0.03, 0.2, 0.26], // 静谧青羽 (Ethereal Deep Teal)
    [0.26, 0.1, 0.22] // 柔和玫瑰暗粉 (Soft Rose Glow)
  ];

  class ShaderGradientController {
    constructor(videoElement, options = {}) {
      this.video = videoElement;
      this.options = {
        speed: 0.65, // 舒缓低流速
        strength: 2.1, // 3D 波动起伏幅度
        density: 1.75, // 波动频率密度
        grain: 0.022, // 极细胶片噪点
        brightness: 0.86, // 舒适明度
        saturation: 1.28, // 柔和自然饱和度
        isStatic: false,
        throttleMs: 300,
        ...options
      };

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'music-shadergradient-canvas';
      this.canvas.style.cssText =
        'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none;';

      // 渲染目标分辨率：480x270 配合硬件插值，兼具高清波动细节与超低能耗
      this.canvas.width = 480;
      this.canvas.height = 270;

      this.gl = this.canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power'
      });

      // 离屏抽色 Canvas
      this.sampleCanvas = document.createElement('canvas');
      this.sampleCanvas.width = 12;
      this.sampleCanvas.height = 12;
      this.sampleCtx = this.sampleCanvas.getContext('2d', {
        alpha: false,
        willReadFrequently: true
      });

      // 调色板当前值与目标值（用于平滑 Lerp 过渡，切歌不跳闪）
      this.currentColors = JSON.parse(JSON.stringify(DEFAULT_PALETTE));
      this.targetColors = JSON.parse(JSON.stringify(DEFAULT_PALETTE));

      this.program = null;
      this.uniforms = {};
      this.animationFrameId = null;
      this.sampleTimer = null;
      this.startTime = performance.now();
      this.isRunning = false;
      this.isDestroyed = false;

      this.initWebGL();
    }

    initWebGL() {
      if (!this.gl) return;
      const gl = this.gl;

      const vShader = this.createShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
      const fShader = this.createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
      if (!vShader || !fShader) return;

      const program = gl.createProgram();
      gl.attachShader(program, vShader);
      gl.attachShader(program, fShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('[ShaderGradient] Program link error:', gl.getProgramInfoLog(program));
        return;
      }
      this.program = program;
      gl.useProgram(program);

      // 全屏四边形顶点数据
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );

      const posAttr = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(posAttr);
      gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

      // 缓存 Uniform 句柄
      this.uniforms = {
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        time: gl.getUniformLocation(program, 'u_time'),
        color1: gl.getUniformLocation(program, 'u_color1'),
        color2: gl.getUniformLocation(program, 'u_color2'),
        color3: gl.getUniformLocation(program, 'u_color3'),
        color4: gl.getUniformLocation(program, 'u_color4'),
        speed: gl.getUniformLocation(program, 'u_speed'),
        strength: gl.getUniformLocation(program, 'u_strength'),
        density: gl.getUniformLocation(program, 'u_density'),
        grain: gl.getUniformLocation(program, 'u_grain'),
        brightness: gl.getUniformLocation(program, 'u_brightness'),
        saturation: gl.getUniformLocation(program, 'u_saturation')
      };
    }

    createShader(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('[ShaderGradient] Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    /**
     * 挂载到父级背景容器
     */
    mount(parentEl) {
      if (!parentEl) return;
      this.parentEl = parentEl;
      this.parentEl.appendChild(this.canvas);
      this.start();
    }

    /**
     * 启动渲染循环与抽色监控
     */
    start() {
      if (this.isRunning || this.isDestroyed) return;
      this.isRunning = true;
      this.extractColorsFromVideo();

      this.sampleTimer = setInterval(() => {
        if (!this.options.isStatic) {
          this.extractColorsFromVideo();
        }
      }, this.options.throttleMs);

      const render = () => {
        if (!this.isRunning || this.isDestroyed) return;
        this.renderFrame();
        this.animationFrameId = requestAnimationFrame(render);
      };
      this.animationFrameId = requestAnimationFrame(render);
    }

    /**
     * 停止渲染循环 (节省切出/后台时的功耗)
     */
    stop() {
      this.isRunning = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      if (this.sampleTimer) {
        clearInterval(this.sampleTimer);
        this.sampleTimer = null;
      }
    }

    /**
     * 从当前视频帧提取最具表现力且彼此和谐的 4 种主色
     */
    extractColorsFromVideo() {
      if (!this.video || this.video.readyState < 2 || !this.video.videoWidth) return;
      try {
        this.sampleCtx.drawImage(this.video, 0, 0, 12, 12);
        const imgData = this.sampleCtx.getImageData(0, 0, 12, 12);
        if (!imgData || !imgData.data) return;

        const pixels = [];
        let avgR = 0;
        let avgG = 0;
        let avgB = 0;

        for (let i = 0; i < imgData.data.length; i += 4) {
          const r = imgData.data[i] / 255;
          const g = imgData.data[i + 1] / 255;
          const b = imgData.data[i + 2] / 255;

          avgR += r;
          avgG += g;
          avgB += b;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          pixels.push({ r, g, b, sat, lum });
        }

        const total = pixels.length;
        avgR /= total;
        avgG /= total;
        avgB /= total;

        // 筛选饱和度适中、明度舒适的优质像素
        const sorted = pixels.sort((a, b) => b.sat - a.sat);
        const candidates = sorted.filter(p => p.lum > 0.06 && p.lum < 0.9);

        if (candidates.length >= 4) {
          const rawPalette = [
            candidates[0],
            candidates[Math.floor(candidates.length * 0.28)],
            candidates[Math.floor(candidates.length * 0.58)],
            candidates[Math.floor(candidates.length * 0.85)]
          ];

          // 和谐化算法 (Harmonization Pass):
          // 将抽取的色彩向全画面色调均值进行 18% 柔和同调融合，避免突兀刺眼的极端杂色，形成同色系和谐感
          for (let i = 0; i < 4; i++) {
            const p = rawPalette[i];
            const harmR = p.r * 0.82 + avgR * 0.18;
            const harmG = p.g * 0.82 + avgG * 0.18;
            const harmB = p.b * 0.82 + avgB * 0.18;

            this.targetColors[i] = [
              Math.min(1.0, Math.max(0.02, harmR)),
              Math.min(1.0, Math.max(0.02, harmG)),
              Math.min(1.0, Math.max(0.02, harmB))
            ];
          }
        }
      } catch (e) {
        // CORS 或 Tainted Canvas 拦截时保持优雅默认调色板
      }
    }

    /**
     * 单帧渲染与颜色平滑插值 (Lerp)
     */
    renderFrame() {
      if (!this.gl || !this.program) return;
      const gl = this.gl;

      // 平滑插值颜色向目标过渡 (衰减率 0.05，保证切歌时色彩极度柔顺自然流淌)
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) {
          this.currentColors[i][j] += (this.targetColors[i][j] - this.currentColors[i][j]) * 0.05;
        }
      }

      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.useProgram(this.program);

      const elapsed = (performance.now() - this.startTime) / 1000;

      gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.uniforms.time, elapsed);
      gl.uniform3fv(this.uniforms.color1, this.currentColors[0]);
      gl.uniform3fv(this.uniforms.color2, this.currentColors[1]);
      gl.uniform3fv(this.uniforms.color3, this.currentColors[2]);
      gl.uniform3fv(this.uniforms.color4, this.currentColors[3]);
      gl.uniform1f(this.uniforms.speed, this.options.speed);
      gl.uniform1f(this.uniforms.strength, this.options.strength);
      gl.uniform1f(this.uniforms.density, this.options.density);
      gl.uniform1f(this.uniforms.grain, this.options.grain);
      gl.uniform1f(this.uniforms.brightness, this.options.brightness);
      gl.uniform1f(this.uniforms.saturation, this.options.saturation);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    /**
     * 重新绑定视频源
     */
    rebindVideo(newVideoElement) {
      if (!newVideoElement) return;
      this.video = newVideoElement;
      this.extractColorsFromVideo();
    }

    /**
     * 动态更新设置
     */
    updateOptions(newOptions) {
      this.options = { ...this.options, ...newOptions };
      if (newOptions.isStatic) {
        this.extractColorsFromVideo();
      }
    }

    /**
     * 彻底销毁与资源释放
     */
    destroy() {
      this.isDestroyed = true;
      this.stop();
      if (this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
      if (this.gl && this.program) {
        this.gl.deleteProgram(this.program);
      }
    }
  }

  global.ShaderGradientController = ShaderGradientController;
})(typeof window !== 'undefined' ? window : this);
