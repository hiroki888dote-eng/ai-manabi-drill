/* =========================================================
   アプリの動き
   ---------------------------------------------------------
   画面は3つ：①ホーム ②問題 ③結果
   「見せる画面」を切りかえることで、1つのページで動かしています。
   ========================================================= */

/* ---------- 設定 ---------- */
const STORAGE_KEY = "ai-manabi-drill-v1"; // 成績を保存するときの名前
const RANDOM_COUNT = 10;                  // ランダム出題の問題数
const EXAM_COUNT = 30;                    // 模擬試験の問題数
const MARKS = ["A", "B", "C", "D"];       // 選択肢の頭につける記号
const COURSE_KEY = "ai-manabi-course";    // 最後に選んだコースを保存するときの名前

// コースの一覧
const COURSES = {
  agent: {
    tab: "🤖 エージェント・ストラテジスト",
    lead: "AIエージェント・ストラテジスト試験<br>（AICX協会）対策ドリル",
    examSub: "全6章からケース問題中心に出題（本番は75分）",
  },
  basic: {
    tab: "📘 AI基礎・G検定など",
    lead: "G検定・生成AIパスポートなどの<br>AI資格を目指せる4択ドリル",
    examSub: "時間を計って本番の練習",
  },
};
let currentCourse = loadCourse();

/* ---------- よく使う画面の部品を取り出しておく ---------- */
// $("id") と書くだけで、その id の部品を取れるようにする小さな関数
const $ = (id) => document.getElementById(id);

const screens = {
  home: $("homeScreen"),
  quiz: $("quizScreen"),
  notes: $("notesScreen"),
  result: $("resultScreen"),
};

/* ---------- 成績の記録 ----------
   問題ごとに { correct: 正解した回数, wrong: 間違えた回数, last: 最後に正解したか }
   を、ブラウザ（スマホ）の中に保存します。 */
let stats = loadStats();

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    // プライベートモードなどで保存が使えない場合は、記録なしで動かす
    return {};
  }
}

function saveStats() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    // 保存できなくてもアプリは動くので、何もしない
  }
}

// 最後に選んだコースを読み込む（はじめての人はストラテジストコース）
function loadCourse() {
  try {
    const saved = localStorage.getItem(COURSE_KEY);
    return COURSES[saved] ? saved : "agent";
  } catch (e) {
    return "agent";
  }
}

function saveCourse() {
  try {
    localStorage.setItem(COURSE_KEY, currentCourse);
  } catch (e) {
    // 保存できなくても問題なし
  }
}

// いま選んでいるコースのジャンルだけを取り出す
function courseCategories() {
  return CATEGORIES.filter((c) => c.course === currentCourse);
}

// いま選んでいるコースの問題だけを取り出す
function courseQuestions() {
  const ids = courseCategories().map((c) => c.id);
  return QUESTIONS.filter((q) => ids.includes(q.cat));
}

/* ---------- いま解いている問題セットの情報 ---------- */
let session = null;
/*  session の中身
    title     : 画面上部に出すタイトル
    questions : 出題する問題の配列
    index     : いま何問目か（0から数える）
    results   : 各問題の結果 { question, chosenText, ok }
    order     : 今の問題の選択肢の並び順
    isExam    : 模擬試験かどうか
    startTime : 開始時刻
*/
let timerId = null;

/* =========================================================
   便利な関数
   ========================================================= */

// 配列の順番をランダムに並べかえる（フィッシャー–イェーツのシャッフル）
function shuffle(array) {
  const a = array.slice(); // 元の配列をこわさないようコピー
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ジャンルの id から、ジャンル情報を探す
function findCategory(catId) {
  return CATEGORIES.find((c) => c.id === catId);
}

// 「苦手な問題」＝最後に解いたとき間違えた問題（いまのコースの中から）
function weakQuestions() {
  return courseQuestions().filter((q) => stats[q.id] && stats[q.id].last === false);
}

// 秒数を「3分05秒」のような文字にする
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, "0");
  return `${m}分${s}秒`;
}

// 画面を切りかえる
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
  // ホーム以外では「戻る」ボタンを出す
  $("backBtn").hidden = name === "home";
  window.scrollTo(0, 0);
}

/* =========================================================
   ① ホーム画面
   ========================================================= */
