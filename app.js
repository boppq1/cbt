let chosenMode = "exam";
let instantFeedback = false;

function advanceQuestion() {
  if (deadline !== null && Date.now() >= deadline && !finished) { finishExam(); return; }
  if (currentIndex < exam.length - 1) {
    currentIndex++;
    showQuestion();
  } else {
    const missing = exam.findIndex(q => answers[q.id] === undefined);
    if (missing !== -1) { currentIndex = missing; showQuestion(); }
    else finishExam();
  }
  window.scrollTo(0, 0);
}

function showHome() {
  stopTimer();
  sessionStarted = false;
  app.innerHTML = `
    <section class="intro"><h1>파이팅</h1><p class="muted">학습 방법을 선택하세요.</p></section>
    <section class="card">
      <button class="full primary" data-mode="exam">1. 전체 문제 풀어보기 · 실전 연습</button>
      <button class="full" data-mode="practice">2. 연습 모드 · 전체 풀기</button>
      <button class="full" data-mode="custom">3. 골라서 풀어보기</button>
      <button class="full" data-mode="wrong">4. 오답노트 · ${wrongIds.length}문항</button>
      <p class="muted small">현재 ${bank.length}문항 · 무작위 출제</p>
    </section>`;
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.onclick = () => {
      chosenMode = button.dataset.mode;
      if (chosenMode === 'wrong' && !wrongIds.length) { alert('아직 오답이 없습니다.'); return; }
      showSettings();
    };
  });
}

const app = document.getElementById("app");

let bank = [];
let exam = [];
let currentIndex = 0;
let answers = {};
let flags = {};
let mode = "exam";
let deadline = null;
let timerId = null;
let finished = false;
let sessionStarted = false;
let reviewOnlyWrong = false;
let practiceRevealed = {};

function readStorage(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return Array.isArray(value) ? value : fallback;
    } catch {
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // 저장 공간을 사용할 수 없어도 시험은 계속 진행합니다.
    }
}

let wrongIds = readStorage("metal-wrong", []);
let history = readStorage("metal-history", []);

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return replacements[character];
    });
}

function shuffle(items) {
    const result = [...items];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}

function stopTimer() {
    clearInterval(timerId);
    timerId = null;
}

function answeredCount() {
    return exam.filter((question) =>
        Object.hasOwn(answers, question.id)
    ).length;
}

function isWrong(question) {
    return answers[question.id] !== question.answer;
}

