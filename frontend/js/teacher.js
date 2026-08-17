"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const api = window.LectureFeedbackApi;
  const status = document.getElementById("teacherStatus");
  const createForm = document.getElementById("createQuizForm");
  const generateButton = document.getElementById("generateButton");
  const sourceTypeInputs = document.querySelectorAll("input[name='sourceType']");
  const textSourcePanel = document.getElementById("textSourcePanel");
  const pdfSourcePanel = document.getElementById("pdfSourcePanel");
  const lectureText = document.getElementById("lectureText");
  const pdfFile = document.getElementById("pdfFile");
  const generatedSection = document.getElementById("generatedQuizSection");
  const resultsForm = document.getElementById("resultsForm");
  const resultsQuizId = document.getElementById("resultsQuizId");
  const refreshResultsButton = document.getElementById("refreshResultsButton");
  let latestQuiz = null;

  sourceTypeInputs.forEach((input) => {
    input.addEventListener("change", updateSourcePanel);
  });

  createForm.addEventListener("submit", generateQuiz);
  resultsForm.addEventListener("submit", loadResults);
  document.getElementById("copyShareUrlButton").addEventListener("click", copyShareUrl);

  const queryQuizId = new URLSearchParams(window.location.search).get("quiz_id");
  const savedQuizId = readSavedQuizId();
  if (queryQuizId || savedQuizId) {
    resultsQuizId.value = queryQuizId || savedQuizId;
  }

  updateSourcePanel();

  function updateSourcePanel() {
    const selected = document.querySelector("input[name='sourceType']:checked");
    const usePdf = selected && selected.value === "pdf";

    textSourcePanel.hidden = usePdf;
    pdfSourcePanel.hidden = !usePdf;
    lectureText.required = !usePdf;
    pdfFile.required = usePdf;
  }

  async function generateQuiz(event) {
    event.preventDefault();

    if (!createForm.reportValidity()) {
      return;
    }

    const title = document.getElementById("lectureTitle").value.trim();
    const numQuestions = Number(document.getElementById("numQuestions").value);
    const sourceType = document.querySelector("input[name='sourceType']:checked").value;

    api.clearStatus(status);
    api.setButtonBusy(generateButton, true, "小テストを生成しています…");
    api.showStatus(
      status,
      sourceType === "pdf"
        ? "PDFを読み込み、小テストを生成しています。少し時間がかかる場合があります。"
        : "講義テキストから小テストを生成しています。",
      "loading"
    );

    try {
      let payload;

      if (sourceType === "pdf") {
        const file = pdfFile.files[0];
        if (!file) {
          throw new Error("PDFファイルを選択してください。");
        }
        if (file.size > api.config.MAX_PDF_BYTES) {
          const maxMb = Math.floor(api.config.MAX_PDF_BYTES / (1024 * 1024));
          throw new Error(`PDFは${maxMb}MB以下のファイルを使用してください。`);
        }

        const pdfBase64 = await api.readFileAsBase64(file);
        payload = {
          action: "upload_pdf_and_generate_quiz",
          title,
          filename: file.name,
          pdf_base64: pdfBase64,
          num_questions: numQuestions,
          max_chars: 8000
        };
      } else {
        const sourceText = lectureText.value.trim();
        if (!sourceText) {
          throw new Error("講義テキストを入力してください。");
        }

        payload = {
          action: "generate_quiz",
          title,
          lecture_text: sourceText,
          num_questions: numQuestions
        };
      }

      const quiz = await api.call(payload);
      latestQuiz = quiz;
      renderGeneratedQuiz(quiz);
      saveQuizId(quiz.quiz_id);
      api.showStatus(status, "小テストを生成しました。内容を確認して学生用URLを共有してください。", "success");
      generatedSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      api.showStatus(status, error.message, "error");
    } finally {
      api.setButtonBusy(generateButton, false);
    }
  }

  function renderGeneratedQuiz(quiz) {
    document.getElementById("generatedTitle").textContent = quiz.title || "無題の小テスト";
    document.getElementById("generatedQuizId").textContent = quiz.quiz_id || "";
    resultsQuizId.value = quiz.quiz_id || "";

    const studentUrl = new URL("student.html", window.location.href);
    studentUrl.searchParams.set("quiz_id", quiz.quiz_id);
    document.getElementById("studentShareUrl").value = studentUrl.href;
    document.getElementById("openStudentPageLink").href = studentUrl.href;
    document.getElementById("copyFeedback").textContent = "";

    const preview = document.getElementById("teacherQuizPreview");
    preview.replaceChildren();

    (quiz.questions || []).forEach((question, index) => {
      const card = api.createElement("article", "question-card");
      const heading = api.createElement("div", "question-heading");
      heading.appendChild(api.createElement("span", "question-number", `問${index + 1}`));
      heading.appendChild(api.createElement("h3", "", question.question));
      card.appendChild(heading);

      const choices = api.createElement("ul", "choice-list");
      (question.choices || []).forEach((choice, choiceIndex) => {
        const isCorrect = Number(question.correct_answer) === choiceIndex;
        const item = api.createElement("li", `choice-item${isCorrect ? " correct-choice" : ""}`);
        item.appendChild(api.createElement("span", "choice-letter", api.choiceLetter(choiceIndex)));
        item.appendChild(api.createElement("span", "", choice));
        if (isCorrect) {
          item.appendChild(api.createElement("strong", "", "（正解）"));
        }
        choices.appendChild(item);
      });
      card.appendChild(choices);

      const explanation = question.explanation || "解説はありません。";
      card.appendChild(api.createElement("p", "teacher-explanation", `解説：${explanation}`));
      preview.appendChild(card);
    });

    generatedSection.hidden = false;
  }

  async function copyShareUrl() {
    const shareInput = document.getElementById("studentShareUrl");
    const feedback = document.getElementById("copyFeedback");

    try {
      await navigator.clipboard.writeText(shareInput.value);
      feedback.textContent = "学生用URLをコピーしました。";
    } catch (_error) {
      shareInput.focus();
      shareInput.select();
      const copied = document.execCommand("copy");
      feedback.textContent = copied
        ? "学生用URLをコピーしました。"
        : "コピーできませんでした。URLを選択して手動でコピーしてください。";
    }
  }

  async function loadResults(event) {
    event.preventDefault();

    if (!resultsForm.reportValidity()) {
      return;
    }

    const quizId = resultsQuizId.value.trim();
    api.setButtonBusy(refreshResultsButton, true, "結果を分析しています…");
    api.showStatus(status, "回答結果を集計し、講義分析を生成しています。", "loading");

    try {
      const results = await api.call({
        action: "get_results",
        quiz_id: quizId
      });

      renderResults(results);
      saveQuizId(quizId);
      api.showStatus(
        status,
        results.num_submissions > 0
          ? "最新の回答結果を表示しました。"
          : "小テストは見つかりましたが、まだ回答はありません。",
        "success"
      );
    } catch (error) {
      api.showStatus(status, error.message, "error");
    } finally {
      api.setButtonBusy(refreshResultsButton, false);
    }
  }

  function renderResults(results) {
    const generatedQuestionCount = latestQuiz && latestQuiz.quiz_id === results.quiz_id
      ? (latestQuiz.questions || []).length
      : 0;
    const maxScore = Number(results.max_score || generatedQuestionCount || 0);
    const averageScore = Number(results.average_score || 0);
    const averageAccuracy = maxScore > 0 ? (averageScore / maxScore) * 100 : 0;

    document.getElementById("submissionCount").textContent = `${Number(results.num_submissions || 0)}人`;
    document.getElementById("averageScore").textContent = maxScore > 0
      ? `${averageScore.toFixed(1)} / ${maxScore}`
      : "—";
    document.getElementById("averageAccuracy").textContent = `${Math.round(averageAccuracy)}%`;

    renderQuestionStats(results.question_stats || []);
    renderStudentScores(results.student_scores || []);
    document.getElementById("analysisText").textContent = results.analysis || "分析結果はありません。";

    document.getElementById("resultsEmpty").hidden = true;
    document.getElementById("resultsContent").hidden = false;
  }

  function renderQuestionStats(stats) {
    const container = document.getElementById("questionStats");
    container.replaceChildren();

    if (stats.length === 0) {
      container.appendChild(api.createElement("p", "field-note", "回答が集まると問題ごとの正答率が表示されます。"));
      return;
    }

    stats.forEach((stat, index) => {
      const accuracy = Math.max(0, Math.min(1, Number(stat.accuracy || 0)));
      const percent = Math.round(accuracy * 100);
      const row = api.createElement("div", "stat-row");
      const header = api.createElement("div", "stat-header");
      header.appendChild(api.createElement("span", "stat-question", `問${index + 1} ${stat.question || ""}`));
      header.appendChild(api.createElement("span", "stat-percent", `${percent}%`));
      row.appendChild(header);

      const track = api.createElement("div", "progress-track");
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(percent));
      track.setAttribute("aria-label", `問${index + 1}の正答率`);
      const bar = api.createElement("div", "progress-bar");
      bar.style.width = `${percent}%`;
      track.appendChild(bar);
      row.appendChild(track);
      container.appendChild(row);
    });
  }

  function renderStudentScores(scores) {
    const tbody = document.getElementById("studentScores");
    tbody.replaceChildren();

    if (scores.length === 0) {
      const row = document.createElement("tr");
      const cell = api.createElement("td", "", "まだ回答がありません。");
      cell.colSpan = 4;
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    scores.forEach((score) => {
      const row = document.createElement("tr");
      row.appendChild(api.createElement("td", "", score.student_id || "—"));
      row.appendChild(api.createElement("td", "", score.student_name || "—"));
      row.appendChild(api.createElement("td", "", `${Number(score.score || 0)} / ${Number(score.max_score || 0)}`));
      row.appendChild(api.createElement("td", "", api.formatDate(score.submitted_at)));
      tbody.appendChild(row);
    });
  }

  function saveQuizId(quizId) {
    if (!quizId) {
      return;
    }
    try {
      window.localStorage.setItem("lectureFeedbackLastQuizId", quizId);
    } catch (_error) {
      // The app still works when local storage is unavailable.
    }
  }

  function readSavedQuizId() {
    try {
      return window.localStorage.getItem("lectureFeedbackLastQuizId") || "";
    } catch (_error) {
      return "";
    }
  }
});
