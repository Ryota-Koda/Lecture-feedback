"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const api = window.LectureFeedbackApi;
  const status = document.getElementById("studentStatus");
  const quizLookupForm = document.getElementById("quizLookupForm");
  const loadQuizButton = document.getElementById("loadQuizButton");
  const quizIdInput = document.getElementById("quizId");
  const quizSection = document.getElementById("studentQuizSection");
  const answerForm = document.getElementById("answerForm");
  const submitButton = document.getElementById("submitAnswersButton");
  const resultSection = document.getElementById("studentResultSection");
  let currentQuiz = null;

  quizLookupForm.addEventListener("submit", loadQuiz);
  answerForm.addEventListener("submit", submitAnswers);

  const sharedQuizId = new URLSearchParams(window.location.search).get("quiz_id");
  if (sharedQuizId) {
    quizIdInput.value = sharedQuizId;
    loadQuiz();
  }

  async function loadQuiz(event) {
    if (event) {
      event.preventDefault();
    }

    const quizId = quizIdInput.value.trim();
    if (!quizId) {
      api.showStatus(status, "quiz_idを入力してください。", "error");
      quizIdInput.focus();
      return;
    }

    api.setButtonBusy(loadQuizButton, true, "読み込んでいます…");
    api.showStatus(status, "小テストを読み込んでいます。", "loading");

    try {
      const quiz = await api.call({
        action: "get_quiz",
        quiz_id: quizId
      });

      currentQuiz = quiz;
      renderQuiz(quiz);
      api.showStatus(status, "小テストを読み込みました。すべての問題に回答してください。", "success");
      quizSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      currentQuiz = null;
      quizSection.hidden = true;
      resultSection.hidden = true;
      api.showStatus(status, error.message, "error");
    } finally {
      api.setButtonBusy(loadQuizButton, false);
    }
  }

  function renderQuiz(quiz) {
    document.getElementById("studentQuizTitle").textContent = quiz.title || "無題の小テスト";
    document.getElementById("quizQuestionCount").textContent = `${(quiz.questions || []).length}問`;

    const container = document.getElementById("studentQuizQuestions");
    container.replaceChildren();

    (quiz.questions || []).forEach((question, index) => {
      const fieldset = api.createElement("fieldset", "question-card");
      fieldset.dataset.questionId = question.question_id;

      const legend = document.createElement("legend");
      legend.className = "question-heading";
      legend.appendChild(api.createElement("span", "question-number", `問${index + 1}`));
      legend.appendChild(api.createElement("span", "", question.question));
      fieldset.appendChild(legend);

      const choices = api.createElement("div", "choice-list");
      (question.choices || []).forEach((choice, choiceIndex) => {
        const label = api.createElement("label", "choice-option");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = question.question_id;
        radio.value = String(choiceIndex);
        radio.required = true;

        label.appendChild(radio);
        label.appendChild(api.createElement("span", "choice-letter", api.choiceLetter(choiceIndex)));
        label.appendChild(api.createElement("span", "", choice));
        choices.appendChild(label);
      });

      fieldset.appendChild(choices);
      container.appendChild(fieldset);
    });

    answerForm.reset();
    document.getElementById("studentId").disabled = false;
    document.getElementById("studentName").disabled = false;
    submitButton.textContent = "回答を送信";
    delete submitButton.dataset.originalLabel;
    submitButton.disabled = false;
    resultSection.hidden = true;
    quizSection.hidden = false;
  }

  async function submitAnswers(event) {
    event.preventDefault();

    if (!currentQuiz) {
      api.showStatus(status, "先に小テストを読み込んでください。", "error");
      return;
    }

    const studentId = document.getElementById("studentId").value.trim();
    if (!studentId) {
      api.showStatus(status, "学生IDを入力してください。", "error");
      document.getElementById("studentId").focus();
      return;
    }

    const answers = {};
    let firstUnanswered = null;

    currentQuiz.questions.forEach((question) => {
      const selected = document.querySelector(`input[name="${cssEscape(question.question_id)}"]:checked`);
      if (selected) {
        answers[question.question_id] = Number(selected.value);
      } else if (!firstUnanswered) {
        firstUnanswered = document.querySelector(`[data-question-id="${cssEscape(question.question_id)}"]`);
      }
    });

    if (firstUnanswered) {
      api.showStatus(status, "未回答の問題があります。すべての問題に回答してください。", "error");
      firstUnanswered.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    api.setButtonBusy(submitButton, true, "回答を送信しています…");
    api.showStatus(status, "回答を送信して採点しています。", "loading");

    try {
      const result = await api.call({
        action: "submit_answer",
        quiz_id: currentQuiz.quiz_id,
        student_id: studentId,
        student_name: document.getElementById("studentName").value.trim(),
        answers
      });

      renderResult(result);
      lockAnswerForm();
      api.showStatus(status, "回答を送信しました。採点結果を確認してください。", "success");
      resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      api.showStatus(status, error.message, "error");
    } finally {
      if (!resultSection.hidden) {
        submitButton.textContent = "回答済み";
        submitButton.disabled = true;
        submitButton.removeAttribute("aria-busy");
      } else {
        api.setButtonBusy(submitButton, false);
      }
    }
  }

  function renderResult(result) {
    const score = Number(result.score || 0);
    const maxScore = Number(result.max_score || 0);
    const rate = maxScore > 0 ? score / maxScore : 0;

    document.getElementById("studentScore").textContent = String(score);
    document.getElementById("studentMaxScore").textContent = String(maxScore);
    document.getElementById("studentResultMessage").textContent = resultMessage(rate);

    const detailsContainer = document.getElementById("studentAnswerDetails");
    detailsContainer.replaceChildren();

    (result.details || []).forEach((detail, index) => {
      const question = currentQuiz.questions.find(
        (item) => item.question_id === detail.question_id
      );
      const card = api.createElement(
        "article",
        `answer-detail ${detail.is_correct ? "correct" : "incorrect"}`
      );
      card.appendChild(api.createElement(
        "h3",
        "",
        `問${index + 1} ${detail.is_correct ? "正解" : "不正解"}：${question ? question.question : detail.question_id}`
      ));

      const selectedText = answerText(question, detail.selected_answer);
      const correctText = answerText(question, detail.correct_answer);
      card.appendChild(resultLine("あなたの回答", selectedText));
      if (!detail.is_correct) {
        card.appendChild(resultLine("正解", correctText));
      }
      card.appendChild(resultLine("解説", detail.explanation || "解説はありません。"));
      detailsContainer.appendChild(card);
    });

    resultSection.hidden = false;
  }

  function resultLine(label, text) {
    const line = document.createElement("p");
    line.appendChild(api.createElement("span", "answer-result-label", `${label}：`));
    line.appendChild(document.createTextNode(text));
    return line;
  }

  function answerText(question, answerIndex) {
    const index = Number(answerIndex);
    if (!question || !Number.isInteger(index) || !question.choices[index]) {
      return "未回答";
    }
    return `${api.choiceLetter(index)}. ${question.choices[index]}`;
  }

  function resultMessage(rate) {
    if (rate === 1) {
      return "全問正解です。よく理解できています。";
    }
    if (rate >= 0.7) {
      return "よくできました。間違えた問題の解説も確認しましょう。";
    }
    if (rate >= 0.4) {
      return "解説を確認して、理解が不十分な部分を復習しましょう。";
    }
    return "講義資料と解説を見直し、もう一度内容を確認しましょう。";
  }

  function lockAnswerForm() {
    answerForm.querySelectorAll("input").forEach((input) => {
      input.disabled = true;
    });
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(String(value));
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }
});