function renderHome() {
  stopTimer();
  const questions = courseQuestions();

  // --- コースの切りかえタブ ---
  const tabs = $("courseTabs");
  tabs.innerHTML = "";
  Object.entries(COURSES).forEach(([key, course]) => {
    const tab = document.createElement("button");
    tab.className = "course-tab" + (key === currentCourse ? " active" : "");
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", key === currentCourse);
    tab.textContent = course.tab;
    tab.addEventListener("click", () => {
      currentCourse = key;
      saveCourse();
      renderHome();
    });
    tabs.appendChild(tab);
  });

  // --- コースに合わせて文言を切りかえる ---
  $("heroLead").innerHTML = COURSES[currentCourse].lead; // アプリ内で決めた文言なので innerHTML でOK
  const examCount = Math.min(EXAM_COUNT, questions.length);
  $("examLabel").textContent = `模擬試験（${examCount}問）`;
  $("examSub").textContent = COURSES[currentCourse].examSub;
  // 試験の紹介カードは、いまのコースの分だけ表示
  document.querySelectorAll("[data-course]").forEach((el) => {
    el.hidden = el.dataset.course !== currentCourse;
  });

  // --- 全体の成績（いまのコースの分だけ） ---
  let answered = 0, correct = 0, total = 0;
  questions.forEach((q) => {
    const s = stats[q.id];
    if (s) {
      answered++;
      correct += s.correct;
      total += s.correct + s.wrong;
    }
  });
  $("statAnswered").textContent = `${answered}/${questions.length}`;
  $("statRate").textContent = total ? Math.round((correct / total) * 100) + "%" : "-";
  $("statWeak").textContent = weakQuestions().length;

  // --- ジャンル別の一覧を作る ---
  const list = $("categoryList");
  list.innerHTML = ""; // いったん空にする

  courseCategories().forEach((cat) => {
    const qs = QUESTIONS.filter((q) => q.cat === cat.id);
    // このジャンルで「最後に正解した」問題の数 ＝ マスターした数
    const mastered = qs.filter((q) => stats[q.id] && stats[q.id].last).length;
    const percent = Math.round((mastered / qs.length) * 100);
    const hasNotes = typeof NOTES !== "undefined" && NOTES[cat.id];

    // カード全体（文字はアプリ内のデータなので innerHTML で組み立てる）
    const card = document.createElement("div");
    card.className = "cat-card";
    card.innerHTML = `
      <div class="cat-top">
        <span class="cat-name">${cat.icon} ${cat.name}</span>
        <span class="cat-meta">${mastered}/${qs.length}問 正解</span>
      </div>
      <div class="cat-desc">${cat.desc}</div>
      <div class="mini-bar"><div style="width:${percent}%"></div></div>
      <div class="cat-actions"></div>
    `;

    const actions = card.querySelector(".cat-actions");
    // 要点ノートがある章だけ「要点を読む」ボタンを付ける
    if (hasNotes) {
      const noteBtn = document.createElement("button");
      noteBtn.className = "small-btn";
      noteBtn.textContent = "📘 要点を読む";
      noteBtn.addEventListener("click", () => renderNotes(cat));
      actions.appendChild(noteBtn);
    }
    const playBtn = document.createElement("button");
    playBtn.className = "small-btn primary";
    playBtn.textContent = `✏️ ${qs.length}問を解く`;
    playBtn.addEventListener("click", () => startQuiz(cat.icon + " " + cat.name, shuffle(qs)));
    actions.appendChild(playBtn);

    list.appendChild(card);
  });

  // 苦手問題が無いときは、復習ボタンを押せないようにする
  $("weakBtn").disabled = weakQuestions().length === 0;
  $("weakBtn").style.opacity = weakQuestions().length === 0 ? 0.5 : 1;

  showScreen("home");
}

/* =========================================================
   ② 問題画面
   ========================================================= */

// 問題セットを決めてスタートする
function startQuiz(title, questions, isExam = false) {
  if (questions.length === 0) return;
  session = {
    title,
    questions,
    index: 0,
    results: [],
    order: [],
    isExam,
    startTime: Date.now(),
  };

  // 模擬試験のときだけ経過時間を表示する
  $("timer").hidden = !isExam;
  if (isExam) startTimer();

  renderQuestion();
  showScreen("quiz");
}

