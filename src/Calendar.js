/**
 * Google カレンダーから、祝日と「お店のお知らせ」（臨時休業・営業時間の変更など）を読む。
 * お店のお知らせは、オーナー様がスマホのカレンダーアプリで予定として入れる。
 *   - 予定の名前：「臨時休業」「17時まで営業」など
 *   - 予定のメモ：お客様に伝えたいこと（AI がそのまま伝える）
 */
/**
 * Google の日本の祝日カレンダー。七五三・クリスマス・銀行休業日なども入っているので、isPublicHoliday_ で国の祝日だけにする。
 * （祝日だけの ja.japanese.official#holiday は、カレンダーの一覧に入れないと GAS から読めない）
 */
const HOLIDAY_CALENDAR_ID_ = 'ja.japanese#holiday@group.v.calendar.google.com';
const SHOP_CALENDAR_NAME_ = 'お店のお知らせ（LINEのAIが読みます）';
/** 今日から何日先までの日付・祝日・お知らせを AI に渡すか */
const CALENDAR_DAYS_ = 14;
/** 祝日だけは、今日から何日先まで AI に渡すか（「次の祝日は？」に答えられるように） */
const HOLIDAY_DAYS_ = 92;
/** 予定のメモを AI に渡す最大の文字数 */
const NOTE_MAX_CHARS_ = 200;

/** お店のお知らせ用のカレンダーを作り、SHOP_CALENDAR_ID に登録する。作成済みなら何もしない。 */
function setupShopCalendar() {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty('SHOP_CALENDAR_ID');
  if (existing && CalendarApp.getCalendarById(existing)) {
    console.log('お店のお知らせのカレンダーは作成済みです: ' + CalendarApp.getCalendarById(existing).getName());
    return;
  }
  const cal = CalendarApp.createCalendar(SHOP_CALENDAR_NAME_, {
    timeZone: 'Asia/Tokyo',
    color: CalendarApp.Color.RED,
  });
  props.setProperty('SHOP_CALENDAR_ID', cal.getId());
  console.log('お店のお知らせのカレンダーを作成しました: ' + cal.getName());
}

/**
 * 日付ごとの祝日とお店のお知らせ。
 * byDay のキーは 'yyyyMMdd'、値は AI に渡す文の配列。
 * laterHolidays は days 日より先（HOLIDAY_DAYS_ 日まで）の祝日 {date, title}。failed は読めなかったカレンダーの名前。
 * カレンダーが読めなくても返信は止めない。
 */
function loadCalendarNotes_(firstDay, days) {
  const end = new Date(firstDay.getTime());
  end.setDate(end.getDate() + days);
  const byDay = {};
  const failed = [];
  const laterHolidays = [];
  const add = function (key, text) { (byDay[key] = byDay[key] || []).push(text); };

  const holidayEnd = new Date(firstDay.getTime());
  holidayEnd.setDate(holidayEnd.getDate() + HOLIDAY_DAYS_);
  const holidaysOk = readEvents_(HOLIDAY_CALENDAR_ID_, firstDay, holidayEnd, function (ev, key, day) {
    if (!isPublicHoliday_(ev)) return;
    if (day < end) add(key, '祝日：' + ev.getTitle());
    else laterHolidays.push({ date: day, title: ev.getTitle() });
  });
  if (!holidaysOk) failed.push('祝日');

  const shopId = getConfig_('SHOP_CALENDAR_ID', false);
  if (shopId) {
    const shopOk = readEvents_(shopId, firstDay, end, function (ev, key) {
      const time = ev.isAllDayEvent() ? '' : Utilities.formatDate(ev.getStartTime(), 'Asia/Tokyo', 'H:mm') + '〜' + Utilities.formatDate(ev.getEndTime(), 'Asia/Tokyo', 'H:mm') + ' ';
      const note = plainNote_(ev.getDescription());
      add(key, 'お店のお知らせ：' + time + ev.getTitle() + (note ? '（' + note + '）' : ''));
    });
    if (!shopOk) failed.push('お店のお知らせ');
  }
  return { byDay: byDay, laterHolidays: laterHolidays, failed: failed };
}

/**
 * 期間内の予定を、重なっている日ごとに each(予定, 'yyyyMMdd', その日の0時) で渡す。何日も続く予定は毎日に入る。
 * 読めなかったら false を返す。
 */
function readEvents_(calendarId, start, end, each) {
  let events;
  try {
    const cal = CalendarApp.getCalendarById(calendarId);
    if (!cal) throw new Error('カレンダーが見つかりません: ' + calendarId);
    events = cal.getEvents(start, end);
  } catch (err) {
    console.error('カレンダーを読めませんでした: ' + err.message);
    return false;
  }
  events.forEach(function (ev) {
    const d = new Date(Math.max(ev.getStartTime().getTime(), start.getTime()));
    d.setHours(0, 0, 0, 0);
    while (d < ev.getEndTime() && d < end) {
      each(ev, Utilities.formatDate(d, 'Asia/Tokyo', 'yyyyMMdd'), new Date(d.getTime()));
      d.setDate(d.getDate() + 1);
    }
  });
  return true;
}

/** 国の祝日（振替休日を含む）なら true。祝日カレンダーの予定のメモが「祝日」で始まるものだけ。 */
function isPublicHoliday_(ev) {
  return /^祝日/.test(String(ev.getDescription() || '').trim());
}

/** 予定のメモから HTML のタグや余分な改行を取り、短くする。 */
function plainNote_(description) {
  const text = String(description || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > NOTE_MAX_CHARS_ ? text.slice(0, NOTE_MAX_CHARS_) + '…' : text;
}