function showSettings() {
    stopTimer();
    sessionStarted = false;

    const categories = [...new Set(bank.map((question) => question.category))];

    const subjectsHtml = categories.map((category) => {
        const count = bank.filter(
            (question) => question.category === category
        ).length;

        return `
      <label class="subject">
        <input
          type="checkbox"
          name="subject"
          value="${escapeHtml(category)}"
          checked
        >
        ${escapeHtml(category)}
        <span>${count}문항</span>
      </label>
    `;
    }).join("");

    const historyHtml = history.length
        ? history.slice(0, 5).map((record) => `
        <div class="history-item">
          ${escapeHtml(record.date)}
          · ${record.total}문제
          · <strong>${record.score}점</strong>
        </div>
      `).join("")
        : `<p class="muted small">아직 시험 기록이 없습니다.</p>`;

    app.innerHTML = `
    <section class="intro">
      <h1>파이팅</h1>
      <p class="muted">
        과목과 문항 수를 선택하고 시험을 시작하세요.
      </p>
    </section>

    <div class="layout">
      <section class="card">
        <div class="row">
          <h2>시험 범위</h2>
          <button id="toggleAll">전체 선택 / 해제</button>
        </div>

        <div class="subjects">
          ${subjectsHtml}
        </div>

        <p class="notice">
          출제 가능 ${bank.length}문항.
          원본에서 정답이나 선택지가 불완전한 항목은 현재 출제에 포함되지 않습니다.
          수식과 기호는 원본 PDF도 함께 확인하세요.
        </p>

        <a href="source.pdf" target="_blank" rel="noopener">
          원본 PDF 보기
        </a>

        <div class="history">
          <h2>최근 시험 기록</h2>
          ${historyHtml}
        </div>
      </section>

      <aside class="card">
        <h2>시험 설정</h2>

        <label class="field" for="mode">학습 방식</label>
        <select id="mode">
          <option value="exam">실전 모드</option>
          <option value="practice">연습 모드 · 정답 확인 가능</option>
          <option value="wrong">오답 복습 · ${wrongIds.length}문항</option>
        </select>

        <label class="field" for="count">문항 수</label>
        <select id="count">
          <option value="20">20문항</option>
          <option value="40">40문항</option>
          <option value="60">60문항</option>
          <option value="100">100문항</option>
          <option value="all" selected>선택 범위 전체</option>
        </select>

        <label class="field" for="minutes">
          제한시간 · 분
        </label>
        <input
          id="minutes"
          type="number"
          min="0"
          max="600"
          value="0"
        >
        <p class="muted small">0으로 설정하면 시간 제한이 없습니다.</p>

        <label class="field">
          <input id="random" type="checkbox" checked>
          문제 순서 무작위
        </label>

        <h2 style="margin-top:24px">문제마다 정답과 해설을 볼까요?</h2>
        <label class="field"><input type="radio" name="feedback" value="yes"> 네 · 확인 후 다음 문제</label>
        <label class="field"><input type="radio" name="feedback" value="no" checked> 아니요 · 선택 즉시 다음 문제</label>
        <button id="settingsBack" class="full">처음으로</button>
        <button id="startButton" class="primary full">
          시험 시작
        </button>

        <p id="error" role="alert"></p>
      </aside>
    </div>
  `;

    document.getElementById("toggleAll").onclick = () => {
        const inputs = [
            ...document.querySelectorAll('input[name="subject"]')
        ];

        const selectAll = !inputs.every((input) => input.checked);

        inputs.forEach((input) => {
            input.checked = selectAll;
        });
    };

    document.getElementById("mode").value = chosenMode === "wrong" ? "wrong" : chosenMode === "practice" ? "practice" : "exam";
    document.getElementById("mode").disabled = true;
    document.querySelector(`input[name="feedback"][value="${chosenMode === "exam" ? "no" : "yes"}"]`).checked = true;
    if (chosenMode !== "custom") {
      document.querySelector('.subjects').style.display = 'none';
      document.getElementById('toggleAll').style.display = 'none';
      document.getElementById('count').disabled = true;
    }
    document.getElementById('settingsBack').onclick = showHome;
    document.getElementById("startButton").onclick = startExam;
}

function startExam() {
    const selectedCategories = [
        ...document.querySelectorAll('input[name="subject"]:checked')
    ].map((input) => input.value);

    mode = document.getElementById("mode").value;
    instantFeedback = document.querySelector('input[name="feedback"]:checked').value === 'yes';

    let pool = bank.filter((question) =>
        selectedCategories.includes(question.category)
    );

    if (mode === "wrong") {
        pool = pool.filter((question) => wrongIds.includes(question.id));
    }

    if (!pool.length) {
        document.getElementById("error").textContent =
            "출제 가능한 문제가 없습니다. 과목이나 학습 방식을 바꿔 주세요.";
        return;
    }

    const minutesInput = document.getElementById("minutes");

    if (!minutesInput.reportValidity()) {
        return;
    }

    const minutes = Number(minutesInput.value);

    if (!Number.isFinite(minutes)) {
        document.getElementById("error").textContent =
            "제한시간을 올바르게 입력해 주세요.";
        return;
    }

    if (document.getElementById("random").checked) {
        pool = shuffle(pool);
    }

    const countValue = document.getElementById("count").value;
    const count = countValue === "all" ? pool.length : Number(countValue);

    exam = pool.slice(0, count);
    currentIndex = 0;
    answers = {};
    flags = {};
    practiceRevealed = {};
    finished = false;
    reviewOnlyWrong = false;
    sessionStarted = true;

    deadline = minutes > 0
        ? Date.now() + minutes * 60 * 1000
        : null;

    stopTimer();
    showQuestion();

    if (deadline !== null) {
        timerId = setInterval(() => {
            if (Date.now() >= deadline) {
                finishExam();
            } else {
                updateTimer();
            }
        }, 1000);
    }

    window.scrollTo(0, 0);
}

