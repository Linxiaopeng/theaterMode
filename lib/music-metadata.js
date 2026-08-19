/**
 * 音乐元数据解析与检索模块 (Music Metadata Parser & Service)
 * 职责：
 * 1. MusicMetadataParser：从视频网页上下文（主标题、选集/分P标题、UP主/频道）智能融合提取歌曲名、歌手及专辑。
 * 2. MusicMetadataService：对接 LrcApi (/jsonapi) 多级高精检索（title + artist + album），支持高清封面与歌词获取。
 * 3. 严格的复合词保护（如 Anti-Hero, Jay-Z）与置信度校验，杜绝误匹配。
 */

/* exported MusicMetadataParser, MusicMetadataService */

class MusicMetadataParser {
  /**
   * 从当前网页 DOM 中提取播放上下文（主视频标题、当前分P/选集标题、UP主/频道名称、播放时长）
   * @returns {{ mainTitle: string, partTitle: string, author: string, duration: number }}
   */
  static extractDOMContext() {
    if (typeof document === 'undefined') {
      return { mainTitle: '', partTitle: '', author: '', duration: 0 };
    }

    // 1. 查找当前活跃的选集 / 分P / 播单 / 章节标题
    let partTitle = '';
    const biliActiveItem = document.querySelector(
      '.video-pod__list .active, .cur-list .on, #multi_page .cur-list li.on, .list-box .active, .ep-item.cursor, .ep-item.active, .sections-item.active'
    );
    if (biliActiveItem) {
      // 优先精准提取纯标题子节点，避开 .duration, .stat 等时长与数据干扰节点
      const specificTitleEl = biliActiveItem.querySelector(
        '.title-txt, .title, .part, a[title], .ep-title, [class*="title"]:not([class*="duration"])'
      );
      if (specificTitleEl) {
        partTitle = (
          specificTitleEl.getAttribute('title') ||
          specificTitleEl.textContent ||
          ''
        ).trim();
      }
      if (!partTitle) {
        partTitle = (
          biliActiveItem.getAttribute('title') ||
          biliActiveItem.textContent ||
          ''
        ).trim();
      }
    }

    if (!partTitle) {
      const ytActiveChapter = document.querySelector(
        'ytd-playlist-panel-video-renderer[selected] #video-title, ' +
          '.ytd-macro-markers-list-item-renderer[active] #details h4, ' +
          '.ytp-chapter-title-content'
      );
      if (ytActiveChapter) {
        partTitle = (ytActiveChapter.textContent || '').trim();
      }
    }

    // 2. 查找主视频 / 专辑 / 合集标题
    let mainTitle = '';
    const biliMainTitle = document.querySelector(
      '#viewbox_report .video-title, .video-info-title-inner, h1.video-title, .video-title.special-text'
    );
    if (biliMainTitle) {
      mainTitle = (biliMainTitle.textContent || '').trim();
    }

    if (!mainTitle) {
      const ytMainTitle = document.querySelector(
        'h1.ytd-watch-metadata yt-formatted-string, #title h1 yt-formatted-string'
      );
      if (ytMainTitle) {
        mainTitle = (ytMainTitle.textContent || '').trim();
      }
    }

    if (!mainTitle) {
      mainTitle = document.title || '';
    }

    // 3. 查找作者 / UP主 / 频道名称
    let author = '';
    const authorEl = document.querySelector(
      '.up-name, .up-detail .up-name-box, .username, #channel-name a, ytd-channel-name a, meta[name="author"]'
    );
    if (authorEl) {
      author = (authorEl.textContent || authorEl.content || '').trim();
    }

    // 4. 获取视频播放总时长（秒）
    let duration = 0;
    const v = document.querySelector('video');
    if (v && Number.isFinite(v.duration)) {
      duration = v.duration;
    }

    return { mainTitle, partTitle, author, duration };
  }

  // =========================================================================
  // 📚 核心词库与过滤字典配置 (Declarative Keyword & Filter Dictionaries)
  // =========================================================================