// 1問分を画面に表示する
function renderQuestion() {
  const q = session.questions[session.index];
  const cat = findCategory(q.cat);

  // 上部の情報と進み具合のバー
  $("quizTitle").textContent = session.title;
  $("quizCount").textContent = `${session.index + 1} / ${session.questions.length}`;
  $("progressBar").style.width = (session.index / session.questions.length) * 100 + "%";

  // 問題文（textContent を使うと、文字がそのまま安全に表示される）
  $("qCategory").textContent = `${cat.icon} ${cat.name}　｜　${q.exam.join("・")}`;
  $("qText").textContent = q.q;

  // ケース問題なら「場面の説明」を表示、なければ隠す
  $("qCase").hidden = !q.case;
  $("qCase").textContent = q.case ? "📋 ケース：" + q.case : "";

  // 選択肢を作る。データでは 0番目が正解なので、並び順をシャッフルする
  session.order = shuffle([0, 1, 2, 3].slice(0, q.choices.length));
  const box = $("choices");
  box.innerHTML = "";
  session.order.forEach((choiceIndex, i) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.dataset.choice = choiceIndex; // どの選択肢か覚えておく

    const mark = document.createElement("span");
    mark.className = "choice-mark";
    mark.textContent = MARKS[i];

    const text = document.createElement("span");
    text.textContent = q.choices[choiceIndex];

    btn.append(mark, text);
    btn.addEventListener("click", () => answer(choiceIndex));
    box.appendChild(btn);
  });

  // 解説と「次へ」はまだ隠しておく
  $("feedback").hidden = true;
  $("nextBtn").hidden = true;
  $("practiceText").value = "";
  document.querySelector(".practice").open = false;
  window.scrollTo(0, 0);
}

// 選択肢が押されたときの処理
function answer(choiceIndex) {
  const q = session.questions[session.index];
  const ok = choiceIndex === 0; // 0番目が正解

  // --- 選択肢ボタンに色をつけ、もう押せないようにする ---
  document.querySelectorAll(".choice").forEach((btn) => {
    const idx = Number(btn.dataset.choice);
    btn.disabled = true;
    if (idx === 0) btn.classList.add("correct");               // 正解は緑
    else if (idx === choiceIndex) btn.classList.add("wrong");  // 選んだ不正解は赤
    else btn.classList.add("dim");                             // それ以外はうすく
  });

  // --- 成績を記録して保存 ---
  const s = stats[q.id] || { correct: 0, wrong: 0, last: null };
  if (ok) s.correct++; else s.wrong++;
  s.last = ok;
  stats[q.id] = s;
  saveStats();

  session.results.push({ question: q, chosenText: q.choices[choiceIndex], ok });

  // --- 正誤と解説を表示 ---
  const judge = $("judge");
  judge.className = "judge " + (ok ? "ok" : "ng");
  judge.textContent = ok ? "⭕ 正解！" : "❌ 不正解";
  $("explainText").textContent = q.exp;
  $("teachText").textContent = q.teach;
  $("feedback").hidden = false;

  // 最後の問題なら「結果を見る」に文字を変える
  const isLast = session.index === session.questions.length - 1;
  $("nextBtn").textContent = isLast ? "結果を見る" : "次の問題へ";
  $("nextBtn").hidden = false;

  // 解説が見えるところまで、なめらかにスクロール
  $("judge").scrollIntoView({ behavior: "smooth", block: "start" });
}

// 「次へ」ボタン
function nextQuestion() {
  session.index++;
  if (session.index < session.questions.length) {
    renderQuestion();
  } else {
    renderResult();
  }
}