function updateTimer() {
    const element = document.getElementById("timer");

    if (!element) {
        return;
    }

    if (finished) {
        element.textContent = "시험 종료";
        return;
    }

    if (deadline === null) {
        element.textContent = "시간 제한 없음";
        return;
    }

    const seconds = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1000)
    );

    const minutesText = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secondsText = String(seconds % 60).padStart(2, "0");

    element.textContent = `${minutesText}:${secondsText}`;
}

function visibleIndexes() {
    return exam
        .map((question, index) => ({ question, index }))
        .filter(({ question }) => !reviewOnlyWrong || isWrong(question))
        .map(({ index }) => index);
}

function showQuestion() {
    const question = exam[currentIndex];
    const selected = answers[question.id];

    const revealed =
        finished || Boolean(practiceRevealed[question.id]);

    const locked = revealed || (!finished && chosenMode !== "exam" && selected !== undefined);
    const indexes = visibleIndexes();
    const position = indexes.indexOf(currentIndex);

    const previousIndex = indexes[position - 1];
    const nextIndex = indexes[position + 1];

    const optionsHtml = question.options.map((option, index) => {
        const classes = ["option"];

        if (selected === index) {
            classes.push("selected");
        }

        if (revealed && index === question.answer) {
            classes.push("correct");
        }

        if (
            revealed &&
            selected === index &&
            index !== question.answer
        ) {
            classes.push("incorrect");
        }

        return `
      <button
        class="${classes.join(" ")}"
        data-option="${index}"
        aria-pressed="${selected === index}"
        ${locked ? "disabled" : ""}
      >
        <span class="option-number">${index + 1}</span>
        <span>${escapeHtml(option)}</span>
      </button>
    `;
    }).join("");

    const navigationHtml = indexes.map((index) => {
        const item = exam[index];
        const classes = [];

        if (Object.hasOwn(answers, item.id)) {
            classes.push("answered");
        }

        if (index === currentIndex) {
            classes.push("current");
        }

        if (flags[item.id]) {
            classes.push("flagged");
        }

        return `
      <button
        data-question="${index}"
        class="${classes.join(" ")}"
        aria-label="${index + 1}번 문제"
        ${index === currentIndex ? 'aria-current="true"' : ""}
      >
        ${index + 1}
      </button>
    `;
    }).join("");

    let explanationHtml = "";

    if (revealed) {
        const status = selected === undefined
            ? "미응답"
            : selected === question.answer
                ? "정답"
                : "오답";

        explanationHtml = `
      <div class="explanation">
        <strong>
          ${status} · 정답 ${question.answer + 1}번
        </strong>
        <p>${escapeHtml(question.explanation || "해설이 없습니다.")}</p>
      </div>
    `;
    }

    const practiceButtonHtml =
        false && !revealed
            ? `
        <button id="revealButton" class="full">
          정답 및 해설 확인
        </button>
      `
            : "";

    app.innerHTML = `
    <div class="row">
      <h1>${finished ? "정답 및 해설" : "파이팅"}</h1>
      <div id="timer" class="timer"></div>
    </div>

    <div class="progress">
      <span style="width:${answeredCount() / exam.length * 100}%"></span>
    </div>

    <div class="layout">
      <section class="card">
        <div class="row">
          <span class="tag">
            ${escapeHtml(question.category)}
            · 원본 ${question.number}번
          </span>

          <button id="flagButton">
            ${flags[question.id] ? "★ 표시됨" : "☆ 나중에 확인"}
          </button>
        </div>

        <h2 class="question">
          ${currentIndex + 1}. ${escapeHtml(question.question)}
        </h2>

        <div>
          ${optionsHtml}
        </div>

        ${practiceButtonHtml}
        ${explanationHtml}

        <div class="actions">
          <button
            id="previousButton"
            ${previousIndex === undefined ? "disabled" : ""}
          >
            이전
          </button>

          <a href="source.pdf" target="_blank" rel="noopener">
            원본 확인
          </a>

          <button
            id="nextButton"
            ${finished && nextIndex === undefined ? "disabled" : ""}
          >
            ${nextIndex === undefined && !finished ? "완료 / 미응답 확인" : "다음 문제"}
          </button>
        </div>
      </section>

      <aside class="card">
        <h2>${reviewOnlyWrong ? "오답 문제" : "문제 이동"}</h2>

        <p class="muted small">
          ${answeredCount()} / ${exam.length}문제 응답
          · 노란 밑줄: 검토 표시
        </p>

        <div class="numbers">
          ${navigationHtml}
        </div>

        <button id="submitButton" class="primary full">
          ${finished ? "결과 보기" : "제출 및 채점"}
        </button>

        <button id="homeButton" class="full">
          처음으로
        </button>
      </aside>
    </div>
  `;

    updateTimer();

    document.querySelectorAll("[data-option]").forEach((button) => {
        button.onclick = () => {
            if (finished || practiceRevealed[question.id] || (chosenMode !== "exam" && answers[question.id] !== undefined)) {
                return;
            }

            if (deadline !== null && Date.now() >= deadline) {
                finishExam();
                return;
            }

            answers[question.id] = Number(button.dataset.option);
            if (instantFeedback) {
              practiceRevealed[question.id] = true;
              showQuestion();
            } else {
              advanceQuestion();
            }
        };
    });

    document.querySelectorAll("[data-question]").forEach((button) => {
        button.onclick = () => {
            currentIndex = Number(button.dataset.question);
            showQuestion();
        };
    });

    document.getElementById("flagButton").onclick = () => {
        flags[question.id] = !flags[question.id];
        showQuestion();
    };

    document.getElementById("previousButton").onclick = () => {
        if (previousIndex !== undefined) {
            currentIndex = previousIndex;
            showQuestion();
        }
    };

    document.getElementById("nextButton").onclick = () => {
        if (!finished) { advanceQuestion(); return; }
        if (nextIndex !== undefined) {
            currentIndex = nextIndex;
            showQuestion();
        }
    };

    const revealButton = document.getElementById("revealButton");

    if (revealButton) {
        revealButton.onclick = () => {
            if (deadline !== null && Date.now() >= deadline) {
                finishExam();
                return;
            }

            if (answers[question.id] === undefined) {
                alert("먼저 답을 선택해 주세요.");
                return;
            }

            practiceRevealed[question.id] = true;
            showQuestion();
        };
    }

    document.getElementById("submitButton").onclick = () => {
        if (finished) {
            showResult();
            return;
        }

        const unanswered = exam.length - answeredCount();
        const message = unanswered > 0
            ? `${unanswered}문제가 미응답입니다. 제출할까요?`
            : "답안을 제출할까요?";

        if (confirm(message)) {
            finishExam();
        }
    };

    document.getElementById("homeButton").onclick = () => {
        if (finished || confirm("현재 시험을 종료할까요?")) {
            showHome();
        }
    };
}

