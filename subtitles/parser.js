/**
 * 字幕解析模块 (Subtitle Parser Module)
 * 职责：负责解析本地上传的字幕文件 (.srt, .vtt)。
 * 架构设计：支持格式检测、时间戳解析、错误处理以及未来 AI 翻译、双语字幕、时间偏移等扩展。
 */

class SubtitleParser {
  /**
   * 解析字幕文件内容
   * @param {string} fileContent 文件文本内容
   * @param {string} fileName 文件名（用于判断格式，如 .srt, .vtt）
   * @returns {Array<{start: number, end: number, text: string}>} 解析后的时间轴与文本列表
   * @throws {Error} 不支持的文件格式
   */
  static parse(fileContent, fileName = '') {
    if (!fileContent || typeof fileContent !== 'string') {
      throw new Error('字幕文件内容为空或格式无效');
    }

    const ext = fileName.split('.').pop().toLowerCase();

    // 根据扩展名或内容自动识别解析策略
    if (ext === 'vtt' || fileContent.trim().startsWith('WEBVTT')) {
      return SubtitleParser.parseVTT(fileContent);
    } else if (ext === 'srt') {
      // 默认按 .srt 解析
      return SubtitleParser.parseSRT(fileContent);
    } else {
      // 不支持的格式，抛出错误提示
      throw new Error('暂不支持 ' + ext.toUpperCase() + ' 格式，仅支持 .srt 和 .vtt');
    }
  }

  /**
   * 解析 SRT 格式字幕
   * @param {string} content
   */
  static parseSRT(content) {
    // 统一换行符
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = normalized.split(/\n\s*\n/);
    const cues = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i].trim();
      if (!block) continue;

      const lines = block.split('\n');
      let timeLineIndex = -1;

      // 查找包含时间戳 "-->" 的行
      for (let j = 0; j < lines.length; j++) {
        if (lines[j].includes('-->')) {
          timeLineIndex = j;
          break;
        }
      }

      if (timeLineIndex === -1) continue;

      const timeLine = lines[timeLineIndex];
      const timeParts = timeLine.split('-->');
      if (timeParts.length !== 2) continue;

      const startTime = SubtitleParser.parseTimestamp(timeParts[0].trim());
      const endTime = SubtitleParser.parseTimestamp(timeParts[1].trim());

      if (isNaN(startTime) || isNaN(endTime)) continue;

      // 时间轴之后的所有行即为字幕文本（支持多行）
      const textLines = lines.slice(timeLineIndex + 1);
      const text = textLines.join('\n').trim();

      if (text) {
        cues.push({
          start: startTime,
          end: endTime,
          text: text
        });
      }
    }

    if (cues.length === 0) {
      throw new Error('未能从文件中解析出有效的 SRT 字幕时间轴，请检查文件格式。');
    }

    return cues;
  }

  /**
   * 解析 VTT 格式字幕（预留扩展）
   */
  static parseVTT(content) {
    // 基础 VTT 解析（可复用 SRT 逻辑，跳过 WEBVTT 头）
    const cleanContent = content.replace(/^WEBVTT[^\n]*\n+/i, '');
    return SubtitleParser.parseSRT(cleanContent);
  }

  /**
   * 解析 ASS 格式字幕（暂不支持）
   * @deprecated 此方法已弃用，请使用 parseSRT() 代替
   */
  static parseASS(content) {
    throw new Error('暂不支持 .ass 格式，敬请期待后续版本。');
  }

  /**
   * 将时间戳字符串转换为秒数
   * 支持 00:01:20,000 或 01:20.000 或 01:20,000
   * @param {string} timeStr
   * @returns {number} 秒数
   */
  static parseTimestamp(timeStr) {
    // 替换逗号为点号以便统一解析
    const clean = timeStr.replace(',', '.');
    const parts = clean.split(':');

    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    if (parts.length === 3) {
      hours = parseFloat(parts[0]) || 0;
      minutes = parseFloat(parts[1]) || 0;
      seconds = parseFloat(parts[2]) || 0;
    } else if (parts.length === 2) {
      minutes = parseFloat(parts[0]) || 0;
      seconds = parseFloat(parts[1]) || 0;
    }

    return hours * 3600 + minutes * 60 + seconds;
  }

  /* ========================================================
   * 未来规划架构预留方法（本次不实现具体逻辑）
   * ======================================================== */

  /**
   * [预留] 字幕时间偏移调整 (Time Offset)
   * @todo 待实现：用于调整字幕显示时间点（例如同步不同语言版本）
   * @param {Array<{start: number, end: number, text: string}>} cues 字幕数组
   * @param {number} _offsetSeconds 时间偏移秒数（占位符，待实现）
   * @returns {Array<{start: number, end: number, text: string}>} 调整后的字幕数组
   */
  static applyTimeOffset(cues, _offsetSeconds) {
    // TODO: 实现字幕时间偏移逻辑
    console.warn('[SubtitleParser] applyTimeOffset 方法暂未实现');
    return cues;
  }

  /**
   * [预留] AI 翻译接入桩 (AI Translation)
   * @todo 待实现：集成 AI 翻译服务（如 OpenAI、Google Translate 等）
   * @param {Array<{start: number, end: number, text: string}>} cues 字幕数组
   * @param {string} targetLang 目标语言代码（占位符，待实现）
   * @returns {Promise<Array<{start: number, end: number, text: string}>>} 翻译后的字幕数组
   */
  static async translateCues(cues, _targetLang = 'zh') {
    // TODO: 实现异步翻译接口
    console.warn('[SubtitleParser] translateCues 方法暂未实现');
    return cues;
  }
}
