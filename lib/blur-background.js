/**
 * 氛围光与背景模糊控制器 (Blur Background Controller)
 * 依赖：BlurHash (lib/blurhash.js)
 * 职责：负责影院模式与音乐模式下柔和背景氛围光的生成与调度。
 * 设计理念：功能解耦、具备 3 级渐进退化能力（BlurHash 低频算法 -> CORS 4x3 极佳低频矩阵 -> Video Clone 容器）。
 */
(function(global) {
  class BlurBackgroundController {
    constructor(videoElement, options = {}) {
      this.video = videoElement;
      this.options = {
        enableBlurHash: true,
        sampleWidth: 16,
        sampleHeight: 9,
        decodeWidth: 32,
        decodeHeight: 18,
        componentX: 4,
        componentY: 3,
        lowFreqWidth: 4,
        lowFreqHeight: 3,
        throttleMs: 150,
        ...options
      };

      this.mode = this.options.enableBlurHash ? 'blurhash' : 'lowfreq'; // 'blurhash' | 'lowfreq' | 'clone'
      
      // 主渲染 Canvas
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.options.decodeWidth;
      this.canvas.height = this.options.decodeHeight;
      this.canvas.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block; transition: opacity 0.3s ease;';
      this.ctx = this.canvas.getContext('2d', { alpha: false, willReadFrequently: true });

      // 离屏 16x9 BlurHash 采样 Canvas
      this.sampleCanvas = document.createElement('canvas');
      this.sampleCanvas.width = this.options.sampleWidth;
      this.sampleCanvas.height = this.options.sampleHeight;
      this.sampleCtx = this.sampleCanvas.getContext('2d', { alpha: false, willReadFrequently: true });

      this.clonedVideo = null;
      this.timer = null;
      this.removeEventListeners = null;
      this.lastHash = '';
      this.hasRenderedFrame = false;
    }

    /**
     * 挂载到指定的父级背景容器
     */
    mount(parentEl) {
      if (!parentEl) return;
      this.parentEl = parentEl;
      this.parentEl.appendChild(this.canvas);
      this.update();
      this.bindEvents();

      // 定时探测补偿：保障在节点移动、缓冲、暂停时均能及时渲染背景
      setTimeout(() => this.update(), 50);
      setTimeout(() => this.update(), 200);
      setTimeout(() => this.update(), 600);
      setTimeout(() => this.update(), 1200);
    }

    /**
     * 动态更新参数
     */
    updateOptions(newOptions) {
      this.options = { ...this.options, ...newOptions };
      if (newOptions.enableBlurHash !== undefined) {
        this.mode = this.options.enableBlurHash ? 'blurhash' : 'lowfreq';
        this.lastHash = '';
        this.update();
      }
    }

    /**
     * 渲染单帧画面 (带 3 级退化降级保护)
     */
    update() {
      if (!this.video || !this.video.isConnected) return;
      if (this.video.readyState < 2 || !this.video.videoWidth) return;

      // Mode 1: BlurHash 算法背景 (当允许 getImageData 导出像素时)
      if (this.mode === 'blurhash' && this.options.enableBlurHash && typeof BlurHash !== 'undefined') {
        try {
          this.sampleCtx.drawImage(this.video, 0, 0, this.options.sampleWidth, this.options.sampleHeight);
          const imgData = this.sampleCtx.getImageData(0, 0, this.options.sampleWidth, this.options.sampleHeight);
          
          if (imgData && imgData.data && imgData.data.length > 0) {
            const hash = BlurHash.encode(
              imgData.data,
              this.options.sampleWidth,
              this.options.sampleHeight,
              this.options.componentX,
              this.options.componentY
            );

            if (hash && hash !== this.lastHash) {
              this.lastHash = hash;
              const decodedPixels = BlurHash.decode(hash, this.options.decodeWidth, this.options.decodeHeight);
              if (decodedPixels) {
                if (this.canvas.width !== this.options.decodeWidth) {
                  this.canvas.width = this.options.decodeWidth;
                  this.canvas.height = this.options.decodeHeight;
                }
                const imageData = new ImageData(decodedPixels, this.options.decodeWidth, this.options.decodeHeight);
                this.ctx.putImageData(imageData, 0, 0);
                this.hasRenderedFrame = true;
              }
            }
            return;
          }
        } catch (e) {
          // 若触发 CORS Tainted Canvas 安全阻断，自动切换到 4x3 低频色彩矩阵 Mode
          this.mode = 'lowfreq';
        }
      }

      // Mode 2: CORS 低频 4x3 色彩阵列 (当 getImageData 被 CORS 屏蔽或主动关闭 BlurHash 时)
      // 通过将 video 绘制到 4x3 超小 Canvas，借由 GPU 硬件双线性插值获得等同于 BlurHash 4x3 的超柔和低频色彩晕染
      if (this.mode === 'lowfreq' || !this.options.enableBlurHash) {
        try {
          if (this.canvas.width !== this.options.lowFreqWidth) {
            this.canvas.width = this.options.lowFreqWidth;
            this.canvas.height = this.options.lowFreqHeight;
          }
          this.ctx.drawImage(this.video, 0, 0, this.options.lowFreqWidth, this.options.lowFreqHeight);
          this.hasRenderedFrame = true;
          return;
        } catch (e) {
          this.mode = 'clone';
        }
      }

      // Mode 3: Cloned Video 元素容器 (极罕见的全面失效保护)
      if (this.mode === 'clone') {
        if (!this.clonedVideo && this.canvas.parentNode) {
          const parent = this.canvas.parentNode;
          this.canvas.remove();
          this.clonedVideo = this.video.cloneNode(true);
          this.clonedVideo.muted = true;
          this.clonedVideo.removeAttribute('id');
          this.clonedVideo.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block;';
          parent.appendChild(this.clonedVideo);
        }
        if (this.clonedVideo) {
          if (this.clonedVideo.paused !== this.video.paused) {
            this.video.paused ? this.clonedVideo.pause() : this.clonedVideo.play().catch(() => {});
          }
          if (Math.abs(this.clonedVideo.currentTime - this.video.currentTime) > 0.3) {
            this.clonedVideo.currentTime = this.video.currentTime;
          }
        }
      }
    }

    /**
     * 绑定视频状态同步事件与定时轮询
     */
    bindEvents() {
      const onUpdate = () => this.update();
      this.video.addEventListener('play', onUpdate);
      this.video.addEventListener('pause', onUpdate);
      this.video.addEventListener('seeked', onUpdate);
      this.video.addEventListener('timeupdate', onUpdate);
      this.video.addEventListener('canplay', onUpdate);
      this.video.addEventListener('loadeddata', onUpdate);
      this.video.addEventListener('loadedmetadata', onUpdate);

      this.removeEventListeners = () => {
        this.video.removeEventListener('play', onUpdate);
        this.video.removeEventListener('pause', onUpdate);
        this.video.removeEventListener('seeked', onUpdate);
        this.video.removeEventListener('timeupdate', onUpdate);
        this.video.removeEventListener('canplay', onUpdate);
        this.video.removeEventListener('loadeddata', onUpdate);
        this.video.removeEventListener('loadedmetadata', onUpdate);
      };

      this.timer = setInterval(() => {
        if (this.video && !this.video.ended) {
          this.update();
        }
      }, this.options.throttleMs);
    }

    /**
     * 销毁与资源清理
     */
    destroy() {
      if (this.removeEventListeners) {
        this.removeEventListeners();
      }
      if (this.timer) {
        clearInterval(this.timer);
      }
      if (this.canvas && this.canvas.parentNode) {
        this.canvas.remove();
      }
      if (this.clonedVideo && this.clonedVideo.parentNode) {
        this.clonedVideo.remove();
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlurBackgroundController;
  } else {
    global.BlurBackgroundController = BlurBackgroundController;
  }
})(typeof self !== 'undefined' ? self : this);