function finishExam() {
    if (finished) {
        return;
    }

    finished = true;
    stopTimer();

    const incorrectQuestions = exam.filter(isWrong);
    const testedIds = new Set(exam.map((question) => question.id));

    wrongIds = [
        ...new Set([
            ...wrongIds.filter((id) => !testedIds.has(id)),
            ...incorrectQuestions.map((question) => question.id)
        ])
    ];

    writeStorage("metal-wrong", wrongIds);

    const correctCount = exam.length - incorrectQuestions.length;
    const score = Math.round(correctCount / exam.length * 100);

    history.unshift({
        date: new Date().toLocaleString("ko-KR"),
        total: exam.length,
        score
    });

    history = history.slice(0, 20);
    writeStorage("metal-history", history);

    showResult();
    window.scrollTo(0, 0);
}

function showResult() {
    const correctCount = exam.filter(
        (question) => answers[question.id] === question.answer
    ).length;

    const score = Math.round(correctCount / exam.length * 100);
    const unanswered = exam.length - answeredCount();
    const incorrectCount = exam.length - correctCount;

    app.innerHTML = `
    <section class="card result">
      <h1>시험 결과</h1>

      <div class="score">${score}점</div>

      <p>
        총 ${exam.length}문제 중
        <strong>${correctCount}문제 정답</strong>
      </p>

      <p class="muted">
        오답 ${incorrectCount - unanswered}문제
        · 미응답 ${unanswered}문제
      </p>

      <div class="result-actions">
        <button id="allReviewButton" class="primary">
          전체 해설
        </button>

        <button
          id="wrongReviewButton"
          ${incorrectCount === 0 ? "disabled" : ""}
        >
          오답 해설
        </button>

        <button id="resultHomeButton">
          처음으로
        </button>
      </div>

      <p class="muted small">
        시험 기록과 오답은 이 브라우저에 저장됩니다.
      </p>
    </section>
  `;

    document.getElementById("allReviewButton").onclick = () => {
        reviewOnlyWrong = false;
        currentIndex = 0;
        showQuestion();
    };

    document.getElementById("wrongReviewButton").onclick = () => {
        const firstWrongIndex = exam.findIndex(isWrong);

        if (firstWrongIndex === -1) {
            return;
        }

        reviewOnlyWrong = true;
        currentIndex = firstWrongIndex;
        showQuestion();
    };

    document.getElementById("resultHomeButton").onclick = showHome;
}