  /** 1. 动态状态/消息前缀（如标签页未读消息、播放/暂停/缓冲状态） */
  static STATUS_PREFIX_REGEX =
    /^\s*(?:[([（][^)）]{0,16}(?:消息|播放|暂停|缓冲)[^)）]{0,6}[)）\]]|(?:\(|\[|（)\s*\d+\+?\s*(?:\)|\]|）)|[▶⏸⏯])\s*/gi;

  /** 2. 视频网站平台噪音后缀 */
  static PLATFORM_SUFFIX_REGEX =
    /\s*([_—\-–]\s*)?(哔哩哔哩(_bilibili)?|bilibili|YouTube|优酷|爱奇艺|腾讯视频|芒果TV|抖音|西瓜视频)\s*$/i;

  /** 3. 时间戳、年月日发布编号与分P选集序号 */
  static TIMESTAMP_REGEX = /(?:\[|\(|\s|^)\d{1,2}:\d{2}(?::\d{2})?(?:\]|\)|\s|$)/g;
  static DATE_STAMP_REGEX =
    /(?:\b|^)(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])(?:\b|$)|(?:\b|^)(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])(?:\b|$)/g;
  static TRACK_NUM_REGEX = /^(?:P\d+|EP\d+|Track\s*\d+|\d{1,3}[.\-_\s、]+)\s*/i;

  /** 4. 中英文技术音轨/营销标签括号 */
  static BRACKET_ZH_TECH_REGEX =
    /【(?:Hi-?Res|Hi_?Res|4K\s*60(?:帧|FPS)?|1080P\s*60(?:帧|FPS)?|2K\s*60(?:帧|FPS)?|2K\s*120(?:帧|FPS)?|720P\s*60(?:帧|FPS)?|8K|4K|1080P|720P|60帧|60FPS|无损|超清|高清|全专|全专辑|整轨(?:专辑)?|分轨|母带|黑胶|FLAC|DSD|WAV|24bit|96kHz|192kHz|歌词版|官方|自制|翻唱|Cover|MV|LIVE|现场|中字|中英|中日|双语|纯享|无杂音|完整版|动态歌词|修复|杜比|Dolby|首发|新歌|Remix|精修|原声|伴奏|字幕).*?】/gi;
  static BRACKET_EN_TECH_REGEX =
    /\[(?:Hi-?Res|Hi_?Res|4K\s*60(?:帧|FPS)?|1080P\s*60(?:帧|FPS)?|2K\s*60(?:帧|FPS)?|4K|1080P|720P|60FPS|MV|Official|Music Video|Audio|Live|Lyrics|Remix|HD|HQ|Special|Full|Cover|Full Album|Full Audio Album|整轨|FLAC|DSD|WAV).*?\]/gi;
  static PAREN_OFFICIAL_REGEX =
    /\((?:Official\s*(?:Music\s*)?Video|Official\s*Audio(?:\s*Album)?|Official\s*MV|Official\s*Lyric\s*(?:Video)?|Official\s*Audio\s*Album|Official|MV|Lyric\s*(?:Video|Ver\.?|Version)?|Lyrics\s*(?:Video)?|Music\s*Video|Live(?:\s+.*?)?|HD|HQ|1080P|720P|4K|Audio|Lyrics|Remix|Cover|Full\s*Ver\.?|Full\s*Album|官方音频专辑|官方\s*Audio|原声专辑).*?\)/gi;

  /** 5. 独立营销、字幕与音质修饰短语 */
  static GENERAL_NOISE_REGEX =
    /(?:中日罗马音字幕|中日双语字幕|中日双语|中日英字幕|中韩双语字幕|罗马音字幕|罗马音|中日字幕|日中字幕|双语字幕|中文字幕|日文字幕|英文字幕|韩文字幕|假名字幕|平假名|片假名|拼音字幕|歌词字幕|无字幕|内嵌字幕|特效字幕|字幕|全专试听|全专辑试听|全专歌词版|全专辑歌词版|全专无损|全专|全专辑|原声专辑合集|原声合集|专辑合集|全专合集|全专辑合集|原声专辑|官方音频专辑|完整专辑|合集试听|全碟试听|全碟|整轨专辑|整轨试听|整轨纯享|整轨|分轨|无损纯享|纯享整轨专辑|纯享整轨|纯享|无损音质|高音质|无损|官方MV|官方超清|(?:\b|^)MV(?:\b|$)|(?:\b|^)OST(?:\b|$))/gi;

  /** 6. 艺术家常见中文别名 / 括号译名表 */
  static ARTIST_ALIAS_REGEX =
    /[（(](?:共和时代|霉霉|盆栽|黄老板|火星哥|碧梨|艾薇儿|酷玩乐队|魔力红|林肯公园|西城男孩|后街男孩|中英字幕|双语字幕|官方|中字|双语).*?[)）]/gi;
  static ARTIST_SUFFIX_REGEX =
    /[（(][^）)]*?(?:乐队|歌手|时代|乐团|Boy|Group|Band|Official)[^）)]*?[)）]/gi;

  /** 7. 艺术家多语言跨语种同义词字典 (Multi-language Artist Synonyms Map) */
  static ARTIST_SYNONYMS_MAP = {
    宇多田光: '宇多田ヒカル',
    宇多田ヒカル: '宇多田ヒカル',
    'Hikaru Utada': '宇多田ヒカル',
    'Utada Hikaru': '宇多田ヒカル',
    米津玄师: '米津玄師',
    米津玄師: '米津玄師',
    'Kenshi Yonezu': '米津玄師',
    坂井泉水: 'ZARD',
    ZARD: 'ZARD',
    椎名林檎: '椎名林檎',
    'Sheena Ringo': '椎名林檎',
    周杰伦: '周杰伦',
    'Jay Chou': '周杰伦',
    林俊杰: '林俊杰',
    'JJ Lin': '林俊杰',
    王菲: '王菲',
    'Faye Wong': '王菲',
    陈奕迅: '陈奕迅',
    'Eason Chan': '陈奕迅',
    张国荣: '张国荣',
    'Leslie Cheung': '张国荣',
    邓紫棋: 'G.E.M. 邓紫棋',
    'G.E.M.': 'G.E.M. 邓紫棋',
    防弹少年团: 'BTS',
    BTS: 'BTS',
    BLACKPINK: 'BLACKPINK',
    IU: 'IU',
    李知恩: 'IU',
    YOASOBI: 'YOASOBI',
    Aimer: 'Aimer',
    'Taylor Swift': 'Taylor Swift',
    OneRepublic: 'OneRepublic',
    'Linkin Park': 'Linkin Park',
    'The Weeknd': 'The Weeknd',
    'Summer Walker': 'Summer Walker'
  };

  /** 8. 整轨专辑/合集识别关键词 */
  static ALBUM_COLLECTION_REGEX =
    /(?:全专试听|全专辑试听|全专歌词版|全专辑歌词版|全专无损|全专|全专辑|原声专辑合集|原声合集|专辑合集|全专合集|全专辑合集|原声专辑|官方音频专辑|完整专辑|合集试听|全碟试听|全碟|整轨专辑|整轨试听|整轨纯享|整轨|分轨|无损纯享|纯享整轨专辑|纯享整轨|Full\s*Album|Full\s*Audio\s*Album|Full\s*Length\s*Album|Complete\s*Album|Official\s*Audio\s*Album|Album\s*Collection|Full\s*OST)/i;

  /**
   * 清理无意义的视频网站后缀、分P序号、时间戳及技术修饰标签
   * @param {string} text
   * @returns {string}
   */
  static stripNoise(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(this.STATUS_PREFIX_REGEX, '')
      .replace(this.PLATFORM_SUFFIX_REGEX, '')
      .replace(this.TIMESTAMP_REGEX, ' ')
      .replace(this.DATE_STAMP_REGEX, ' ')
      .replace(/(?:^|\s)\d{1,2}:\d{2}(?::\d{2})?(?:$|\s)/g, ' ')
      .replace(this.TRACK_NUM_REGEX, '')
      .replace(this.BRACKET_ZH_TECH_REGEX, ' ')
      .replace(this.BRACKET_EN_TECH_REGEX, ' ')
      .replace(this.PAREN_OFFICIAL_REGEX, ' ')
      .replace(this.GENERAL_NOISE_REGEX, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 在字符串中扫描匹配已知艺术家或其别名
   * @param {string} text
   * @returns {{ canonicalName: string, matchedAliases: string[] } | null}
   */
  static findKnownArtist(text) {
    if (!text || typeof text !== 'string') return null;
    const matchedAliases = [];
    let canonicalName = '';
    const keys = Object.keys(this.ARTIST_SYNONYMS_MAP).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      if (text.toLowerCase().includes(k.toLowerCase())) {
        matchedAliases.push(k);
        if (!canonicalName) {
          canonicalName = this.ARTIST_SYNONYMS_MAP[k];
        }
      }
    }
    return canonicalName ? { canonicalName, matchedAliases } : null;
  }

  /**
   * 清洗艺术家名称（剥离括号中的译名或别名，如 OneRepublic（共和时代） -> OneRepublic）
   * @param {string} text
   * @returns {string}
   */
  static cleanArtist(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(this.ARTIST_ALIAS_REGEX, ' ')
      .replace(this.ARTIST_SUFFIX_REGEX, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 清洗专辑/曲目名称（剥离年份前缀后缀，如 2013 - Native -> Native）
   * @param {string} text
   * @returns {string}
   */
  static cleanAlbum(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(
        /^(?:(?:19|20)\d{2}\s*[-—–:：/.\s]\s*|\((?:19|20)\d{2}\)\s*|\[(?:19|20)\d{2}\]\s*)/i,
        ''
      )
      .replace(
        /\s*(?:\((?:19|20)\d{2}\)|\[(?:19|20)\d{2}\]|[-—–:：/.\s]\s*(?:19|20)\d{2})\s*$/i,
        ''
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 解析整张专辑/汇总合集视频 (Full Album / Album Collection)
   * @param {string} rawText 视频标题
   * @param {number} [duration=0] 视频时长 (秒)
   * @returns {{ isAlbumCollection: boolean, artist: string, album: string }}
   */
  static parseAlbumCollection(rawText, duration = 0) {
    const isCollection =
      this.ALBUM_COLLECTION_REGEX.test(rawText) ||
      (duration >= 600 && /(?:全新专辑|新专辑|首张专辑|专辑|Album|OST|《.+?》)/i.test(rawText));

    if (!isCollection) {
      return { isAlbumCollection: false, artist: '', album: '' };
    }

    // 1. 优先检查管道符 "|" 分割结构：如 "OneRepublic（共和时代） | 2013 - Native | HiRes 无损纯享整轨专辑"
    if (rawText.includes('|')) {
      const rawSegments = rawText.split('|').map(s => s.trim());
      const validSegments = [];
      for (const seg of rawSegments) {
        const cleanedSeg = this.stripNoise(seg);
        if (cleanedSeg && cleanedSeg.length > 0) {
          validSegments.push(cleanedSeg);
        }
      }
      if (validSegments.length >= 2) {
        const artist = this.cleanArtist(validSegments[0]);
        const album = this.cleanAlbum(validSegments[1]);
        return { isAlbumCollection: true, artist, album };
      }
    }

    const working = this.stripNoise(rawText);
    let artist = '';
    let album = '';

    // 2. 优先匹配《书名号》中的专辑名
    const bookMatch = working.match(/^(.*?)[《<「](.+?)[》>」](.*?)$/);
    if (bookMatch) {
      album = this.cleanAlbum(bookMatch[2]);
      const before = this.cleanArtist(
        bookMatch[1].replace(
          /(?:全新专辑|新专辑|首张专辑|同名专辑|专辑|全专试听|全专辑试听|全专歌词版|全专无损|全专|全专辑|原声专辑合集|原声合集|专辑合集|完整版|无损高音质|高音质|无损音质|无损|官方MV|(?:\b|^)MV(?:\b|$)|(?:\b|^)OST(?:\b|$))/gi,
          ''
        )
      );
      const after = this.cleanArtist(
        bookMatch[3].replace(
          /(?:全新专辑|新专辑|首张专辑|同名专辑|专辑|全专试听|全专辑试听|全专歌词版|全专无损|全专|全专辑|原声专辑合集|原声合集|专辑合集|完整版|无损高音质|高音质|无损音质|无损|官方MV|(?:\b|^)MV(?:\b|$)|(?:\b|^)OST(?:\b|$))/gi,
          ''
        )
      );
      artist = before || after || '';
    }

    // 3. 匹配合集词分割：如 "After Hours 原声专辑合集 The Weeknd"
    if (!album) {
      const colSplit = rawText.match(
        /^(.*?)\s*(?:原声专辑合集|原声合集|专辑合集|全专合集|全专辑合集|全新专辑|新专辑|首张专辑|同名专辑|专辑|全专试听|全专辑试听|全专歌词版|全专无损|全专|全专辑|Full\s*Album|Album\s*Collection|Full\s*OST)\s*(.*?)$/i
      );
      if (colSplit) {
        const left = this.cleanAlbum(this.stripNoise(colSplit[1]));
        const right = this.cleanArtist(this.stripNoise(colSplit[2]));
        if (left && right) {
          album = left;
          artist = right;
        } else if (left) {
          album = left;
        } else if (right) {
          album = right;
        }
      }
    }

    // 4. 匹配 "Artist - Album" (ASCII 减号 \s+-\s+)
    if (!album) {
      const splitMatch = working.match(
        /^(.+?)(?:\s+-\s+|\s*[—–|]\s*|(?<!\d)\s*[:：]\s*(?!\d))(.+?)$/
      );
      if (splitMatch) {
        artist = this.cleanArtist(splitMatch[1].replace(/(?:全专试听|全专|全专辑|无损)/gi, ''));
        album = this.cleanAlbum(splitMatch[2].replace(/(?:全专试听|全专|全专辑|无损)/gi, ''));
      }
    }

    if (!album) {
      album = this.cleanAlbum(working);
    }

    artist = this.cleanArtist(artist)
      .replace(/^(?:由|by|feat\.?)\s+/i, '')
      .replace(/^[-—–:：/|\s]+|[-—–:：/|\s]+$/g, '')
      .trim();
    album = album.replace(/^[-—–:：/|\s]+|[-—–:：/|\s]+$/g, '').trim();

    return { isAlbumCollection: true, artist, album };
  }

  /**
   * 解析主标题中的歌手与专辑信息（如：Taylor Swift 新专辑 Midnights）
   * @param {string} mainText
   * @returns {{ artist: string, album: string, cleaned: string }}
   */
  static parseMain(mainText) {
    const cleaned = this.stripNoise(mainText);
    let artist = '';
    let album = '';

    // 1. 匹配 "新专辑 / 首张专辑 / 专辑" 关键词
    const albumWordMatch = cleaned.match(
      /^(.*?)\s*(?:全新专辑|新专辑|首张专辑|同名专辑|专辑)\s*[《<「]?(.*?)[》>」]?$/i
    );
    if (albumWordMatch) {
      artist = this.cleanArtist(albumWordMatch[1]);
      album = this.cleanAlbum(albumWordMatch[2]);
    }

    // 2. 匹配 《专辑名》
    if (!album) {
      const bookMatch = cleaned.match(/^(.*?)[《<](.+?)[》>](.*?)$/);
      if (bookMatch) {
        artist = this.cleanArtist(bookMatch[1] || bookMatch[3] || '');
        album = this.cleanAlbum(bookMatch[2]);
      }
    }

    // 3. 匹配 "Artist - Album" (ASCII 减号必须有两侧空格 \s+-\s+，避免截断复合词)
    if (!album) {
      const splitMatch = cleaned.match(
        /^(.+?)(?:\s+-\s+|\s*[—–|]\s*|(?<!\d)\s*[:：]\s*(?!\d))(.+?)$/
      );
      if (splitMatch) {
        const part1 = splitMatch[1].trim();
        const part2 = splitMatch[2].trim();
        if (!/^\d{1,2}:\d{2}$/.test(part1) && !/^\d{1,2}:\d{2}$/.test(part2)) {
          artist = this.cleanArtist(part1);
          album = this.cleanAlbum(part2);
        }
      }
    }

    // 4. 清理残留符号
    artist = artist.replace(/^[-—–:：/|\s]+|[-—–:：/|\s]+$/g, '').trim();
    album = album.replace(/^[-—–:：/|\s]+|[-—–:：/|\s]+$/g, '').trim();

    return { artist, album, cleaned };
  }

  /**
   * 解析单段标题（如分P或单曲视频）
   * @param {string} trackText
   * @returns {{ title: string, artist: string, cleaned: string }}
   */
  static parseTrack(trackText) {
    // 1. 检查 "|" 管道分隔结构：如 "OneRepublic（共和时代） | 2013 - Native | HiRes 无损纯享整轨专辑"
    if (trackText && trackText.includes('|')) {
      const rawSegments = trackText.split('|').map(s => s.trim());
      const validSegments = [];
      for (const seg of rawSegments) {
        const cleanedSeg = this.stripNoise(seg);
        if (cleanedSeg && cleanedSeg.length > 0) {
          validSegments.push(cleanedSeg);
        }
      }
      if (validSegments.length >= 2) {
        const artist = this.cleanArtist(validSegments[0]);
        const title = this.cleanAlbum(validSegments[1]);
        return { title, artist, cleaned: `${artist} - ${title}` };
      }
    }

    const cleaned = this.stripNoise(trackText);
    let artist = '';
    let title = '';

    // 2. 匹配 《歌名》
    const bookMatch = cleaned.match(/^(.*?)[《<](.+?)[》>](.*?)$/);
    if (bookMatch) {
      title = this.cleanAlbum(bookMatch[2]);
      artist = this.cleanArtist(bookMatch[1] || bookMatch[3] || '');
    }

    // 3. 匹配 「歌名」
    if (!title) {
      const jpMatch = cleaned.match(/^(.*?)「(.+?)」(.*?)$/);
      if (jpMatch) {
        title = this.cleanAlbum(jpMatch[2]);
        artist = this.cleanArtist(jpMatch[1] || jpMatch[3] || '');
      }
    }

    // 4. 匹配 歌手 - 歌名 (关键：ASCII 短横杠必须有空格 \s+-\s+，保护 Anti-Hero, Post-Modern, Jay-Z 等复合词；冒号避开时间戳)
    if (!title) {
      const splitMatch = cleaned.match(
        /^(.+?)(?:\s+-\s+|\s*[—–|]\s*|(?<!\d)\s*[:：]\s*(?!\d))(.+?)$/
      );
      if (splitMatch) {
        const part1 = splitMatch[1].trim();
        const part2 = splitMatch[2].trim();
        if (!/^\d{1,2}:\d{2}$/.test(part1) && !/^\d{1,2}:\d{2}$/.test(part2)) {
          artist = this.cleanArtist(part1);
          title = this.cleanAlbum(part2);
        }
      }
    }

    // 5. 匹配 Title by Artist
    if (!title) {
      const byMatch = cleaned.match(/^(.+?)\s+(?:by|feat\.?)\s+(.+?)$/i);
      if (byMatch) {
        title = this.cleanAlbum(byMatch[1]);
        artist = this.cleanArtist(byMatch[2]);
      }
    }

    // 6. 匹配无明确分隔符的多语言空间分词序列（如 "宇多田光 First Love 宇多田ヒカル 初恋" / "米津玄师 柠檬 米津玄師 Lemon"）
    if (!artist || !title || artist === title) {
      const knownArtist = this.findKnownArtist(cleaned);
      if (knownArtist) {
        artist = knownArtist.canonicalName;
        let remaining = cleaned;
        for (const alias of knownArtist.matchedAliases) {
          remaining = remaining.replace(
            new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
            ' '
          );
        }
        remaining = remaining.replace(/\s+/g, ' ').trim();
        const enMatch = remaining.match(/[A-Za-z0-9\s'-]+/);
        if (enMatch && enMatch[0].trim().length > 1) {
          title = enMatch[0].trim();
        } else if (remaining) {
          title = remaining.split(/\s+/)[0];
        }
      }
    }

    if (!title) {
      title = this.cleanAlbum(cleaned);
    }

    title = title.replace(/^[-—–:：/|\s]+|[-—–:：/|\s]+$/g, '').trim();
    artist = artist.replace(/^[-—–:：/|\s]+|[-—–:：/|\s]+$/g, '').trim();

    return { title, artist, cleaned };
  }

  /**
   * 清洗并融合网页上下文中的音乐特征信息
   * @param {string} rawTitle 原始网页标题
   * @param {{ mainTitle?: string, partTitle?: string, author?: string, duration?: number }} [domContext] 网页上下文
   * @returns {{ isAlbumCollection: boolean, queryTitle: string, queryArtist: string, queryAlbum: string, cleanFallbackTitle: string }}
   */
  static parse(rawTitle, domContext = null) {
    const raw = (rawTitle || '').trim();
    const ctx = domContext || this.extractDOMContext();
    const { mainTitle = '', partTitle = '', author = '', duration = 0 } = ctx;

    const cleanFallback = this.stripNoise(partTitle || raw || mainTitle) || raw || '未知曲目';

    // 场景 A：存在分P / 选集标题，且与主标题不同（如全专辑选集、分P合集）
    if (partTitle && this.stripNoise(partTitle) !== this.stripNoise(mainTitle || raw)) {
      // 若该选集自身为整轨专辑 / 全专汇总
      const partCol = this.parseAlbumCollection(partTitle, duration);
      if (partCol.isAlbumCollection && (partCol.album || partCol.artist)) {
        const authorClean = this.cleanArtist(this.stripNoise(author));
        const queryArtist = partCol.artist || authorClean || '';
        const queryAlbum = partCol.album || cleanFallback;

        return {
          isAlbumCollection: true,
          queryTitle: queryAlbum,
          queryArtist,
          queryAlbum,
          cleanFallbackTitle: queryArtist ? `${queryAlbum} - ${queryArtist}` : queryAlbum
        };
      }

      const partParsed = this.parseTrack(partTitle);
      const mainParsed = this.parseMain(mainTitle || raw);
      const authorClean = this.cleanArtist(this.stripNoise(author));

      const queryTitle = partParsed.title || this.stripNoise(partTitle);
      const queryArtist = partParsed.artist || mainParsed.artist || authorClean || '';
      const queryAlbum = mainParsed.album || '';

      return {
        isAlbumCollection: false,
        queryTitle,
        queryArtist,
        queryAlbum,
        cleanFallbackTitle: queryArtist ? `${queryTitle} - ${queryArtist}` : queryTitle
      };
    }

    // 场景 B：未分集，且检测为主视频为整张专辑汇总试听/合集（如全专试听、时长长且为专辑）
    const albumCol = this.parseAlbumCollection(mainTitle || raw, duration);
    if (albumCol.isAlbumCollection) {
      const authorClean = this.cleanArtist(this.stripNoise(author));
      const queryArtist = albumCol.artist || authorClean || '';
      const queryAlbum = albumCol.album || cleanFallback;

      return {
        isAlbumCollection: true,
        queryTitle: queryAlbum,
        queryArtist,
        queryAlbum,
        cleanFallbackTitle: queryArtist ? `${queryAlbum} - ${queryArtist}` : queryAlbum
      };
    }

    // 场景 C：普通单曲视频
    const trackParsed = this.parseTrack(raw || mainTitle);
    const mainParsed = this.parseMain(raw || mainTitle);
    const authorClean = this.cleanArtist(this.stripNoise(author));

    const queryTitle = trackParsed.title || cleanFallback;
    const queryArtist = trackParsed.artist || mainParsed.artist || authorClean || '';
    const queryAlbum = mainParsed.album || '';

    return {
      isAlbumCollection: false,
      queryTitle,
      queryArtist,
      queryAlbum,
      cleanFallbackTitle: queryArtist ? `${queryTitle} - ${queryArtist}` : queryTitle
    };
  }
}

class MusicMetadataService {
  static _cache = new Map();
  static DEFAULT_API_HOST = 'https://api.lrc.cx';

  /**
   * 异步检索音乐元数据 (Title, Artist, Album, Cover, Lyrics)
   * @param {{ isAlbumCollection?: boolean, queryTitle: string, queryArtist?: string, queryAlbum?: string, cleanFallbackTitle?: string }} parsedInfo
   * @param {string} [customHost] 可选的自定义 API 实例地址
   * @returns {Promise<{ isAlbumCollection?: boolean, title: string, artist: string, album: string, cover: string, lyrics: string, id: string } | null>}
   */
  static async fetchMetadata(parsedInfo, customHost = '') {
    if (!parsedInfo || !parsedInfo.queryTitle) {
      return null;
    }

    const { isAlbumCollection, queryTitle, queryArtist, queryAlbum } = parsedInfo;
    const cacheKey =
      `${isAlbumCollection ? 'col_' : ''}${queryTitle}___${queryArtist || ''}___${queryAlbum || ''}`.toLowerCase();

    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const host = (customHost || this.DEFAULT_API_HOST).replace(/\/+$/, '');

    let result = null;
    const canonicalArtist =
      (typeof MusicMetadataParser !== 'undefined' &&
        MusicMetadataParser.ARTIST_SYNONYMS_MAP &&
        MusicMetadataParser.ARTIST_SYNONYMS_MAP[queryArtist]) ||
      queryArtist;

    // 专辑合集模式：优先调用 artist + album 精确匹配整张专辑
    if (isAlbumCollection && queryArtist && queryAlbum) {
      result = await this._queryApi(host, '', canonicalArtist || queryArtist, queryAlbum, true);
      if (!result && canonicalArtist !== queryArtist) {
        result = await this._queryApi(host, '', queryArtist, queryAlbum, true);
      }
    }

    // 1. 最高精度组合搜索（title + artist + album）
    if (!result && (queryArtist || queryAlbum)) {
      result = await this._queryApi(
        host,
        queryTitle,
        canonicalArtist || queryArtist,
        queryAlbum,
        isAlbumCollection
      );
      if (!result && canonicalArtist !== queryArtist) {
        result = await this._queryApi(host, queryTitle, queryArtist, queryAlbum, isAlbumCollection);
      }
    }

    // 2. 次级精度搜索（title + artist）
    if (!result && queryArtist) {
      result = await this._queryApi(
        host,
        queryTitle,
        canonicalArtist || queryArtist,
        '',
        isAlbumCollection
      );
      if (!result && canonicalArtist !== queryArtist) {
        result = await this._queryApi(host, queryTitle, queryArtist, '', isAlbumCollection);
      }
    }

    // 3. 降级为单歌名模糊检索（title）
    if (!result) {
      result = await this._queryApi(host, queryTitle, '', '', isAlbumCollection);
    }

    if (result) {
      if (isAlbumCollection) {
        result.isAlbumCollection = true;
        if (queryAlbum) {
          result.album = result.album || queryAlbum;
        }
      }
      this._cache.set(cacheKey, result);
      return result;
    }

    return null;
  }

  /**
   * 请求 LrcApi /jsonapi 端点
   * @private
   */
  static async _queryApi(host, title, artist, album = '', isAlbumCollection = false) {
    let url = `${host}/jsonapi?`;
    const params = [];
    if (title) params.push(`title=${encodeURIComponent(title)}`);
    if (artist) params.push(`artist=${encodeURIComponent(artist)}`);
    if (album) params.push(`album=${encodeURIComponent(album)}`);
    url += params.join('&');

    try {
      let data = null;

      // 1. 优先通过 Chrome Background Service Worker 代理以规避宿主网页 CSP
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          const res = await new Promise(resolve => {
            chrome.runtime.sendMessage({ type: 'FETCH_MUSIC_METADATA', url }, response => {
              if (chrome.runtime.lastError) {
                resolve(null);
              } else {
                resolve(response);
              }
            });
          });
          if (res && res.success && Array.isArray(res.data)) {
            data = res.data;
          }
        } catch (e) {
          data = null;
        }
      }

      // 2. 如果 Background 代理未响应，则通过 fetch 兜底直接请求
      if (!data) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const fetchRes = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (fetchRes.ok) {
          data = await fetchRes.json();
        }
      }

      if (Array.isArray(data) && data.length > 0) {
        // 校验匹配置信度，防止非音乐类视频或局部同名词产生误匹配
        for (const item of data) {
          if (this._isValidMatch(title, artist, album, item, isAlbumCollection)) {
            const rawCover = item.cover || '';
            const secureCover = rawCover ? rawCover.replace(/^http:\/\//i, 'https://') : '';
            return {
              isAlbumCollection: !!isAlbumCollection,
              title: isAlbumCollection ? item.album || album || title : item.title || title,
              artist: item.artist || artist || '',
              album: item.album || album || '',
              cover: secureCover,
              lyrics: item.lyrics || '',
              id: item.id || ''
            };
          }
        }
      }
    } catch (err) {
      console.warn('[MusicMetadataService] Metadata request failed:', err);
    }

    return null;
  }

  /**
   * 校验返回结果与原始查询词的匹配置信度
   * @private
   */
  static _isValidMatch(queryTitle, queryArtist, queryAlbum, item, isAlbumCollection = false) {
    if (!item || !item.title) return false;

    const normalize = str =>
      (str || '')
        .toLowerCase()
        .replace(
          /\((?:deluxe(?:\s+edition)?|standard(?:\s+edition)?|expanded(?:\s+edition)?|special(?:\s+edition)?|bonus\s+track\s+version|the\s+til\s+dawn\s+edition|3am\s+edition|deluxe\s+video\s+album|complete\s+set)\)/gi,
          ''
        )
        .replace(/[\s\-_—–:：/|《》「」()（）]+/g, '');

    const normQueryTitle = normalize(queryTitle);
    const normResultTitle = normalize(item.title);
    const normQueryArtist = normalize(queryArtist);
    const normResultArtist = normalize(item.artist);
    const normQueryAlbum = normalize(queryAlbum);
    const normResultAlbum = normalize(item.album);

    // 专辑合集模式特殊判定：必须专辑名称完全一致（如 Finally Over It 绝不能误匹配为 Over It）
    if (isAlbumCollection) {
      if (normQueryAlbum && normResultAlbum) {
        if (normQueryAlbum === normResultAlbum) {
          if (!normQueryArtist || !normResultArtist) return true;
          return (
            normQueryArtist.includes(normResultArtist) || normResultArtist.includes(normQueryArtist)
          );
        }
      }
      return false;
    }

    // 单曲模式判定：
    // 1. 若原始提取中包含明确歌手，且与返回歌手存在交叉匹配
    if (normQueryArtist && normResultArtist) {
      if (
        normQueryArtist.includes(normResultArtist) ||
        normResultArtist.includes(normQueryArtist)
      ) {
        // 当歌手匹配时，歌名完全相同
        if (normQueryTitle === normResultTitle || normQueryTitle === normResultAlbum) {
          return true;
        }
      }
    }

    // 2. 歌名完全相同（精准匹配）
    if (normQueryTitle === normResultTitle) {
      return true;
    }

    // 3. 长度相似度判定（单曲模式下防止长视频标题中的局部词组被模糊检索强行匹配）
    if (normQueryTitle.includes(normResultTitle)) {
      const lengthRatio = normResultTitle.length / Math.max(1, normQueryTitle.length);
      if (lengthRatio >= 0.75) {
        return true;
      }
    }

    return false;
  }
}

if (typeof window !== 'undefined') {
  window.MusicMetadataParser = MusicMetadataParser;
  window.MusicMetadataService = MusicMetadataService;
}
