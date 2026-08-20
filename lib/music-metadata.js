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
      '.video-pod__list .video-pod__item.active, ' +
        '.video-pod__list .video-pod__item.is-active, ' +
        '.video-pod__item.active, .video-pod__item.is-active, ' +
        '.video-pod__list .active, .video-pod__list .is-active, ' +
        '.simple-base-item.active, .simple-base-item.is-active, ' +
        '.video-episode-card.active, .video-episode-card.is-active, ' +
        '[class*="video-pod__item"][class*="active"], [class*="video-pod__item"][class*="is-active"], ' +
        '#multi_page .cur-list li.on, .cur-list li.on, .cur-list .on, ' +
        '.list-box .active, .list-box li.on, ' +
        '.ep-item.cursor, .ep-item.active, .ep-item.is-active, .ep-list-wrapper .active, ' +
        '.sections-item.active, .section-item.active, .episode-item.active, ' +
        '[class*="ep-item"][class*="active"], [class*="episode-item"][class*="active"], ' +
        '[class*="section-item"][class*="active"], [class*="sections-item"][class*="active"], ' +
        '[class*="cur-list"] [class*="on"]'
    );
    if (biliActiveItem) {
      // 优先精准提取纯标题子节点，避开 .duration, .stat 等时长与数据干扰节点
      const specificTitleEl = biliActiveItem.querySelector(
        '.title-txt, .title, .part, a[title], .ep-title, [class*="title"]:not([class*="duration"]), [class*="info-title"], .simple-base-item__title, .video-episode-card__info-title'
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
          biliActiveItem.getAttribute('aria-label') ||
          biliActiveItem.textContent ||
          ''
        ).trim();
      }
    }

    if (!partTitle) {
      const ytActiveChapter = document.querySelector(
        'ytd-playlist-panel-video-renderer[selected] #video-title, ' +
          'ytd-playlist-panel-video-renderer[selected] h4, ' +
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

    // 5. 查找 Bilibili 官方发现音乐标签 / 歌曲识别卡 / 详情弹窗 (如: 发现《Good Goodbye》或 发现《Home》)
    let musicId = '';
    let discoveryTitle = '';
    let biliArtist = '';
    let biliAlbum = '';
    let biliCover = '';

    const isBili =
      typeof location !== 'undefined' &&
      location.hostname &&
      location.hostname.includes('bilibili.com');

    // 5.1 遍历所有候选标签，提取 BGM / 发现音乐 / 音乐链接
    const allTagElements = document.querySelectorAll(
      '.bgm-tag, .bgm-link, [class*="bgm-tag"], [class*="bgm-link"], .tag-link[title*="发现《"], [title*="发现《"], .bgm-tag .tag-txt, a[href*="music-detail"], a[href*="music.bilibili.com"], [data-music-id], .tag-panel .tag-link, .video-tag-container .tag-link'
    );

    for (const tagEl of allTagElements) {
      const href =
        tagEl.getAttribute('href') ||
        tagEl.getAttribute('data-href') ||
        tagEl.getAttribute('data-url') ||
        tagEl.getAttribute('to') ||
        '';
      const matchId =
        href.match(/music_id=([A-Za-z0-9_]+)/i) || href.match(/music-detail\/?\?([A-Za-z0-9_]+)/i);
      if (matchId && !musicId) {
        musicId = matchId[1];
      }

      const rawTagText = (
        tagEl.getAttribute('title') ||
        tagEl.getAttribute('aria-label') ||
        tagEl.querySelector?.('.tag-txt')?.textContent ||
        tagEl.textContent ||
        ''
      ).trim();

      // 匹配 "发现《歌名》" / "发现<歌名>" / "发现「歌名」" / "发现『歌名』" / "发现【歌名】" / "发现 歌名"
      const matchDiscover =
        rawTagText.match(/发现\s*[《<「『【](.+?)[》>」』】]/) ||
        rawTagText.match(/发现\s*[:：]?\s*([^\s《<「『【].+?)$/);
      if (matchDiscover && !discoveryTitle) {
        const candidate = matchDiscover[1].trim();
        const splitMatch = candidate.match(/^(.+?)\s+-\s+(.+?)$/);
        if (splitMatch) {
          discoveryTitle = splitMatch[1].trim();
          if (!biliArtist) biliArtist = splitMatch[2].trim();
        } else {
          discoveryTitle = candidate;
        }
      }

      // 如果标签本身有音乐链接或 bgm 特征，但文字是 "《歌名》" 或纯歌名
      if (
        !discoveryTitle &&
        (href.includes('music') ||
          href.includes('bgm') ||
          (tagEl.className && String(tagEl.className).includes('bgm')))
      ) {
        const bookMatch = rawTagText.match(/[《<「『【](.+?)[》>」』】]/);
        if (bookMatch) {
          discoveryTitle = bookMatch[1].trim();
        } else if (rawTagText && !rawTagText.includes('http')) {
          discoveryTitle = rawTagText.replace(/^[🎵🎶\s]+/u, '').trim();
        }
      }
    }

    // 5.2 检查 Bilibili 页面内的音乐详情弹窗卡片 (._PcDetailInfo_ / .bili-music-card / .popover)
    const biliDetailInfo = document.querySelector(
      '[class*="_PcDetailInfo_"], [class*="PcDetailInfo"], [class*="pc-detail-info"], [class*="music-card"], [class*="music-detail"], [class*="music-info"], [class*="bgm-card"], .bili-music-card, .bpx-player-music-info, .popover-video-tag, .video-tag-popover'
    );
    if (biliDetailInfo) {
      const titleEl = biliDetailInfo.querySelector(
        '.title, [class*="title"], [class*="musicTitle"], [class*="song-name"], [class*="music-name"], h3, h4, a[href*="music"]'
      );
      const singerEl = biliDetailInfo.querySelector(
        '.singer, .noMidSinger, [class*="singer"], [class*="artist"], [class*="author"], [class*="musician"], [class*="sub-title"], [class*="subtitle"]'
      );
      const coverEl = biliDetailInfo.querySelector(
        'img.cover, .cover img, .left img, [class*="cover"] img, [class*="cover"], img[src*="bfs/music"], img[src*="hdslb"], img[src*="i0.hdslb.com"]'
      );
      const albumEl = biliDetailInfo.querySelector('.album, [class*="album"]');
      const linkEl = biliDetailInfo.querySelector('a[href*="music_id="], a[href*="music-detail"]');

      if (linkEl && !musicId) {
        const linkHref = linkEl.getAttribute('href') || '';
        const matchId = linkHref.match(/music_id=([A-Za-z0-9_]+)/i);
        if (matchId) musicId = matchId[1];
      }

      if (titleEl) {
        const rawT = (titleEl.textContent || '').replace(/[《》<「『【】』」>]/g, '').trim();
        if (rawT) discoveryTitle = rawT;
      }
      if (singerEl) {
        const rawA = (singerEl.textContent || '')
          .replace(/^(?:歌手|原唱|演唱|艺术家|Artist)[:：\s]*/i, '')
          .trim();
        if (rawA) biliArtist = rawA;
      }
      if (albumEl) {
        const rawAlb = (albumEl.textContent || '').replace(/^(?:专辑|Album)[:：\s]*/i, '').trim();
        if (rawAlb) biliAlbum = rawAlb;
      }
      if (coverEl) {
        let rawSrc =
          coverEl.getAttribute('src') ||
          coverEl.currentSrc ||
          coverEl.src ||
          coverEl.getAttribute('data-src') ||
          '';
        if (rawSrc) {
          rawSrc = rawSrc.replace(/^http:\/\//i, 'https://');
          if (rawSrc.startsWith('//')) rawSrc = 'https:' + rawSrc;
          rawSrc = rawSrc.replace(/@.*$/, '').trim();
          if (rawSrc) biliCover = rawSrc;
        }
      }
    }

    // 5.3 从 inline script (__INITIAL_STATE__) 中快速检索兜底 music_id
    if (!musicId && isBili) {
      try {
        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
          const t = s.textContent || '';
          if (t.includes('music_id') || t.includes('music-detail')) {
            const m =
              t.match(/["']music_id["']\s*:\s*["']([A-Za-z0-9_]+)["']/i) ||
              t.match(/music_id=([A-Za-z0-9_]+)/i);
            if (m) {
              musicId = m[1];
              break;
            }
          }
        }
      } catch (e) {
        // 忽略
      }
    }

    // 6. 查找 YouTube 结构化音乐版权专区 ("Music in this video" / Content ID)
    let ytSong = '';
    let ytArtist = '';
    let ytAlbum = '';
    let ytCover = '';

    // 6.1 现代 Polymer 结构化音乐属性视图 (yt-video-attribute-view-model)
    const ytViewModel = document.querySelector(
      'ytd-horizontal-card-list-renderer yt-video-attribute-view-model, yt-video-attribute-view-model, .ytVideoAttributeViewModelHost'
    );
    if (ytViewModel) {
      const titleEl = ytViewModel.querySelector('.ytVideoAttributeViewModelTitle, h1');
      const artistEl = ytViewModel.querySelector('.ytVideoAttributeViewModelSubtitle, h4');
      const albumEl = ytViewModel.querySelector('.ytVideoAttributeViewModelSecondarySubtitle');
      const coverEl = ytViewModel.querySelector(
        '.ytVideoAttributeViewModelHeroImage, .ytVideoAttributeViewModelHeroSection img, yt-img-shadow img, img'
      );
      if (titleEl) ytSong = (titleEl.textContent || '').trim();
      if (artistEl) ytArtist = (artistEl.textContent || '').trim();
      if (albumEl) ytAlbum = (albumEl.textContent || '').trim();
      if (coverEl) {
        const rawSrc = (
          coverEl.getAttribute('src') ||
          coverEl.currentSrc ||
          coverEl.src ||
          coverEl.getAttribute('data-src') ||
          coverEl.getAttribute('data-thumb') ||
          ''
        ).trim();
        if (rawSrc && !rawSrc.startsWith('data:image')) {
          ytCover = rawSrc;
        }
      }
    }

    // 6.2 经典列表式音乐表格兜底 (ytd-metadata-row-renderer)
    if (!ytSong) {
      const ytRows = document.querySelectorAll('ytd-metadata-row-renderer');
      if (ytRows && ytRows.length > 0) {
        for (const row of ytRows) {
          const titleEl = row.querySelector('#title, .title');
          const contentEl = row.querySelector('#content, .content, #default-metadata');
          if (titleEl && contentEl) {
            const label = (titleEl.textContent || '').trim().toLowerCase();
            const val = (contentEl.textContent || '').trim();
            if (label.includes('song') || label.includes('歌曲')) ytSong = val;
            else if (
              label.includes('artist') ||
              label.includes('音乐人') ||
              label.includes('艺术家')
            )
              ytArtist = val;
            else if (label.includes('album') || label.includes('专辑')) ytAlbum = val;
          }
        }
      }
    }

    // 6.3 富媒体卡片兜底 (ytd-rich-metadata-renderer)
    if (!ytSong) {
      const richCard = document.querySelector('ytd-rich-metadata-renderer');
      if (richCard) {
        const titleEl = richCard.querySelector('#title');
        const subEl = richCard.querySelector('#subtitle');
        if (titleEl) ytSong = (titleEl.textContent || '').trim();
        if (subEl) ytArtist = (subEl.textContent || '').trim();
      }
    }

    // 7. 提取页面标签池
    const tags = Array.from(
      document.querySelectorAll('.tag-link, .tag-panel .tag-link, .video-tag-container a, #tags a')
    )
      .map(el => el.textContent.trim())
      .filter(Boolean);

    // 8. 网易云音乐 (music.163.com) 专用结构化提取
    let neteaseTitle = '';
    let neteaseArtist = '';
    let neteaseAlbum = '';
    let neteaseCover = '';

    const isNetease =
      typeof location !== 'undefined' &&
      location.hostname &&
      (location.hostname.includes('music.163.com') || location.hostname.includes('163.com'));

    if (isNetease) {
      // 8.1 查找全局底部播放条 (.m-playbar)
      const playbar =
        document.querySelector('.m-playbar, .g-btmbar, #g_player') ||
        (typeof window !== 'undefined' && window.top && window.top !== window && window.top.document
          ? window.top.document.querySelector('.m-playbar, .g-btmbar, #g_player')
          : null);
      if (playbar) {
        const titleEl = playbar.querySelector('.name.f-thide, .words .name, .name a, a.f-thide');
        const artistEl = playbar.querySelector('.by.f-thide, .words .by, .by a, a[href*="artist"]');
        const coverEl = playbar.querySelector('.head img, img[src*="music.126.net"]');
        if (titleEl)
          neteaseTitle = (titleEl.getAttribute('title') || titleEl.textContent || '').trim();
        if (artistEl)
          neteaseArtist = (artistEl.getAttribute('title') || artistEl.textContent || '').trim();
        if (coverEl && (coverEl.src || coverEl.getAttribute('src'))) {
          const rawCover = coverEl.src || coverEl.getAttribute('src');
          neteaseCover = rawCover
            .replace(/\?param=\d+y\d+/i, '?param=1000y1000')
            .replace(/^http:\/\//i, 'https://');
        }
      }

      // 8.2 查找歌曲详情页元素 (主页面或 iframe 内)
      const doc = document;
      const detailTitle = doc.querySelector('.tit .f-ff2, em.f-ff2, .cnt .hd h2');
      if (detailTitle && !neteaseTitle) {
        neteaseTitle = detailTitle.textContent.trim();
      }
      const detailArtist = doc.querySelector(
        'p.des a[href*="artist"], .cnt .des:nth-child(2) a, .s-fc7'
      );
      if (detailArtist && !neteaseArtist) {
        neteaseArtist = detailArtist.textContent.trim();
      }
      const detailAlbum = doc.querySelector('p.des a[href*="album"]');
      if (detailAlbum && !neteaseAlbum) {
        neteaseAlbum = detailAlbum.textContent.trim();
      }
      const detailCover = doc.querySelector('.u-cover img, img.j-img, .cvrwrap img');
      if (detailCover && (detailCover.src || detailCover.getAttribute('src')) && !neteaseCover) {
        const rawCover = detailCover.src || detailCover.getAttribute('src');
        neteaseCover = rawCover
          .replace(/\?param=\d+y\d+/i, '?param=1000y1000')
          .replace(/^http:\/\//i, 'https://');
      }
    }

    return {
      mainTitle,
      partTitle,
      author,
      duration,
      musicId,
      discoveryTitle,
      biliArtist,
      biliAlbum,
      biliCover,
      tags,
      ytSong,
      ytArtist,
      ytAlbum,
      ytCover
    };
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
    /(?:(?:翻译|中字|双语|歌词|罗马音)?\s*(?:字幕)?\s*(?:版|Ver\.?|Version)\s*(?:\(\d+\)|（\d+）|\d+)?|中日罗马音字幕|中日双语字幕|中日双语|中日英字幕|中韩双语字幕|罗马音字幕|罗马音|中日字幕|日中字幕|双语字幕|中文字幕|日文字幕|英文字幕|韩文字幕|假名字幕|平假名|片假名|拼音字幕|歌词字幕|无字幕|内嵌字幕|特效字幕|字幕|全专试听|全专辑试听|全专歌词版|全专辑歌词版|全专无损|全专|全专辑|原声专辑合集|原声合集|专辑合集|全专合集|全专辑合集|原声专辑|官方音频专辑|完整专辑|合集试听|全碟试听|全碟|整轨专辑|整轨试听|整轨纯享|整轨|分轨|无损纯享|纯享整轨专辑|纯享整轨|纯享|无损音质|高音质|无损|官方MV|官方超清|(?:\b|^)MV(?:\b|$)|(?:\b|^)OST(?:\b|$))/gi;

  /** 6. 艺术家常见中文/韩语别名与括号译名表 */
  static ARTIST_ALIAS_REGEX =
    /[（(](?:[\uac00-\ud7a3]+|共和时代|霉霉|盆栽|黄老板|火星哥|碧梨|艾薇儿|酷玩乐队|魔力红|林肯公园|西城男孩|后街男孩|中英字幕|双语字幕|官方|中字|双语).*?[)）]/gi;
  static ARTIST_SUFFIX_REGEX =
    /[（(][^）)]*?(?:乐队|歌手|时代|乐团|Boy|Group|Band|Official)[^）)]*?[)）]/gi;

  /** 视频网站官方发行/频道噪点账号 */
  static PUBLISHING_LABELS_REGEX =
    /^(?:1theK.*|SMTOWN|HYBE\s*LABELS|JYP\s*Entertainment|Stone\s*Music.*|CJ\s*ENM.*|Warner\s*Music.*|Sony\s*Music.*|Universal\s*Music.*|GENIE\s*MUSIC.*|Bighit.*|YG\s*ENTERTAINMENT|Avex.*|.*Official\s*Channel.*|.*Music\s*Channel.*)$/i;

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
    Rihanna: 'Rihanna',
    蕾哈娜: 'Rihanna',
    'Lady Gaga': 'Lady Gaga',
    'Ariana Grande': 'Ariana Grande',
    'Bruno Mars': 'Bruno Mars',
    'Ed Sheeran': 'Ed Sheeran',
    'Billie Eilish': 'Billie Eilish',
    Coldplay: 'Coldplay',
    'Maroon 5': 'Maroon 5',
    'Katy Perry': 'Katy Perry',
    'Dua Lipa': 'Dua Lipa',
    Eminem: 'Eminem',
    Beyoncé: 'Beyoncé',
    Beyonce: 'Beyoncé',
    Adele: 'Adele',
    Drake: 'Drake',
    'Justin Bieber': 'Justin Bieber',
    'Kendrick Lamar': 'Kendrick Lamar',
    'Post Malone': 'Post Malone',
    'Travis Scott': 'Travis Scott',
    'Imagine Dragons': 'Imagine Dragons',
    Avicii: 'Avicii',
    'Alan Walker': 'Alan Walker',
    'Michael Jackson': 'Michael Jackson',
    Queen: 'Queen',
    'The Beatles': 'The Beatles',
    OneRepublic: 'OneRepublic',
    'Linkin Park': 'Linkin Park',
    'The Weeknd': 'The Weeknd',
    'Summer Walker': 'Summer Walker',
    NewJeans: 'NewJeans',
    aespa: 'aespa',
    IVE: 'IVE',
    'LE SSERAFIM': 'LE SSERAFIM',
    TWICE: 'TWICE',
    RADWIMPS: 'RADWIMPS',
    'ONE OK ROCK': 'ONE OK ROCK',
    'King Gnu': 'King Gnu',
    Official髭男dism: 'Official髭男dism',
    LiSA: 'LiSA',
    华莎: 'HWASA',
    HWASA: 'HWASA',
    화사: 'HWASA'
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
    const cleaned = text
      .replace(this.ARTIST_ALIAS_REGEX, ' ')
      .replace(this.ARTIST_SUFFIX_REGEX, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (this.PUBLISHING_LABELS_REGEX && this.PUBLISHING_LABELS_REGEX.test(cleaned)) {
      return '';
    }
    return cleaned;
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
        const p1 = splitMatch[1].replace(/(?:全专试听|全专|全专辑|无损)/gi, '').trim();
        const p2 = splitMatch[2].replace(/(?:全专试听|全专|全专辑|无损)/gi, '').trim();
        const known2 = this.findKnownArtist(p2);
        const known1 = this.findKnownArtist(p1);
        if (known2 && !known1) {
          artist = this.cleanArtist(p2);
          album = this.cleanAlbum(p1);
        } else {
          artist = this.cleanArtist(p1);
          album = this.cleanAlbum(p2);
        }
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
        /^(.+?)(?:\s+-\s+|\s*[_—–|]\s*|(?<!\d)\s*[:：]\s*(?!\d))(.+?)$/
      );
      if (splitMatch) {
        const part1 = splitMatch[1].trim();
        const part2 = splitMatch[2].trim();
        if (!/^\d{1,2}:\d{2}$/.test(part1) && !/^\d{1,2}:\d{2}$/.test(part2)) {
          const known2 = this.findKnownArtist(part2);
          const known1 = this.findKnownArtist(part1);
          if (known2 && !known1) {
            artist = this.cleanArtist(part2);
            album = this.cleanAlbum(part1);
          } else {
            artist = this.cleanArtist(part1);
            album = this.cleanAlbum(part2);
          }
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
        /^(.+?)(?:\s+-\s+|\s*[_—–|]\s*|(?<!\d)\s*[:：]\s*(?!\d))(.+?)$/
      );
      if (splitMatch) {
        const part1 = splitMatch[1].trim();
        const part2 = splitMatch[2].trim();
        if (!/^\d{1,2}:\d{2}$/.test(part1) && !/^\d{1,2}:\d{2}$/.test(part2)) {
          const known2 = this.findKnownArtist(part2);
          const known1 = this.findKnownArtist(part1);
          if (known2 && !known1) {
            artist = this.cleanArtist(part2);
            title = this.cleanAlbum(part1);
          } else {
            artist = this.cleanArtist(part1);
            title = this.cleanAlbum(part2);
          }
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
    const {
      mainTitle = '',
      partTitle = '',
      author = '',
      duration = 0,
      musicId = '',
      discoveryTitle = '',
      biliArtist = '',
      biliAlbum = '',
      biliCover = '',
      ytSong = '',
      ytArtist = '',
      ytAlbum = '',
      ytCover = '',
      neteaseTitle = '',
      neteaseArtist = '',
      neteaseAlbum = '',
      neteaseCover = '',
      isNetease = false
    } = ctx;

    const cleanFallback = this.stripNoise(partTitle || raw || mainTitle) || raw || '未知曲目';
    const activeCover = ytCover || biliCover || neteaseCover || '';

    // 优先 0：网易云音乐 (music.163.com) 结构化播放元数据
    if (neteaseTitle || isNetease) {
      const qTitle = neteaseTitle || this.stripNoise(partTitle || mainTitle || raw);
      const qArtist = neteaseArtist || this.cleanArtist(author);
      const qAlbum = neteaseAlbum || '';
      return {
        isAlbumCollection: false,
        queryTitle: qTitle,
        queryArtist: qArtist,
        queryAlbum: qAlbum,
        cleanFallbackTitle: qArtist ? `${qTitle} - ${qArtist}` : qTitle,
        musicId: '',
        cover: activeCover
      };
    }

    // 优先 1：若存在明确的分P / 选集标题，且与主标题不同，优先以当前播放的具体分集为准
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
          cleanFallbackTitle: queryArtist ? `${queryAlbum} - ${queryArtist}` : queryAlbum,
          musicId,
          cover: activeCover
        };
      }

      const partParsed = this.parseTrack(partTitle);
      const mainParsed = this.parseMain(mainTitle || raw);
      const authorClean = this.cleanArtist(this.stripNoise(author));

      const queryTitle = partParsed.title || this.stripNoise(partTitle);
      const queryArtist = partParsed.artist || mainParsed.artist || biliArtist || authorClean || '';
      const queryAlbum = mainParsed.album || '';

      return {
        isAlbumCollection: false,
        queryTitle,
        queryArtist,
        queryAlbum,
        cleanFallbackTitle: queryArtist ? `${queryTitle} - ${queryArtist}` : queryTitle,
        musicId,
        cover: activeCover
      };
    }

    // 优先 2：若 YouTube Content ID 结构化信息完整存在，直接采用
    if (ytSong) {
      return {
        isAlbumCollection: false,
        queryTitle: ytSong,
        queryArtist: ytArtist || this.cleanArtist(this.stripNoise(author)),
        queryAlbum: ytAlbum,
        cleanFallbackTitle: ytArtist ? `${ytSong} - ${ytArtist}` : ytSong,
        musicId,
        cover: activeCover
      };
    }

    // 优先 3：若 Bilibili 官方发现音乐 / 音乐标签信息已明确提取，结合标题与详情提炼歌手，直接用于高精度在线检索
    if (discoveryTitle) {
      const trackParsed = this.parseTrack(raw || mainTitle);
      const mainParsed = this.parseMain(raw || mainTitle);
      const authorClean = this.cleanArtist(this.stripNoise(author));

      // 提取最佳歌手：标签指定歌手 > 标题解析出的歌手 > 主标题歌手 > UP主昵称
      let effectiveArtist = biliArtist ? this.cleanArtist(biliArtist) : '';
      if (!effectiveArtist) {
        effectiveArtist = trackParsed.artist || mainParsed.artist || authorClean || '';
      }

      const effectiveAlbum = biliAlbum || mainParsed.album || '';

      return {
        isAlbumCollection: false,
        queryTitle: discoveryTitle,
        queryArtist: effectiveArtist,
        queryAlbum: effectiveAlbum,
        cleanFallbackTitle: effectiveArtist
          ? `${discoveryTitle} - ${effectiveArtist}`
          : discoveryTitle,
        musicId,
        cover: activeCover
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
        cleanFallbackTitle: queryArtist ? `${queryAlbum} - ${queryArtist}` : queryAlbum,
        musicId,
        cover: activeCover
      };
    }

    // 场景 C：普通单曲视频
    const trackParsed = this.parseTrack(raw || mainTitle);
    const mainParsed = this.parseMain(raw || mainTitle);
    const authorClean = this.cleanArtist(this.stripNoise(author));

    const queryTitle = trackParsed.title || cleanFallback;
    const queryArtist = biliArtist || trackParsed.artist || mainParsed.artist || authorClean || '';
    const queryAlbum = mainParsed.album || '';

    return {
      isAlbumCollection: false,
      queryTitle,
      queryArtist,
      queryAlbum,
      cleanFallbackTitle: queryArtist ? `${queryTitle} - ${queryArtist}` : queryTitle,
      musicId,
      cover: activeCover
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

    const { isAlbumCollection, queryTitle, queryArtist, queryAlbum, musicId } = parsedInfo;
    const cacheKey =
      `${isAlbumCollection ? 'col_' : ''}${musicId || ''}___${queryTitle}___${queryArtist || ''}___${queryAlbum || ''}`.toLowerCase();

    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const host = (customHost || this.DEFAULT_API_HOST).replace(/\/+$/, '');

    // =========================================================================
    // 1. 第一优先级：统一优先从 LrcAPI 获取超清原盘封面 (3000x3000px) 与同步歌词
    // =========================================================================
    let result = null;
    const canonicalArtist =
      (typeof MusicMetadataParser !== 'undefined' &&
        MusicMetadataParser.ARTIST_SYNONYMS_MAP &&
        MusicMetadataParser.ARTIST_SYNONYMS_MAP[queryArtist]) ||
      queryArtist;

    // 优先级调整：根据网页信息获取到歌名/专辑名/艺术家名后，优先去LrcAPI中尝试获取专辑封面
    // 1.0 专辑模式：直接获取专辑封面（artist + album）
    if (isAlbumCollection && queryArtist && queryAlbum) {
      result = await this._queryApi(host, '', canonicalArtist || queryArtist, queryAlbum, true);
      if (!result && canonicalArtist !== queryArtist) {
        result = await this._queryApi(host, '', queryArtist, queryAlbum, true);
      }

      // 专辑命中后直接返回，保留网页原始封面
      if (result) {
        if (result.isAlbumCollection) {
          result.isAlbumCollection = true;
          if (queryAlbum) {
            result.album = result.album || queryAlbum;
          }
        }
        if (!result.cover && parsedInfo.cover) {
          result.cover = parsedInfo.cover;
        }
        this._cache.set(cacheKey, result);
        return result;
      }
    }

    // 1.1 最高精度组合搜索（title + artist + album）
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

      // 组合搜索命中后直接返回，保留网页原始封面
      if (result) {
        if (isAlbumCollection) {
          result.isAlbumCollection = true;
          if (queryAlbum) {
            result.album = result.album || queryAlbum;
          }
        }
        if (!result.cover && parsedInfo.cover) {
          result.cover = parsedInfo.cover;
        }
        this._cache.set(cacheKey, result);
        return result;
      }
    }

    // 1.2 次级精度搜索（title + artist）
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

      // 歌手+歌名命中后直接返回，保留网页原始封面
      if (result) {
        if (isAlbumCollection) {
          result.isAlbumCollection = true;
          if (queryAlbum) {
            result.album = result.album || queryAlbum;
          }
        }
        if (!result.cover && parsedInfo.cover) {
          result.cover = parsedInfo.cover;
        }
        this._cache.set(cacheKey, result);
        return result;
      }
    }

    // 1.3 调换 Title 与 Artist 再次检索（应对 "Title - Artist" 如 "We Found Love - Rihanna" 或 歌手/歌名 颠倒场景）
    if (
      !result &&
      queryArtist &&
      queryTitle &&
      queryArtist.toLowerCase() !== queryTitle.toLowerCase()
    ) {
      const swappedTitle = queryArtist;
      const swappedArtist = queryTitle;
      const canonicalSwappedArtist =
        (typeof MusicMetadataParser !== 'undefined' &&
          MusicMetadataParser.ARTIST_SYNONYMS_MAP &&
          MusicMetadataParser.ARTIST_SYNONYMS_MAP[swappedArtist]) ||
        swappedArtist;

      // 调换后的组合搜索与双字段搜索
      if (queryAlbum) {
        result = await this._queryApi(
          host,
          swappedTitle,
          canonicalSwappedArtist || swappedArtist,
          queryAlbum,
          false
        );
        if (!result && canonicalSwappedArtist !== swappedArtist) {
          result = await this._queryApi(host, swappedTitle, swappedArtist, queryAlbum, false);
        }
      }

      if (!result) {
        result = await this._queryApi(
          host,
          swappedTitle,
          canonicalSwappedArtist || swappedArtist,
          '',
          false
        );
        if (!result && canonicalSwappedArtist !== swappedArtist) {
          result = await this._queryApi(host, swappedTitle, swappedArtist, '', false);
        }
      }

      // 调换检索命中后直接返回，保留网页原始封面
      if (result) {
        if (isAlbumCollection) {
          result.isAlbumCollection = true;
          if (queryAlbum) {
            result.album = result.album || queryAlbum;
          }
        }
        if (!result.cover && parsedInfo.cover) {
          result.cover = parsedInfo.cover;
        }
        this._cache.set(cacheKey, result);
        return result;
      }
    }

    // 1.4 专辑合集模式下调换 Artist 与 Album 重试（应对 "Album - Artist" 反向命名）
    if (
      !result &&
      isAlbumCollection &&
      queryArtist &&
      queryAlbum &&
      queryArtist.toLowerCase() !== queryAlbum.toLowerCase()
    ) {
      result = await this._queryApi(host, '', queryAlbum, queryArtist, true);

      // 调换后命中直接返回，保留网页原始封面
      if (result) {
        if (result.isAlbumCollection) {
          result.isAlbumCollection = true;
          if (queryAlbum) {
            result.album = result.album || queryAlbum;
          }
        }
        if (!result.cover && parsedInfo.cover) {
          result.cover = parsedInfo.cover;
        }
        this._cache.set(cacheKey, result);
        return result;
      }
    }

    // 1.5 MusicBrainz 多语言别名矩阵检索 (中/日/韩/英/罗马音跨语种识别)
    if (!result && queryArtist && queryTitle) {
      const aliases = await MusicBrainzService.fetchArtistAliases(queryArtist);
      for (const alias of aliases) {
        if (
          alias.toLowerCase() === queryArtist.toLowerCase() ||
          alias.toLowerCase() === (canonicalArtist || '').toLowerCase()
        ) {
          continue;
        }

        result = await this._queryApi(host, queryTitle, alias, queryAlbum, isAlbumCollection);
        if (result) break;
      }

      // 若正向别名未搜到，且存在颠倒可能时，尝试查询 swappedArtist (即 queryTitle) 的多语言别名
      if (!result && queryArtist.toLowerCase() !== queryTitle.toLowerCase()) {
        const swappedAliases = await MusicBrainzService.fetchArtistAliases(queryTitle);
        for (const alias of swappedAliases) {
          result = await this._queryApi(host, queryArtist, alias, queryAlbum, isAlbumCollection);
          if (result) break;
        }
      }

      // MusicBrainz命中后直接返回，保留网页原始封面
      if (result) {
        if (isAlbumCollection) {
          result.isAlbumCollection = true;
          if (queryAlbum) {
            result.album = result.album || queryAlbum;
          }
        }
        if (!result.cover && parsedInfo.cover) {
          result.cover = parsedInfo.cover;
        }
        this._cache.set(cacheKey, result);
        return result;
      }
    }

    // 1.6 降级为单歌名模糊检索（仅在未提供明确 artist 时）
    if (!result && !queryArtist) {
      result = await this._queryApi(host, queryTitle, '', '', isAlbumCollection);
    }

    // 单歌名命中后直接返回，保留网页原始封面
    if (result) {
      if (isAlbumCollection) {
        result.isAlbumCollection = true;
        if (queryAlbum) {
          result.album = result.album || queryAlbum;
        }
      }
      if (!result.cover && parsedInfo.cover) {
        result.cover = parsedInfo.cover;
      }
      this._cache.set(cacheKey, result);
      return result;
    }

    // =========================================================================
    // 2. 第二优先级：若 LrcAPI 未匹配到结果，再检索网页自身的音乐卡片与官方版权库
    // =========================================================================

    // 2.1 调取 Bilibili 官方版权接口 (如存在 musicId 或通过 BV号 检索到)
    let effectiveMusicId = musicId;
    if (
      !effectiveMusicId &&
      typeof location !== 'undefined' &&
      location.hostname &&
      location.hostname.includes('bilibili.com')
    ) {
      const bvMatch = location.pathname.match(/\/(BV[A-Za-z0-9]+)/i);
      if (bvMatch) {
        effectiveMusicId = await this._queryBiliTagMusicId(bvMatch[1]);
      }
    }

    if (effectiveMusicId) {
      const biliResult = await this._queryBiliMusicDetail(effectiveMusicId);
      if (biliResult) {
        if (!biliResult.lyrics) {
          const lrcRes = await this._queryApi(
            host,
            biliResult.title,
            biliResult.artist,
            biliResult.album || '',
            false
          );
          if (lrcRes && lrcRes.lyrics) {
            biliResult.lyrics = lrcRes.lyrics;
          }
        }
        this._cache.set(cacheKey, biliResult);
        return biliResult;
      }
    }

    // 2.2 调取网页 DOM 自身已渲染并提取到的结构化音乐卡片（如已展开的 YouTube 卡片 / B 站弹窗卡片）
    if (parsedInfo.cover && parsedInfo.queryTitle) {
      let lrcLyrics = '';
      try {
        const lrcRes = await this._queryApi(
          host,
          parsedInfo.queryTitle,
          parsedInfo.queryArtist || '',
          parsedInfo.queryAlbum || '',
          false
        );
        if (lrcRes && lrcRes.lyrics) {
          lrcLyrics = lrcRes.lyrics;
        }
      } catch (e) {
        // 忽略
      }

      const domResult = {
        title: parsedInfo.queryTitle,
        artist: parsedInfo.queryArtist || '',
        album: parsedInfo.queryAlbum || parsedInfo.queryTitle,
        cover: parsedInfo.cover,
        lyrics: lrcLyrics,
        id: parsedInfo.musicId || '',
        source: 'dom_structured_card'
      };
      this._cache.set(cacheKey, domResult);
      return domResult;
    }

    return null;
  }

  /**
   * 独立向 LrcAPI 获取同步歌词
   * @param {string} queryTitle
   * @param {string} queryArtist
   * @param {string} queryAlbum
   * @param {string} customHost
   * @returns {Promise<string>}
   */
  static async fetchLyrics(queryTitle, queryArtist = '', queryAlbum = '', customHost = '') {
    if (!queryTitle) return '';
    const host = (customHost || this.DEFAULT_API_HOST).replace(/\/+$/, '');

    // 1. 正向检索
    let res = await this._queryApi(host, queryTitle, queryArtist, queryAlbum);
    if (res && res.lyrics) return res.lyrics;

    // 2. 调换检索 (Title ↔ Artist)
    if (queryArtist && queryArtist.toLowerCase() !== queryTitle.toLowerCase()) {
      res = await this._queryApi(host, queryArtist, queryTitle, queryAlbum);
      if (res && res.lyrics) return res.lyrics;
    }

    // 3. MusicBrainz 跨语种别名检索
    if (queryArtist && typeof MusicBrainzService !== 'undefined') {
      const aliases = await MusicBrainzService.fetchArtistAliases(queryArtist);
      for (const alias of aliases) {
        res = await this._queryApi(host, queryTitle, alias, queryAlbum);
        if (res && res.lyrics) return res.lyrics;
      }
    }

    // 4. 单歌名检索
    res = await this._queryApi(host, queryTitle, '', '');
    if (res && res.lyrics) return res.lyrics;

    return '';
  }

  /**
   * 统一网络请求方法：优先走 Background 代理（绕过 CSP），兜底使用 fetch
   * @private
   */
  static async _fetchJson(url) {
    if (!url) return null;

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
        if (res && res.success && res.data) {
          return res.data;
        }
      } catch (e) {
        // 忽略并降级
      }
    }

    // 2. 如果 Background 代理未响应，则通过 fetch 兜底直接请求
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const fetchRes = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (fetchRes.ok) {
        return await fetchRes.json();
      }
    } catch (e) {
      // 忽略
    }

    return null;
  }

  /**
   * 通过 Bilibili 视频标签接口动态检索 music_id
   * @private
   */
  static async _queryBiliTagMusicId(bvid) {
    if (!bvid) return null;
    const url = `https://api.bilibili.com/x/tag/archive/tags?bvid=${encodeURIComponent(bvid)}`;
    try {
      const data = await this._fetchJson(url);
      if (data && data.code === 0 && Array.isArray(data.data)) {
        for (const tag of data.data) {
          const jumpUrl = tag.jump_url || '';
          const matchId =
            jumpUrl.match(/music_id=([A-Za-z0-9_]+)/i) ||
            jumpUrl.match(/music-detail\/?\?([A-Za-z0-9_]+)/i);
          if (matchId) {
            return matchId[1];
          }
          if (tag.music_id) {
            return String(tag.music_id);
          }
        }
      }
    } catch (e) {
      // 忽略
    }
    return null;
  }

  /**
   * 异步请求 Bilibili 官方音乐版权/BGM 详情端点
   * @private
   */
  static async _queryBiliMusicDetail(musicId) {
    if (!musicId) return null;
    const url = `https://api.bilibili.com/x/copyright-music-publicity/bgm/detail?music_id=${encodeURIComponent(musicId)}`;
    try {
      const data = await this._fetchJson(url);
      if (data && data.code === 0 && data.data) {
        const d = data.data;
        const title = (d.music_title || d.title || '').trim();
        const artist = (
          d.origin_artist ||
          d.artist ||
          d.artists_list
            ?.map(a => (a.name || a.author || '').trim())
            .filter(Boolean)
            .join(', ') ||
          ''
        ).trim();
        const album = (d.album || title).trim();
        let cover = (d.mv_cover || d.cover || '').trim();
        if (cover) {
          cover = cover.replace(/^http:\/\//i, 'https://');
          if (cover.startsWith('//')) cover = 'https:' + cover;
          cover = cover.replace(/@.*$/, '').trim();
        }

        if (title) {
          return {
            title,
            artist,
            album,
            cover,
            lyrics: (d.mv_lyric || d.lyrics || '').trim(),
            id: musicId,
            source: 'bilibili_bgm'
          };
        }
      }
    } catch (e) {
      console.warn('[Music Mode] Failed to fetch Bilibili BGM detail:', e);
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
      const data = await this._fetchJson(url);

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
              id: item.id || '',
              source: 'lrc_api'
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
    // 1. 若原始提取中包含明确歌手，必须校验歌手是否吻合
    if (normQueryArtist && normResultArtist) {
      if (
        normQueryArtist.includes(normResultArtist) ||
        normResultArtist.includes(normQueryArtist)
      ) {
        // 当歌手匹配时，歌名完全相同或包含
        if (normQueryTitle === normResultTitle || normQueryTitle === normResultAlbum) {
          return true;
        }
        if (normQueryTitle.includes(normResultTitle)) {
          const lengthRatio = normResultTitle.length / Math.max(1, normQueryTitle.length);
          if (lengthRatio >= 0.75) {
            return true;
          }
        }
      }
      return false;
    }

    // 2. 无明确歌手时，歌名完全相同（精准匹配）
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

/**
 * MusicBrainz 多语言艺术家别名识别服务
 * 通过 MusicBrainz API 实现中/日/韩/英/罗马音跨语言歌手对齐与别名池解析
 */
class MusicBrainzService {
  static _cache = new Map();
  static _lastRequestTime = 0;

  /**
   * 异步查询歌手在 MusicBrainz 中的多语言别名候选列表
   * @param {string} artistName 原始歌手名
   * @returns {Promise<string[]>} 多语言别名列表 (如: ['米津玄師', 'Kenshi Yonezu', 'よねづけんし'])
   */
  static async fetchArtistAliases(artistName) {
    if (!artistName || typeof artistName !== 'string') return [];
    const trimmed = artistName.trim();
    if (!trimmed || trimmed.length < 2) return [];

    const cacheKey = trimmed.toLowerCase();
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    // 遵守 MusicBrainz 速率限制 (最少间隔 500ms)
    const now = Date.now();
    const elapsed = now - this._lastRequestTime;
    if (elapsed < 500) {
      await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
    }
    this._lastRequestTime = Date.now();

    const url = `https://musicbrainz.org/ws/2/artist/?query="${encodeURIComponent(trimmed)}"&fmt=json`;
    try {
      const data = await MusicMetadataService._fetchJson(url);
      if (data && Array.isArray(data.artists) && data.artists.length > 0) {
        // 筛选高相关度歌手结果 (匹配度分值 score >= 75)
        const relevantArtists = data.artists
          .filter(a => a.score == null || a.score >= 75)
          .slice(0, 2);
        const candidateSet = new Set();

        for (const artist of relevantArtists) {
          if (artist.name) candidateSet.add(artist.name.trim());
          if (artist['sort-name'] && !artist['sort-name'].includes(',')) {
            candidateSet.add(artist['sort-name'].trim());
          }

          if (Array.isArray(artist.aliases)) {
            // 优先主名称 (primary: true)
            const sortedAliases = [...artist.aliases].sort(
              (a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0)
            );
            for (const alias of sortedAliases) {
              if (alias.name && alias.name.trim().length > 0) {
                candidateSet.add(alias.name.trim());
              }
            }
          }
        }

        const candidates = Array.from(candidateSet).filter(Boolean);
        this._cache.set(cacheKey, candidates);
        return candidates;
      }
    } catch (err) {
      console.warn('[MusicBrainzService] Artist alias search failed:', err);
    }

    this._cache.set(cacheKey, []);
    return [];
  }
}

if (typeof window !== 'undefined') {
  window.MusicMetadataParser = MusicMetadataParser;
  window.MusicMetadataService = MusicMetadataService;
  window.MusicBrainzService = MusicBrainzService;
}