document.getElementById("shareButton").onclick = async () => {
    try {
        await navigator.clipboard.writeText(location.href);
        alert("링크를 복사했습니다.");
    } catch {
        prompt("아래 링크를 복사하세요.", location.href);
    }
};

window.addEventListener("beforeunload", (event) => {
    if (sessionStarted && !finished) {
        event.preventDefault();
        event.returnValue = "";
    }
});

document.addEventListener("visibilitychange", () => {
    if (
        !document.hidden &&
        sessionStarted &&
        !finished &&
        deadline !== null &&
        Date.now() >= deadline
    ) {
        finishExam();
    }
});

async function loadQuestions() {
    try {
        const response = await fetch("questions.json");

        if (!response.ok) {
            throw new Error("문제 파일을 불러오지 못했습니다.");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("문제 데이터 형식이 올바르지 않습니다.");
        }

        bank = data.filter((question) => (
            typeof question.id === "string" &&
            typeof question.question === "string" &&
            typeof question.category === "string" &&
            Array.isArray(question.options) &&
            question.options.length === 4 &&
            Number.isInteger(question.answer) &&
            question.answer >= 0 &&
            question.answer <= 3
        ));

        if (!bank.length) {
            throw new Error("출제 가능한 문제가 없습니다.");
        }

        const validIds = new Set(bank.map((question) => question.id));
        wrongIds = wrongIds.filter((id) => validIds.has(id));

        showHome();
    } catch (error) {
        app.innerHTML = `
      <section class="card">
        <h1>문제를 불러오지 못했습니다.</h1>
        <p>${escapeHtml(error.message)}</p>
        <p>
          questions.json이 같은 폴더에 있는지 확인하고,
          http://localhost:8000으로 접속해 주세요.
        </p>
        <button id="retryButton">다시 시도</button>
      </section>
    `;

        document.getElementById("retryButton").onclick = loadQuestions;
    }
}

loadQuestions();