/* ---------- 模擬試験用のタイマー ---------- */
function startTimer() {
  stopTimer();
  const update = () => {
    const sec = Math.floor((Date.now() - session.startTime) / 1000);
    $("timer").textContent = "⏱ 経過時間 " + formatTime(sec);
  };
  update();
  timerId = setInterval(update, 1000);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

/* =========================================================
   ③ 結果画面
   ========================================================= */
function renderResult() {
  stopTimer();
  const total = session.results.length;
  const correct = session.results.filter((r) => r.ok).length;
  const rate = correct / total;

  $("resultCorrect").textContent = correct;
  $("resultTotal").textContent = total;

  // 正答率に合わせたひと言
  let message;
  if (rate === 1) message = "パーフェクト！人に教えられるレベルです 🎉";
  else if (rate >= 0.8) message = "すばらしい！合格ラインが見えてきました 👏";
  else if (rate >= 0.6) message = "あと少し！間違えた問題を復習しよう 💪";
  else message = "まずは解説と「教えるコツ」を読みこもう 📖";
  $("resultMessage").textContent = message;

  // 模擬試験ならかかった時間も表示
  const sec = Math.floor((Date.now() - session.startTime) / 1000);
  $("resultTime").textContent = session.isExam ? "かかった時間：" + formatTime(sec) : "";

  // --- ふりかえり一覧（タップで開くと解説が見える） ---
  const list = $("reviewList");
  list.innerHTML = "";
  session.results.forEach((r, i) => {
    const item = document.createElement("details");
    item.className = "review-item";

    const summary = document.createElement("summary");
    const mark = document.createElement("span");
    mark.className = "review-mark " + (r.ok ? "ok" : "ng");
    mark.textContent = r.ok ? "⭕" : "❌";
    const qText = document.createElement("span");
    qText.textContent = `Q${i + 1}. ${r.question.q}`;
    summary.append(mark, qText);

    const body = document.createElement("div");
    body.className = "review-body";
    // ここで表示する文字はすべてアプリ内のデータなので、そのまま組み立てる
    body.append(
      ...(r.question.case ? [makeP("📋 ケース：" + r.question.case)] : []),
      makeP("✅ 正解：" + r.question.choices[0]),
      ...(r.ok ? [] : [makeP("あなたの回答：" + r.chosenText)]),
      makeP("📖 " + r.question.exp),
      makeP("🧑‍🏫 " + r.question.teach),
    );

    item.append(summary, body);
    list.appendChild(item);
  });

  // 全問正解なら「間違えた問題をもう一度」は出さない
  $("retryWrongBtn").hidden = correct === total;
  $("progressBar").style.width = "100%";

  showScreen("result");
}

/* =========================================================
   要点ノート画面
   ========================================================= */
let notesCategory = null; // いま開いている章

function renderNotes(cat) {
  notesCategory = cat;
  $("notesTitle").textContent = `${cat.icon} ${cat.name}`;

  const list = $("notesList");
  list.innerHTML = "";
  // NOTES は [見出し, 説明] の組がならんだ配列
  NOTES[cat.id].forEach(([term, desc]) => {
    const card = document.createElement("div");
    card.className = "card note-card";
    const h = document.createElement("h3");
    h.textContent = term;
    const p = document.createElement("p");
    p.textContent = desc;
    card.append(h, p);
    list.appendChild(card);
  });

  showScreen("notes");
}

// <p>文字</p> を作る小さな関数
function makeP(text) {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
}

/* =========================================================
   ボタンを押したときの動きを登録
   ========================================================= */
$("randomBtn").addEventListener("click", () => {
  startQuiz("🎲 ランダム10問", shuffle(courseQuestions()).slice(0, RANDOM_COUNT));
});

$("examBtn").addEventListener("click", () => {
  startQuiz("📝 模擬試験", shuffle(courseQuestions()).slice(0, EXAM_COUNT), true);
});

// 要点ノートから、その章の問題へ
$("notesStartBtn").addEventListener("click", () => {
  const cat = notesCategory;
  startQuiz(cat.icon + " " + cat.name, shuffle(QUESTIONS.filter((q) => q.cat === cat.id)));
});

$("weakBtn").addEventListener("click", () => {
  startQuiz("🔁 苦手を復習", shuffle(weakQuestions()));
});

$("nextBtn").addEventListener("click", nextQuestion);

$("retryWrongBtn").addEventListener("click", () => {
  const wrong = session.results.filter((r) => !r.ok).map((r) => r.question);
  startQuiz("🔁 間違えた問題", shuffle(wrong));
});

$("homeBtn").addEventListener("click", renderHome);

/* ---------- 確認ダイアログ ----------
   公開先のページではブラウザの confirm() が使えないので、
   アプリの中に「はい / やめる」を聞く小さな画面を用意しています。 */
let confirmAction = null; // 「はい」を押したときに実行する処理

function askConfirm(message, onYes) {
  $("confirmMessage").textContent = message;
  confirmAction = onYes;
  $("confirmBox").hidden = false;
  $("confirmYes").focus();
}

function closeConfirm() {
  $("confirmBox").hidden = true;
  confirmAction = null;
}

$("confirmYes").addEventListener("click", () => {
  const action = confirmAction;
  closeConfirm();
  if (action) action();
});
$("confirmNo").addEventListener("click", closeConfirm);

// 問題の途中で戻るときは、確認してから戻る
$("backBtn").addEventListener("click", () => {
  const inQuiz = !screens.quiz.hidden && session && session.index < session.questions.length;
  if (inQuiz) {
    askConfirm("ホームに戻りますか？（ここまでの解答記録は保存されています）", renderHome);
  } else {
    renderHome();
  }
});

$("resetBtn").addEventListener("click", () => {
  askConfirm("学習記録をすべて消しますか？（元に戻せません）", () => {
    stats = {};
    saveStats();
    renderHome();
  });
});

/* ---------- 最初にホーム画面を表示 ---------- */
renderHome();
